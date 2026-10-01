import type { RouteDetail, Shipment, ShipmentDetail, UnassignedShipment } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { routes, shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, send } from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;
let dispatcherId: string;

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  // 10:00 in Bogotá on Thursday 1 October 2026.
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  const dispatcher = await t.signIn("dispatcher", { name: "John Coordinador" });
  cookie = dispatcher.cookie;
  dispatcherId = dispatcher.user.id;
});

const register = (overrides: Record<string, unknown> = {}) =>
  registerShipment(t, cookie, catalog, overrides);

const shape = (route: RouteDetail) =>
  route.stops.map(
    (stop) => `${stop.kind}:${stop.tasks.map((task) => task.shipment.trackingNumber).join("+")}`,
  );

describe("GET /api/shipments/unassigned (FR-001)", () => {
  it("lists registered shipments up to the date with their pickup place", async () => {
    const today = await register({ window: { preset: "before", end: "10:30" } });
    const yesterday = await register({ serviceDate: "2026-09-30" });
    const tomorrow = await register({ serviceDate: "2026-10-02" });
    const onRoute = await register();
    await createRoute(t, cookie, { shipmentIds: [onRoute.id] });

    const { body } = await send<{ shipments: UnassignedShipment[] }>(
      t,
      cookie,
      "/api/shipments/unassigned?date=2026-10-01",
    );
    const numbers = body.shipments.map((shipment) => shipment.trackingNumber).sort();
    expect(numbers).toEqual([today.trackingNumber, yesterday.trackingNumber].sort());
    expect(body.shipments.find((shipment) => shipment.id === today.id)).toMatchObject({
      pickupPoint: { id: catalog.pickup.bullish, label: "Bodega Estadio" },
      pickupAddress: "Cra 70 # 45-10",
      pickupNeighborhood: { id: catalog.place.estadio, name: "El Estadio" },
      rateZone: { id: catalog.zone.medellin },
      recipientNeighborhood: { name: "Laureles" },
      codAmount: 50000,
      windowEnd: "2026-10-01T15:30:00.000Z",
    });
    const tomorrowList = await send<{ shipments: UnassignedShipment[] }>(
      t,
      cookie,
      "/api/shipments/unassigned?date=2026-10-02",
    );
    expect(tomorrowList.body.shipments.map((shipment) => shipment.id)).toContain(tomorrow.id);
  });

  it("filters by rate zone and merchant", async () => {
    const medellin = await register();
    const itagui = await register({ recipientNeighborhoodId: catalog.place.itagui, fee: 15000 });
    const amy = await register({
      merchantId: catalog.merchant.amy,
      pickupPointId: catalog.pickup.amy,
      fee: 9700,
    });
    const ids = async (query: string) =>
      (
        await send<{ shipments: UnassignedShipment[] }>(
          t,
          cookie,
          `/api/shipments/unassigned?${query}`,
        )
      ).body.shipments.map((shipment) => shipment.id);
    expect(await ids(`rateZoneId=${catalog.zone.belloItagui}`)).toEqual([itagui.id]);
    expect(await ids(`merchantId=${catalog.merchant.amy}`)).toEqual([amy.id]);
    expect((await ids("")).sort()).toEqual([medellin.id, itagui.id, amy.id].sort());
  });
});

