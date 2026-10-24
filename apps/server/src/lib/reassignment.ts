import {
  addShipmentToStops,
  addHeldShipmentToStops,
  canMoveBetweenRoutes,
  isHeldForRouting,
  removeShipmentFromStops,
  shipmentStatusLabels,
  statusOnJoiningRoute,
} from "@domy/domain";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Executor } from "../db/client.ts";
import { handovers, routes, routeTasks, shipmentEvents, shipments } from "../db/schema/index.ts";
import { AppError } from "./errors.ts";
import { refreshRouteStatus } from "./route-status.ts";
import {
  loadPlan,
  loadRouteRow,
  loadOfficePlace,
  planShipments,
  removeFromPlan,
  recordRouteEvents,
  savePlan,
  touchRoute,
  type NewRouteEvent,
} from "./route-store.ts";

/**
 * Reassignment and handovers (feature 002, FR-014, FR-015, FR-025, research R8). Custody of a
 * package changes only through a confirmed handover; every change is recorded in the history
 * of the shipment and of each route it touches (FR-016, FR-022).
 */

export type HandoverRow = typeof handovers.$inferSelect;
type ShipmentRow = typeof shipments.$inferSelect;
type Author = { actorUserId: string; now: Date; noticeIds?: string[] };

/** Locks routes in one order, the same for every action, so two actions never deadlock. */
export async function lockRoutes(tx: Executor, ids: (string | null)[]): Promise<void> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return;
  await tx
    .select({ id: routes.id })
    .from(routes)
    .where(inArray(routes.id, unique))
    .orderBy(asc(routes.id))
    .for("update");
}

/** The shipment's pending delivery task waits for a handover, or no longer does. */
export async function blockDelivery(
  tx: Executor,
  shipmentId: string,
  handoverId: string | null,
): Promise<void> {
  await tx
    .update(routeTasks)
    .set({ blockedByHandoverId: handoverId })
    .where(
      and(
        eq(routeTasks.shipmentId, shipmentId),
        inArray(routeTasks.kind, ["delivery", "return"]),
        eq(routeTasks.status, "pending"),
      ),
    );
}

/** Cancels the shipment's pending handover, if any, and returns it (FR-025, EC-14). */
export async function cancelPendingHandover(
  tx: Executor,
  shipmentId: string,
  by: Author,
): Promise<HandoverRow | null> {
  const [cancelled] = await tx
    .update(handovers)
    .set({ status: "cancelled", resolvedBy: by.actorUserId, resolvedAt: by.now })
    .where(and(eq(handovers.shipmentId, shipmentId), eq(handovers.status, "pending")))
    .returning();
  return cancelled ?? null;
}

/** A pending handover of a picked-up package; its delivery waits for it (FR-025). */
export async function requestHandover(
  tx: Executor,
  handover: {
    shipmentId: string;
    fromCourierId: string;
    toCourierId: string;
    fromRouteId: string | null;
    toRouteId: string;
    reason: string;
  },
  by: Author,
): Promise<HandoverRow> {
  const [created] = await tx
    .insert(handovers)
    .values({ ...handover, requestedBy: by.actorUserId, requestedAt: by.now })
    .returning();
  if (!created) throw new Error("The handover was not created");
  await blockDelivery(tx, handover.shipmentId, created.id);
  return created;
}

export const handoverEvent = (
  type: "handover_requested" | "handover_confirmed" | "handover_cancelled",
  routeId: string,
  handover: HandoverRow,
  by: Author,
): NewRouteEvent => ({
  routeId,
  type,
  actorUserId: by.actorUserId,
  occurredAt: by.now,
  shipmentId: handover.shipmentId,
  fromCourierId: handover.fromCourierId,
  toCourierId: handover.toCourierId,
  ...(type === "handover_requested" && { reason: handover.reason }),
});

/** 003 FR-029–FR-031: the same held-stop/custody orchestration for a decision, add or move.
 * Caller locks all affected routes before the shipment and writes its state/event in this tx.
 */
