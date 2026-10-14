import {
  courierRecordInput,
  type RouteDetail,
  type Shipment,
  type ShipmentStatus,
} from "@domy/domain";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../../src/db/client.ts";
import { couriers, routes, shipments } from "../../src/db/schema/index.ts";
import { applyCourierRecord } from "../../src/lib/courier-records.ts";

/**
 * Route helpers for integration tests. Pickups, deliveries, and exceptions go through the
 * courier records of feature 003, the only way tasks are completed and packages picked up.
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
async function routeOf(db: Db, shipmentId: string) {
  const [route] = await db
    .select({
      courierId: routes.courierId,
      createdBy: routes.createdBy,
      kind: shipments.kind,
    })
    .from(shipments)
    .innerJoin(routes, eq(routes.id, shipments.routeId))
    .where(eq(shipments.id, shipmentId));
  if (!route?.courierId) throw new Error("The shipment is not on a route with a courier");
  return { ...route, courierId: route.courierId };
}

/**
 * A record of the route's courier through `applyCourierRecord`, as the courier app sends it
 * (feature 003). Couriers of these tests have no account, so the route's author enters it.
 */
async function recordForRouteCourier(
  db: Db,
  shipmentId: string,
  record: Record<string, unknown>,
  at: Date,
) {
  const route = await routeOf(db, shipmentId);
  const result = await applyCourierRecord(
    db,
    courierRecordInput.parse({
      id: crypto.randomUUID(),
      shipmentId,
      occurredAt: at.toISOString(),
      ...record,
      ...(record["kind"] === "delivery" &&
        route.kind !== "errand" && { receivedByName: "Laura Gómez" }),
    }),
    { courierId: route.courierId, authorUserId: route.createdBy, onBehalf: false, recordedAt: at },
  );
  if (result.outcome !== "applied") {
    throw new Error(`The ${String(record["kind"])} record was ${result.outcome}`);
  }
}

/** The route's courier picks up the shipment and takes custody (feature 003). */
export async function pickUp(db: Db, shipmentId: string, at = new Date()): Promise<void> {
  await recordForRouteCourier(db, shipmentId, { kind: "pickup" }, at);
}

/**
 * The route's courier delivers the shipment (or completes the errand) or reports an exception,
 * and the route finishes when nothing is left (FR-012).
 */
export async function finishTask(
  db: Db,
  shipmentId: string,
  outcome: "delivered" | "exception",
  at = new Date(),
): Promise<void> {
  await recordForRouteCourier(
    db,
    shipmentId,
    outcome === "delivered"
      ? { kind: "delivery" }
      : { kind: "exception", reason: "recipient_absent" },
    at,
  );
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
