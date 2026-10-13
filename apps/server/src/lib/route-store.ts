import {
  routeProgress,
  shipmentPlaces,
  type Handover,
  type RouteDetail,
  type RouteEvent,
  type RoutePlanShipment,
  type RouteStopPlan,
  type RouteTaskPlan,
  type ShipmentStatus,
} from "@domy/domain";
import { and, asc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "../db/client.ts";
import {
  couriers,
  handovers,
  merchants,
  neighborhoods,
  routeEvents,
  routes,
  routeStops,
  routeTasks,
  shipmentEvents,
  shipments,
  users,
} from "../db/schema/index.ts";
import { AppError } from "./errors.ts";

/**
 * Loading and saving routes (feature 002, research R1–R5). Every change runs in the caller's
 * transaction: the route rules of `@domy/domain` compute the new stops, and these helpers
 * write them, the shipment transitions, and the history.
 */

export type RouteRow = typeof routes.$inferSelect;
type StoredTask = RouteTaskPlan & { id: string };
export type StoredStop = Omit<RouteStopPlan, "tasks"> & { tasks: StoredTask[] };

export async function loadRouteRow(db: Executor, id: string): Promise<RouteRow> {
  const [route] = await db.select().from(routes).where(eq(routes.id, id));
  if (!route) throw new AppError("not_found", { message: "No encontramos esa ruta." });
  return route;
}

/** Bumps the version the user saw, or refuses a stale one (FR-021). */
export async function claimVersion(tx: Executor, routeId: string, version: number, now: Date) {
  const [row] = await tx
    .update(routes)
    .set({ version: sql`${routes.version} + 1`, updatedAt: now })
    .where(and(eq(routes.id, routeId), eq(routes.version, version)))
    .returning({ id: routes.id });
  if (!row) {
    throw new AppError("version_conflict", {
      message: "Esta ruta cambió; revisa la versión más reciente.",
    });
  }
}

/** The stops of a route in order, with their tasks. */
export async function loadPlan(db: Executor, routeId: string): Promise<StoredStop[]> {
  const stops = await db
    .select()
    .from(routeStops)
    .where(eq(routeStops.routeId, routeId))
    .orderBy(asc(routeStops.position));
  if (stops.length === 0) return [];
  const tasks = await db
    .select()
    .from(routeTasks)
    .where(
      inArray(
        routeTasks.stopId,
        stops.map((stop) => stop.id),
      ),
    )
    .orderBy(asc(routeTasks.id));
  return stops.map((stop) => ({
    id: stop.id,
    kind: stop.kind,
    address: stop.address,
    neighborhoodId: stop.neighborhoodId,
    tasks: tasks
      .filter((task) => task.stopId === stop.id)
      .map((task) => ({
        id: task.id,
        shipmentId: task.shipmentId,
        kind: task.kind,
        status: task.status,
      })),
  }));
}

/**
 * Writes a new arrangement of stops: removed pending tasks and empty stops are deleted
 * (research R10), new ones inserted, and positions rewritten. Positions first move out of
 * the way, so the unique `(route_id, position)` holds at every step.
 */
export async function savePlan(
  tx: Executor,
  routeId: string,
  before: StoredStop[],
  after: RouteStopPlan[],
): Promise<void> {
  const kept = new Set(
    after
      .flatMap((stop) => stop.tasks.map((task) => (task as Partial<StoredTask>).id))
      .filter(Boolean),
  );
  const removedTasks = before.flatMap((stop) => stop.tasks).filter((task) => !kept.has(task.id));
  if (removedTasks.length > 0) {
    await tx.delete(routeTasks).where(
      and(
        inArray(
          routeTasks.id,
          removedTasks.map((task) => task.id),
        ),
        eq(routeTasks.status, "pending"),
      ),
    );
  }
  const afterIds = new Set(after.map((stop) => stop.id));
  const removedStops = before.filter((stop) => !afterIds.has(stop.id)).map((stop) => stop.id);
  if (removedStops.length > 0)
    await tx.delete(routeStops).where(inArray(routeStops.id, removedStops));

  await tx
    .update(routeStops)
    .set({ position: sql`-${routeStops.position} - 1` })
    .where(eq(routeStops.routeId, routeId));
  const existing = new Set(before.map((stop) => stop.id));
  for (const [position, stop] of after.entries()) {
    if (existing.has(stop.id)) {
      await tx.update(routeStops).set({ position }).where(eq(routeStops.id, stop.id));
    } else {
      await tx.insert(routeStops).values({
        id: stop.id,
        routeId,
        position,
        kind: stop.kind,
        address: stop.address,
        neighborhoodId: stop.neighborhoodId,
      });
    }
    const added = stop.tasks.filter((task) => !(task as Partial<StoredTask>).id);
    if (added.length > 0) {
      await tx.insert(routeTasks).values(
        added.map((task) => ({
          stopId: stop.id,
          shipmentId: task.shipmentId,
          kind: task.kind,
          status: task.status,
        })),
      );
    }
  }
}

/** The shipments in the order given, as the route rules see them (FR-005). */
export async function planShipments(db: Executor, ids: string[]): Promise<RoutePlanShipment[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: shipments.id,
      kind: shipments.kind,
      pickupAddress: shipments.pickupAddress,
      pickupNeighborhoodId: shipments.pickupNeighborhoodId,
      recipientAddress: shipments.recipientAddress,
      recipientNeighborhoodId: shipments.recipientNeighborhoodId,
      recipientNeighborhoodName: neighborhoods.name,
    })
    .from(shipments)
    .leftJoin(neighborhoods, eq(neighborhoods.id, shipments.recipientNeighborhoodId))
    .where(inArray(shipments.id, ids));
  return ids.flatMap((id) => {
    const row = rows.find((candidate) => candidate.id === id);
    return row ? [{ id: row.id, kind: row.kind, ...shipmentPlaces(row) }] : [];
  });
}

