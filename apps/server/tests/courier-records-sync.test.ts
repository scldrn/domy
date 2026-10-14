import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { courierRecords, shipmentEvents, shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction } from "./setup/routes.ts";

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
  // Better Auth uses the process clock, independently of Domy's injected business clock.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T15:00:00Z"));
  await database.truncate();
  t = createTestApp(database.db);
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
  courier = await courierWithAccount(t, database.db);
});
afterEach(() => {
  vi.useRealTimers();
});

async function shipmentOnRoute() {
  const shipment = await registerShipment(t, cookie, catalog, {
    paymentMode: "merchant_account",
    codAmount: 0,
  });
  const route = await createRoute(t, cookie, { shipmentIds: [shipment.id], courierId: courier.id });
  expect((await routeAction(t, cookie, route, "/dispatch")).status).toBe(200);
  return shipment;
}

/** US2 T042: real PostgreSQL, controlled device/server times, one transaction per record. */
describe("courier record synchronization", () => {
  it("refuses a genuinely expired Better Auth session without storing an action", async () => {
    const shipment = await shipmentOnRoute();
    const later = "2026-11-01T15:00:00Z";
    vi.setSystemTime(new Date(later));
    t.setNow(later);

    const result = await sendRecords(t, courier, [{ shipmentId: shipment.id, kind: "pickup" }]);

    expect(result.status).toBe(401);
    expect(await database.db.select().from(courierRecords)).toHaveLength(0);
  });
  it("replays a whole batch exactly once and applies one shipment's records in sent order", async () => {
    const shipment = await shipmentOnRoute();
    const records = [
      {
        id: crypto.randomUUID(),
        shipmentId: shipment.id,
        kind: "pickup",
        occurredAt: "2026-10-01T14:00:00Z",
      },
      {
        id: crypto.randomUUID(),
        shipmentId: shipment.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        occurredAt: "2026-10-01T14:10:00Z",
      },
    ];

    const first = await sendRecords(t, courier, records);
    const replay = await sendRecords(t, courier, records);

    expect(first.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    expect(first.body.results.map((result) => result.outcome)).toEqual(["applied", "applied"]);
    const stored = await database.db
      .select()
      .from(courierRecords)
      .where(eq(courierRecords.shipmentId, shipment.id));
    expect(stored).toHaveLength(2);
    expect(
      (await database.db.select().from(shipments).where(eq(shipments.id, shipment.id)))[0]?.status,
    ).toBe("delivered");
    const events = await database.db
      .select()
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, shipment.id));
    expect(events.filter((event) => event.toStatus === "delivered")).toHaveLength(1);
  });

  it.each([
    ["2026-10-01T16:00:00Z", "2026-10-01T15:30:00Z", "2026-10-01T14:30:00Z"],
    ["2026-10-01T14:00:00Z", "2026-10-01T13:30:00Z", "2026-10-01T14:30:00Z"],
    ["2026-10-01T16:00:00Z", "2026-10-01T17:00:00Z", "2026-10-01T15:00:00Z"],
  ])(
    "corrects device time %s and clamps future actions",
    async (deviceNow, occurredAt, expected) => {
      const shipment = await shipmentOnRoute();
      const recordId = crypto.randomUUID();

      const result = await sendRecords(
        t,
        courier,
        [{ id: recordId, shipmentId: shipment.id, kind: "pickup", occurredAt }],
        deviceNow,
      );

      expect(result.status).toBe(200);
      const [stored] = await database.db
        .select()
        .from(courierRecords)
        .where(eq(courierRecords.id, recordId));
      expect(stored).toMatchObject({ occurredAt: new Date(expected), recordedAt: t.now() });
      const [event] = await database.db
        .select()
        .from(shipmentEvents)
        .where(eq(shipmentEvents.shipmentId, shipment.id))
        .orderBy(shipmentEvents.id)
        .then((events) => events.filter((entry) => entry.toStatus === "picked_up"));
      expect(event).toMatchObject({ occurredAt: new Date(expected), recordedAt: t.now() });
    },
  );

  it("stores an inapplicable record and continues with later records of the batch", async () => {
    const shipment = await shipmentOnRoute();
    const result = await sendRecords(t, courier, [
      { shipmentId: shipment.id, kind: "delivery", receivedByName: "Laura Gómez" },
      { shipmentId: shipment.id, kind: "pickup" },
      { shipmentId: shipment.id, kind: "delivery", receivedByName: "Laura Gómez" },
    ]);

    expect(result.status).toBe(200);
    expect(result.body.results.map((record) => record.outcome)).toEqual([
      "not_applied",
      "applied",
      "applied",
    ]);
    expect(
      await database.db
        .select()
        .from(courierRecords)
        .where(eq(courierRecords.shipmentId, shipment.id)),
    ).toHaveLength(3);
  });

  it("refuses malformed fields before any record of the request is applied", async () => {
    const shipment = await shipmentOnRoute();
    const result = await sendRecords(t, courier, [
      { shipmentId: shipment.id, kind: "pickup" },
      { shipmentId: shipment.id, kind: "exception", reason: "unknown_reason" },
    ]);

    expect(result.status).toBe(400);
    expect(await database.db.select().from(courierRecords)).toHaveLength(0);
    expect(
      (await database.db.select().from(shipments).where(eq(shipments.id, shipment.id)))[0]?.status,
    ).toBe("dispatched");
  });
});
