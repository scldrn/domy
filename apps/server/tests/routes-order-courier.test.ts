import type { RouteDetail } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { routeEvents } from "../src/db/schema/index.ts";
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
let route: RouteDetail;

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
  const a = await registerShipment(t, cookie, catalog);
  const b = await registerShipment(t, cookie, catalog, {
    pickupPointId: catalog.pickup.bullishSecondary,
  });
  route = await createRoute(t, cookie, { shipmentIds: [a.id, b.id] });
  // pickup a, pickup b, delivery a, delivery b
});

const ids = (detail: RouteDetail) => detail.stops.map((stop) => stop.id);
const reorder = (current: RouteDetail, stopIds: string[], actionId = crypto.randomUUID()) =>
  send<RouteDetail>(
    t,
    cookie,
    `/api/routes/${current.id}/stop-order`,
    { actionId, version: current.version, stopIds },
    "PUT",
  );

describe("PUT /api/routes/:id/stop-order (FR-006)", () => {
  it("accepts an order that keeps each delivery after its pickup", async () => {
    const [pa, pb, da, db] = ids(route);
    const result = await reorder(route, [pa, da, pb, db] as string[]);
    expect(result.status).toBe(200);
    expect(ids(result.body)).toEqual([pa, da, pb, db]);
    expect(result.body.stops.map((stop) => stop.position)).toEqual([0, 1, 2, 3]);
    expect(result.body.version).toBe(route.version + 1);
    expect(result.body.events.at(-1)).toMatchObject({ type: "reordered" });
  });

  it("refuses a delivery before its pickup (scenario 2)", async () => {
    const [pa, pb, da, db] = ids(route);
    const result = await reorder(route, [da, pa, pb, db] as string[]);
    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({
      error: {
        code: "invalid_stop_order",
        message: "La entrega de un envío debe quedar después de su recogida.",
      },
    });
  });

  it("refuses moving a completed stop", async () => {
    const courier = await createCourier(database.db);
    const assigned = await routeAction(t, cookie, route, "", { courierId: courier }, "PATCH");
    const dispatched = await routeAction(t, cookie, assigned.body, "/dispatch");
    await pickUp(database.db, route.stops[0]?.tasks[0]?.shipmentId ?? "");
    const [pa, pb, da, db] = ids(route);
    const result = await reorder(dispatched.body, [pb, pa, da, db] as string[]);
    expect(result.body).toMatchObject({
      error: { message: "Las paradas completadas no se mueven." },
    });
  });

  it("refuses a stale version and applies a repeated action once (FR-020, FR-021)", async () => {
    const [pa, pb, da, db] = ids(route);
    const actionId = crypto.randomUUID();
    const first = await reorder(route, [pa, da, pb, db] as string[], actionId);
    const again = await reorder(route, [pa, da, pb, db] as string[], actionId);
    expect(again.status).toBe(200);
    expect(again.body.version).toBe(first.body.version);
    const stale = await reorder(route, [pa, pb, db, da] as string[]);
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ error: { code: "version_conflict" } });
    const events = await database.db
      .select()
      .from(routeEvents)
      .where(eq(routeEvents.routeId, route.id));
    expect(events.filter((event) => event.type === "reordered")).toHaveLength(1);
  });
});

describe("PATCH /api/routes/:id (FR-008)", () => {
  it("sets and changes the courier of a route in preparation without a reason", async () => {
    const carlos = await createCourier(database.db, "Carlos Pérez");
    const juan = await createCourier(database.db, "Juan Mesa");
    const first = await routeAction(t, cookie, route, "", { courierId: carlos }, "PATCH");
    expect(first.body).toMatchObject({ courier: { id: carlos, name: "Carlos Pérez" } });
    const second = await routeAction(t, cookie, first.body, "", { courierId: juan }, "PATCH");
    expect(second.body.courier?.name).toBe("Juan Mesa");
    expect(second.body.events.filter((event) => event.type === "courier_set")).toMatchObject([
      { fromCourier: null, toCourier: { name: "Carlos Pérez" } },
      { fromCourier: { name: "Carlos Pérez" }, toCourier: { name: "Juan Mesa" } },
    ]);
  });

  it("offers only active couriers", async () => {
    const inactive = await createCourier(database.db, "Inactivo");
    await send(
      t,
      cookie,
      `/api/couriers/${inactive}`,
      { actionId: crypto.randomUUID(), isActive: false },
      "PATCH",
    );
    const result = await routeAction(t, cookie, route, "", { courierId: inactive }, "PATCH");
    expect(result.status).toBe(400);
  });
});
