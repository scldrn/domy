import type { ShipmentDetail } from "@domy/domain";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { courierNotices, courierRecords, recordPhotos, shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction } from "./setup/routes.ts";

/**
 * One record the server cannot take never blocks the rest of the batch (ROB-3, C003-3,
 * FR-018, FR-024; contracts/http-api.md `POST /api/courier/records`).
 */

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

async function shipmentsOnRoute(count: number) {
  const shipments = [];
  for (let index = 0; index < count; index++)
    shipments.push(
      await registerShipment(t, cookie, catalog, { paymentMode: "merchant_account", codAmount: 0 }),
    );
  const route = await createRoute(t, cookie, {
    shipmentIds: shipments.map((shipment) => shipment.id),
    courierId: courier.id,
  });
  expect((await routeAction(t, cookie, route, "/dispatch")).status).toBe(200);
  return shipments;
}

const storedIds = async () =>
  (await database.db.select({ id: courierRecords.id }).from(courierRecords))
    .map((row) => row.id)
    .sort();

describe("a record refused inside a batch (ROB-3)", () => {
  it("answers an unknown shipment as not applied and applies the records around it", async () => {
    const [first, third] = await shipmentsOnRoute(2);
    const records = [
      { id: crypto.randomUUID(), shipmentId: first?.id, kind: "pickup" },
      { id: crypto.randomUUID(), shipmentId: crypto.randomUUID(), kind: "pickup" },
      { id: crypto.randomUUID(), shipmentId: third?.id, kind: "pickup" },
    ];

    const response = await sendRecords(t, courier, records);

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([
      { id: records[0]?.id, outcome: "applied" },
      {
        id: records[1]?.id,
        outcome: "not_applied",
        error: { code: "not_found", message: "No encontramos ese envío." },
      },
      { id: records[2]?.id, outcome: "applied" },
    ]);
    expect(await storedIds()).toEqual([records[0]?.id, records[2]?.id].sort());

    // The phone resends the same batch when the answer is lost: same answer, nothing new.
    const again = await sendRecords(t, courier, records);
    expect(again.status).toBe(200);
    expect(again.body.results.map((result) => result.outcome)).toEqual([
      "applied",
      "not_applied",
      "applied",
    ]);
    expect(await storedIds()).toEqual([records[0]?.id, records[2]?.id].sort());
  });

  it("stores a delivery without the name a package needs as not applied, with its data", async () => {
    const [shipment, other] = await shipmentsOnRoute(2);
    const pickups = [shipment, other].map((item) => ({
      shipmentId: item?.id,
      kind: "pickup",
    }));
    expect((await sendRecords(t, courier, pickups)).status).toBe(200);
    // The phone took it as an errand; the office changed it to a package meanwhile (FR-024).
    const nameless = {
      id: crypto.randomUUID(),
      shipmentId: shipment?.id,
      kind: "delivery",
      cashAmount: 40_000,
      note: "Cobro parcial acordado",
      photos: [{ id: crypto.randomUUID(), kind: "proof" }],
    };
    const named = {
      id: crypto.randomUUID(),
      shipmentId: other?.id,
      kind: "delivery",
      receivedByName: "Laura Gómez",
    };

    const response = await sendRecords(t, courier, [nameless, named]);

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([
      { id: nameless.id, outcome: "not_applied" },
      { id: named.id, outcome: "applied" },
    ]);
    const [stored] = await database.db
      .select()
      .from(courierRecords)
      .where(eq(courierRecords.id, nameless.id));
    expect(stored).toMatchObject({
      outcome: "not_applied",
      notAppliedReason: "invalid_for_shipment",
      receivedByName: null,
      cashAmount: 40_000,
      note: "Cobro parcial acordado",
    });
    expect(
      await database.db.select().from(recordPhotos).where(eq(recordPhotos.recordId, nameless.id)),
    ).toHaveLength(1);
    // FR-026, FR-036: the shipment stays as it was, is flagged for review, shows the record in
    // its history, and the courier gets the notice.
    const [row] = await database.db
      .select()
      .from(shipments)
      .where(eq(shipments.id, shipment?.id ?? ""));
    expect(row).toMatchObject({ status: "picked_up", needsReview: true });
    const detail = await t.request(`/api/shipments/${shipment?.id ?? ""}`, { cookie });
    expect(((await detail.json()) as ShipmentDetail).records).toContainEqual(
      expect.objectContaining({ id: nameless.id, outcome: "not_applied" }),
    );
    const notApplied = () =>
      database.db
        .select()
        .from(courierNotices)
        .where(
          and(
            eq(courierNotices.courierId, courier.id),
            eq(courierNotices.type, "record_not_applied"),
          ),
        );
    expect(await notApplied()).toHaveLength(1);

    // A resend is answered from the stored record, with nothing new.
    const again = await sendRecords(t, courier, [nameless, named]);
    expect(again.body.results).toEqual(response.body.results);
    expect(await notApplied()).toHaveLength(1);
    expect((await storedIds()).filter((id) => id === nameless.id)).toHaveLength(1);
  });
});
