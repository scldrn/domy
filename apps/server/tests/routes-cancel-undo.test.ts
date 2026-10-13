import type { RouteDetail, Shipment, ShipmentDetail, UnassignedShipment } from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import {
  createCourier,
  createRoute,
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
const draft = (list: Shipment[], courierId?: string) =>
  createRoute(t, cookie, {
    shipmentIds: list.map((shipment) => shipment.id),
    ...(courierId && { courierId }),
  });
async function dispatched(list: Shipment[], courierId: string): Promise<RouteDetail> {
  return (await routeAction(t, cookie, await draft(list, courierId), "/dispatch")).body;
}

const cancel = (route: RouteDetail, reason = "Ruta armada por error") =>
  routeAction(t, cookie, route, "/cancel", { reason });
const undo = (route: RouteDetail, reason = "Despachada al mensajero equivocado") =>
  routeAction(t, cookie, route, "/undo-dispatch", { reason });
const detail = async (shipment: Shipment) =>
  (await send<ShipmentDetail>(t, cookie, `/api/shipments/${shipment.id}`)).body;
const unassigned = async () =>
  (
    await send<{ shipments: UnassignedShipment[] }>(
      t,
      cookie,
      "/api/shipments/unassigned?date=2026-10-01",
    )
  ).body.shipments.map((shipment) => shipment.id);

describe("POST /api/routes/:id/cancel (FR-017)", () => {
  it("returns the shipments to «Registrado» and keeps the route as «Cancelada» with its number (scenario 1)", async () => {
    const first = await register();
    const second = await register();
    await draft([await register()]);
    const route = await draft([first, second], ana);

    const result = await cancel(route);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      id: route.id,
      number: 2,
      status: "cancelled",
      cancelReason: "Ruta armada por error",
      stops: [],
      codToCollect: 0,
    });
    expect(result.body.events.at(-1)).toMatchObject({
      type: "cancelled",
      reason: "Ruta armada por error",
      actor: { name: "John Coordinador" },
    });
    expect(await unassigned()).toEqual(expect.arrayContaining([first.id, second.id]));
    for (const shipment of [first, second]) {
      const shown = await detail(shipment);
      expect(shown).toMatchObject({ status: "registered", route: null });
      expect(shown.events.at(-1)).toMatchObject({
        type: "status_changed",
        fromStatus: "assigned",
        toStatus: "registered",
        reason: "Ruta armada por error",
      });
    }

    // The shipments join another route; the cancelled one never reopens (FR-012).
    expect((await draft([first, second], beto)).stops).not.toHaveLength(0);
    const again = await routeAction(t, cookie, result.body, "/shipments", {
      shipmentIds: [(await register()).id],
    });
    expect(again.status).toBe(409);
  });

  it("asks for a reason and acts once per action (FR-016, FR-020)", async () => {
    const route = await draft([await register()]);
    const short = await cancel(route, "no");
    expect(short.status).toBe(400);
    expect(short.body).toMatchObject({ error: { code: "invalid_request" } });

    const actionId = crypto.randomUUID();
    const body = { actionId, version: route.version, reason: "Ruta armada por error" };
    const first = await send<RouteDetail>(t, cookie, `/api/routes/${route.id}/cancel`, body);
    const replay = await send<RouteDetail>(t, cookie, `/api/routes/${route.id}/cancel`, body);
    expect(replay.status).toBe(200);
    expect(replay.body.version).toBe(first.body.version);
    expect(replay.body.events.filter((event) => event.type === "cancelled")).toHaveLength(1);
  });

  it("refuses a route in progress and explains the way out (scenario 2)", async () => {
    const shipment = await register();
    const route = await dispatched([shipment], ana);
    const refused = await cancel(route);
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({
      error: {
        code: "route_in_progress",
        message: expect.stringMatching(/quita o reasigna.*deshaz el despacho/i),
      },
    });
    expect((await detail(shipment)).status).toBe("dispatched");

    const done = await cancel((await cancel(await draft([await register()]))).body);
    expect(done.status).toBe(409);
  });
});

describe("POST /api/routes/:id/undo-dispatch (FR-026)", () => {
  it("returns the route to «En preparación» and its shipments to «Asignado», freeing the courier (scenario 3)", async () => {
    const first = await register();
    const second = await register();
    const route = await dispatched([first, second], ana);

    const result = await undo(route);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      status: "draft",
      dispatchedAt: null,
      courier: { name: "Ana Ruiz" },
    });
    expect(result.body.stops.flatMap((stop) => stop.tasks)).toHaveLength(4);
    expect(result.body.events.at(-1)).toMatchObject({
      type: "dispatch_undone",
      reason: "Despachada al mensajero equivocado",
      fromCourier: { name: "Ana Ruiz" },
      actor: { name: "John Coordinador" },
    });
    for (const shipment of [first, second]) {
      const shown = await detail(shipment);
      expect(shown.status).toBe("assigned");
      expect(shown.events.at(-1)).toMatchObject({
        type: "status_changed",
        fromStatus: "dispatched",
        toStatus: "assigned",
        reason: "Despachada al mensajero equivocado",
      });
    }

    // Ana may take another route now, and the undone one can change courier again.
    expect((await dispatched([await register()], ana)).status).toBe("in_progress");
    const changed = await routeAction(t, cookie, result.body, "", { courierId: beto }, "PATCH");
    expect(changed.status).toBe(200);
    expect((await routeAction(t, cookie, changed.body, "/dispatch")).body.status).toBe(
      "in_progress",
    );
  });

  it("refuses a route in preparation", async () => {
    const refused = await undo(await draft([await register()], ana));
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ error: { code: "route_not_in_progress" } });
  });

  it("refuses once a stop is completed (scenario 4)", async () => {
    const picked = await register();
    const waiting = await register();
    const route = await dispatched([picked, waiting], ana);
    await pickUp(database.db, picked.id, now);

    const refused = await undo(route);
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ error: { code: "route_has_completed_stops" } });
    expect((await detail(waiting)).status).toBe("dispatched");
  });

  it("refuses while the route holds a package received through a handover", async () => {
    const moved = await register();
    const from = await dispatched([moved, await register()], ana);
    const to = await dispatched([await register()], beto);
    await pickUp(database.db, moved.id, now);
    const reassigned = await send(t, cookie, `/api/shipments/${moved.id}/reassign`, {
      actionId: crypto.randomUUID(),
      toRouteId: to.id,
      reason: "Beto pasa por esa zona",
    });
    expect(reassigned.status).toBe(200);

    // Beto's route has no completed stop, but the package on it was already picked up.
    const latest = async (route: RouteDetail) =>
      (await send<RouteDetail>(t, cookie, `/api/routes/${route.id}`)).body;
    const current = await latest(to);
    expect(current.progress.completed).toBe(0);
    for (const route of [current, await latest(from)]) {
      const refused = await undo(route);
      expect(refused.status).toBe(409);
      expect(refused.body).toMatchObject({ error: { code: "route_has_completed_stops" } });
    }
  });
});
