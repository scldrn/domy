import {
  removeShipmentFromStops,
  routeProgress,
  safeIntegerCop,
  shipmentFlag,
  shipmentPlaces,
  type Handover,
  type RouteDetail,
  type RouteEvent,
  type RoutePlanShipment,
  type RouteStopPlan,
  type RouteSummary,
  type RouteTaskPlan,
  type ShipmentStatus,
  type Place,
  type NoticeType,
} from "@domy/domain";
import { and, asc, eq, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "../db/client.ts";
import {
  couriers,
  courierNotices,
  companySettings,
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
import { notifyCourier } from "./notices.ts";

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
      // The place changes when its shipment is edited (FR-013).
      await tx
        .update(routeStops)
        .set({ position, address: stop.address, neighborhoodId: stop.neighborhoodId })
        .where(eq(routeStops.id, stop.id));
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

/**
 * Takes a shipment's pending tasks off a route, with any stop left empty, and returns the
 * event that records it: the stops before and after, and what the deleted stops held
 * (FR-012, FR-013, research R10).
 */
export async function removeFromPlan(
  tx: Executor,
  routeId: string,
  shipmentId: string,
  event: { actorUserId: string; occurredAt: Date; reason?: string },
): Promise<NewRouteEvent> {
  const before = await loadPlan(tx, routeId);
  const after = removeShipmentFromStops(before, shipmentId);
  await savePlan(tx, routeId, before, after);
  const kept = new Set(after.map((stop) => stop.id));
  return {
    routeId,
    type: "shipment_removed",
    shipmentId,
    ...event,
    changes: {
      before: before.map((stop) => stop.id),
      after: after.map((stop) => stop.id),
      removedStops: before
        .filter((stop) => !kept.has(stop.id))
        .map(({ id, kind, address, neighborhoodId }) => ({ id, kind, address, neighborhoodId })),
    },
  };
}

/** A new version for a route changed through one of its shipments (research R5). */
export async function touchRoute(tx: Executor, routeId: string, now: Date): Promise<void> {
  await tx
    .update(routes)
    .set({ version: sql`${routes.version} + 1`, updatedAt: now })
    .where(eq(routes.id, routeId));
}

/** The configured office pickup shared by all FR-041 consumers. */
export async function loadOfficePlace(db: Executor): Promise<Place> {
  const [row] = await db.select().from(companySettings);
  if (!row?.officeAddress || !row.officeNeighborhoodId) throw new AppError("office_not_configured");
  return { address: row.officeAddress, neighborhoodId: row.officeNeighborhoodId };
}

/** The shipments in the order given, as the route rules see them (FR-005). */
export async function planShipments(
  db: Executor,
  ids: string[],
  options: { heldPurpose?: "delivery" | "return" } = {},
): Promise<RoutePlanShipment[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: shipments.id,
      kind: shipments.kind,
      heldAtOffice: shipments.heldAtOffice,
      returnDecided: shipments.returnDecided,
      pickupAddress: shipments.pickupAddress,
      pickupNeighborhoodId: shipments.pickupNeighborhoodId,
      recipientAddress: shipments.recipientAddress,
      recipientNeighborhoodId: shipments.recipientNeighborhoodId,
      recipientNeighborhoodName: neighborhoods.name,
    })
    .from(shipments)
    .leftJoin(neighborhoods, eq(neighborhoods.id, shipments.recipientNeighborhoodId))
    .where(inArray(shipments.id, ids));
  // FR-029/T105: immutable completed stops retain the actual first pickup even after
  // an office-held new attempt becomes editable. Later office pickups are not its sender.
  const pickups =
    options.heldPurpose === "return"
      ? await db
          .select({
            shipmentId: routeTasks.shipmentId,
            address: routeStops.address,
            neighborhoodId: routeStops.neighborhoodId,
          })
          .from(routeTasks)
          .innerJoin(routeStops, eq(routeStops.id, routeTasks.stopId))
          .where(
            and(
              inArray(routeTasks.shipmentId, ids),
              eq(routeTasks.kind, "pickup"),
              eq(routeTasks.status, "completed"),
            ),
          )
          .orderBy(asc(routeTasks.completedAt), asc(routeTasks.id))
      : [];
  // FR-041: ordinary routing picks up at the office; held routing supplies it separately.
  const office =
    !options.heldPurpose && rows.some((row) => row.heldAtOffice && !row.returnDecided)
      ? await loadOfficePlace(db)
      : null;
  return ids.flatMap((id) => {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) return [];
    const firstPickup = pickups.find((pickup) => pickup.shipmentId === id);
    return [
      {
        id: row.id,
        kind: row.kind,
        ...shipmentPlaces(row),
        ...(firstPickup && {
          pickup: { address: firstPickup.address, neighborhoodId: firstPickup.neighborhoodId },
        }),
        ...(row.heldAtOffice && !row.returnDecided && office && { pickup: office }),
      },
    ];
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
    /** The reason of a route action that moves them back (FR-017, FR-026). */
    reason?: string;
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
        reason: change.reason ?? null,
      })),
    );
  }
  return changed;
}

