import { serve } from "@hono/node-server";
import { Writable } from "node:stream";
import { copyFileSync, mkdtempSync, rmSync, symlinkSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError, errorForLog, setErrorReporter } from "../src/lib/errors.ts";
import { createMailer } from "../src/lib/email.ts";
import { createLogger } from "../src/lib/logger.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});

describe("logs (FR-041)", () => {
  it("omits arbitrary native path, header, query and body markers from request logs (OP-01)", async () => {
    const marker = crypto.randomUUID();
    let output = "";
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        output += chunk.toString();
        done();
      },
    });
    const t = createTestApp(database.db, { logger: createLogger("debug", sink) });
    const server = serve({ fetch: t.app.fetch, hostname: "127.0.0.1", port: 0 });
    await new Promise<void>((resolve) => server.once("listening", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected native listener");
      const origin = `http://127.0.0.1:${String(address.port)}`;
      const headers = {
        "X-Request-Id": marker,
        authorization: `Bearer ${marker}`,
        cookie: `synthetic=${marker}`,
        "content-type": "text/plain",
      };
      const missing = await fetch(`${origin}/missing/${marker}?q=${marker}`, {
        method: "POST",
        headers,
        body: marker,
      });
      await missing.arrayBuffer();
      expect(missing.status).toBe(404);
      const health = await fetch(`${origin}/health/live?q=${marker}`, { headers });
      await health.arrayBuffer();
      expect(health.status).toBe(200);
      expect(health.headers.get("x-request-id") === marker).toBe(false);
      expect(output.includes(marker), "native log markers must be absent").toBe(false);
      expect(output).toContain('"path":"/health/live"');
      expect(output).toContain('"msg":"request"');
    } finally {
      if ("closeAllConnections" in server) server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        }),
      );
    }
  });
  beforeEach(async () => {
    await database.truncate();
  });

  it("never logs a password recovery token carried in the native callback path (T151)", async () => {
    let output = "";
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        output += chunk.toString();
        done();
      },
    });
    const t = createTestApp(database.db, { logger: createLogger("debug", sink) });
    const owner = await t.signIn("owner");
    const requested = await t.request("/api/auth/request-password-reset", {
      method: "POST",
      body: { email: owner.email, redirectTo: "http://localhost:3000/restablecer-contrasena" },
    });
    expect(requested.status).toBe(200);
    const url = t.emails[0]?.url;
    if (!url) throw new Error("The recovery fixture must receive its native email");
    const token = new URL(url).pathname.split("/").at(-1);
    if (!token) throw new Error("The native callback must carry a token");
    expect((await t.app.request(url)).status).toBe(302);
    for (const variant of [
      url.replace("/reset-password/", "/%72eset-password/"),
      url.replace("/reset-password/", "/RESET-PASSWORD/"),
      url.replace(`/reset-password/${token}`, `/%72eset-password/${token}%FF`),
    ]) {
      expect((await t.app.request(variant)).status).toBe(404);
    }
    // A failed privacy assertion must not print the live token or captured logs.
    expect(output.includes(token), "request logs must omit recovery tokens").toBe(false);
    expect(output).toContain('"msg":"request"');
    expect(output).toContain('"path":"/api/auth/request-password-reset"');
    expect(output).toContain('"path":"/api/auth/reset-password/:token"');
  });

  it("never logs recovery bearer URLs or tokens in development mail fallback (T155)", async () => {
    let output = "";
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        output += chunk.toString();
        done();
      },
    });
    const logger = createLogger("debug", sink);
    const mailer = createMailer({
      nodeEnv: "development",
      apiKey: undefined,
      from: "soporte@domy.test",
      logger,
    });
    const secretToken = "super-secret-bearer-token-12345";
    const bearerUrl = `http://localhost:3000/api/auth/reset-password/${secretToken}?callbackURL=http://localhost:3000/restablecer`;
    await mailer.sendResetPassword({
      email: "recuperacion@domy.test",
      name: "Usuario Recuperación",
      url: bearerUrl,
    });

    expect(
      output.includes(secretToken),
      "development mail fallback must not log bearer tokens",
    ).toBe(false);
    expect(output.includes(bearerUrl), "development mail fallback must not log bearer URLs").toBe(
      false,
    );
    expect(
      output.includes("recuperacion@domy.test"),
      "development mail fallback must not log recipient emails",
    ).toBe(false);
    expect(output).toContain("RESEND_API_KEY");
  });
  it("never contain passwords, cookies, or recipients' data", async () => {
    let output = "";
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        output += chunk.toString();
        done();
      },
    });
    const t = createTestApp(database.db, { logger: createLogger("debug", sink) });
    const owner = await t.signIn("owner");
    const catalog = await createCatalog(database.db, owner.user.id);
    const phone = "3009998877";
    const created = await t.request("/api/shipments", {
      method: "POST",
      cookie: owner.cookie,
      body: {
        id: crypto.randomUUID(),
        kind: "delivery",
        merchantId: catalog.merchant.bullish,
        pickupPointId: catalog.pickup.bullish,
        recipientName: "Rosalba Quintero",
        recipientPhone: phone,
        recipientAddress: "Calle 99 # 77-55",
        recipientNeighborhoodId: catalog.place.laureles,
        paymentMode: "merchant_account",
        fee: 13000,
      },
    });
    expect(created.status).toBe(201);
    await t.request(`/api/shipments/search?q=${phone}`, { cookie: owner.cookie });
    await t.request("/api/auth/sign-in/email", {
      method: "POST",
      body: { email: owner.email, password: "una-contrasena-equivocada" },
    });

    expect(output).toContain('"msg":"request"');
    const cookieValue = owner.cookie.split("=")[1]?.split(";")[0] ?? "";
    for (const secret of [
      owner.password,
      "una-contrasena-equivocada",
      cookieValue,
      phone,
      "Rosalba",
      "Calle 99",
    ]) {
      expect(output).not.toContain(secret);
    }
  });

  it("retains a real unique-violation code without driver text or parameters (T153)", async () => {
    const marker = crypto.randomUUID();
    let failure: unknown;
    try {
      await database.db.transaction(async (tx) => {
        await tx.execute(sql`create temporary table t153_unique (name text primary key)`);
        await tx.execute(sql`insert into t153_unique values (${marker})`);
        await tx.execute(sql`insert into t153_unique values (${marker})`);
      });
    } catch (error) {
      failure = error;
    }
    if (!(failure instanceof Error)) throw new Error("Expected real PostgreSQL violation");
    const logged = errorForLog(failure);
    expect(logged.type).toBe("DatabaseError");
    expect(logged.code).toBe("23505");
    expect(JSON.stringify(logged).includes(marker)).toBe(false);
    expect(JSON.stringify(logged).includes("t153_unique")).toBe(false);
  });

  it("keeps real driver input out of actual request logs and reporting, with rollback (T153)", async () => {
    let output = "";
    const reported: Error[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        output += chunk.toString();
        done();
      },
    });
    const t = createTestApp(database.db, { logger: createLogger("debug", sink) });
    const owner = await t.signIn("owner");
    const catalog = await createCatalog(database.db, owner.user.id);
    const id = crypto.randomUUID();
    const marker = crypto.randomUUID();
    setErrorReporter((error) => reported.push(error));
    try {
      await database.db.execute(sql`
        create function t153_reject_shipment() returns trigger language plpgsql as $$
        begin perform new.recipient_name::integer; return new; end $$`);
      await database.db.execute(sql`
        create trigger t153_reject before insert on shipments
        for each row execute function t153_reject_shipment()`);
      const response = await t.request("/api/shipments", {
        method: "POST",
        cookie: owner.cookie,
        body: {
          id,
          kind: "delivery",
          merchantId: catalog.merchant.bullish,
          pickupPointId: catalog.pickup.bullish,
          recipientName: marker,
          recipientPhone: "3009998877",
          recipientAddress: "Calle 99 # 77-55",
          recipientNeighborhoodId: catalog.place.laureles,
          paymentMode: "merchant_account",
          fee: 13000,
        },
      });
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: {
          code: "internal_error",
          message: "Ocurrió un error inesperado. Intenta de nuevo.",
        },
      });
      const rows = await database.db.execute(sql`select id from shipments where id = ${id}`);
      expect(rows).toHaveLength(0);
      expect(output.includes('"msg":"unhandled error"')).toBe(true);
      expect(output.includes("22P02")).toBe(true);
      expect(output.includes(marker)).toBe(false);
      expect(output.includes("3009998877")).toBe(false);
      expect(reported).toHaveLength(1);
      const error = reported[0];
      if (!error) throw new Error("Reporter was not called");
      expect(error.name).toBe("DatabaseError");
      expect(`${error.message}\n${error.stack ?? ""}`.includes(marker)).toBe(false);
      expect(error.stack?.includes("apps/server/src/")).toBe(true);
      expect(error.cause).toBeUndefined();
    } finally {
      setErrorReporter(null);
      await database.db.execute(sql`drop trigger if exists t153_reject on shipments`);
      await database.db.execute(sql`drop function if exists t153_reject_shipment()`);
    }
  });

  it("projects ordinary exceptions through the actual monolith, without mutable text (T153)", async () => {
    const marker = crypto.randomUUID();
    let output = "";
    const reported: Error[] = [];
    const t = createTestApp(database.db, {
      logger: createLogger(
        "debug",
        new Writable({
          write(chunk: Buffer, _encoding, done) {
            output += chunk.toString();
            done();
          },
        }),
      ),
    });
    const failure = new TypeError(marker, { cause: new Error(marker) });
    failure.name = marker;
    // Test-only route on the real application; no production route or mocked handler.
    t.app.get("/api/test/t153-fault", () => {
      throw failure;
    });
    t.app.get("/api/test/t153-expected", () => {
      throw new AppError("forbidden");
    });
    setErrorReporter((error) => reported.push(error));
    try {
      const response = await t.request("/api/test/t153-fault");
      expect(response.status).toBe(500);
      expect((await response.text()).includes(marker)).toBe(false);
      expect(output.includes('"msg":"unhandled error"')).toBe(true);
      expect(output.includes(marker)).toBe(false);
      expect(reported).toHaveLength(1);
      const error = reported[0];
      if (!error) throw new Error("Reporter was not called");
      expect(error).not.toBe(failure);
      expect(error.name === "TypeError").toBe(true);
      expect(`${error.message}\n${error.stack ?? ""}`.includes(marker)).toBe(false);
      expect(error.cause).toBeUndefined();
      expect(error.stack?.includes("reporting_site")).toBe(true);
      expect((await t.request("/api/test/t153-expected")).status).toBe(403);
      expect(reported).toHaveLength(1);
    } finally {
      setErrorReporter(null);
    }
  });

  it("recognizes a real raw driver error and rejects its invalid mutable code (T153)", async () => {
    const marker = crypto.randomUUID();
    let failure: unknown;
    try {
      await database.db.$client`select ${marker}::integer`;
    } catch (error) {
      failure = error;
    }
    if (!(failure instanceof postgres.PostgresError))
      throw new Error("Expected raw PostgreSQL error");
    expect(errorForLog(failure).code).toBe("22P02");
    Object.defineProperty(failure, "code", { value: marker });
    const logged = errorForLog(failure);
    expect(logged.type).toBe("DatabaseError");
    expect(logged.code).toBeUndefined();
    expect(JSON.stringify(logged).includes(marker)).toBe(false);
  });
});