export async function routeHeldShipment(
  tx: Executor,
  shipment: ShipmentRow,
  toRouteId: string | null,
  by: Author & { reason: string; routeEvent?: "reassigned" | false },
): Promise<{ fromCourierId: string | null; toCourierId: string | null }> {
  const target = toRouteId ? await loadRouteRow(tx, toRouteId) : null;
  const from = shipment.routeId ? await loadRouteRow(tx, shipment.routeId) : null;
  if (
    target &&
    target.status !== "in_progress" &&
    !(shipment.heldAtOffice && target.status === "draft")
  ) {
    throw new AppError("route_not_in_progress", {
      message: "Un paquete en custodia del mensajero solo se agrega a una ruta en curso.",
    });
  }
  const events: NewRouteEvent[] = [];
  if (from) {
    const removed = await removeFromPlan(tx, from.id, shipment.id, {
      actorUserId: by.actorUserId,
      occurredAt: by.now,
      reason: by.reason,
    });
    events.push(
      by.routeEvent === "reassigned"
        ? {
            ...removed,
            type: "reassigned",
            changes: { toRouteId },
            fromCourierId: from.courierId,
            toCourierId: target?.courierId ?? null,
          }
        : removed,
    );
  }
  const cancelled = await cancelPendingHandover(tx, shipment.id, by);
  if (cancelled) {
    events.push(handoverEvent("handover_cancelled", cancelled.toRouteId, cancelled, by));
    await tx.insert(shipmentEvents).values({
      shipmentId: shipment.id,
      type: "handover_cancelled",
      actorUserId: by.actorUserId,
      occurredAt: by.now,
      routeId: cancelled.toRouteId,
    });
  }
  if (target) {
    const purpose = shipment.returnDecided ? "return" : "delivery";
    const [planned] = await planShipments(tx, [shipment.id], { heldPurpose: purpose });
    if (!planned) throw new AppError("not_found");
    const before = await loadPlan(tx, target.id);
    const office = shipment.heldAtOffice ? await loadOfficePlace(tx) : null;
    const held: Parameters<typeof addHeldShipmentToStops>[3] = office
      ? {
          holder: "office" as const,
          purpose,
          office,
        }
      : { holder: "courier" as const, purpose };
    await savePlan(
      tx,
      target.id,
      before,
      addHeldShipmentToStops(before, planned, () => crypto.randomUUID(), held),
    );
    // A route-add action owns its keyed addition event; decisions/moves record it here.
    if (by.routeEvent !== false)
      events.push({
        routeId: target.id,
        type: by.routeEvent ?? "shipment_added",
        shipmentId: shipment.id,
        actorUserId: by.actorUserId,
        occurredAt: by.now,
        ...(by.routeEvent === "reassigned" && {
          fromCourierId: from?.courierId ?? shipment.custodyCourierId,
          toCourierId: target.courierId,
          reason: by.reason,
          changes: { fromRouteId: shipment.routeId },
        }),
      });
    if (
      shipment.custodyCourierId &&
      target.courierId &&
      shipment.custodyCourierId !== target.courierId
    ) {
      const handover = await requestHandover(
        tx,
        {
          shipmentId: shipment.id,
          fromCourierId: shipment.custodyCourierId,
          toCourierId: target.courierId,
          fromRouteId: cancelled?.fromRouteId ?? shipment.routeId,
          toRouteId: target.id,
          reason: by.reason,
        },
        by,
      );
      events.push(handoverEvent("handover_requested", target.id, handover, by));
    }
  }
  await recordRouteEvents(tx, events, by.noticeIds);
  const affected = new Set([
    shipment.routeId,
    toRouteId,
    cancelled?.fromRouteId ?? null,
    cancelled?.toRouteId ?? null,
  ]);
  for (const id of affected)
    if (id) {
      await touchRoute(tx, id, by.now);
      await refreshRouteStatus(tx, id, by);
    }
  return {
    fromCourierId: from?.courierId ?? shipment.custodyCourierId,
    toCourierId: target?.courierId ?? null,
  };
}

/**
 * Moves a shipment to another route with a reason (FR-014). A shipment not picked up moves
 * with its pending stops and takes the target route's status; a picked-up one moves only to
 * a route in progress, with its delivery stop, and goes to another courier through a pending
 * handover from whoever holds it, which replaces any pending one (FR-025, EC-14).
 */
