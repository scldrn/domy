import { serve } from "@hono/node-server";
import { randomBytes } from "node:crypto";
import { connect } from "node:net";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../src/app.ts";
import type { Db } from "../src/db/client.ts";
import { setErrorReporter } from "../src/lib/errors.ts";
import { createLogger } from "../src/lib/logger.ts";
import type { PhotoStorage } from "../src/lib/storage.ts";
import { createTestApp } from "./setup/app.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

const publicErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const publicWebFixture = fileURLToPath(new URL("./fixtures/public-protection", import.meta.url));
const testStorage: PhotoStorage = {
  putPhoto: () => Promise.reject(new Error("Unexpected photo write in public protection test")),
  getPhoto: () => Promise.reject(new Error("Unexpected photo read in public protection test")),
  deletePhoto: () => Promise.resolve(),
  ensureBucket: () => Promise.resolve(),
};

let database: TestDatabase;

function createTrustedProxyTestApp(db: Db, trustedProxyIp: string, monotonicNow: () => number) {
  const logger = createLogger("silent");
  return createApp({
    db,
    authConfig: {
      secret: "test-secret-with-at-least-thirty-two-characters",
      baseUrl: "http://localhost:3000",
      sendResetPassword: () => Promise.resolve(),
    },
    clock: () => new Date("2026-10-01T15:00:00.000Z"),
    logger,
    publicBaseUrl: "http://localhost:5173",
    storage: testStorage,
    monotonicNow,
    trustedProxyIp,
  });
}

beforeAll(async () => {
  database = await startDatabase();
});

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.truncate();
});

afterEach(() => {
  setErrorReporter(null);
});

function expectPublicHeaders(response: Response): void {
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  expect(
    cacheControl.split(",").some((directive) => directive.trim() === "no-store"),
    "public responses must opt out of storage",
  ).toBe(true);
  expect(response.headers.get("x-robots-tag")?.toLowerCase() ?? "").toContain("noindex");
}

async function readPublicError(response: Response) {
  expect(response.headers.get("content-type") ?? "").toMatch(/application\/json/iu);
  return publicErrorSchema.parse(await response.json());
}

async function withNativeServer<Result>(
  app: ReturnType<typeof createTestApp>["app"],
  action: (origin: string) => Promise<Result>,
): Promise<Result> {
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected loopback listener");
    return await action(`http://127.0.0.1:${String(address.port)}`);
  } finally {
    if ("closeAllConnections" in server) server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      }),
    );
  }
}

function requestWithDuplicateClientIp(origin: string, path: string): Promise<number> {
  const target = new URL(origin);
  return new Promise((resolve, reject) => {
    const socket = connect({ host: target.hostname, port: Number(target.port) });
    const chunks: string[] = [];
    socket.setTimeout(10_000);
    socket.once("connect", () => {
      socket.write(
        [
          `GET ${path} HTTP/1.1`,
          `Host: ${target.host}`,
          "X-Domy-Client-IP: 198.51.100.7",
          "X-Domy-Client-IP: 198.51.100.7",
          "Connection: close",
          "",
          "",
        ].join("\r\n"),
      );
    });
    socket.on("data", (chunk: Buffer) => chunks.push(chunk.toString("utf8")));
    socket.once("timeout", () => socket.destroy(new Error("Duplicate-header request timed out")));
    socket.once("error", reject);
    socket.once("end", () => {
      const firstLine = chunks.join("").split("\r\n", 1)[0];
      const statusCode = firstLine
        ? /^HTTP\/1\.[01] ([0-9]{3})(?: [\x20-\x7e]*)?$/u.exec(firstLine)?.[1]
        : undefined;
      if (statusCode === undefined) {
        reject(new Error("Duplicate-header request returned no HTTP status"));
        return;
      }
      resolve(Number(statusCode));
    });
  });
}

