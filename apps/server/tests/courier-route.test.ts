import type { CourierTask, Handover, RouteDetail, Shipment } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { couriers } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, snapshot } from "./setup/courier.ts";
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
  // 10:00 in Bogotá on 2026-10-01.
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
});

async function dispatchedTo(courier: { id: string }, list: Shipment[]): Promise<RouteDetail> {
  const route = await createRoute(t, cookie, {
    shipmentIds: list.map((shipment) => shipment.id),
    courierId: courier.id,
  });
  return (await routeAction(t, cookie, route, "/dispatch")).body;
}

const carrierHandoff = () =>
  registerShipment(t, cookie, catalog, {
    kind: "carrier_handoff",
    recipientNeighborhoodId: catalog.place.terminalNorte,
    carrierId: catalog.carrier,
    destinationTown: "Santa Rosa de Osos",
    recipientName: undefined,
    recipientPhone: undefined,
    recipientAddress: undefined,
    fee: 15000,
  });

/** `GET /api/courier/route` (feature 003, US1 scenarios 1 and 11, FR-002, FR-005). */
describe("the courier's route", () => {
  it("is null without a route in progress, with the time and the session's end", async () => {
    const ana = await courierWithAccount(t, database.db);

    const { status, body } = await snapshot(t, ana);

    expect(status).toBe(200);
    expect(body).toMatchObject({
      serverTime: "2026-10-01T15:00:00.000Z",
      route: null,
      handoversToGive: [],
      heldOffRoute: [],
      notices: [],
      summary: { date: "2026-10-01", deliveries: 0, pendingStops: 0, cashToHandOver: 0 },
    });
    expect(new Date(body.sessionExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("shows the stops in the dispatcher's order with what the courier needs", async () => {
    const ana = await courierWithAccount(t, database.db);
    const delivery = await registerShipment(t, cookie, catalog, {
      codAmount: 85_000,
      instructions: "Dejar en portería",
      packageCount: 2,
      packageSize: "medium",
      window: { preset: "between", start: "12:00", end: "14:00" },
    });
    const handoff = await carrierHandoff();
    const route = await dispatchedTo(ana, [delivery, handoff]);

    const { body } = await snapshot(t, ana);

    expect(body.route).toMatchObject({
      id: route.id,
      number: route.number,
      serviceDate: "2026-10-01",
      status: "in_progress",
    });
    const stops = body.route?.stops ?? [];
    expect(stops.map((stop) => stop.id)).toEqual(route.stops.map((stop) => stop.id));
    expect(stops.map((stop) => stop.position)).toEqual(stops.map((_, index) => index));
    const pickup = stops.find((stop) => stop.kind === "pickup");
    // The merchant's WhatsApp at a pickup (FR-016).
    expect(pickup).toMatchObject({ address: "Cra 70 # 45-10", contactPhone: "3000000001" });
    expect(pickup?.tasks.map((task) => task.shipmentId).sort()).toEqual(
      [delivery.id, handoff.id].sort(),
    );
    const deliveryStop = stops.find(
      (stop) => stop.kind === "delivery" && stop.tasks[0]?.shipmentId === delivery.id,
    );
    expect(deliveryStop).toMatchObject({
      address: "Calle 10 # 43-12",
      neighborhood: { id: catalog.place.laureles, name: "Laureles" },
      contactPhone: "3001234567",
    });
    expect(deliveryStop?.tasks[0]).toEqual({
      id: expect.any(String),
      shipmentId: delivery.id,
      kind: "delivery",
      status: "pending",
      trackingNumber: delivery.trackingNumber,
      shipmentKind: "delivery",
      shipmentStatus: "dispatched",
      merchant: { id: catalog.merchant.bullish, name: "Bullish Hype" },
      recipientName: "Laura Gómez",
      recipientPhone: "3001234567",
      carrier: null,
      destinationTown: null,
      errandDescription: null,
      instructions: "Dejar en portería",
      packageCount: 2,
      packageSize: "medium",
      windowStart: "2026-10-01T17:00:00.000Z",
      windowEnd: "2026-10-01T19:00:00.000Z",
      codAmount: 85_000,
      blockedByHandover: null,
      problemNote: null,
    } satisfies CourierTask);
    // A carrier handoff names its carrier, proposed as who received it (FR-008).
    const handoffTask = stops
      .flatMap((stop) => stop.tasks)
      .find((task) => task.shipmentId === handoff.id && task.kind === "delivery");
    expect(handoffTask).toMatchObject({
      carrier: { id: catalog.carrier, name: expect.any(String) },
      destinationTown: "Santa Rosa de Osos",
      recipientPhone: null,
    });
  });

  it("shows only the caller's own route (FR-002)", async () => {
    const ana = await courierWithAccount(t, database.db, "Ana Ruiz");
    const beto = await courierWithAccount(t, database.db, "Beto Gómez");
    await dispatchedTo(beto, [await registerShipment(t, cookie, catalog)]);

    expect((await snapshot(t, ana)).body.route).toBeNull();
    expect((await snapshot(t, beto)).body.route).not.toBeNull();
  });

  it("records when the courier's app last synchronized (FR-033)", async () => {
    const ana = await courierWithAccount(t, database.db);
    t.setNow("2026-10-01T15:20:00Z");

    await snapshot(t, ana);

    const [row] = await database.db.select().from(couriers).where(eq(couriers.id, ana.id));
    expect(row?.lastSyncedAt).toEqual(new Date("2026-10-01T15:20:00Z"));
  });

  it("lists the packages to hand over and today's summary", async () => {
    const ana = await courierWithAccount(t, database.db, "Ana Ruiz");
    const beto = await courierWithAccount(t, database.db, "Beto Gómez");
    const first = await registerShipment(t, cookie, catalog, { codAmount: 50_000 });
    const second = await registerShipment(t, cookie, catalog);
    await dispatchedTo(ana, [first, second]);
    const betoRoute = await dispatchedTo(beto, [await registerShipment(t, cookie, catalog)]);
    await sendRecords(t, ana, [
      { shipmentId: first.id, kind: "pickup" },
      { shipmentId: second.id, kind: "pickup" },
      {
        shipmentId: first.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        cashAmount: 50_000,
      },
    ]);
    const moved = await send<{ handover: Handover }>(
      t,
      cookie,
      `/api/shipments/${second.id}/reassign`,
      { actionId: crypto.randomUUID(), toRouteId: betoRoute.id, reason: "Cambio de mensajero" },
    );
    expect(moved.status).toBe(200);

    const { body } = await snapshot(t, ana);

    expect(body.handoversToGive).toEqual([
      {
        handoverId: moved.body.handover.id,
        shipmentId: second.id,
        trackingNumber: second.trackingNumber,
        toCourier: { id: beto.id, name: "Beto Gómez" },
      },
    ]);
    expect(body.summary).toMatchObject({ deliveries: 1, cash: 50_000, cashToHandOver: 50_000 });
  });

  it("refuses the office: owner and dispatcher do not use the courier app (FR-002)", async () => {
    expect((await send(t, cookie, "/api/courier/route")).status).toBe(403);
  });
});

/** A courier account not linked to a courier sees nothing. */
describe("an account without a courier", () => {
  it("is refused with an explanation", async () => {
    const { cookie: unlinked } = await t.signIn("courier");
    const result = await send<{ error: { code: string; message: string } }>(
      t,
      unlinked,
      "/api/courier/route",
    );
    expect(result.status).toBe(403);
    expect(result.body.error.message).toBe(
      "Tu cuenta no está vinculada a un mensajero. Pide al propietario que la vincule.",
    );
  });
});
