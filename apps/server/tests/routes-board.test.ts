import type { DispatchBoard, RouteDetail, RoutesBoard, Shipment } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { handovers } from "../src/db/schema/index.ts";
import { refreshRouteStatus } from "../src/lib/route-status.ts";
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

/** A route with a courier, dispatched (FR-009). */
async function dispatched(
  shipmentIds: string[],
  courierId: string,
  serviceDate = "2026-10-01",
): Promise<RouteDetail> {
  const route = await createRoute(t, cookie, { shipmentIds, courierId, serviceDate });
  const result = await routeAction(t, cookie, route, "/dispatch");
  expect(result.status).toBe(200);
  return result.body;
}

async function board(date = "2026-10-01"): Promise<RoutesBoard> {
  const result = await send<RoutesBoard>(t, cookie, `/api/routes/board?date=${date}`);
  expect(result.status).toBe(200);
  return result.body;
}

async function detail(routeId: string): Promise<RouteDetail> {
  return (await send<RouteDetail>(t, cookie, `/api/routes/${routeId}`)).body;
}

describe("GET /api/routes/board (FR-018)", () => {
  it("summarizes every route of the date and counts the unassigned shipments (scenario 1)", async () => {
    const ana = await createCourier(database.db, "Ana Ruiz");
    const beto = await createCourier(database.db, "Beto Mesa");
    const soon = await register({ codAmount: 40000, window: { preset: "before", end: "10:30" } });
    const later = await register({ codAmount: 60000, window: { preset: "before", end: "11:00" } });
    const plain = await register({ codAmount: 25000 });
    const first = await dispatched([soon.id, later.id], ana);
    const second = await dispatched([plain.id], beto);
    await register();
    await register();
    await register();
    await register({ serviceDate: "2026-09-30" });
    await register({ serviceDate: "2026-10-02" });

    // 10:45: the 10:30 window is late, the 11:00 one at risk.
    t.setNow("2026-10-01T15:45:00Z");
    const result = await board();
    expect(result).toMatchObject({
      date: "2026-10-01",
      serverTime: "2026-10-01T15:45:00.000Z",
      unassignedCount: 4,
      routesFromPreviousDays: [],
    });
    expect(result.routes).toEqual([
      {
        id: first.id,
        number: first.number,
        serviceDate: "2026-10-01",
        status: "in_progress",
        courier: { id: ana, name: "Ana Ruiz" },
        completedStops: 0,
        totalStops: 3,
        codToCollect: 100000,
        atRiskCount: 1,
        lateCount: 1,
        pendingHandovers: 0,
      },
      {
        id: second.id,
        number: second.number,
        serviceDate: "2026-10-01",
        status: "in_progress",
        courier: { id: beto, name: "Beto Mesa" },
        completedStops: 0,
        totalStops: 2,
        codToCollect: 25000,
        atRiskCount: 0,
        lateCount: 0,
        pendingHandovers: 0,
      },
    ]);
  });

  it("lists routes in preparation without a courier, and other dates apart", async () => {
    const shipment = await register();
    const draft = await createRoute(t, cookie, { shipmentIds: [shipment.id] });
    const future = await register({ serviceDate: "2026-10-02" });
    await createRoute(t, cookie, { shipmentIds: [future.id], serviceDate: "2026-10-02" });

    const today = await board();
    expect(today.routes).toHaveLength(1);
    expect(today.routes[0]).toMatchObject({ id: draft.id, status: "draft", courier: null });
    const tomorrow = await board("2026-10-02");
    expect(tomorrow.routes).toHaveLength(1);
    expect(tomorrow.unassignedCount).toBe(0);
  });

  it("counts completed stops whatever their position (scenarios 2 and 5)", async () => {
    const courier = await createCourier(database.db);
    const a = await register();
    const b = await register();
    const c = await register();
    const route = await dispatched([a.id, b.id, c.id], courier);
    for (const shipment of [a, b, c]) await pickUp(database.db, shipment.id);
    await finishTask(database.db, c.id, "delivered");

    const [summary] = (await board()).routes;
    expect(summary).toMatchObject({ completedStops: 2, totalStops: 4, status: "in_progress" });
    const stops = (await detail(route.id)).stops;
    expect(stops.map((stop) => stop.tasks.every((task) => task.status !== "pending"))).toEqual([
      true,
      false,
      false,
      true,
    ]);
  });

  it("finishes a route once every shipment is resolved, recording who and when (scenario 3)", async () => {
    const courier = await createCourier(database.db);
    const delivered = await register();
    const failed = await register();
    const route = await dispatched([delivered.id, failed.id], courier);
    for (const shipment of [delivered, failed]) await pickUp(database.db, shipment.id);
    await finishTask(database.db, delivered.id, "delivered");
    expect((await detail(route.id)).status).toBe("in_progress");
    await finishTask(database.db, failed.id, "exception");

    const finished = await detail(route.id);
    expect(finished.status).toBe("finished");
    expect(finished.finishedAt).not.toBeNull();
    expect(finished.events.at(-1)).toMatchObject({ type: "finished" });
    expect((await board()).routes[0]).toMatchObject({
      status: "finished",
      completedStops: 3,
      totalStops: 3,
    });
  });

  it("keeps a route in progress while a handover from it is pending (FR-012)", async () => {
    const ana = await createCourier(database.db, "Ana Ruiz");
    const beto = await createCourier(database.db, "Beto Mesa");
    const shipment = await register();
    const other = await register();
    const from = await dispatched([shipment.id], ana);
    const to = await dispatched([other.id], beto);
    await pickUp(database.db, shipment.id);
    const [handover] = await database.db
      .insert(handovers)
      .values({
        shipmentId: shipment.id,
        fromCourierId: ana,
        toCourierId: beto,
        fromRouteId: from.id,
        toRouteId: to.id,
        reason: "Se le dañó la moto",
        requestedBy: dispatcherId,
        requestedAt: new Date("2026-10-01T15:00:00Z"),
      })
      .returning({ id: handovers.id });
    await finishTask(database.db, shipment.id, "delivered");
    expect((await detail(from.id)).status).toBe("in_progress");
    expect((await board()).routes.find((route) => route.id === to.id)?.pendingHandovers).toBe(1);

    await database.db
      .update(handovers)
      .set({ status: "cancelled" })
      .where(eq(handovers.id, handover?.id ?? ""));
    await database.db.transaction((tx) =>
      refreshRouteStatus(tx, from.id, { actorUserId: dispatcherId, now: t.now() }),
    );
    expect((await detail(from.id)).status).toBe("finished");
  });

  it("lists routes still in progress from earlier dates on today's board only (scenario 6)", async () => {
    const courier = await createCourier(database.db);
    t.setNow("2026-09-30T15:00:00Z");
    const pending = await register({ serviceDate: "2026-09-30" });
    const done = await register({ serviceDate: "2026-09-30" });
    const route = await dispatched([pending.id, done.id], courier, "2026-09-30");
    for (const shipment of [pending, done]) await pickUp(database.db, shipment.id);
    await finishTask(database.db, done.id, "delivered");

    t.setNow("2026-10-01T15:00:00Z");
    const today = await board();
    expect(today.routes).toEqual([]);
    expect(today.routesFromPreviousDays).toMatchObject([
      { id: route.id, serviceDate: "2026-09-30", status: "in_progress", completedStops: 2 },
    ]);
    expect((await board("2026-10-02")).routesFromPreviousDays).toEqual([]);
  });
});

