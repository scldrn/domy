import { courierRecordInput, type Handover, type RouteDetail, type Shipment } from "@domy/domain";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  courierRecords,
  couriers,
  recordPhotos,
  routeEvents,
  routes,
  routeTasks,
  shipmentEvents,
  shipments,
} from "../src/db/schema/index.ts";
import { applyCourierRecord } from "../src/lib/courier-records.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction, send } from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;

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
});

type Courier = { id: string; userId: string; name: string };

/** A courier with an account, as the courier app signs in (FR-002). */
async function courierWithAccount(name: string): Promise<Courier> {
  const { user } = await t.signIn("courier", { name });
  const id = crypto.randomUUID();
  await database.db.insert(couriers).values({ id, name, phone: "3004445566", userId: user.id });
  return { id, userId: user.id, name };
}

async function dispatchedTo(courier: Courier, list: Shipment[]): Promise<RouteDetail> {
  const route = await createRoute(t, cookie, {
    shipmentIds: list.map((shipment) => shipment.id),
    courierId: courier.id,
  });
  return (await routeAction(t, cookie, route, "/dispatch")).body;
}

/** 10:MM in Bogotá on 1 October 2026. */
const at = (minute: number) => `2026-10-01T15:${String(minute).padStart(2, "0")}:00.000Z`;

/** Applies a record as the courier sent it, received at 10:30 unless said otherwise. */
function apply(
  courier: Courier,
  input: Record<string, unknown>,
  options: { onBehalf?: boolean; authorUserId?: string; recordedAt?: string } = {},
) {
  return applyCourierRecord(
    database.db,
    courierRecordInput.parse({ id: crypto.randomUUID(), occurredAt: at(5), ...input }),
    {
      courierId: courier.id,
      authorUserId: options.authorUserId ?? courier.userId,
      onBehalf: options.onBehalf ?? false,
      recordedAt: new Date(options.recordedAt ?? at(30)),
    },
  );
}

async function shipmentRow(id: string) {
  const [row] = await database.db.select().from(shipments).where(eq(shipments.id, id));
  if (!row) throw new Error("No shipment");
  return row;
}

const eventsOf = (shipmentId: string) =>
  database.db
    .select()
    .from(shipmentEvents)
    .where(eq(shipmentEvents.shipmentId, shipmentId))
    .orderBy(asc(shipmentEvents.occurredAt), asc(shipmentEvents.recordedAt));

const tasksOf = (shipmentId: string) =>
  database.db.select().from(routeTasks).where(eq(routeTasks.shipmentId, shipmentId));

const recordsOf = (shipmentId: string) =>
  database.db.select().from(courierRecords).where(eq(courierRecords.shipmentId, shipmentId));

