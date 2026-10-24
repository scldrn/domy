import {
  receivedByNameProblem,
  collectionProblem,
  onBehalfCourierId,
  resolveCourierRecord,
  type CourierRecordInput,
  type RecordEffect,
  type RecordOutcome,
  type ShipmentForRecord,
} from "@domy/domain";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db, Executor } from "../db/client.ts";
import {
  courierRecords,
  handovers,
  recordPhotos,
  routes,
  routeStops,
  routeTasks,
  shipmentEvents,
  shipments,
} from "../db/schema/index.ts";
import { AppError } from "./errors.ts";
import {
  handoverEvent,
  lockRoutes,
  requestHandover,
  cancelPendingHandover,
} from "./reassignment.ts";
import { notifyCourier } from "./notices.ts";
import { refreshRouteStatus } from "./route-status.ts";
import { recordRouteEvents, touchRoute, removeFromPlan } from "./route-store.ts";
import { photoKey } from "./storage.ts";
import { isUniqueViolation } from "./validate.ts";

/**
 * Applying a courier record (feature 003, research R5). The record is stored by its
 * phone-generated `id`, which makes it exactly-once (FR-019), even when it cannot be applied
 * (FR-024); `resolveCourierRecord` of `@domy/domain` decides what it does, and this executes
 * that decision on the shipment, its task, custody, and history in one transaction.
 */

export type RecordAuthor = {
  /** The courier who did it, or on whose behalf it is recorded. */
  courierId: string;
  /** Who entered it: the courier's user, or the owner or dispatcher (FR-034). */
  authorUserId: string;
  onBehalf: boolean;
  /** The server's time on receipt. */
  recordedAt: Date;
  noticeIds?: string[];
};

export type RecordResult = { id: string; outcome: RecordOutcome };

type ShipmentRow = typeof shipments.$inferSelect;

async function storedOutcome(tx: Executor, id: string): Promise<RecordResult | null> {
  const [stored] = await tx
    .select({ id: courierRecords.id, outcome: courierRecords.outcome })
    .from(courierRecords)
    .where(eq(courierRecords.id, id));
  return stored ?? null;
}

/** The shipment as the record rules see it (`ShipmentForRecord`), with its row. */
export async function loadState(
  tx: Executor,
  shipmentId: string,
): Promise<{ row: ShipmentRow; forRecord: ShipmentForRecord; routeIds: string[] }> {
  const [row] = await tx.select().from(shipments).where(eq(shipments.id, shipmentId));
  if (!row) throw new AppError("not_found", { message: "No encontramos ese envío." });
  const [route] = row.routeId
    ? await tx
        .select({ id: routes.id, status: routes.status, courierId: routes.courierId })
        .from(routes)
        .where(eq(routes.id, row.routeId))
    : [];
  const pendingTasks = await tx
    .select({
      id: routeTasks.id,
      kind: routeTasks.kind,
      routeId: routes.id,
      routeStatus: routes.status,
      routeCourierId: routes.courierId,
    })
    .from(routeTasks)
    .innerJoin(routeStops, eq(routeStops.id, routeTasks.stopId))
    .innerJoin(routes, eq(routes.id, routeStops.routeId))
    .where(and(eq(routeTasks.shipmentId, shipmentId), eq(routeTasks.status, "pending")));
  const [pendingHandover] = await tx
    .select({
      id: handovers.id,
      toCourierId: handovers.toCourierId,
      toRouteId: handovers.toRouteId,
      fromRouteId: handovers.fromRouteId,
    })
    .from(handovers)
    .where(and(eq(handovers.shipmentId, shipmentId), eq(handovers.status, "pending")));
  const appliedRecords = await tx
    .select({ kind: courierRecords.kind, courierId: courierRecords.courierId })
    .from(courierRecords)
    .where(
      and(
        eq(courierRecords.shipmentId, shipmentId),
        eq(courierRecords.outcome, "applied"),
        isNull(courierRecords.revertedAt),
      ),
    );
  return {
    row,
    // Every route the record may touch, to lock them before the shipment, as feature 002 does.
    routeIds: [
      ...(row.routeId ? [row.routeId] : []),
      ...pendingTasks.map((task) => task.routeId),
      ...(pendingHandover
        ? [pendingHandover.toRouteId, pendingHandover.fromRouteId].filter(
            (id): id is string => id !== null,
          )
        : []),
    ],
    forRecord: {
      kind: row.kind,
      status: row.status,
      custodyCourierId: row.custodyCourierId,
      heldAtOffice: row.heldAtOffice,
      returnDecided: row.returnDecided,
      route: route ?? null,
      pendingTasks,
      pendingHandover: pendingHandover
        ? {
            id: pendingHandover.id,
            toCourierId: pendingHandover.toCourierId,
            toRouteId: pendingHandover.toRouteId,
          }
        : null,
      appliedRecords,
    },
  };
}

