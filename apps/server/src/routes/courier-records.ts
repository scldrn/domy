import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import { requireRole } from "../lib/auth-guard.ts";
import {
  blocksRecordRevert,
  recordCorrectionInput,
  recordCorrectionProblem,
  recordRevertInput,
  recordRevertState,
} from "@domy/domain";
import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Executor } from "../db/client.ts";
import {
  courierRecords,
  routeEvents,
  routeStops,
  routeTasks,
  shipmentEvents,
  shipments,
} from "../db/schema/index.ts";
import { loadState } from "../lib/courier-records.ts";
import { AppError } from "../lib/errors.ts";
import { notifyCourier } from "../lib/notices.ts";
import { lockRoutes } from "../lib/reassignment.ts";
import { loadShipmentRecords } from "../lib/record-views.ts";
import { loadRouteRow, touchRoute } from "../lib/route-store.ts";
import { isUniqueViolation, validate } from "../lib/validate.ts";
import { loadShipment } from "./shipments.ts";

const idParam = z.object({ id: z.uuid() });
type RecordRow = typeof courierRecords.$inferSelect;

/** An accepted action always returns its original target's current projection (Constitution II). */
async function replayTarget(db: Executor, actionId: string) {
  const [event] = await db
    .select()
    .from(shipmentEvents)
    .where(eq(shipmentEvents.clientEventId, actionId));
  if (!event) return null;
  if (!event.courierRecordId)
    throw new AppError("invalid_request", {
      message: "Ese identificador ya se usó para otra acción. Vuelve a abrir el formulario.",
    });
  return event.courierRecordId;
}
async function loadRecord(db: Executor, id: string) {
  const [record] = await db.select().from(courierRecords).where(eq(courierRecords.id, id));
  if (!record) throw new AppError("not_found", { message: "No encontramos ese registro." });
  return record;
}
async function projection(db: Executor, id: string) {
  const record = await loadRecord(db, id);
  const result = (await loadShipmentRecords(db, record.shipmentId)).find((item) => item.id === id);
  if (!result) throw new AppError("not_found");
  return result;
}
/** Same route-before-shipment lock order as courier sync and dispatch. */
async function lockRecord(tx: Executor, id: string) {
  const record = await loadRecord(tx, id);
  const peek = await loadState(tx, record.shipmentId);
  await lockRoutes(tx, [...peek.routeIds, record.routeId]);
  await tx
    .select({ id: shipments.id })
    .from(shipments)
    .where(eq(shipments.id, record.shipmentId))
    .for("update");
  return { record: await loadRecord(tx, id), ...(await loadState(tx, record.shipmentId)) };
}

/** Exact effect provenance, with a conservative fallback for pre-migration rows (research R12). */
function effectOf(record: RecordRow, events: (typeof shipmentEvents.$inferSelect)[]) {
  const status =
    record.kind === "delivery"
      ? "delivered"
      : record.kind === "exception"
        ? "exception"
        : record.kind === "return"
          ? "returned"
          : null;
  const direct = events.filter(
    (event) => event.type === "status_changed" && event.courierRecordId === record.id,
  );
  if (direct.length === 1) return direct[0];
  if (direct.length > 1 || !status) return undefined;
  const legacy = events.filter(
    (event) =>
      event.courierRecordId === null &&
      event.type === "status_changed" &&
      event.toStatus === status &&
      event.actorUserId === record.authorUserId &&
      event.occurredAt.getTime() === record.occurredAt.getTime() &&
      event.recordedAt.getTime() === record.recordedAt.getTime(),
  );
  return legacy.length === 1 ? legacy[0] : undefined;
}

/**
 * The office's corrections and reverts of courier records (feature 003, FR-035); they arrive
 * with user story 6 (tasks.md T075).
 */
