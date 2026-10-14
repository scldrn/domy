import type { RouteDetail, Shipment } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { courierRecords, recordPhotos, routes, shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, snapshot, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction } from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;
let ana: CourierAccount;

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
  ana = await courierWithAccount(t, database.db);
});

async function dispatched(list: Shipment[]): Promise<RouteDetail> {
  const route = await createRoute(t, cookie, {
    shipmentIds: list.map((shipment) => shipment.id),
    courierId: ana.id,
  });
  return (await routeAction(t, cookie, route, "/dispatch")).body;
}

async function statusOf(shipment: Shipment) {
  const [row] = await database.db.select().from(shipments).where(eq(shipments.id, shipment.id));
  return row?.status;
}

const recordsOf = (shipment: Shipment) =>
  database.db.select().from(courierRecords).where(eq(courierRecords.shipmentId, shipment.id));

const location = { latitude: 6.2442, longitude: -75.5812, accuracyM: 12 };

/** `POST /api/courier/records` (feature 003, US1 scenarios 2–9, FR-006–FR-012, FR-015). */
describe("the courier's records", () => {
  it("confirms pickups one by one; the stop waits for the rest (scenario 2)", async () => {
    const list = [
      await registerShipment(t, cookie, catalog),
      await registerShipment(t, cookie, catalog),
      await registerShipment(t, cookie, catalog),
    ];
    await dispatched(list);

    const { status, body } = await sendRecords(t, ana, [
      { shipmentId: list[0]?.id, kind: "pickup" },
      { shipmentId: list[1]?.id, kind: "pickup" },
    ]);

    expect(status).toBe(200);
    expect(body.results.map((result) => result.outcome)).toEqual(["applied", "applied"]);
    expect(await Promise.all(list.map(statusOf))).toEqual(["picked_up", "picked_up", "dispatched"]);
    const route = (await snapshot(t, ana)).body.route;
    const pickup = route?.stops.find((stop) => stop.kind === "pickup");
    expect(pickup?.tasks.map((task) => task.status).sort()).toEqual([
      "completed",
      "completed",
      "pending",
    ]);
  });

  it("delivers with who received it, the location, and the photos declared (scenario 3)", async () => {
    const shipment = await registerShipment(t, cookie, catalog, {
      paymentMode: "merchant_account",
      codAmount: 0,
    });
    await dispatched([shipment]);
    await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "pickup" }]);
    const recordId = crypto.randomUUID();
    const photoId = crypto.randomUUID();

    const { body } = await sendRecords(t, ana, [
      {
        id: recordId,
        shipmentId: shipment.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        location,
        photos: [{ id: photoId, kind: "proof" }],
      },
    ]);

    expect(body.results).toEqual([{ id: recordId, outcome: "applied" }]);
    expect(await statusOf(shipment)).toBe("delivered");
    const [delivery] = (await recordsOf(shipment)).filter((record) => record.kind === "delivery");
    expect(delivery).toMatchObject({
      receivedByName: "Laura Gómez",
      latitude: 6.2442,
      longitude: -75.5812,
      locationAccuracyM: 12,
      courierId: ana.id,
      authorUserId: ana.userId,
      onBehalf: false,
    });
    const photos = await database.db
      .select()
      .from(recordPhotos)
      .where(eq(recordPhotos.recordId, recordId));
    expect(photos).toEqual([expect.objectContaining({ id: photoId, uploadedAt: null })]);
  });

  it("splits a collection among the three payment methods (scenario 5)", async () => {
    const shipment = await registerShipment(t, cookie, catalog, { codAmount: 85_000 });
    await dispatched([shipment]);
    await sendRecords(t, ana, [
      { shipmentId: shipment.id, kind: "pickup" },
      {
        shipmentId: shipment.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        cashAmount: 50_000,
        companyTransferAmount: 25_000,
        merchantTransferAmount: 10_000,
        photos: [{ id: crypto.randomUUID(), kind: "transfer_receipt" }],
      },
    ]);

    const [delivery] = (await recordsOf(shipment)).filter((record) => record.kind === "delivery");
    expect(delivery).toMatchObject({
      cashAmount: 50_000,
      companyTransferAmount: 25_000,
      merchantTransferAmount: 10_000,
      note: null,
    });
  });

  it("keeps the note of a collection different from the COD amount (scenario 6)", async () => {
    const shipment = await registerShipment(t, cookie, catalog, { codAmount: 85_000 });
    await dispatched([shipment]);
    await sendRecords(t, ana, [
      { shipmentId: shipment.id, kind: "pickup" },
      {
        shipmentId: shipment.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        cashAmount: 80_000,
        note: "Pagó 80.000; el resto lo transfiere mañana",
      },
    ]);

    const [delivery] = (await recordsOf(shipment)).filter((record) => record.kind === "delivery");
    expect(delivery).toMatchObject({
      cashAmount: 80_000,
      note: "Pagó 80.000; el resto lo transfiere mañana",
    });
  });

  it("completes an errand with an optional note and no received-by name (FR-008)", async () => {
    const errand = await registerShipment(t, cookie, catalog, {
      kind: "errand",
      errandDescription: "Pagar un recibo",
      recipientName: undefined,
      recipientPhone: undefined,
      recipientAddress: undefined,
      recipientNeighborhoodId: undefined,
      paymentMode: "merchant_account",
      codAmount: undefined,
      fee: 12000,
      feeOverrideReason: "Diligencia en el centro",
    });
    await dispatched([errand]);

    const { body } = await sendRecords(t, ana, [
      { shipmentId: errand.id, kind: "delivery", note: "Recibo pagado en el banco" },
    ]);

    expect(body.results[0]?.outcome).toBe("applied");
    expect(await statusOf(errand)).toBe("delivered");
  });

  it("does not apply a delivery of a shipment not picked up (scenario 7)", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatched([shipment]);

    const { body } = await sendRecords(t, ana, [
      { shipmentId: shipment.id, kind: "delivery", receivedByName: "Laura Gómez" },
    ]);

    expect(body.results[0]?.outcome).toBe("not_applied");
    expect(await statusOf(shipment)).toBe("dispatched");
  });

  it("accepts stops out of order and finishes the route when none is left (scenario 8)", async () => {
    const first = await registerShipment(t, cookie, catalog, { codAmount: 20_000 });
    const second = await registerShipment(t, cookie, catalog, {
      recipientAddress: "Carrera 80 # 30-15",
      codAmount: 30_000,
    });
    const route = await dispatched([first, second]);
    const delivery = (shipment: Shipment, cash: number) => ({
      shipmentId: shipment.id,
      kind: "delivery",
      receivedByName: "Laura Gómez",
      cashAmount: cash,
    });

    await sendRecords(t, ana, [
      { shipmentId: first.id, kind: "pickup" },
      { shipmentId: second.id, kind: "pickup" },
      delivery(second, 30_000),
    ]);
    const midway = (await snapshot(t, ana)).body.route;
    expect(midway?.status).toBe("in_progress");
    await sendRecords(t, ana, [delivery(first, 20_000)]);

    const [row] = await database.db.select().from(routes).where(eq(routes.id, route.id));
    expect(row?.status).toBe("finished");
    expect((await snapshot(t, ana)).body.route).toBeNull();
  });

  it("stores a disbursement for a shipment of the route, done or pending (scenario 9)", async () => {
    const handoff = await registerShipment(t, cookie, catalog, {
      kind: "carrier_handoff",
      recipientNeighborhoodId: catalog.place.terminalNorte,
      carrierId: catalog.carrier,
      destinationTown: "Santa Rosa de Osos",
      recipientName: undefined,
      recipientPhone: undefined,
      recipientAddress: undefined,
      fee: 15000,
    });
    await dispatched([handoff]);

    const { body } = await sendRecords(t, ana, [
      {
        shipmentId: handoff.id,
        kind: "disbursement",
        amount: 12_000,
        payee: "Coonorte",
        photos: [{ id: crypto.randomUUID(), kind: "disbursement_receipt" }],
      },
    ]);

    expect(body.results[0]?.outcome).toBe("applied");
    expect(await recordsOf(handoff)).toEqual([
      expect.objectContaining({
        kind: "disbursement",
        disbursementAmount: 12_000,
        payee: "Coonorte",
      }),
    ]);
    expect((await snapshot(t, ana)).body.summary).toMatchObject({
      disbursements: 12_000,
      cashToHandOver: -12_000,
    });
  });

  it("refuses records that are not well formed, without effect", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatched([shipment]);

    const { status } = await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "teleport" }]);

    expect(status).toBe(400);
    expect(await recordsOf(shipment)).toEqual([]);
  });
});