/** `applyCourierRecord` (feature 003, research R5, FR-019, FR-024, FR-039). */
describe("applyCourierRecord", () => {
  it("applies a pickup in one go: status, custody, task, record, and event", async () => {
    const ana = await courierWithAccount("Ana Ruiz");
    const shipment = await registerShipment(t, cookie, catalog);
    const route = await dispatchedTo(ana, [shipment]);

    const recordId = crypto.randomUUID();
    const result = await apply(ana, { id: recordId, shipmentId: shipment.id, kind: "pickup" });

    expect(result).toEqual({ id: recordId, outcome: "applied" });
    const row = await shipmentRow(shipment.id);
    expect(row).toMatchObject({
      status: "picked_up",
      custodyCourierId: ana.id,
      heldAtOffice: false,
      needsReview: false,
      version: shipment.version + 3, // assigned, dispatched, then picked up
    });
    const tasks = await tasksOf(shipment.id);
    expect(tasks.find((task) => task.kind === "pickup")).toMatchObject({
      status: "completed",
      completedAt: new Date(at(5)),
      completedByCourierId: ana.id,
    });
    expect(await recordsOf(shipment.id)).toEqual([
      expect.objectContaining({
        id: recordId,
        kind: "pickup",
        courierId: ana.id,
        authorUserId: ana.userId,
        onBehalf: false,
        routeId: route.id,
        outcome: "applied",
        notAppliedReason: null,
        occurredAt: new Date(at(5)),
        recordedAt: new Date(at(30)),
      }),
    ]);
    // The event says who, when it happened, and when it was received (FR-039), and is the
    // custody line that feature 002's "Custodia del paquete" reads (research R17).
    const events = await eventsOf(shipment.id);
    expect(events.at(-1)).toMatchObject({
      type: "status_changed",
      fromStatus: "dispatched",
      toStatus: "picked_up",
      actorUserId: ana.userId,
      occurredAt: new Date(at(5)),
      recordedAt: new Date(at(30)),
      routeId: route.id,
      changes: { custodyCourierId: [null, ana.id] },
      onBehalf: false,
    });
  });

  it("gives the same record sent twice one effect and its stored outcome (FR-019)", async () => {
    const ana = await courierWithAccount("Ana Ruiz");
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatchedTo(ana, [shipment]);
    const record = { id: crypto.randomUUID(), shipmentId: shipment.id, kind: "pickup" };

    const first = await apply(ana, record);
    const eventsAfterFirst = (await eventsOf(shipment.id)).length;
    const second = await apply(ana, record, { recordedAt: at(40) });

    expect(second).toEqual(first);
    expect(await recordsOf(shipment.id)).toHaveLength(1);
    expect(await eventsOf(shipment.id)).toHaveLength(eventsAfterFirst);
    expect((await shipmentRow(shipment.id)).version).toBe(shipment.version + 3);
  });

  it("stores a record it cannot apply, with why, and flags the shipment (FR-024, FR-026)", async () => {
    const ana = await courierWithAccount("Ana Ruiz");
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatchedTo(ana, [shipment]);
    const eventsBefore = (await eventsOf(shipment.id)).length;

    // A delivery before the pickup.
    const result = await apply(ana, {
      shipmentId: shipment.id,
      kind: "delivery",
      receivedByName: "Laura Gómez",
      cashAmount: 50_000,
    });

    expect(result.outcome).toBe("not_applied");
    expect(await recordsOf(shipment.id)).toEqual([
      expect.objectContaining({
        outcome: "not_applied",
        notAppliedReason: "not_picked_up",
        receivedByName: "Laura Gómez",
        cashAmount: 50_000,
      }),
    ]);
    expect(await shipmentRow(shipment.id)).toMatchObject({
      status: "dispatched",
      custodyCourierId: null,
      needsReview: true,
    });
    expect(await eventsOf(shipment.id)).toHaveLength(eventsBefore);
  });

  it("delivers: custody ends, the collection is kept, and the route finishes (FR-012)", async () => {
    const ana = await courierWithAccount("Ana Ruiz");
    const shipment = await registerShipment(t, cookie, catalog, { codAmount: 85_000 });
    const route = await dispatchedTo(ana, [shipment]);
    await apply(ana, { shipmentId: shipment.id, kind: "pickup", occurredAt: at(5) });

    const photoId = crypto.randomUUID();
    const recordId = crypto.randomUUID();
    const result = await apply(ana, {
      id: recordId,
      shipmentId: shipment.id,
      kind: "delivery",
      occurredAt: at(20),
      receivedByName: "Laura Gómez",
      cashAmount: 50_000,
      companyTransferAmount: 35_000,
      location: { latitude: 6.2442, longitude: -75.5812, accuracyM: 12 },
      photos: [{ id: photoId, kind: "proof" }],
    });

    expect(result.outcome).toBe("applied");
    expect(await shipmentRow(shipment.id)).toMatchObject({
      status: "delivered",
      custodyCourierId: null,
    });
    const [delivery] = (await recordsOf(shipment.id)).filter((each) => each.kind === "delivery");
    expect(delivery).toMatchObject({
      cashAmount: 50_000,
      companyTransferAmount: 35_000,
      merchantTransferAmount: 0,
      latitude: 6.2442,
      longitude: -75.5812,
      locationAccuracyM: 12,
    });
    // The photo is expected: "Foto pendiente" until it arrives (FR-023).
    expect(
      await database.db.select().from(recordPhotos).where(eq(recordPhotos.recordId, recordId)),
    ).toEqual([
      expect.objectContaining({ id: photoId, kind: "proof", uploadedAt: null, byteSize: null }),
    ]);
    expect((await eventsOf(shipment.id)).at(-1)).toMatchObject({
      type: "status_changed",
      fromStatus: "picked_up",
      toStatus: "delivered",
      changes: { custodyCourierId: [ana.id, null] },
      onBehalf: false,
    });
    const [finished] = await database.db.select().from(routes).where(eq(routes.id, route.id));
    expect(finished).toMatchObject({ status: "finished", finishedAt: new Date(at(30)) });
  });

  it("requires who received a delivery, except an errand (FR-008)", async () => {
    const ana = await courierWithAccount("Ana Ruiz");
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatchedTo(ana, [shipment]);
    await apply(ana, { shipmentId: shipment.id, kind: "pickup" });

    await expect(
      apply(ana, { shipmentId: shipment.id, kind: "delivery", cashAmount: 50_000 }),
    ).rejects.toMatchObject({
      code: "invalid_request",
      fields: { receivedByName: "Escribe el nombre de quien recibe, de al menos 2 letras." },
    });
    expect((await recordsOf(shipment.id)).map((each) => each.kind)).toEqual(["pickup"]);
  });

  it("keeps a delivery collected differently even without its note: it happened (FR-024)", async () => {
    const ana = await courierWithAccount("Ana Ruiz");
    // The dispatcher may change the COD amount after the phone last synchronized.
    const shipment = await registerShipment(t, cookie, catalog, { codAmount: 85_000 });
    await dispatchedTo(ana, [shipment]);
    await apply(ana, { shipmentId: shipment.id, kind: "pickup" });

    const result = await apply(ana, {
      shipmentId: shipment.id,
      kind: "delivery",
      receivedByName: "Laura Gómez",
      cashAmount: 80_000,
    });

    expect(result.outcome).toBe("applied");
    expect((await shipmentRow(shipment.id)).status).toBe("delivered");
  });

  it("fails the delivery task on an exception and keeps the custody (FR-013)", async () => {
    const ana = await courierWithAccount("Ana Ruiz");
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatchedTo(ana, [shipment]);
    await apply(ana, { shipmentId: shipment.id, kind: "pickup" });

    await apply(ana, {
      shipmentId: shipment.id,
      kind: "exception",
      occurredAt: at(20),
      reason: "recipient_absent",
    });

    expect(await shipmentRow(shipment.id)).toMatchObject({
      status: "exception",
      custodyCourierId: ana.id,
    });
    const delivery = (await tasksOf(shipment.id)).find((task) => task.kind === "delivery");
    expect(delivery).toMatchObject({ status: "failed", completedAt: new Date(at(20)) });
    const last = (await eventsOf(shipment.id)).at(-1);
    expect(last).toMatchObject({ fromStatus: "picked_up", toStatus: "exception" });
    expect(last?.changes).toBeNull();
    const [exception] = (await recordsOf(shipment.id)).filter((each) => each.kind === "exception");
    expect(exception?.exceptionReason).toBe("recipient_absent");
  });

  it("marks a pickup problem on its task, with no status change (FR-014)", async () => {
    const ana = await courierWithAccount("Ana Ruiz");
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatchedTo(ana, [shipment]);

    const result = await apply(ana, {
      shipmentId: shipment.id,
      kind: "problem",
      note: "El cliente no tenía el paquete listo",
    });

    expect(result.outcome).toBe("applied");
    expect((await shipmentRow(shipment.id)).status).toBe("dispatched");
    const pickup = (await tasksOf(shipment.id)).find((task) => task.kind === "pickup");
    expect(pickup).toMatchObject({
      status: "pending",
      problemNote: "El cliente no tenía el paquete listo",
    });
    // Completing the task clears it.
    await apply(ana, { shipmentId: shipment.id, kind: "pickup", occurredAt: at(10) });
    const done = (await tasksOf(shipment.id)).find((task) => task.kind === "pickup");
    expect(done).toMatchObject({ status: "completed", problemNote: null });
  });

  it("writes every event of a record on behalf as on behalf (FR-034)", async () => {
    const ana = await courierWithAccount("Ana Ruiz");
    const dispatcher = await t.signIn("dispatcher", { name: "Diana Despacho" });
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatchedTo(ana, [shipment]);

    await apply(
      ana,
      { shipmentId: shipment.id, kind: "pickup" },
      { onBehalf: true, authorUserId: dispatcher.user.id },
    );

    const [record] = await recordsOf(shipment.id);
    expect(record).toMatchObject({
      courierId: ana.id,
      authorUserId: dispatcher.user.id,
      onBehalf: true,
    });
    expect((await eventsOf(shipment.id)).at(-1)).toMatchObject({
      actorUserId: dispatcher.user.id,
      onBehalf: true,
      changes: { custodyCourierId: [null, ana.id] },
    });
  });

  it("confirms a handover by the receiving courier, not on behalf (research R17)", async () => {
    const ana = await courierWithAccount("Ana Ruiz");
    const beto = await courierWithAccount("Beto Gómez");
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatchedTo(ana, [shipment]);
    const betoRoute = await dispatchedTo(beto, [await registerShipment(t, cookie, catalog)]);
    await apply(ana, { shipmentId: shipment.id, kind: "pickup" });
    const moved = await send<{ handover: Handover }>(
      t,
      cookie,
      `/api/shipments/${shipment.id}/reassign`,
      { actionId: crypto.randomUUID(), toRouteId: betoRoute.id, reason: "Cambio de mensajero" },
    );
    expect(moved.status).toBe(200);

    const result = await apply(beto, {
      shipmentId: shipment.id,
      kind: "handover_confirmation",
      occurredAt: at(15),
    });

    expect(result.outcome).toBe("applied");
    expect((await shipmentRow(shipment.id)).custodyCourierId).toBe(beto.id);
    const delivery = (await tasksOf(shipment.id)).find(
      (task) => task.kind === "delivery" && task.status === "pending",
    );
    expect(delivery?.blockedByHandoverId).toBeNull();
    expect((await eventsOf(shipment.id)).at(-1)).toMatchObject({
      type: "handover_confirmed",
      actorUserId: beto.userId,
      occurredAt: new Date(at(15)),
      changes: { custodyCourierId: [ana.id, beto.id] },
      onBehalf: false,
    });
    const confirmed = await database.db
      .select()
      .from(routeEvents)
      .where(eq(routeEvents.type, "handover_confirmed"));
    expect(confirmed.length).toBeGreaterThan(0);
    for (const event of confirmed) {
      expect(event).toMatchObject({ actorUserId: beto.userId, onBehalf: false });
    }
    // Confirming again, from a second phone, is a duplicate without effect.
    const again = await apply(beto, { shipmentId: shipment.id, kind: "handover_confirmation" });
    expect(again.outcome).toBe("duplicate");
  });

  it("never stores a record as happening after it was received (FR-019)", async () => {
    const ana = await courierWithAccount("Ana Ruiz");
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatchedTo(ana, [shipment]);

    await apply(
      ana,
      { shipmentId: shipment.id, kind: "pickup", occurredAt: at(45) },
      { recordedAt: at(30) },
    );

    const [record] = await recordsOf(shipment.id);
    expect(record).toMatchObject({ occurredAt: new Date(at(30)), recordedAt: new Date(at(30)) });
  });

  it("stores nothing for a shipment that does not exist", async () => {
    const ana = await courierWithAccount("Ana Ruiz");
    const shipmentId = crypto.randomUUID();
    await expect(apply(ana, { shipmentId, kind: "pickup" })).rejects.toMatchObject({
      code: "not_found",
    });
    expect(await recordsOf(shipmentId)).toEqual([]);
  });
});
