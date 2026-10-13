import type { Handover, RouteDetail, Shipment, ShipmentDetail } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { shipments } from "../src/db/schema/index.ts";
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
  cookie = (await t.signIn("dispatcher", { name: "John Coordinador" })).cookie;
  ana = await createCourier(database.db, "Ana Ruiz");
  beto = await createCourier(database.db, "Beto Gómez");
});

const register = () => registerShipment(t, cookie, catalog);

async function dispatched(shipmentList: Shipment[], courierId: string): Promise<RouteDetail> {
  const route = await createRoute(t, cookie, {
    shipmentIds: shipmentList.map((shipment) => shipment.id),
    courierId,
  });
  const result = await routeAction(t, cookie, route, "/dispatch");
  expect(result.status).toBe(200);
  return result.body;
}

type Reassigned = { shipment: Shipment; handover: Handover | null };
const reassign = (
  shipment: Shipment,
  toRouteId: string,
  reason = "La moto de Ana se varó",
  actionId = crypto.randomUUID(),
) =>
  send<Reassigned>(t, cookie, `/api/shipments/${shipment.id}/reassign`, {
    actionId,
    toRouteId,
    reason,
  });

const getRoute = async (id: string) =>
  (await send<RouteDetail>(t, cookie, `/api/routes/${id}`)).body;
const detail = async (shipment: Shipment) =>
  (await send<ShipmentDetail>(t, cookie, `/api/shipments/${shipment.id}`)).body;
const shape = (route: RouteDetail) =>
  route.stops.map(
    (stop) => `${stop.kind}:${stop.tasks.map((task) => task.shipment.trackingNumber).join("+")}`,
  );
const stopsOf = (...items: [string, ...Shipment[]][]) =>
  items.map(
    ([kind, ...list]) => `${kind}:${list.map((shipment) => shipment.trackingNumber).join("+")}`,
  );

