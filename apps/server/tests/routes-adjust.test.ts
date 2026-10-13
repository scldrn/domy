import type { RouteDetail, Shipment, ShipmentDetail, UnassignedShipment } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { routeTasks, shipments } from "../src/db/schema/index.ts";
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
let courier: string;

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
  cookie = (await t.signIn("dispatcher", { name: "John Coordinador" })).cookie;
  courier = await createCourier(database.db);
});

const register = (overrides: Record<string, unknown> = {}) =>
  registerShipment(t, cookie, catalog, overrides);
/** A shipment picked up at the merchant's second pickup point, "Local Laureles". */
const registerAtLocal = () => register({ pickupPointId: catalog.pickup.bullishSecondary });

/** Each stop as `kind:tracking numbers`, in order. */
const shape = (route: RouteDetail) =>
  route.stops.map(
    (stop) => `${stop.kind}:${stop.tasks.map((task) => task.shipment.trackingNumber).join("+")}`,
  );
const stopsOf = (...items: [string, ...Shipment[]][]) =>
  items.map(
    ([kind, ...list]) => `${kind}:${list.map((shipment) => shipment.trackingNumber).join("+")}`,
  );

async function dispatched(shipmentIds: string[]): Promise<RouteDetail> {
  const route = await createRoute(t, cookie, { shipmentIds, courierId: courier });
  const result = await routeAction(t, cookie, route, "/dispatch");
  expect(result.status).toBe(200);
  return result.body;
}

const add = (route: RouteDetail, shipmentIds: string[], extra: Record<string, unknown> = {}) =>
  routeAction(t, cookie, route, "/shipments", { shipmentIds, ...extra });
const remove = (route: RouteDetail, shipment: Shipment) =>
  routeAction(t, cookie, route, `/shipments/${shipment.id}/remove`);
const getRoute = async (id: string) =>
  (await send<RouteDetail>(t, cookie, `/api/routes/${id}`)).body;
const detail = async (shipment: Shipment) =>
  (await send<ShipmentDetail>(t, cookie, `/api/shipments/${shipment.id}`)).body;

async function routeIdOf(shipment: Shipment) {
  const [row] = await database.db
    .select({ routeId: shipments.routeId })
    .from(shipments)
    .where(eq(shipments.id, shipment.id));
  return row?.routeId;
}

