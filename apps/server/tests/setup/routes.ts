import type { RouteDetail, Shipment, ShipmentStatus } from "@domy/domain";
import { and, eq, sql } from "drizzle-orm";
import type { Db, Executor } from "../../src/db/client.ts";
import { couriers, routes, routeTasks, shipments } from "../../src/db/schema/index.ts";
import { refreshRouteStatus } from "../../src/lib/route-status.ts";

/**
 * Route helpers for integration tests. The database helpers stand in for feature 003 (the
 * courier app), which is the only one that completes tasks and picks up packages.
 */

export async function createCourier(db: Db, name = "Carlos Pérez"): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(couriers).values({ id, name, phone: "3004445566" });
  return id;
}

/**
 * Puts a shipment in a route status directly, on a route of its own, for tests of other
 * features that only need the status (a shipment "Asignado" must be on a route).
 */
export async function placeOnRoute(
  db: Db,
  shipmentId: string,
  status: Extract<ShipmentStatus, "assigned" | "dispatched" | "picked_up">,
  createdBy: string,
): Promise<string> {
  const [shipment] = await db
    .select({ serviceDate: shipments.serviceDate })
    .from(shipments)
    .where(eq(shipments.id, shipmentId));
  const courierId = status === "assigned" ? null : await createCourier(db, "Mensajero de prueba");
  const routeId = crypto.randomUUID();
  await db.insert(routes).values({
    id: routeId,
    serviceDate: shipment?.serviceDate ?? "2026-10-01",
    number: sql`(select coalesce(max(${routes.number}), 0) + 1 from ${routes})`,
    courierId,
    status: status === "assigned" ? "draft" : "in_progress",
    createdBy,
  });
  await db
    .update(shipments)
    .set({ status, routeId, ...(status === "picked_up" && { custodyCourierId: courierId }) })
    .where(eq(shipments.id, shipmentId));
  return routeId;
}

/** The route carrying a shipment, with its courier and its author. */
async function routeOf(db: Executor, shipmentId: string) {
  const [route] = await db
    .select({ id: routes.id, courierId: routes.courierId, createdBy: routes.createdBy })
    .from(shipments)
    .innerJoin(routes, eq(routes.id, shipments.routeId))
    .where(eq(shipments.id, shipmentId));
  if (!route) throw new Error("The shipment is not on a route");
  return route;
}

/**
 * Completes the pending pickup task of a shipment and marks it picked up by the route's
 * courier, as the courier app will (feature 003).
 */
export async function pickUp(db: Db, shipmentId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const route = await routeOf(tx, shipmentId);
    await tx
      .update(routeTasks)
      .set({ status: "completed", completedAt: new Date(), completedByCourierId: route.courierId })
      .where(
        and(
          eq(routeTasks.shipmentId, shipmentId),
          eq(routeTasks.kind, "pickup"),
          eq(routeTasks.status, "pending"),
        ),
      );
    await tx
      .update(shipments)
      .set({ status: "picked_up", custodyCourierId: route.courierId })
      .where(eq(shipments.id, shipmentId));
    // The route's author stands in for the courier who will record it (feature 003).
    await refreshRouteStatus(tx, route.id, { actorUserId: route.createdBy, now: new Date() });
  });
}

/**
 * Completes or fails the pending delivery (or errand) task of a shipment directly, and
 * finishes the route when nothing is left (FR-012), as the courier app will (feature 003).
 */
export async function finishTask(
  db: Db,
  shipmentId: string,
  outcome: "delivered" | "exception",
): Promise<void> {
  await db.transaction(async (tx) => {
    const route = await routeOf(tx, shipmentId);
    await tx
      .update(routeTasks)
      .set({
        status: outcome === "delivered" ? "completed" : "failed",
        completedAt: new Date(),
        completedByCourierId: route.courierId,
      })
      .where(
        and(
          eq(routeTasks.shipmentId, shipmentId),
          eq(routeTasks.status, "pending"),
          sql`${routeTasks.kind} in ('delivery', 'errand')`,
        ),
      );
    await tx.update(shipments).set({ status: outcome }).where(eq(shipments.id, shipmentId));
    await refreshRouteStatus(tx, route.id, { actorUserId: route.createdBy, now: new Date() });
  });
}

type TestApp = {
  request: (
    path: string,
    init?: { method?: string; cookie?: string; body?: unknown },
  ) => Promise<Response>;
};

/** Registers a delivery through the API (feature 001), Bullish Hype to Laureles by default. */
export async function registerShipment(
  t: TestApp,
  cookie: string,
  catalog: {
    merchant: { bullish: string };
    pickup: { bullish: string };
    place: { laureles: string };
  },
  overrides: Record<string, unknown> = {},
): Promise<Shipment> {
  const response = await t.request("/api/shipments", {
    method: "POST",
    cookie,
    body: {
      id: crypto.randomUUID(),
      kind: "delivery",
      merchantId: catalog.merchant.bullish,
      pickupPointId: catalog.pickup.bullish,
      recipientName: "Laura Gómez",
      recipientPhone: "3001234567",
      recipientAddress: "Calle 10 # 43-12",
      recipientNeighborhoodId: catalog.place.laureles,
      paymentMode: "cash_on_delivery",
      codAmount: 50000,
      fee: 13000,
      ...overrides,
    },
  });
  if (response.status !== 201) {
    throw new Error(`Registration failed: ${String(response.status)} ${await response.text()}`);
  }
  return (await response.json()) as Shipment;
}

/** Sends a JSON request and returns the status and body, typed by the caller. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names the response shape.
export async function send<T = Record<string, unknown>>(
  t: TestApp,
  cookie: string,
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<{ status: number; body: T }> {
  const response = await t.request(path, { method, cookie, body });
  return { status: response.status, body: (await response.json().catch(() => ({}))) as T };
}

/** Creates a route through the API and returns it. */
export async function createRoute(
  t: TestApp,
  cookie: string,
  input: { serviceDate?: string; shipmentIds: string[]; courierId?: string; confirmed?: boolean },
): Promise<RouteDetail> {
  const result = await send<RouteDetail>(t, cookie, "/api/routes", {
    id: crypto.randomUUID(),
    actionId: crypto.randomUUID(),
    serviceDate: "2026-10-01",
    ...input,
  });
  if (result.status !== 201)
    throw new Error(`Route creation failed: ${JSON.stringify(result.body)}`);
  return result.body;
}

/** Sends a route action with a new `actionId` and the route's current `version`. */
export function routeAction(
  t: TestApp,
  cookie: string,
  route: { id: string; version: number },
  path: string,
  body: Record<string, unknown> = {},
  method = "POST",
) {
  return send<RouteDetail>(
    t,
    cookie,
    `/api/routes/${route.id}${path}`,
    { actionId: crypto.randomUUID(), version: route.version, ...body },
    method,
  );
}