/**
 * Moves shipments between statuses for a route, only from the statuses given, and records
 * each change with the route it refers to (FR-022). Returns the shipments that moved.
 */
export async function transitionShipments(
  tx: Executor,
  change: {
    ids: string[];
    from: ShipmentStatus[];
    to: ShipmentStatus;
    routeId: string | null;
    eventRouteId: string;
    actorUserId: string;
    occurredAt: Date;
    extraWhere?: SQL | undefined;
  },
): Promise<{ id: string; status: ShipmentStatus }[]> {
  if (change.ids.length === 0) return [];
  const before = await tx
    .select({ id: shipments.id, status: shipments.status })
    .from(shipments)
    .where(and(inArray(shipments.id, change.ids), inArray(shipments.status, change.from)));
  const moved = await tx
    .update(shipments)
    .set({
      status: change.to,
      routeId: change.routeId,
      version: sql`${shipments.version} + 1`,
      updatedAt: change.occurredAt,
    })
    .where(
      and(
        inArray(shipments.id, change.ids),
        inArray(shipments.status, change.from),
        change.extraWhere,
      ),
    )
    .returning({ id: shipments.id });
  const movedIds = new Set(moved.map((row) => row.id));
  const changed = before.filter((row) => movedIds.has(row.id));
  if (changed.length > 0) {
    await tx.insert(shipmentEvents).values(
      changed.map((row) => ({
        shipmentId: row.id,
        type: "status_changed" as const,
        fromStatus: row.status,
        toStatus: change.to,
        actorUserId: change.actorUserId,
        occurredAt: change.occurredAt,
        routeId: change.eventRouteId,
      })),
    );
  }
  return changed;
}

export type NewRouteEvent = Omit<typeof routeEvents.$inferInsert, "id" | "recordedAt">;

export async function recordRouteEvents(tx: Executor, events: NewRouteEvent[]): Promise<void> {
  if (events.length > 0) await tx.insert(routeEvents).values(events);
}

const completedBy = alias(couriers, "completed_by");
const fromCourier = alias(couriers, "from_courier");
const toCourier = alias(couriers, "to_courier");
const resolver = alias(users, "resolver");

export async function loadHandovers(db: Executor, where: SQL | undefined): Promise<Handover[]> {
  const rows = await db
    .select({
      handover: handovers,
      trackingNumber: shipments.trackingNumber,
      from: { id: fromCourier.id, name: fromCourier.name },
      to: { id: toCourier.id, name: toCourier.name },
      requestedBy: { id: users.id, name: users.name },
      resolvedBy: { id: resolver.id, name: resolver.name },
    })
    .from(handovers)
    .innerJoin(shipments, eq(shipments.id, handovers.shipmentId))
    .innerJoin(fromCourier, eq(fromCourier.id, handovers.fromCourierId))
    .innerJoin(toCourier, eq(toCourier.id, handovers.toCourierId))
    .innerJoin(users, eq(users.id, handovers.requestedBy))
    .leftJoin(resolver, eq(resolver.id, handovers.resolvedBy))
    .where(where)
    .orderBy(asc(handovers.requestedAt), asc(handovers.id));
  return rows.map(({ handover: h, ...names }) => ({
    id: h.id,
    shipment: { id: h.shipmentId, trackingNumber: names.trackingNumber },
    fromCourier: names.from,
    toCourier: names.to,
    fromRouteId: h.fromRouteId,
    toRouteId: h.toRouteId,
    reason: h.reason,
    status: h.status,
    requestedBy: names.requestedBy,
    requestedAt: h.requestedAt.toISOString(),
    resolvedBy: h.resolvedBy ? names.resolvedBy : null,
    resolvedAt: h.resolvedAt?.toISOString() ?? null,
    resolvedOnBehalf: h.resolvedOnBehalf,
  }));
}