describe("POST /api/routes/:id/shipments (FR-011)", () => {
  it("adds to a route in progress at the pending pickup stop of its place, on the way at once (scenario 1)", async () => {
    const first = await register();
    const route = await dispatched([first.id]);
    const sameBodega = await register();
    const elsewhere = await registerAtLocal();

    const result = await add(route, [sameBodega.id, elsewhere.id]);
    expect(result.status).toBe(200);
    expect(shape(result.body)).toEqual(
      stopsOf(
        ["pickup", first, sameBodega],
        ["delivery", first],
        ["delivery", sameBodega],
        ["pickup", elsewhere],
        ["delivery", elsewhere],
      ),
    );
    expect(result.body.codToCollect).toBe(150000);
    expect(
      result.body.events
        .filter((event) => event.type === "shipment_added")
        .map((event) => [event.shipment?.trackingNumber, event.actor.name]),
    ).toEqual([
      [sameBodega.trackingNumber, "John Coordinador"],
      [elsewhere.trackingNumber, "John Coordinador"],
    ]);
    const added = await detail(sameBodega);
    expect(added.status).toBe("dispatched");
    expect(added.events.at(-1)).toMatchObject({ fromStatus: "registered", toStatus: "dispatched" });
    expect(await routeIdOf(sameBodega)).toBe(route.id);
  });

  it("gives a new pickup stop at the end when the stop of its place is done", async () => {
    const first = await register();
    const route = await dispatched([first.id]);
    await pickUp(database.db, first.id);
    const later = await register();

    const result = await add(route, [later.id]);
    expect(shape(result.body)).toEqual(
      stopsOf(["pickup", first], ["delivery", first], ["pickup", later], ["delivery", later]),
    );
  });

  it("assigns the shipment in a route in preparation", async () => {
    const route = await createRoute(t, cookie, { shipmentIds: [(await register()).id] });
    const added = await register();
    expect((await add(route, [added.id])).status).toBe(200);
    expect((await detail(added)).status).toBe("assigned");
  });

  it("refuses a shipment on another route or dated after the route, and keeps older ones' dates (FR-003, FR-004)", async () => {
    const onRoute = await register();
    await createRoute(t, cookie, { shipmentIds: [onRoute.id] });
    const tomorrow = await register({ serviceDate: "2026-10-02" });
    const route = await createRoute(t, cookie, { shipmentIds: [(await register()).id] });

    for (const shipment of [onRoute, tomorrow]) {
      const refused = await add(route, [shipment.id]);
      expect(refused.status).toBe(409);
      expect(refused.body).toMatchObject({ error: { code: "shipment_not_registered" } });
    }
    const unchanged = await getRoute(route.id);
    expect(unchanged.version).toBe(route.version);
    expect(unchanged.stops).toHaveLength(2);

    // A pending shipment of an earlier day joins today's route with its own date (EC-06).
    const yesterday = await register({ serviceDate: "2026-09-30" });
    expect((await add(route, [yesterday.id])).status).toBe(200);
    expect((await detail(yesterday)).serviceDate).toBe("2026-09-30");
    // A route for tomorrow takes tomorrow's shipments.
    const tomorrowRoute = await createRoute(t, cookie, {
      serviceDate: "2026-10-02",
      shipmentIds: [(await register({ serviceDate: "2026-10-02" })).id],
    });
    expect((await add(tomorrowRoute, [tomorrow.id])).status).toBe(200);
  });

  it("asks for confirmation when the route grows beyond 15 shipments (FR-005)", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 15; i++) ids.push((await register()).id);
    const route = await createRoute(t, cookie, { shipmentIds: ids });
    const sixteenth = await register();

    const asked = await add(route, [sixteenth.id]);
    expect(asked.status).toBe(422);
    expect(asked.body).toMatchObject({ error: { code: "confirmation_required" } });
    expect((await add(route, [sixteenth.id], { confirmed: true })).status).toBe(200);
  });

  it("applies a repeated action once and refuses a stale version (FR-020, FR-021)", async () => {
    const route = await createRoute(t, cookie, { shipmentIds: [(await register()).id] });
    const added = await register();
    const body = { actionId: crypto.randomUUID(), version: route.version, shipmentIds: [added.id] };
    const first = await send<RouteDetail>(t, cookie, `/api/routes/${route.id}/shipments`, body);
    const again = await send<RouteDetail>(t, cookie, `/api/routes/${route.id}/shipments`, body);
    expect(again.status).toBe(200);
    expect(again.body.version).toBe(first.body.version);
    expect(again.body.events.filter((event) => event.type === "shipment_added")).toHaveLength(1);

    const stale = await add(route, [(await register()).id]);
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ error: { code: "version_conflict" } });
  });
});

describe("POST /api/routes/:id/shipments/:shipmentId/remove (FR-012)", () => {
  it("returns a shipment not picked up to registered, without its stops (scenario 2)", async () => {
    const kept = await register();
    const removed = await registerAtLocal();
    const route = await dispatched([kept.id, removed.id]);

    const result = await remove(route, removed);
    expect(result.status).toBe(200);
    expect(shape(result.body)).toEqual(stopsOf(["pickup", kept], ["delivery", kept]));
    expect(result.body.codToCollect).toBe(50000);
    expect(result.body.events.at(-1)).toMatchObject({
      type: "shipment_removed",
      shipment: { trackingNumber: removed.trackingNumber },
      actor: { name: "John Coordinador" },
    });
    const back = await detail(removed);
    expect(back.status).toBe("registered");
    expect(back.events.at(-1)).toMatchObject({ fromStatus: "dispatched", toStatus: "registered" });
    expect(await routeIdOf(removed)).toBeNull();
    expect(
      await database.db.select().from(routeTasks).where(eq(routeTasks.shipmentId, removed.id)),
    ).toEqual([]);
    const { body } = await send<{ shipments: UnassignedShipment[] }>(
      t,
      cookie,
      "/api/shipments/unassigned?date=2026-10-01",
    );
    expect(body.shipments.map((shipment) => shipment.id)).toEqual([removed.id]);
  });

  it("refuses a picked-up shipment, one in Novedad, one delivered, and one on another route (scenario 3)", async () => {
    const pickedUp = await register();
    const failed = await register();
    const delivered = await register();
    const route = await dispatched([pickedUp.id, failed.id, delivered.id]);
    await pickUp(database.db, pickedUp.id);
    await pickUp(database.db, failed.id);
    await finishTask(database.db, failed.id, "exception");
    await pickUp(database.db, delivered.id);
    await finishTask(database.db, delivered.id, "delivered");

    const picked = await remove(route, pickedUp);
    expect(picked.status).toBe(409);
    expect(picked.body).toMatchObject({ error: { code: "shipment_picked_up" } });
    for (const shipment of [failed, delivered]) {
      const refused = await remove(route, shipment);
      expect(refused.status).toBe(409);
      expect(refused.body).toMatchObject({ error: { code: "shipment_not_movable" } });
    }
    const other = await register();
    await createRoute(t, cookie, { shipmentIds: [other.id] });
    expect((await remove(route, other)).status).toBe(404);
    expect((await getRoute(route.id)).version).toBe(route.version);
  });

  it("finishes a route in progress once its last pending shipment leaves; an empty route in preparation stays (FR-012, EC-08)", async () => {
    const delivered = await register();
    const removed = await register();
    const route = await dispatched([delivered.id, removed.id]);
    await pickUp(database.db, delivered.id);
    await finishTask(database.db, delivered.id, "delivered");

    const result = await remove(route, removed);
    expect(result.body).toMatchObject({ status: "finished", finishedAt: expect.any(String) });
    expect(result.body.events.slice(-2).map((event) => event.type)).toEqual([
      "shipment_removed",
      "finished",
    ]);

    const only = await register();
    const draft = await createRoute(t, cookie, { shipmentIds: [only.id] });
    const emptied = await remove(draft, only);
    expect(emptied.body).toMatchObject({ status: "draft", stops: [] });
  });

  it("applies a repeated removal once (FR-020)", async () => {
    const kept = await register();
    const removed = await register();
    const route = await createRoute(t, cookie, { shipmentIds: [kept.id, removed.id] });
    const body = { actionId: crypto.randomUUID(), version: route.version };
    const path = `/api/routes/${route.id}/shipments/${removed.id}/remove`;
    const first = await send<RouteDetail>(t, cookie, path, body);
    const again = await send<RouteDetail>(t, cookie, path, body);
    expect(again.status).toBe(200);
    expect(again.body.version).toBe(first.body.version);
    expect(again.body.events.filter((event) => event.type === "shipment_removed")).toHaveLength(1);
  });
});