export const courierRecordRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  .post(
    "/:id/correct",
    validate("param", idParam),
    validate("json", recordCorrectionInput),
    async (c) => {
      const db = c.get("db");
      const { actionId, reason, ...values } = c.req.valid("json");
      let target = await replayTarget(db, actionId);
      if (!target) {
        target = await db
          .transaction(async (tx) => {
            const { record, row } = await lockRecord(tx, c.req.valid("param").id);
            const replay = await replayTarget(tx, actionId);
            if (replay) return replay;
            if (record.revertedAt || record.outcome !== "applied")
              throw new AppError("invalid_request", {
                message:
                  "Solo se corrige un registro aplicado y no revertido. Revisa el historial.",
              });
            const problem = recordCorrectionProblem(record, values, row.codAmount);
            if (problem) throw new AppError("invalid_request", { message: problem });
            const { amount, ...fields } = values;
            const next = { ...fields, ...(amount !== undefined && { disbursementAmount: amount }) };
            const changes = Object.fromEntries(
              Object.entries(next)
                .filter(([field, value]) => record[field as keyof RecordRow] !== value)
                .map(([field, value]) => [field, [record[field as keyof RecordRow], value]]),
            );
            const now = c.get("clock")();
            if (Object.keys(changes).length > 0)
              await tx.update(courierRecords).set(next).where(eq(courierRecords.id, record.id));
            await tx.insert(shipmentEvents).values({
              shipmentId: row.id,
              courierRecordId: record.id,
              type: "record_corrected",
              clientEventId: actionId,
              actorUserId: c.get("user").id,
              occurredAt: now,
              recordedAt: now,
              reason,
              changes,
            });
            if (Object.keys(changes).length > 0) {
              await tx
                .update(shipments)
                .set({ version: sql`${shipments.version} + 1`, updatedAt: now })
                .where(eq(shipments.id, row.id));
              await notifyCourier(
                tx,
                record.courierId,
                "record_corrected",
                { shipmentId: row.id, routeId: record.routeId },
                now,
                c.get("noticeIds"),
              );
            }
            return record.id;
          })
          .catch(async (error: unknown) => {
            if (!isUniqueViolation(error, "shipment_events_client_event_id_key")) throw error;
            const replay = await replayTarget(db, actionId);
            if (!replay) throw error;
            return replay;
          });
      }
      return c.json(await projection(db, target));
    },
  )
  .post(
    "/:id/revert",
    validate("param", idParam),
    validate("json", recordRevertInput),
    async (c) => {
      const db = c.get("db");
      const { actionId, reason } = c.req.valid("json");
      let target = await replayTarget(db, actionId);
      if (!target) {
        target = await db
          .transaction(async (tx) => {
            const { record, row } = await lockRecord(tx, c.req.valid("param").id);
            const replay = await replayTarget(tx, actionId);
            if (replay) return replay;
            const events = await tx
              .select()
              .from(shipmentEvents)
              .where(eq(shipmentEvents.shipmentId, row.id))
              .orderBy(asc(shipmentEvents.id));
            const effect = effectOf(record, events);
            const records = await tx
              .select()
              .from(courierRecords)
              .where(
                and(
                  eq(courierRecords.shipmentId, row.id),
                  eq(courierRecords.outcome, "applied"),
                  isNull(courierRecords.revertedAt),
                  inArray(courierRecords.kind, ["delivery", "exception", "return"]),
                ),
              );
            const isLatest =
              effect !== undefined &&
              !records.some((other) => {
                if (other.id === record.id) return false;
                const time =
                  other.occurredAt.getTime() - record.occurredAt.getTime() ||
                  other.recordedAt.getTime() - record.recordedAt.getTime();
                const otherEffect = effectOf(other, events);
                return time > 0 || (time === 0 && (!otherEffect || otherEffect.id > effect.id));
              });
            // A whole-route reassignment has no shipment event for completed stops (A2).
            const laterRouteDecision =
              effect && record.routeId
                ? await tx
                    .select({ id: routeEvents.id })
                    .from(routeEvents)
                    .where(
                      and(
                        eq(routeEvents.routeId, record.routeId),
                        isNull(routeEvents.shipmentId),
                        eq(routeEvents.type, "reassigned"),
                        gt(routeEvents.id, effect.id),
                      ),
                    )
                    .limit(1)
                : [];
            const hasLaterOperation =
              !effect ||
              laterRouteDecision.length > 0 ||
              events.some((event) => event.id > effect.id && blocksRecordRevert(event.type));
            const route = record.routeId ? await loadRouteRow(tx, record.routeId) : null;
            const eligibility = {
              ...record,
              reverted: record.revertedAt !== null,
              isLatest,
              hasLaterOperation,
            };
            const initialState = recordRevertState(row, eligibility, route);
            const [task] = initialState?.routeId
              ? await tx
                  .select({ id: routeTasks.id, status: routeTasks.status })
                  .from(routeTasks)
                  .innerJoin(routeStops, eq(routeStops.id, routeTasks.stopId))
                  .where(
                    and(
                      eq(routeStops.routeId, initialState.routeId),
                      eq(routeTasks.shipmentId, row.id),
                      eq(routeTasks.kind, initialState.taskKind),
                      eq(routeTasks.completedByCourierId, record.courierId),
                      eq(routeTasks.completedAt, record.occurredAt),
                    ),
                  )
                  .orderBy(desc(routeTasks.id))
                  .limit(1)
              : [];
            const state = task ? initialState : recordRevertState(row, eligibility, null);
            if (!state)
              throw new AppError("record_not_revertible", {
                message:
                  "No se puede revertir: hay una operación posterior o el registro ya no es el último aplicado. Revisa el historial antes de continuar.",
              });
            const now = c.get("clock")();
            if (state.routeId && task) {
              await tx
                .update(routeTasks)
                .set({
                  status: "pending",
                  completedAt: null,
                  completedByCourierId: null,
                  problemNote: null,
                })
                .where(eq(routeTasks.id, task.id));
              await touchRoute(tx, state.routeId, now);
              await tx.insert(routeEvents).values({
                routeId: state.routeId,
                shipmentId: row.id,
                type: "record_reverted",
                actorUserId: c.get("user").id,
                occurredAt: now,
                recordedAt: now,
                reason,
                changes: { taskStatus: [task.status, "pending"] },
              });
            }
            const { taskKind: _, ...next } = state;
            await tx
              .update(shipments)
              .set({ ...next, version: sql`${shipments.version} + 1`, updatedAt: now })
              .where(eq(shipments.id, row.id));
            await tx
              .update(courierRecords)
              .set({ revertedAt: now, revertedBy: c.get("user").id, revertReason: reason })
              .where(eq(courierRecords.id, record.id));
            await tx.insert(shipmentEvents).values({
              shipmentId: row.id,
              courierRecordId: record.id,
              type: "record_reverted",
              clientEventId: actionId,
              actorUserId: c.get("user").id,
              occurredAt: now,
              recordedAt: now,
              reason,
              fromStatus: row.status,
              toStatus: state.status,
              routeId: state.routeId,
              changes: Object.fromEntries(
                Object.entries(next)
                  .filter(([field, value]) => row[field as keyof typeof row] !== value)
                  .map(([field, value]) => [field, [row[field as keyof typeof row], value]]),
              ),
            });
            await notifyCourier(
              tx,
              record.courierId,
              "record_reverted",
              { shipmentId: row.id, routeId: state.routeId },
              now,
              c.get("noticeIds"),
            );
            return record.id;
          })
          .catch(async (error: unknown) => {
            if (!isUniqueViolation(error, "shipment_events_client_event_id_key")) throw error;
            const replay = await replayTarget(db, actionId);
            if (!replay) throw error;
            return replay;
          });
      }
      return c.json(await loadShipment(db, (await loadRecord(db, target)).shipmentId));
    },
  );