describe("POST /api/routes (FR-002, FR-005)", () => {
  it("builds the stops and assigns the shipments (scenario 1)", async () => {
    const a = await register();
    const b = await register({ pickupPointId: catalog.pickup.bullishSecondary });
    const c = await register();
    const route = await createRoute(t, cookie, { shipmentIds: [a.id, b.id, c.id] });
    expect(route).toMatchObject({
      number: 1,
      status: "draft",
      serviceDate: "2026-10-01",
      courier: null,
    });
    expect(shape(route)).toEqual([
      `pickup:${a.trackingNumber}+${c.trackingNumber}`,
      `pickup:${b.trackingNumber}`,
      `delivery:${a.trackingNumber}`,
      `delivery:${b.trackingNumber}`,
      `delivery:${c.trackingNumber}`,
    ]);
    expect(route.stops[0]).toMatchObject({
      position: 0,
      address: "Cra 70 # 45-10",
      neighborhood: { name: "El Estadio" },
    });
    expect(route.codToCollect).toBe(150000);
    expect(route.events).toMatchObject([
      { type: "created", actor: { id: dispatcherId, name: "John Coordinador" } },
    ]);

    const detail = (await send<ShipmentDetail>(t, cookie, `/api/shipments/${a.id}`)).body;
    expect(detail.status).toBe("assigned");
    expect(detail.events.at(-1)).toMatchObject({
      type: "status_changed",
      fromStatus: "registered",
      toStatus: "assigned",
    });
    const [row] = await database.db.select().from(shipments).where(eq(shipments.id, a.id));
    expect(row?.routeId).toBe(route.id);

    const second = await createRoute(t, cookie, { shipmentIds: [(await register()).id] });
    expect(second.number).toBe(2);
    const tomorrow = await createRoute(t, cookie, {
      serviceDate: "2026-10-02",
      shipmentIds: [(await register()).id],
    });
    expect(tomorrow.number).toBe(1);
  });

  it("places reverse pickups, carrier handoffs, and errands (scenario 5)", async () => {
    const reverse = await register({ kind: "reverse_pickup" });
    const handoff = await register({
      kind: "carrier_handoff",
      recipientNeighborhoodId: catalog.place.terminalNorte,
      carrierId: catalog.carrier,
      destinationTown: "Santa Rosa de Osos",
      recipientName: undefined,
      recipientPhone: undefined,
      recipientAddress: undefined,
      fee: 15000,
    });
    const errand = await register({
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
    const route = await createRoute(t, cookie, {
      shipmentIds: [reverse.id, handoff.id, errand.id],
    });
    const stopOf = (shipment: Shipment, kind: string) =>
      route.stops.find(
        (stop) => stop.kind === kind && stop.tasks.some((task) => task.shipmentId === shipment.id),
      );
    expect(stopOf(reverse, "pickup")).toMatchObject({ address: "Calle 10 # 43-12" });
    expect(stopOf(reverse, "delivery")).toMatchObject({ address: "Cra 70 # 45-10" });
    expect(stopOf(handoff, "delivery")).toMatchObject({ address: "Terminal del Norte" });
    expect(stopOf(errand, "errand")).toBeDefined();
    expect(
      route.stops.filter((stop) => stop.tasks.some((task) => task.shipmentId === errand.id)),
    ).toHaveLength(1);
  });

  it("refuses a past date and shipments outside the date rule (FR-002, FR-003)", async () => {
    const shipment = await register();
    const past = await send(t, cookie, "/api/routes", {
      id: crypto.randomUUID(),
      actionId: crypto.randomUUID(),
      serviceDate: "2026-09-30",
      shipmentIds: [shipment.id],
    });
    expect(past.status).toBe(422);
    expect(past.body).toMatchObject({ error: { code: "past_service_date" } });

    const tomorrow = await register({ serviceDate: "2026-10-02" });
    const early = await send(t, cookie, "/api/routes", {
      id: crypto.randomUUID(),
      actionId: crypto.randomUUID(),
      serviceDate: "2026-10-01",
      shipmentIds: [tomorrow.id],
    });
    expect(early.status).toBe(409);
    expect(early.body).toMatchObject({ error: { code: "shipment_not_registered" } });

    // A shipment from yesterday joins today's route.
    const yesterday = await register({ serviceDate: "2026-09-30" });
    const route = await createRoute(t, cookie, { shipmentIds: [yesterday.id] });
    expect(route.stops).toHaveLength(2);
  });

  it("refuses a shipment already on a route (scenario 9, FR-004)", async () => {
    const shipment = await register();
    await createRoute(t, cookie, { shipmentIds: [shipment.id] });
    const again = await send(t, cookie, "/api/routes", {
      id: crypto.randomUUID(),
      actionId: crypto.randomUUID(),
      serviceDate: "2026-10-01",
      shipmentIds: [shipment.id],
    });
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ error: { code: "shipment_not_registered" } });
  });

  it("leaves a shipment on exactly one route when two creations race (FR-004)", async () => {
    const shipment = await register();
    const attempt = () =>
      send(t, cookie, "/api/routes", {
        id: crypto.randomUUID(),
        actionId: crypto.randomUUID(),
        serviceDate: "2026-10-01",
        shipmentIds: [shipment.id],
      });
    const results = await Promise.all([attempt(), attempt(), attempt()]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409, 409]);
    expect(await database.db.select().from(routes)).toHaveLength(1);
  });

  it("asks for confirmation beyond 15 shipments", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 16; i++) ids.push((await register()).id);
    const body = {
      id: crypto.randomUUID(),
      actionId: crypto.randomUUID(),
      serviceDate: "2026-10-01",
      shipmentIds: ids,
    };
    const unconfirmed = await send(t, cookie, "/api/routes", body);
    expect(unconfirmed.status).toBe(422);
    expect(unconfirmed.body).toMatchObject({ error: { code: "confirmation_required" } });
    expect((await send(t, cookie, "/api/routes", { ...body, confirmed: true })).status).toBe(201);
  });

  it("creates one route when the same creation is sent again (FR-020)", async () => {
    const shipment = await register();
    const body = {
      id: crypto.randomUUID(),
      actionId: crypto.randomUUID(),
      serviceDate: "2026-10-01",
      shipmentIds: [shipment.id],
    };
    expect((await send(t, cookie, "/api/routes", body)).status).toBe(201);
    const again = await send<RouteDetail>(t, cookie, "/api/routes", body);
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(body.id);
    expect(await database.db.select().from(routes)).toHaveLength(1);
  });

  it("is only for the owner and dispatchers (FR-023)", async () => {
    const courier = await t.signIn("courier");
    expect((await send(t, courier.cookie, "/api/routes", {})).status).toBe(403);
  });
});
