import type { RouteDetail, Shipment, ShipmentDetail } from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import {
  createCourier,
  createRoute,
  finishTask,
  pickUp,
  registerShipment,
  routeAction,
  send,
} from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;
let ana: string;
let beto: string;

/** The test clock: the courier app's actions (feature 003) happen at the same moment. */
const now = new Date("2026-10-01T15:00:00Z");

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: now.toISOString() });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher", { name: "John Coordinador" })).cookie;
  ana = await createCourier(database.db, "Ana Ruiz");
  beto = await createCourier(database.db, "Beto Gómez");
});

const register = () => registerShipment(t, cookie, catalog);

async function dispatched(list: Shipment[], courierId: string): Promise<RouteDetail> {
  const route = await createRoute(t, cookie, {
    shipmentIds: list.map((shipment) => shipment.id),
    courierId,
  });
  return (await routeAction(t, cookie, route, "/dispatch")).body;
}

const reassignRoute = (route: RouteDetail, courierId: string, reason = "Ana terminó su turno") =>
  routeAction(t, cookie, route, "/reassign", { courierId, reason });
const detail = async (shipment: Shipment) =>
  (await send<ShipmentDetail>(t, cookie, `/api/shipments/${shipment.id}`)).body;

describe("POST /api/routes/:id/reassign (FR-015)", () => {
  it("passes pending stops to the new courier; done stops keep who did them; picked-up packages wait for a handover (scenario 5)", async () => {
    const delivered = await register();
    const picked = await register();
    const waiting = await register();
    const route = await dispatched([delivered, picked, waiting], ana);
    await pickUp(database.db, delivered.id, now);
    await finishTask(database.db, delivered.id, "delivered", now);
    await pickUp(database.db, picked.id, now);

    const result = await reassignRoute(route, beto);
    expect(result.status).toBe(200);
    expect(result.body.courier).toMatchObject({ name: "Beto Gómez" });
    const tasks = result.body.stops.flatMap((stop) => stop.tasks);
    for (const task of tasks.filter((each) => each.status === "completed")) {
      expect(task.completedBy).toMatchObject({ name: "Ana Ruiz" });
    }
    expect(result.body.handovers).toEqual([
      expect.objectContaining({
        status: "pending",
        shipment: { id: picked.id, trackingNumber: picked.trackingNumber },
        fromCourier: expect.objectContaining({ name: "Ana Ruiz" }),
        toCourier: expect.objectContaining({ name: "Beto Gómez" }),
        fromRouteId: route.id,
        toRouteId: route.id,
      }),
    ]);
    const handoverId = result.body.handovers[0]?.id;
    expect(
      tasks.find((task) => task.shipmentId === picked.id && task.kind === "delivery")
        ?.blockedByHandoverId,
    ).toBe(handoverId);
    expect(
      tasks
        .filter((task) => task.shipmentId === waiting.id)
        .map((task) => task.blockedByHandoverId),
    ).toEqual([null, null]);
    expect(result.body.events.map((event) => event.type).slice(-2)).toEqual([
      "reassigned",
      "handover_requested",
    ]);
    expect(result.body.events.at(-2)).toMatchObject({
      fromCourier: { name: "Ana Ruiz" },
      toCourier: { name: "Beto Gómez" },
      reason: "Ana terminó su turno",
      actor: { name: "John Coordinador" },
    });
    // Each shipment still on its way records the change of courier (FR-016).
    for (const shipment of [picked, waiting]) {
      expect((await detail(shipment)).events.at(-1)).toMatchObject({
        type: "reassigned",
        reason: "Ana terminó su turno",
        changes: { courierId: ["Ana Ruiz", "Beto Gómez"] },
      });
    }
    expect((await detail(delivered)).events.at(-1)?.type).not.toBe("reassigned");
  });

  it("refuses a courier with a route in progress and a route in preparation", async () => {
    const route = await dispatched([await register()], ana);
    const betoRoute = await dispatched([await register()], beto);
    const busy = await reassignRoute(route, beto);
    expect(busy.status).toBe(409);
    expect(busy.body).toMatchObject({
      error: { code: "courier_busy", routeId: betoRoute.id, routeNumber: betoRoute.number },
    });

    const draft = await createRoute(t, cookie, { shipmentIds: [(await register()).id] });
    const notStarted = await reassignRoute(draft, beto);
    expect(notStarted.status).toBe(409);
    expect(notStarted.body).toMatchObject({ error: { code: "route_not_in_progress" } });
  });

  it("requires a reason and applies a repeated action once (FR-016, FR-020)", async () => {
    const route = await dispatched([await register()], ana);
    expect((await reassignRoute(route, beto, "no")).status).toBe(400);
    const body = {
      actionId: crypto.randomUUID(),
      version: route.version,
      courierId: beto,
      reason: "Ana terminó su turno",
    };
    const path = `/api/routes/${route.id}/reassign`;
    expect((await send<RouteDetail>(t, cookie, path, body)).status).toBe(200);
    const again = await send<RouteDetail>(t, cookie, path, body);
    expect(again.status).toBe(200);
    expect(again.body.events.filter((event) => event.type === "reassigned")).toHaveLength(1);
  });
});

describe("PATCH /api/couriers/:id deactivation (FR-010)", () => {
  it("answers with the courier's routes in preparation or in progress, which stay assigned", async () => {
    await dispatched([await register()], ana);
    await createRoute(t, cookie, { shipmentIds: [(await register()).id], courierId: ana });
    const deactivate = (id: string) =>
      send<{ openRoutes: number; isActive: boolean }>(
        t,
        cookie,
        `/api/couriers/${id}`,
        { actionId: crypto.randomUUID(), isActive: false },
        "PATCH",
      );
    const result = await deactivate(ana);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ isActive: false, openRoutes: 2 });
    expect((await deactivate(beto)).body).toMatchObject({ openRoutes: 0 });
  });
});
