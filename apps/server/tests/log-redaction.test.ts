import { Writable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorForLog } from "../src/lib/errors.ts";
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

  it("keep only the database's message of a failed query, never its parameters", () => {
    const failure = new Error(
      'Failed query: insert into "shipments" ... \nparams: Rosalba Quintero,3009998877',
      {
        cause: Object.assign(new Error("duplicate key value"), {
          code: "23505",
          constraint_name: "x",
        }),
      },
    );
    const logged = JSON.stringify(errorForLog(failure));
    expect(logged).toContain("23505");
    expect(logged).not.toContain("3009998877");
    expect(logged).not.toContain("Rosalba");
  });
});