/**
 * The input checks that need the shipment, for a record entered by dispatch (FR-034); the
 * phone's record is never refused for them (`invalid_for_shipment`, ROB-3).
 */
function checkInput(input: CourierRecordInput, row: ShipmentRow): void {
  if (input.kind !== "delivery") return;
  const problem = receivedByNameProblem(row.kind, input.receivedByName);
  if (problem) throw new AppError("invalid_request", { fields: { receivedByName: problem } });
}

/** The kind-specific columns of a record (data-model.md). */
function recordColumns(input: CourierRecordInput) {
  switch (input.kind) {
    case "delivery":
      return {
        receivedByName: input.receivedByName ?? null,
        cashAmount: input.cashAmount,
        companyTransferAmount: input.companyTransferAmount,
        merchantTransferAmount: input.merchantTransferAmount,
        note: input.note ?? null,
      };
    case "exception":
      return { exceptionReason: input.reason, note: input.note ?? null };
    case "problem":
      return { note: input.note };
    case "return":
      return { receivedByName: input.receivedByName };
    case "disbursement":
      return { disbursementAmount: input.amount, payee: input.payee, note: input.note ?? null };
    case "pickup":
    case "handover_confirmation":
      return {};
  }
}

export async function applyCourierRecord(
  db: Db,
  input: CourierRecordInput,
  requestedBy: Omit<RecordAuthor, "courierId"> & { courierId?: string },
): Promise<RecordResult> {
  try {
    return await applyOnce(db, input, requestedBy);
  } catch (error) {
    // C003-4, FR-019: the same id sent concurrently about another shipment shares no lock with
    // the first; once that one commits, its stored outcome is the answer.
    if (!isUniqueViolation(error, "courier_records_pkey")) throw error;
    const stored = await storedOutcome(db, input.id);
    if (!stored) throw error;
    return stored;
  }
}

async function applyOnce(
  db: Db,
  input: CourierRecordInput,
  requestedBy: Omit<RecordAuthor, "courierId"> & { courierId?: string },
): Promise<RecordResult> {
  return db.transaction(async (tx) => {
    const stored = await storedOutcome(tx, input.id);
    if (stored) return stored;

    const [phoneRoute] = requestedBy.courierId
      ? await tx
          .select({ id: routes.id, courierId: routes.courierId })
          .from(routes)
          .where(and(eq(routes.courierId, requestedBy.courierId), eq(routes.status, "in_progress")))
      : [];
    const peek = await loadState(tx, input.shipmentId);
    await lockRoutes(tx, [...peek.routeIds, phoneRoute?.id ?? null]);
    await tx
      .select({ id: shipments.id })
      .from(shipments)
      .where(eq(shipments.id, input.shipmentId))
      .for("update");
    // The same record from a second request may have been applied while this one waited.
    const raced = await storedOutcome(tx, input.id);
    if (raced) return raced;
    const { row, forRecord } = await loadState(tx, input.shipmentId);
    // FR-034: resolve attribution under the same locks as the effect, never from a stale HTTP read.
    const courierId = requestedBy.onBehalf ? onBehalfCourierId(forRecord) : requestedBy.courierId;
    if (!courierId) throw new AppError("courier_required");
    const by: RecordAuthor = { ...requestedBy, courierId };
    const courierRoute = by.onBehalf
      ? forRecord.route?.courierId === courierId
        ? forRecord.route
        : null
      : phoneRoute;
    if (by.onBehalf && new Date(input.occurredAt) > by.recordedAt)
      throw new AppError("occurred_in_future");
    // ROB-3, FR-024: dispatch fixes its own form; the phone's record is kept as not applied.
    if (by.onBehalf) checkInput(input, row);
    if (by.onBehalf && input.kind === "delivery") {
      const problem = collectionProblem(row.codAmount, input);
      if (problem) throw new AppError("invalid_request", { fields: { note: problem } });
    }

    // Phone time corrected by the caller, and never after the server received it (FR-019).
    const claimed = new Date(input.occurredAt);
    const occurredAt = claimed > by.recordedAt ? by.recordedAt : claimed;
    const resolution = resolveCourierRecord(forRecord, {
      kind: input.kind,
      courierId: by.courierId,
      ...(input.kind === "delivery" && { delivery: { receivedByName: input.receivedByName } }),
    });

    await tx.insert(courierRecords).values({
      id: input.id,
      shipmentId: input.shipmentId,
      kind: input.kind,
      courierId: by.courierId,
      authorUserId: by.authorUserId,
      onBehalf: by.onBehalf,
      routeId: courierRoute?.id ?? null,
      occurredAt,
      recordedAt: by.recordedAt,
      latitude: input.location?.latitude ?? null,
      longitude: input.location?.longitude ?? null,
      locationAccuracyM: input.location?.accuracyM ?? null,
      outcome: resolution.outcome,
      notAppliedReason: resolution.outcome === "not_applied" ? resolution.reason : null,
      ...recordColumns(input),
    });
    // Photos declared by the record are expected: "Foto pendiente" until they arrive (FR-023).
    const photos = "photos" in input ? input.photos : [];
    if (photos.length > 0) {
      await tx
        .insert(recordPhotos)
        .values(
          photos.map((photo) => ({
            id: photo.id,
            recordId: input.id,
            kind: photo.kind,
            storageKey: photoKey({ recordId: input.id, photoId: photo.id }),
          })),
        )
        .onConflictDoNothing();
    }

    if (resolution.outcome === "not_applied") {
      // FR-026: the failed fact and its notice share this transaction.
      await tx
        .update(shipments)
        .set({
          needsReview: true,
          version: sql`${shipments.version} + 1`,
          updatedAt: by.recordedAt,
        })
        .where(eq(shipments.id, row.id));
      await notifyCourier(
        tx,
        by.courierId,
        "record_not_applied",
        { routeId: courierRoute?.id ?? null, shipmentId: row.id },
        by.recordedAt,
        by.noticeIds,
      );
    } else if (resolution.outcome === "applied") {
      await executeEffect(tx, {
        row,
        forRecord,
        input,
        effect: resolution.effect,
        occurredAt,
        by,
        authorRouteId: courierRoute?.id ?? null,
      });
    }
    return { id: input.id, outcome: resolution.outcome };
  });
}