export async function moveShipment(
  tx: Executor,
  shipment: ShipmentRow,
  toRouteId: string,
  /** Without `actionId` when a route action moves several shipments and keeps it itself. */
  by: Author & { reason: string; actionId?: string; noticeAsAddition?: boolean },
): Promise<void> {
  if (isHeldForRouting(shipment)) {
    if (shipment.routeId === toRouteId)
      throw new AppError("invalid_transition", { message: "El envío ya está en esa ruta." });
    const moved = await routeHeldShipment(tx, shipment, toRouteId, {
      ...by,
      routeEvent: "reassigned",
    });
    await tx
      .update(shipments)
      .set({ routeId: toRouteId, version: sql`${shipments.version} + 1`, updatedAt: by.now })
      .where(eq(shipments.id, shipment.id));
    await tx.insert(shipmentEvents).values({
      shipmentId: shipment.id,
      type: "reassigned",
      fromStatus: shipment.status,
      toStatus: shipment.status,
      reason: by.reason,
      actorUserId: by.actorUserId,
      occurredAt: by.now,
      routeId: toRouteId,
      changes: {
        routeId: [shipment.routeId, toRouteId],
        courierId: [moved.fromCourierId, moved.toCourierId],
      },
      clientEventId: by.actionId ?? null,
    });
    return;
  }
  // DESIGN-1: a held package moved above; here only a planned shipment on a route moves.
  if (!shipment.routeId || !canMoveBetweenRoutes(shipment.status)) {
    throw new AppError("shipment_not_movable", {
      message:
        shipment.status === "registered"
          ? "Este envío no está en una ruta; agrégalo a una desde «Sin asignar»."
          : `Un envío «${shipmentStatusLabels[shipment.status]}» no se reasigna.`,
    });
  }
  const from = await loadRouteRow(tx, shipment.routeId);
  const target = await loadRouteRow(tx, toRouteId);
  if (target.id === from.id) {
    throw new AppError("invalid_transition", { message: "El envío ya está en esa ruta." });
  }
  if (target.status !== "in_progress" && target.status !== "draft") {
    throw new AppError("route_not_in_progress", {
      message: "Solo se reasigna a una ruta en preparación o en curso.",
    });
  }

  const [planned] = await planShipments(tx, [shipment.id]);
  if (!planned) throw new AppError("not_found", { message: "No encontramos ese envío." });
  const fromStops = await loadPlan(tx, from.id);
  await savePlan(tx, from.id, fromStops, removeShipmentFromStops(fromStops, shipment.id));
  const toStops = await loadPlan(tx, target.id);
  await savePlan(
    tx,
    target.id,
    toStops,
    addShipmentToStops(toStops, planned, () => crypto.randomUUID()),
  );
  const status = statusOnJoiningRoute(target.status);
  await tx
    .update(shipments)
    .set({
      status,
      routeId: target.id,
      version: sql`${shipments.version} + 1`,
      updatedAt: by.now,
    })
    .where(eq(shipments.id, shipment.id));

  await tx.insert(shipmentEvents).values([
    {
      shipmentId: shipment.id,
      type: "reassigned",
      fromStatus: shipment.status,
      toStatus: status,
      reason: by.reason,
      actorUserId: by.actorUserId,
      occurredAt: by.now,
      routeId: target.id,
      changes: {
        routeId: [from.id, target.id],
        courierId: [from.courierId, target.courierId],
      },
      clientEventId: by.actionId ?? null,
    },
  ]);
  const moved = {
    actorUserId: by.actorUserId,
    occurredAt: by.now,
    shipmentId: shipment.id,
    fromCourierId: from.courierId,
    toCourierId: target.courierId,
    reason: by.reason,
  };
  await recordRouteEvents(
    tx,
    [
      { ...moved, routeId: from.id, type: "reassigned", changes: { toRouteId: target.id } },
      { ...moved, routeId: target.id, type: "reassigned", changes: { fromRouteId: from.id } },
    ],
    by.noticeIds,
    by.noticeAsAddition ? "shipment_added" : undefined,
  );
  for (const routeId of [from.id, target.id]) {
    await touchRoute(tx, routeId, by.now);
    await refreshRouteStatus(tx, routeId, by);
  }
}

async function loadPending(tx: Executor, id: string): Promise<HandoverRow> {
  const [found] = await tx.select().from(handovers).where(eq(handovers.id, id));
  if (!found) throw new AppError("not_found", { message: "No encontramos ese traspaso." });
  await lockRoutes(tx, [found.fromRouteId, found.toRouteId]);
  const [handover] = await tx.select().from(handovers).where(eq(handovers.id, id)).for("update");
  if (handover?.status !== "pending") {
    throw new AppError("invalid_transition", {
      message:
        handover?.status === "confirmed"
          ? "Este traspaso ya fue confirmado."
          : "Este traspaso ya fue cancelado.",
    });
  }
  return handover;
}

/**
 * The dispatcher confirms a handover on the receiving courier's behalf (FR-025): custody
 * passes to that courier and the delivery can be done.
 */
export async function confirmHandover(
  tx: Executor,
  id: string,
  by: Author & { actionId: string },
): Promise<void> {
  const handover = await loadPending(tx, id);
  await tx
    .update(handovers)
    .set({
      status: "confirmed",
      resolvedBy: by.actorUserId,
      resolvedAt: by.now,
      resolvedOnBehalf: true,
    })
    .where(eq(handovers.id, id));
  await tx
    .update(shipments)
    .set({
      custodyCourierId: handover.toCourierId,
      version: sql`${shipments.version} + 1`,
      updatedAt: by.now,
    })
    .where(eq(shipments.id, handover.shipmentId));
  await tx
    .update(routeTasks)
    .set({ blockedByHandoverId: null })
    .where(eq(routeTasks.blockedByHandoverId, id));
  await tx.insert(shipmentEvents).values({
    shipmentId: handover.shipmentId,
    type: "handover_confirmed",
    actorUserId: by.actorUserId,
    occurredAt: by.now,
    routeId: handover.toRouteId,
    changes: { custodyCourierId: [handover.fromCourierId, handover.toCourierId] },
    onBehalf: true,
  });
  await recordHandoverOnRoutes(tx, "handover_confirmed", handover, by);
}