describe("bounded structural error locations (T153/R14)", () => {
  const source = fileURLToPath(new URL("../src/lib/errors.ts", import.meta.url));
  const projectRelative = "apps/server/src/lib/errors.ts:1:1";

  it("retains only a verified source location, not its function or stack header", () => {
    const marker = crypto.randomUUID();
    const error = new RangeError(marker);
    error.stack = `${marker}\n    at ${marker} (${source}:1:1)`;
    const logged = errorForLog(error);
    expect(logged.type).toBe("RangeError");
    expect(logged.stack.includes(projectRelative)).toBe(true);
    expect(JSON.stringify(logged).includes(marker)).toBe(false);
    expect(logged.stack.includes("reporting_site")).toBe(false);
  });

  it("accepts native bare/file URL locations and shared domain sources", () => {
    // Resolve directly from this test module, independently of production roots.
    const domainSource = new URL("../../../packages/domain/src/fees.ts", import.meta.url);
    for (const location of [
      source,
      new URL("../src/lib/errors.ts", import.meta.url).href,
      domainSource.href,
    ]) {
      const error = new Error("private");
      error.stack = `private\n    at ${location}:1:1`;
      const logged = errorForLog(error);
      expect(logged.stack.includes("reporting_site")).toBe(false);
      expect(logged.stack.includes("source (")).toBe(true);
      expect(JSON.stringify(logged).includes("private")).toBe(false);
    }
  });

  it("bounds stack scanning and fails closed on mutable stack accessors", () => {
    const error = new Error("private");
    error.stack = `private\n${"    at unknown\n".repeat(32)}    at ${source}:1:1`;
    expect(errorForLog(error).stack.includes("reporting_site")).toBe(true);
    error.stack = `private\n${" ".repeat(65_536)}\n    at ${source}:1:1`;
    expect(errorForLog(error).stack.includes("reporting_site")).toBe(true);
    Object.defineProperty(error, "stack", {
      get() {
        throw new Error("private");
      },
    });
    const logged = errorForLog(error);
    expect(logged.stack.includes("reporting_site")).toBe(true);
    expect(JSON.stringify(logged).includes("private")).toBe(false);
  });

  it.each([
    "file://person:secret@localhost/unsafe.ts:1:1",
    "https://example.test/unsafe.ts?token=secret:1:1",
    "file:///private/outside.ts:1:1",
    `${source}?token=secret:1:1`,
    `${source}#secret:1:1`,
    `${source}/../errors.ts:1:1`,
    `${source}.missing.ts:1:1`,
    `${source}:0:1`,
    `${source}:999999999:1`,
    `${source}:1:999999999`,
    "eval at secret (unsafe.ts:1:1)",
  ])("rejects unsafe candidate %s without retaining arbitrary stack content", (candidate) => {
    const error = new Error("private message");
    error.stack = `private header\n    at secret (${candidate})`;
    const logged = errorForLog(error);
    expect(logged.stack.includes("reporting_site")).toBe(true);
    expect(JSON.stringify(logged).includes("secret")).toBe(false);
    expect(JSON.stringify(logged).includes("private")).toBe(false);
  });

  it("rejects final and ancestor symlinks without reading their targets", () => {
    const directory = mkdtempSync(fileURLToPath(new URL("../src/t153-fixture-", import.meta.url)));
    try {
      symlinkSync(source, join(directory, "alias.ts"));
      mkdirSync(join(directory, "real"));
      copyFileSync(source, join(directory, "real", "source.ts"));
      symlinkSync(join(directory, "real"), join(directory, "linked"));
      for (const path of [join(directory, "alias.ts"), join(directory, "linked", "source.ts")]) {
        const error = new Error("private");
        error.stack = `private\n    at (${path}:1:1)`;
        expect(errorForLog(error).stack.includes("reporting_site")).toBe(true);
      }
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  it("does not classify an arbitrary cause as PostgreSQL by duck typing", () => {
    const marker = crypto.randomUUID();
    const error = new Error(marker, { cause: { code: marker, message: marker } });
    const logged = errorForLog(error);
    expect(logged.type).toBe("Error");
    expect(logged.code).toBeUndefined();
    expect(JSON.stringify(logged).includes(marker)).toBe(false);
  });
});
