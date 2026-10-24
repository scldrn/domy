import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { courierRecords } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction } from "./setup/routes.ts";

/** Robustness of `POST /api/courier/records` (ROB-5, C003-4; contracts/http-api.md). */

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;
let courier: CourierAccount;

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
  courier = await courierWithAccount(t, database.db);
});

const unrouted = () =>
  registerShipment(t, cookie, catalog, { paymentMode: "merchant_account", codAmount: 0 });

async function shipmentOnRoute() {
  const shipment = await unrouted();
  const route = await createRoute(t, cookie, { shipmentIds: [shipment.id], courierId: courier.id });
  expect((await routeAction(t, cookie, route, "/dispatch")).status).toBe(200);
  return shipment;
}

const storedIds = async () =>
  (await database.db.select({ id: courierRecords.id }).from(courierRecords)).map((row) => row.id);

describe("record bounds (ROB-5)", () => {
  it("refuses a disbursement above the storable peso amount with 400, not 500", async () => {
    const shipment = await shipmentOnRoute();
    const response = await sendRecords(t, courier, [
      { shipmentId: shipment.id, kind: "disbursement", amount: 3_000_000_000, payee: "Tienda X" },
    ]);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: "invalid_request" } });
    expect(await storedIds()).toEqual([]);
  });

  it("refuses a location accuracy beyond any position on Earth with 400, not 500", async () => {
    const shipment = await shipmentOnRoute();
    const response = await sendRecords(t, courier, [
      {
        shipmentId: shipment.id,
        kind: "pickup",
        location: { latitude: 6.2, longitude: -75.5, accuracyM: 3_000_000_000 },
      },
    ]);

    expect(response.status).toBe(400);
    expect(await storedIds()).toEqual([]);
  });
});

describe("concurrent replays (C003-4, FR-019)", () => {
  // Off any route, the two requests share no lock, so both inserts reach the primary key.
  it("answers the stored outcome when one record id races on two shipments", async () => {
    const shipments = [await unrouted(), await unrouted()];
    const id = crypto.randomUUID();

    const responses = await Promise.all(
      shipments.map((shipment) =>
        sendRecords(t, courier, [{ id, shipmentId: shipment.id, kind: "pickup" }]),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const [stored] = await database.db
      .select({ outcome: courierRecords.outcome })
      .from(courierRecords)
      .where(eq(courierRecords.id, id));
    expect(stored).toBeDefined();
    for (const response of responses)
      expect(response.body.results).toEqual([{ id, outcome: stored?.outcome }]);
    expect(await storedIds()).toEqual([id]);
  });
});