export type NewRouteEvent = Omit<typeof routeEvents.$inferInsert, "id" | "recordedAt">;

export async function recordRouteEvents(
  tx: Executor,
  events: NewRouteEvent[],
  noticeIds?: string[],
  noticeOverride?: NoticeType | false,
): Promise<void> {
  if (events.length > 0) await tx.insert(routeEvents).values(events);
  const emitted = new Set<string>();
  for (const event of events) {
    const [route] = await tx.select().from(routes).where(eq(routes.id, event.routeId));
    if (!route) continue;
    const handover = event.type.startsWith("handover_");
    const wholeReassignment = event.type === "reassigned" && !event.shipmentId;
    const direct: Partial<Record<NewRouteEvent["type"], NoticeType>> = {
      dispatched: "route_dispatched",
      dispatch_undone: "dispatch_undone",
      handover_requested: "handover_requested",
      handover_cancelled: "handover_cancelled",
      handover_confirmed: "handover_confirmed",
      shipment_added: "shipment_added",
      shipment_removed: "shipment_removed",
      reordered: "stops_reordered",
    };
    let inferred = direct[event.type];
    if (wholeReassignment) inferred = "route_reassigned";
    else if (event.type === "reassigned")
      inferred =
        event.changes && typeof event.changes === "object" && "toRouteId" in event.changes
          ? "shipment_reassigned_out"
          : "shipment_reassigned_in";
    const type = noticeOverride === false ? null : (noticeOverride ?? inferred);
    if (!type) continue;
    // Draft routes are never on a phone. Undo and whole reassignment name their old courier explicitly.
    if (!handover && !wholeReassignment && event.type !== "dispatch_undone" && !route.dispatchedAt)
      continue;
    const recipients =
      handover || wholeReassignment ? [event.fromCourierId, event.toCourierId] : [route.courierId];
    for (const courierId of recipients) {
      if (!courierId) continue;
      const key = `${courierId}:${type}:${event.shipmentId ?? event.routeId}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      await notifyCourier(
        tx,
        courierId,
        type,
        { routeId: event.routeId, shipmentId: event.shipmentId ?? null },
        event.occurredAt,
        noticeIds,
      );
    }
  }
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

/** Shipments on no route up to a date: "Sin asignar" (FR-001, data model §Derived values). */
export function unassignedUpTo(date: string): SQL | undefined {
  return and(
    isNull(shipments.routeId),
    or(
      inArray(shipments.status, ["registered", "picked_up"]),
      and(eq(shipments.status, "exception"), eq(shipments.returnDecided, true)),
    ),
    lte(shipments.serviceDate, date),
  );
}

/** COD to collect per route: the sum over the shipments currently on it (FR-018). */
async function codToCollect(db: Executor, routeIds: string[]): Promise<Map<string, number>> {
  if (routeIds.length === 0) return new Map();
  const rows = await db
    .select({
      routeId: shipments.routeId,
      total: sql<string | number>`coalesce(sum(${shipments.codAmount}), 0)::bigint`,
    })
    .from(shipments)
    .where(inArray(shipments.routeId, routeIds))
    .groupBy(shipments.routeId);
  return new Map(
    rows.flatMap((row) => (row.routeId ? [[row.routeId, safeIntegerCop(row.total)] as const] : [])),
  );
}

/**
 * Each route's line on the routes board (FR-018): courier, status, progress, COD to collect,
 * the flags of its shipments at `now`, and the handovers waiting for its courier.
 */
export async function loadRouteSummaries(
  db: Executor,
  where: SQL | undefined,
  now: Date,
): Promise<RouteSummary[]> {
  const rows = await db
    .select({
      route: routes,
      courier: { id: couriers.id, name: couriers.name },
      lastSyncedAt: couriers.lastSyncedAt,
    })
    .from(routes)
    .leftJoin(couriers, eq(couriers.id, routes.courierId))
    .where(where)
    .orderBy(asc(routes.serviceDate), asc(routes.number));
  if (rows.length === 0) return [];
  const ids = rows.map(({ route }) => route.id);
  const stops = await db
    .select({ id: routeStops.id, routeId: routeStops.routeId })
    .from(routeStops)
    .where(inArray(routeStops.routeId, ids));
  const tasks =
    stops.length === 0
      ? []
      : await db
          .select({ stopId: routeTasks.stopId, status: routeTasks.status })
          .from(routeTasks)
          .where(
            inArray(
              routeTasks.stopId,
              stops.map((stop) => stop.id),
            ),
          );
  const carried = await db
    .select({
      routeId: shipments.routeId,
      status: shipments.status,
      windowEnd: shipments.windowEnd,
    })
    .from(shipments)
    .where(inArray(shipments.routeId, ids));
  const waiting = await db
    .select({ routeId: handovers.toRouteId, count: sql<number>`count(*)::int` })
    .from(handovers)
    .where(and(eq(handovers.status, "pending"), inArray(handovers.toRouteId, ids)))
    .groupBy(handovers.toRouteId);
  const cod = await codToCollect(db, ids);
  const unseen = await db
    .select({ courierId: courierNotices.courierId, count: sql<number>`count(*)::int` })
    .from(courierNotices)
    .where(isNull(courierNotices.acknowledgedAt))
    .groupBy(courierNotices.courierId);
  return rows.map(({ route, courier, lastSyncedAt }) => {
    const progress = routeProgress(
      stops
        .filter((stop) => stop.routeId === route.id)
        .map((stop) => ({ tasks: tasks.filter((task) => task.stopId === stop.id) })),
    );
    const flags = carried
      .filter((shipment) => shipment.routeId === route.id)
      .map((shipment) => shipmentFlag(shipment, now)?.kind);
    return {
      id: route.id,
      number: route.number,
      serviceDate: route.serviceDate,
      status: route.status,
      courier: route.courierId ? courier : null,
      completedStops: progress.completed,
      totalStops: progress.total,
      codToCollect: cod.get(route.id) ?? 0,
      atRiskCount: flags.filter((kind) => kind === "at_risk").length,
      lateCount: flags.filter((kind) => kind === "late").length,
      pendingHandovers: waiting.find((row) => row.routeId === route.id)?.count ?? 0,
      courierLastSyncedAt: lastSyncedAt?.toISOString() ?? null,
      unacknowledgedNotices: unseen.find((row) => row.courierId === route.courierId)?.count ?? 0,
    };
  });
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
  const cod = await codToCollect(db, [id]);
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
    codToCollect: cod.get(id) ?? 0,
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
      onBehalf: event.onBehalf,
    })),
  };
}