describe("POST /api/shipments/:id/reassign (FR-014, FR-016)", () => {
  it("moves a shipment on the way with both stops to another courier's route (scenario 1)", async () => {
    const staying = await register();
    const moved = await register();
    const fromRoute = await dispatched([staying, moved], ana);
    const other = await register();
    const toRoute = await dispatched([other], beto);

    const result = await reassign(moved, toRoute.id);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ shipment: { status: "dispatched" }, handover: null });

    const from = await getRoute(fromRoute.id);
    const to = await getRoute(toRoute.id);
    expect(shape(from)).toEqual(stopsOf(["pickup", staying], ["delivery", staying]));
    expect(shape(to)).toEqual(
      stopsOf(["pickup", other, moved], ["delivery", other], ["delivery", moved]),
    );
    expect(from.version).toBeGreaterThan(fromRoute.version);
    expect(to.version).toBeGreaterThan(toRoute.version);
    for (const route of [from, to]) {
      expect(route.events.at(-1)).toMatchObject({
        type: "reassigned",
        shipment: { trackingNumber: moved.trackingNumber },
        fromCourier: { name: "Ana Ruiz" },
        toCourier: { name: "Beto Gómez" },
        reason: "La moto de Ana se varó",
        actor: { name: "John Coordinador" },
      });
    }
    const history = await detail(moved);
    expect(history.route).toMatchObject({ id: toRoute.id, courier: { name: "Beto Gómez" } });
    expect(history.events.at(-1)).toMatchObject({
      type: "reassigned",
      fromStatus: "dispatched",
      toStatus: "dispatched",
      reason: "La moto de Ana se varó",
      actor: { name: "John Coordinador" },
      changes: {
        courierId: ["Ana Ruiz", "Beto Gómez"],
        routeId: [`Ruta ${String(fromRoute.number)}`, `Ruta ${String(toRoute.number)}`],
      },
    });
  });

  it("takes the status of the target route", async () => {
    const assigned = await register();
    const draft = await createRoute(t, cookie, { shipmentIds: [assigned.id] });
    const onTheWay = await register();
    const inProgress = await dispatched([onTheWay], ana);

    expect((await reassign(assigned, inProgress.id)).body.shipment.status).toBe("dispatched");
    expect((await reassign(onTheWay, draft.id)).body.shipment.status).toBe("assigned");
    expect((await detail(onTheWay)).events.at(-1)).toMatchObject({
      type: "reassigned",
      fromStatus: "dispatched",
      toStatus: "assigned",
    });
  });

  it("moves a picked-up shipment only to a route in progress, with its delivery stop and a pending handover (scenario 2)", async () => {
    const picked = await register();
    const fromRoute = await dispatched([picked], ana);
    await pickUp(database.db, picked.id);
    const draft = await createRoute(t, cookie, { shipmentIds: [(await register()).id] });
    const toRoute = await dispatched([await register()], beto);

    const refused = await reassign(picked, draft.id);
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ error: { code: "route_not_in_progress" } });

    const result = await reassign(picked, toRoute.id);
    expect(result.status).toBe(200);
    expect(result.body.shipment.status).toBe("picked_up");
    expect(result.body.handover).toMatchObject({
      status: "pending",
      fromCourier: { name: "Ana Ruiz" },
      toCourier: { name: "Beto Gómez" },
      fromRouteId: fromRoute.id,
      toRouteId: toRoute.id,
      reason: "La moto de Ana se varó",
    });
    expect(shape(await getRoute(fromRoute.id))).toEqual(stopsOf(["pickup", picked]));
    const to = await getRoute(toRoute.id);
    const delivery = to.stops.at(-1);
    expect(delivery?.tasks[0]).toMatchObject({
      shipmentId: picked.id,
      kind: "delivery",
      blockedByHandoverId: result.body.handover?.id,
    });
    expect(to.events.map((event) => event.type).slice(-2)).toEqual([
      "reassigned",
      "handover_requested",
    ]);
    // Ana keeps the package until Beto confirms it (FR-025).
    const shipment = await detail(picked);
    expect(shipment.custodyCourier).toMatchObject({ name: "Ana Ruiz" });
    expect(shipment.handover).toMatchObject({ id: result.body.handover?.id, status: "pending" });
    const [row] = await database.db
      .select({ custody: shipments.custodyCourierId })
      .from(shipments)
      .where(eq(shipments.id, picked.id));
    expect(row?.custody).toBe(ana);
  });

  it("needs no handover to move a picked-up shipment back to the courier who holds it", async () => {
    const picked = await register();
    const fromRoute = await dispatched([picked], ana);
    await pickUp(database.db, picked.id);
    const toRoute = await dispatched([await register()], beto);
    const first = await reassign(picked, toRoute.id);

    const back = await reassign(picked, fromRoute.id, "Ana sí puede entregarlo");
    expect(back.status).toBe(200);
    expect(back.body.handover).toBeNull();
    const from = await getRoute(fromRoute.id);
    expect(shape(from)).toEqual(stopsOf(["pickup", picked], ["delivery", picked]));
    expect(from.stops[1]?.tasks[0]?.blockedByHandoverId).toBeNull();
    expect(from.handovers).toEqual([
      expect.objectContaining({ id: first.body.handover?.id, status: "cancelled" }),
    ]);
  });

  it("refuses shipments in Novedad, delivered, or not on a route, and a missing reason (scenario 6)", async () => {
    const failed = await register();
    const delivered = await register();
    const movable = await register();
    const route = await dispatched([failed, delivered, movable], ana);
    await pickUp(database.db, failed.id);
    await finishTask(database.db, failed.id, "exception");
    await pickUp(database.db, delivered.id);
    await finishTask(database.db, delivered.id, "delivered");
    const target = await dispatched([await register()], beto);

    for (const shipment of [failed, delivered, await register()]) {
      const refused = await reassign(shipment, target.id);
      expect(refused.status).toBe(409);
      expect(refused.body).toMatchObject({ error: { code: "shipment_not_movable" } });
    }
    expect((await reassign(movable, target.id, "no")).status).toBe(400);
    expect((await reassign(movable, target.id, "")).status).toBe(400);
    const same = await reassign(movable, route.id);
    expect(same.status).toBe(409);
  });

  it("applies a repeated reassignment once (FR-020)", async () => {
    const moved = await register();
    await dispatched([moved], ana);
    const target = await dispatched([await register()], beto);
    const actionId = crypto.randomUUID();
    expect((await reassign(moved, target.id, undefined, actionId)).status).toBe(200);
    expect((await reassign(moved, target.id, undefined, actionId)).status).toBe(200);
    const events = (await getRoute(target.id)).events.filter(
      (event) => event.type === "reassigned",
    );
    expect(events).toHaveLength(1);
  });
});