describe("Shipment changes on a route (FR-013)", () => {
  it("takes a voided shipment off its route in the same operation (scenario 5)", async () => {
    const kept = await register();
    const voided = await registerAtLocal();
    const route = await dispatched([kept.id, voided.id]);

    const result = await send(t, cookie, `/api/shipments/${voided.id}/void`, {
      actionId: crypto.randomUUID(),
      version: (await detail(voided)).version,
      reason: "Cliente canceló el pedido",
    });
    expect(result.status).toBe(200);
    const after = await getRoute(route.id);
    expect(shape(after)).toEqual(stopsOf(["pickup", kept], ["delivery", kept]));
    expect(after.version).toBeGreaterThan(route.version);
    expect(after.codToCollect).toBe(50000);
    expect(after.events.at(-1)).toMatchObject({
      type: "shipment_removed",
      shipment: { trackingNumber: voided.trackingNumber },
      reason: "Cliente canceló el pedido",
    });
    expect(await routeIdOf(voided)).toBeNull();

    // Voiding the last pending shipment finishes the route in progress (FR-012).
    await send(t, cookie, `/api/shipments/${kept.id}/void`, {
      actionId: crypto.randomUUID(),
      version: (await detail(kept)).version,
      reason: "Cliente canceló el pedido",
    });
    expect((await getRoute(route.id)).status).toBe("finished");
  });

  it("updates the stops of a shipment whose address or pickup point changes (EC-05)", async () => {
    const first = await register();
    const edited = await register();
    const route = await createRoute(t, cookie, { shipmentIds: [first.id, edited.id] });
    const edit = async (changes: Record<string, unknown>) => {
      const result = await send(
        t,
        cookie,
        `/api/shipments/${edited.id}`,
        { actionId: crypto.randomUUID(), version: (await detail(edited)).version, ...changes },
        "PATCH",
      );
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      return getRoute(route.id);
    };

    // Other fields leave the route alone.
    expect((await edit({ instructions: "Llamar antes" })).version).toBe(route.version);

    const moved = await edit({ recipientAddress: "Calle 50 # 20-30" });
    expect(moved.stops[2]).toMatchObject({ id: route.stops[2]?.id, address: "Calle 50 # 20-30" });
    expect(moved.version).toBeGreaterThan(route.version);

    // Its pickup leaves the shared stop for a new one right before its delivery.
    const repicked = await edit({ pickupPointId: catalog.pickup.bullishSecondary });
    expect(shape(repicked)).toEqual(
      stopsOf(["pickup", first], ["delivery", first], ["pickup", edited], ["delivery", edited]),
    );
    expect(repicked.stops[2]).toMatchObject({ address: "Cq 1 # 70-20" });
  });
});
