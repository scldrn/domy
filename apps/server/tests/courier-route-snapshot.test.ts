import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, snapshot } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction } from "./setup/routes.ts";

/**
 * The snapshot the phone keeps is read at one instant (DATA-2, FR-005, FR-022): its route,
 * handovers, custody, notices and summary come from one read-only REPEATABLE READ transaction.
 */

let database: TestDatabase;
let catalog: Catalog;

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
});

/** The database, recording the configuration of every transaction it opens. */
function recordingTransactions(db: Db) {
  const configs: unknown[] = [];
  const proxy = new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "transaction") return Reflect.get(target, property, receiver) as unknown;
      return (...args: Parameters<Db["transaction"]>) => {
        configs.push(args[1] ?? null);
        return target.transaction(...args);
      };
    },
  });
  return { db: proxy, configs };
}

describe("the courier's snapshot (DATA-2)", () => {
  it("reads every part in one read-only repeatable-read transaction", async () => {
    const recording = recordingTransactions(database.db);
    const t = createTestApp(recording.db, { now: "2026-10-01T15:00:00Z" });
    const owner = await t.signIn("owner");
    catalog = await createCatalog(database.db, owner.user.id);
    const { cookie } = await t.signIn("dispatcher");
    const courier = await courierWithAccount(t, database.db);
    const shipment = await registerShipment(t, cookie, catalog, {
      paymentMode: "merchant_account",
      codAmount: 0,
    });
    const route = await createRoute(t, cookie, {
      shipmentIds: [shipment.id],
      courierId: courier.id,
    });
    expect((await routeAction(t, cookie, route, "/dispatch")).status).toBe(200);
    recording.configs.length = 0;

    const response = await snapshot(t, courier);

    expect(response.status).toBe(200);
    expect(response.body.route?.stops.length).toBeGreaterThan(0);
    expect(recording.configs).toContainEqual({
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
  });
});