/**
 * The dispatcher cancels a pending handover (FR-025): the package stays with the courier who
 * has it, and its delivery stop returns to that courier's route.
 */
export async function cancelHandover(
  tx: Executor,
  id: string,
  by: Author & { actionId: string },
): Promise<void> {
  const handover = await loadPending(tx, id);
  const back = handover.fromRouteId;
  if (back === handover.toRouteId) {
    throw new AppError("invalid_transition", {
      message:
        "Este traspaso no tiene otra ruta a la cual volver; para deshacerlo, reasigna la ruta o el envío.",
    });
  }
  if (!back) {
    await cancelPendingHandover(tx, handover.shipmentId, by);
    await removeFromPlan(tx, handover.toRouteId, handover.shipmentId, {
      actorUserId: by.actorUserId,
      occurredAt: by.now,
      reason: "Traspaso cancelado",
    });
    await tx
      .update(shipments)
      .set({ routeId: null, version: sql`${shipments.version} + 1`, updatedAt: by.now })
      .where(eq(shipments.id, handover.shipmentId));
    await tx.insert(shipmentEvents).values({
      shipmentId: handover.shipmentId,
      type: "handover_cancelled",
      actorUserId: by.actorUserId,
      occurredAt: by.now,
      routeId: handover.toRouteId,
      changes: { routeId: [handover.toRouteId, null] },
    });
    await recordHandoverOnRoutes(tx, "handover_cancelled", handover, by);
    return;
  }
  const previous = await loadRouteRow(tx, back);
  if (previous.status !== "in_progress") {
    throw new AppError("route_not_in_progress", {
      message: `La Ruta ${String(previous.number)} ya no está en curso.`,
    });
  }
  await cancelPendingHandover(tx, handover.shipmentId, by);
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, handover.shipmentId));
  if (!shipment) throw new AppError("not_found");
  const purpose = shipment.returnDecided ? "return" : "delivery";
  const [planned] = await planShipments(tx, [handover.shipmentId], { heldPurpose: purpose });
  if (!planned) throw new AppError("not_found", { message: "No encontramos ese envío." });
  const toStops = await loadPlan(tx, handover.toRouteId);
  await savePlan(
    tx,
    handover.toRouteId,
    toStops,
    removeShipmentFromStops(toStops, handover.shipmentId),
  );
  const backStops = await loadPlan(tx, back);
  await savePlan(
    tx,
    back,
    backStops,
    addHeldShipmentToStops(backStops, planned, () => crypto.randomUUID(), {
      holder: "courier",
      purpose,
    }),
  );
  await tx
    .update(shipments)
    .set({ routeId: back, version: sql`${shipments.version} + 1`, updatedAt: by.now })
    .where(eq(shipments.id, handover.shipmentId));
  await tx.insert(shipmentEvents).values({
    shipmentId: handover.shipmentId,
    type: "handover_cancelled",
    actorUserId: by.actorUserId,
    occurredAt: by.now,
    routeId: back,
    changes: { routeId: [handover.toRouteId, back] },
  });
  await recordHandoverOnRoutes(tx, "handover_cancelled", handover, by);
}

/**
 * Records a resolution on both routes, the receiving one first with the action identifier;
 * each gets a new version, and either may now finish (FR-012).
 */
async function recordHandoverOnRoutes(
  tx: Executor,
  type: "handover_confirmed" | "handover_cancelled",
  handover: HandoverRow,
  by: Author & { actionId: string },
): Promise<void> {
  const routeIds = [...new Set([handover.toRouteId, handover.fromRouteId])].filter(
    (routeId): routeId is string => routeId !== null,
  );
  await recordRouteEvents(
    tx,
    routeIds.map((routeId, index) => ({
      ...handoverEvent(type, routeId, handover, by),
      // Dispatch confirms for the receiving courier; feature 003 lets the courier do it.
      onBehalf: type === "handover_confirmed",
      ...(index === 0 && { clientEventId: by.actionId }),
    })),
    by.noticeIds,
  );
  for (const routeId of routeIds) {
    await touchRoute(tx, routeId, by.now);
    await refreshRouteStatus(tx, routeId, by);
  }
}