/** A route with its stops, tasks, handovers, and history, as the API returns it (FR-019). */
export async function loadRouteDetail(db: Executor, id: string): Promise<RouteDetail> {
  const route = await loadRouteRow(db, id);
  const [courier] = route.courierId
    ? await db
        .select({ id: couriers.id, name: couriers.name, phone: couriers.phone })
        .from(couriers)
        .where(eq(couriers.id, route.courierId))
    : [];
  const stops = await db
    .select({ stop: routeStops, neighborhood: { id: neighborhoods.id, name: neighborhoods.name } })
    .from(routeStops)
    .leftJoin(neighborhoods, eq(neighborhoods.id, routeStops.neighborhoodId))
    .where(eq(routeStops.routeId, id))
    .orderBy(asc(routeStops.position));
  const tasks =
    stops.length === 0
      ? []
      : await db
          .select({
            task: routeTasks,
            shipment: shipments,
            merchant: { id: merchants.id, name: merchants.name },
            completedBy: { id: completedBy.id, name: completedBy.name },
          })
          .from(routeTasks)
          .innerJoin(shipments, eq(shipments.id, routeTasks.shipmentId))
          .innerJoin(merchants, eq(merchants.id, shipments.merchantId))
          .leftJoin(completedBy, eq(completedBy.id, routeTasks.completedByCourierId))
          .where(
            inArray(
              routeTasks.stopId,
              stops.map(({ stop }) => stop.id),
            ),
          )
          .orderBy(asc(routeTasks.id));
  const [cod] = await db
    .select({ total: sql<number>`coalesce(sum(${shipments.codAmount}), 0)::int` })
    .from(shipments)
    .where(eq(shipments.routeId, id));
  const events = await db
    .select({
      event: routeEvents,
      actor: { id: users.id, name: users.name },
      trackingNumber: shipments.trackingNumber,
      from: { id: fromCourier.id, name: fromCourier.name },
      to: { id: toCourier.id, name: toCourier.name },
    })
    .from(routeEvents)
    .innerJoin(users, eq(users.id, routeEvents.actorUserId))
    .leftJoin(shipments, eq(shipments.id, routeEvents.shipmentId))
    .leftJoin(fromCourier, eq(fromCourier.id, routeEvents.fromCourierId))
    .leftJoin(toCourier, eq(toCourier.id, routeEvents.toCourierId))
    .where(eq(routeEvents.routeId, id))
    .orderBy(asc(routeEvents.occurredAt), asc(routeEvents.id));

  const detailStops = stops.map(({ stop, neighborhood }) => ({
    id: stop.id,
    position: stop.position,
    kind: stop.kind,
    address: stop.address,
    neighborhood: stop.neighborhoodId ? neighborhood : null,
    tasks: tasks
      .filter(({ task }) => task.stopId === stop.id)
      .map(({ task, shipment: s, merchant, completedBy: by }) => ({
        id: task.id,
        shipmentId: task.shipmentId,
        kind: task.kind,
        status: task.status,
        completedAt: task.completedAt?.toISOString() ?? null,
        completedBy: task.completedByCourierId ? by : null,
        blockedByHandoverId: task.blockedByHandoverId,
        shipment: {
          trackingNumber: s.trackingNumber,
          kind: s.kind,
          status: s.status,
          merchant,
          recipientName: s.recipientName,
          windowStart: s.windowStart?.toISOString() ?? null,
          windowEnd: s.windowEnd?.toISOString() ?? null,
          codAmount: s.codAmount,
        },
      })),
  }));
  return {
    id: route.id,
    number: route.number,
    serviceDate: route.serviceDate,
    status: route.status,
    courier: courier ?? null,
    cancelReason: route.cancelReason,
    dispatchedAt: route.dispatchedAt?.toISOString() ?? null,
    finishedAt: route.finishedAt?.toISOString() ?? null,
    version: route.version,
    codToCollect: cod?.total ?? 0,
    progress: routeProgress(detailStops),
    stops: detailStops,
    handovers: await loadHandovers(
      db,
      or(eq(handovers.toRouteId, id), eq(handovers.fromRouteId, id)),
    ),
    events: events.map(({ event, actor, trackingNumber, from, to }): RouteEvent => ({
      id: event.id,
      type: event.type,
      actor,
      occurredAt: event.occurredAt.toISOString(),
      shipment:
        event.shipmentId && trackingNumber ? { id: event.shipmentId, trackingNumber } : null,
      fromCourier: event.fromCourierId ? from : null,
      toCourier: event.toCourierId ? to : null,
      reason: event.reason,
      changes: event.changes as Record<string, unknown> | null,
    })),
  };
}
