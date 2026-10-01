import type { RouteDetail, ShipmentDetail } from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createCourier, createRoute, registerShipment, routeAction, send } from "./setup/routes.ts";

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
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
  courier = await createCourier(database.db);
});

async function routeWith(count: number, courierId?: string, serviceDate = "2026-10-01") {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push((await registerShipment(t, cookie, catalog, { serviceDate })).id);
  }
  return createRoute(t, cookie, {
    shipmentIds: ids,
    serviceDate,
    ...(courierId && { courierId }),
  });
}

describe("POST /api/routes/:id/dispatch (FR-009)", () => {
  it("puts the route in progress and its shipments on the way (scenario 3)", async () => {
    const route = await routeWith(2, courier);
    const result = await routeAction(t, cookie, route, "/dispatch");
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ status: "in_progress", dispatchedAt: expect.any(String) });
    expect(result.body.events.at(-1)).toMatchObject({ type: "dispatched" });
    const shipmentId = route.stops[0]?.tasks[0]?.shipmentId ?? "";
    const shipment = (await send<ShipmentDetail>(t, cookie, `/api/shipments/${shipmentId}`)).body;
    expect(shipment.status).toBe("dispatched");
    expect(shipment.events.at(-1)).toMatchObject({
      fromStatus: "assigned",
      toStatus: "dispatched",
    });
  });

  it("requires a courier and at least one shipment", async () => {
    const route = await routeWith(1);
    const result = await routeAction(t, cookie, route, "/dispatch");
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ error: { code: "courier_required" } });
  });

  it("refuses a second route in progress for the same courier, from any day (scenario 4)", async () => {
    // A route from yesterday still in progress counts.
    t.setNow("2026-09-30T15:00:00Z");
    const yesterday = await routeWith(1, courier, "2026-09-30");
    expect((await routeAction(t, cookie, yesterday, "/dispatch")).status).toBe(200);
    t.setNow("2026-10-01T15:00:00Z");

    const today = await routeWith(1, courier);
    const result = await routeAction(t, cookie, today, "/dispatch");
    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({
      error: { code: "courier_busy", routeNumber: yesterday.number, routeId: yesterday.id },
    });
  });

  it("lets only one of two simultaneous dispatches to a courier through", async () => {
    const first = await routeWith(1, courier);
    const second = await routeWith(1, courier);
    const results = await Promise.all([
      routeAction(t, cookie, first, "/dispatch"),
      routeAction(t, cookie, second, "/dispatch"),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  });

  it("applies a repeated dispatch once (FR-020)", async () => {
    const route = await routeWith(1, courier);
    const actionId = crypto.randomUUID();
    const body = { actionId, version: route.version };
    const first = await send<RouteDetail>(t, cookie, `/api/routes/${route.id}/dispatch`, body);
    const again = await send<RouteDetail>(t, cookie, `/api/routes/${route.id}/dispatch`, body);
    expect(again.status).toBe(200);
    expect(again.body.version).toBe(first.body.version);
    expect(again.body.events.filter((event) => event.type === "dispatched")).toHaveLength(1);
  });
});