/** Executes an applied record's effect, with its shipment event and the route status. */
async function executeEffect(
  tx: Executor,
  context: {
    row: ShipmentRow;
    forRecord: ShipmentForRecord;
    input: CourierRecordInput;
    effect: RecordEffect;
    occurredAt: Date;
    by: RecordAuthor;
    authorRouteId: string | null;
  },
): Promise<void> {
  const { row, forRecord, input, effect, occurredAt, by } = context;
  const author = { actorUserId: by.authorUserId, now: by.recordedAt, onBehalf: by.onBehalf };
  const touchedRoutes = new Set<string>();
  // FR-025: execute only the shared domain's cross-route decision, retaining completed history.
  if (effect.cancelHandoverId) {
    const cancelled = await cancelPendingHandover(tx, row.id, author);
    if (cancelled) {
      const ids = [...new Set([cancelled.fromRouteId, cancelled.toRouteId])].filter(
        (id): id is string => id !== null,
      );
      await recordRouteEvents(
        tx,
        ids.map((id) => ({
          ...handoverEvent("handover_cancelled", id, cancelled, author),
          onBehalf: by.onBehalf,
        })),
        by.noticeIds,
      );
      await tx.insert(shipmentEvents).values({
        shipmentId: row.id,
        type: "handover_cancelled",
        actorUserId: by.authorUserId,
        occurredAt,
        recordedAt: by.recordedAt,
        routeId: cancelled.toRouteId,
        onBehalf: by.onBehalf,
      });
      for (const id of ids) touchedRoutes.add(id);
    }
  }
  const removedFrom = new Set(
    forRecord.pendingTasks
      .filter((task) => effect.removeTaskIds?.includes(task.id))
      .map((task) => task.routeId),
  );
  for (const routeId of removedFrom) {
    const removed = await removeFromPlan(tx, routeId, row.id, {
      actorUserId: by.authorUserId,
      occurredAt: by.recordedAt,
      reason: "Registro recibido después de cambiar la ruta",
    });
    await recordRouteEvents(tx, [{ ...removed, onBehalf: by.onBehalf }], by.noticeIds);
    await touchRoute(tx, routeId, by.recordedAt);
    touchedRoutes.add(routeId);
  }
  const taskRoute = (taskId: string | undefined) =>
    forRecord.pendingTasks.find((task) => task.id === taskId)?.routeId;

  const finished = effect.completeTaskId ?? effect.failTaskId;
  if (finished) {
    await tx
      .update(routeTasks)
      .set({
        status: effect.completeTaskId ? "completed" : "failed",
        completedAt: occurredAt,
        completedByCourierId: by.courierId,
        problemNote: null,
      })
      .where(eq(routeTasks.id, finished));
    const routeId = taskRoute(finished);
    if (routeId) touchedRoutes.add(routeId);
  }
  if (effect.problemNoteTaskId && input.kind === "problem") {
    await tx
      .update(routeTasks)
      .set({ problemNote: input.note })
      .where(eq(routeTasks.id, effect.problemNoteTaskId));
  }

  if (effect.requestHandover) {
    const handover = await requestHandover(
      tx,
      {
        shipmentId: row.id,
        fromCourierId: by.courierId,
        toCourierId: effect.requestHandover.toCourierId,
        toRouteId: effect.requestHandover.toRouteId,
        fromRouteId: context.authorRouteId,
        reason: "Recogida recibida después de cambiar la ruta",
      },
      author,
    );
    await recordRouteEvents(
      tx,
      [
        {
          ...handoverEvent("handover_requested", handover.toRouteId, handover, author),
          onBehalf: by.onBehalf,
        },
      ],
      by.noticeIds,
    );
    touchedRoutes.add(handover.toRouteId);
    if (handover.fromRouteId) touchedRoutes.add(handover.fromRouteId);
  }

  let handover: typeof handovers.$inferSelect | undefined;
  if (effect.confirmHandoverId) {
    [handover] = await tx
      .update(handovers)
      .set({
        status: "confirmed",
        resolvedBy: by.authorUserId,
        resolvedAt: occurredAt,
        resolvedOnBehalf: by.onBehalf,
      })
      .where(and(eq(handovers.id, effect.confirmHandoverId), eq(handovers.status, "pending")))
      .returning();
    await tx
      .update(routeTasks)
      .set({ blockedByHandoverId: null })
      .where(eq(routeTasks.blockedByHandoverId, effect.confirmHandoverId));
  }

  const custody = effect.custody;
  const custodyChanged = custody && custody.courierId !== row.custodyCourierId;
  const officeChanged = custody && custody.heldAtOffice !== row.heldAtOffice;
  const status = effect.status ?? row.status;
  const changed =
    status !== row.status ||
    custodyChanged ||
    officeChanged ||
    effect.returnDecided === false ||
    effect.needsReview;
  if (changed) {
    await tx
      .update(shipments)
      .set({
        status,
        ...(custody && {
          custodyCourierId: custody.courierId,
          heldAtOffice: custody.heldAtOffice,
        }),
        ...(effect.returnDecided === false && { returnDecided: false }),
        ...(effect.needsReview && { needsReview: true }),
        ...((effect.leaveRoute || removedFrom.has(row.routeId ?? "")) && { routeId: null }),
        version: sql`${shipments.version} + 1`,
        updatedAt: by.recordedAt,
      })
      .where(eq(shipments.id, row.id));
  }

  // The custody lines of the history: who held it before and after (research R17).
  const changes = {
    ...(custodyChanged && { custodyCourierId: [row.custodyCourierId, custody.courierId] }),
    ...(officeChanged && { heldAtOffice: [row.heldAtOffice, custody.heldAtOffice] }),
  };
  const event = {
    shipmentId: row.id,
    courierRecordId: input.id,
    actorUserId: by.authorUserId,
    occurredAt,
    recordedAt: by.recordedAt,
    onBehalf: by.onBehalf,
    changes: Object.keys(changes).length > 0 ? changes : null,
  };
  if (handover) {
    await tx
      .insert(shipmentEvents)
      .values({ ...event, type: "handover_confirmed", routeId: handover.toRouteId });
    const routeIds = [...new Set([handover.toRouteId, handover.fromRouteId])].filter(
      (routeId): routeId is string => routeId !== null,
    );
    await recordRouteEvents(
      tx,
      routeIds.map((routeId) => ({
        ...handoverEvent("handover_confirmed", routeId, handover, {
          actorUserId: by.authorUserId,
          now: occurredAt,
        }),
        onBehalf: by.onBehalf,
      })),
      by.noticeIds,
    );
    for (const routeId of routeIds) {
      await touchRoute(tx, routeId, by.recordedAt);
      touchedRoutes.add(routeId);
    }
  } else if (status !== row.status || custodyChanged || officeChanged) {
    await tx.insert(shipmentEvents).values({
      ...event,
      type: "status_changed",
      fromStatus: row.status,
      toStatus: status,
      routeId: taskRoute(finished) ?? row.routeId,
    });
  }

  // The automatic finish of every route the record touched (feature 002, FR-012).
  for (const routeId of touchedRoutes) await refreshRouteStatus(tx, routeId, author);
}