describe("public boundary protections (FR-011, FR-012, R14)", () => {
  it("serves an unknown public tracking link anonymously with one uniform response", async () => {
    const code = randomBytes(16).toString("base64url");
    const t = createTestApp(database.db);

    await withNativeServer(t.app, async (origin) => {
      const response = await fetch(`${origin}/api/public/tracking/${code}`);
      expect(response.status).toBe(404);
      expectPublicHeaders(response);
      const { error } = await readPublicError(response);
      expect(error).toEqual({ code: "link_not_found", message: "Este enlace no es válido" });
    });
  });

  it("keeps no-store and noindex on unknown public API and photo responses", async () => {
    const code = randomBytes(16).toString("base64url");
    const photoId = crypto.randomUUID();
    const t = createTestApp(database.db);
    const paths = [
      `/api/public/tracking/${code}`,
      `/api/public/merchant/${code}?date=2026-10-01`,
      `/api/public/merchant/${code}/photos/${photoId}`,
    ];

    await withNativeServer(t.app, async (origin) => {
      for (const path of paths) {
        const response = await fetch(`${origin}${path}`);
        expect(response.status).toBe(404);
        expectPublicHeaders(response);
        await response.arrayBuffer();
      }
    });
  });

  it("keeps unknown public API requests JSON when the web app is mounted", async () => {
    const code = randomBytes(16).toString("base64url");
    const t = createTestApp(database.db, { webDist: publicWebFixture });

    await withNativeServer(t.app, async (origin) => {
      const response = await fetch(`${origin}/api/public/unrecognized/${code}`);
      expect(response.status).toBe(404);
      expectPublicHeaders(response);
      const { error } = await readPublicError(response);
      expect(error).toEqual({ code: "link_not_found", message: "Este enlace no es válido" });
    });
  });

  it("keeps no-store and noindex on an oversized public API request", async () => {
    const code = randomBytes(16).toString("base64url");
    const t = createTestApp(database.db);

    await withNativeServer(t.app, async (origin) => {
      const response = await fetch(`${origin}/api/public/tracking/${code}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "x".repeat(1024 * 1024 + 1),
      });
      expect(response.status).toBe(413);
      expectPublicHeaders(response);
      const { error } = await readPublicError(response);
      expect(error.code).toBe("payload_too_large");
    });
  });

  it("limits the 61st request by native peer despite forged XFF and rolls over monotonically", async () => {
    const code = randomBytes(16).toString("base64url");
    let monotonicTime = 0;
    const t = createTestApp(database.db, { monotonicNow: () => monotonicTime });

    await withNativeServer(t.app, async (origin) => {
      let refused: Response | undefined;
      for (let attempt = 1; attempt <= 61; attempt++) {
        const response = await fetch(`${origin}/api/public/tracking/${code}`, {
          headers: {
            Forwarded: `for=198.51.100.${String(attempt)}`,
            "X-Forwarded-For": `198.51.100.${String(attempt)}`,
            "X-Real-IP": `198.51.100.${String(attempt)}`,
            "X-Domy-Client-IP": `198.51.100.${String(attempt)}`,
          },
        });
        if (attempt < 61) {
          expect(response.status).toBe(404);
          await response.arrayBuffer();
        } else {
          refused = response;
        }
      }

      if (!refused) throw new Error("The 61st request must produce a response");
      expect(refused.status).toBe(429);
      expectPublicHeaders(refused);
      const { error } = await readPublicError(refused);
      expect(error.code).toBe("rate_limited");
      expect(error.message).toMatch(/solicitudes|minuto|intenta|espera/iu);

      monotonicTime += 60_000;
      const afterWindow = await fetch(`${origin}/api/public/tracking/${code}`, {
        headers: {
          Forwarded: "for=203.0.113.61",
          "X-Forwarded-For": "203.0.113.61",
          "X-Real-IP": "203.0.113.61",
          "X-Domy-Client-IP": "203.0.113.61",
        },
      });
      expect(afterWindow.status).toBe(404);
      expectPublicHeaders(afterWindow);
      await afterWindow.arrayBuffer();
    });
  });

  it("uses canonical client IPs only behind the explicitly trusted native peer", async () => {
    let monotonicTime = 0;
    const app = createTrustedProxyTestApp(database.db, "::ffff:127.0.0.1", () => monotonicTime);
    const code = randomBytes(16).toString("base64url");

    await withNativeServer(app, async (origin) => {
      for (let attempt = 1; attempt <= 60; attempt++) {
        const response = await fetch(`${origin}/api/public/tracking/${code}`, {
          headers: {
            Forwarded: `for=203.0.113.${String(attempt)}`,
            "X-Forwarded-For": `203.0.113.${String(attempt)}`,
            "X-Real-IP": `203.0.113.${String(attempt)}`,
            "X-Domy-Client-IP": "198.51.100.7",
          },
        });
        expect(response.status).toBe(404);
        await response.arrayBuffer();
      }

      const duplicateHeader = await requestWithDuplicateClientIp(
        origin,
        `/api/public/tracking/${code}`,
      );
      expect(duplicateHeader).toBe(404);

      const otherClient = await fetch(`${origin}/api/public/tracking/${code}`, {
        headers: {
          Forwarded: "for=203.0.113.7",
          "X-Forwarded-For": "203.0.113.7",
          "X-Real-IP": "203.0.113.7",
          "X-Domy-Client-IP": "198.51.100.8",
        },
      });
      expect(otherClient.status).toBe(404);
      await otherClient.arrayBuffer();

      const limitedClient = await fetch(`${origin}/api/public/tracking/${code}`, {
        headers: {
          Forwarded: "for=203.0.113.8",
          "X-Forwarded-For": "203.0.113.8",
          "X-Real-IP": "203.0.113.8",
          "X-Domy-Client-IP": "198.51.100.7",
        },
      });
      expect(limitedClient.status).toBe(429);
      expectPublicHeaders(limitedClient);
      expect((await readPublicError(limitedClient)).error.code).toBe("rate_limited");

      monotonicTime += 60_000;
      const afterWindow = await fetch(`${origin}/api/public/tracking/${code}`, {
        headers: { "X-Domy-Client-IP": "198.51.100.7" },
      });
      expect(afterWindow.status).toBe(404);
      await afterWindow.arrayBuffer();
    });
  });

  it("marks both public SPA documents no-store and noindex", async () => {
    const code = randomBytes(16).toString("base64url");
    const t = createTestApp(database.db, { webDist: publicWebFixture });

    await withNativeServer(t.app, async (origin) => {
      for (const path of [`/seguimiento/${code}`, `/cliente/${code}`]) {
        const response = await fetch(`${origin}${path}`);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type") ?? "").toMatch(/text\/html/iu);
        expectPublicHeaders(response);
        expect(await response.text()).toContain("public-protection-fixture");
      }
    });
  });

  it("redacts raw, encoded, and malformed bearer paths from useful request/error diagnostics", async () => {
    const code = randomBytes(16).toString("base64url");
    let output = "";
    const reported: Error[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        output += chunk.toString();
        done();
      },
    });
    const t = createTestApp(database.db, { logger: createLogger("debug", sink) });
    t.app.get("/api/public/test-error/:code", (c) => {
      throw new TypeError(c.req.param("code"));
    });
    setErrorReporter((error) => reported.push(error));
    const first = code[0];
    if (!first) throw new Error("A generated public test code cannot be empty");
    const encodedCode = `%${first.charCodeAt(0).toString(16).padStart(2, "0")}${code.slice(1)}`;
    const malformedCode = `${code.slice(0, 8)}%ZZ${code.slice(8)}`;

    await withNativeServer(t.app, async (origin) => {
      const errorResponse = await fetch(`${origin}/api/public/test-error/${code}`);
      expect(errorResponse.status).toBe(500);
      expectPublicHeaders(errorResponse);
      expect((await errorResponse.text()).includes(code)).toBe(false);

      for (const path of [
        `/api/public/tracking/${code}`,
        `/api/public/tracking/${encodedCode}`,
        `/api/public/tracking/${malformedCode}`,
      ]) {
        const response = await fetch(`${origin}${path}`);
        await response.arrayBuffer();
      }
    });

    expect(output.includes(code), "request and error logs must omit the bearer code").toBe(false);
    expect(output.includes(encodedCode), "request logs must omit the encoded bearer code").toBe(
      false,
    );
    expect(output.includes(malformedCode), "request logs must omit the malformed bearer code").toBe(
      false,
    );
    expect(output).toContain('"msg":"request"');
    expect(output).toContain('"msg":"unhandled error"');
    expect(output).toContain('"status":500');
    expect(output).toContain('"path":"/api/public/test-error/:code"');
    expect(reported).toHaveLength(1);
    const error = reported[0];
    if (!error) throw new Error("The test error must reach the sanitized reporter");
    expect(`${error.message}\n${error.stack ?? ""}`).not.toContain(code);
  });
});