describe("GET /api/shipments/board with routes (FR-018; feature 001, FR-021 and FR-023)", () => {
  async function shipmentBoard(query = ""): Promise<DispatchBoard> {
    const result = await send<DispatchBoard>(t, cookie, `/api/shipments/board${query}`);
    expect(result.status).toBe(200);
    return result.body;
  }
  const find = (result: DispatchBoard, shipment: Shipment) =>
    result.shipments.find((item) => item.id === shipment.id);

  it("shows each shipment's route and courier, and filters by courier", async () => {
    const ana = await createCourier(database.db, "Ana Ruiz");
    const beto = await createCourier(database.db, "Beto Mesa");
    const first = await register();
    const second = await register();
    const loose = await register();
    const route = await dispatched([first.id], ana);
    const draft = await createRoute(t, cookie, { shipmentIds: [second.id], courierId: beto });

    const result = await shipmentBoard();
    expect(find(result, first)).toMatchObject({
      routeId: route.id,
      routeNumber: route.number,
      courier: { id: ana, name: "Ana Ruiz" },
    });
    expect(find(result, second)).toMatchObject({
      routeId: draft.id,
      routeNumber: draft.number,
      courier: { id: beto, name: "Beto Mesa" },
    });
    expect(find(result, loose)).toMatchObject({ routeId: null, routeNumber: null, courier: null });

    const filtered = await shipmentBoard(`?courierId=${ana}`);
    expect(filtered.shipments.map((item) => item.id)).toEqual([first.id]);
  });
});
