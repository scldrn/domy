import {
  bogotaToday,
  courierRecordsBatch,
  courierPushConfig,
  noticeAcknowledgeInput,
  pushSubscriptionInput,
  pushSubscriptionRemoveInput,
  daySummary,
  finalStatuses,
  routeProgress,
  type CourierRoute,
  type CourierSnapshot,
  type CourierStop,
  type CourierTask,
  type HandoverToGive,
  type HeldShipment,
  type Notice,
} from "@domy/domain";
import { and, asc, eq, gte, inArray, isNull, notInArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import {
  carriers,
  courierNotices,
  courierRecords,
  couriers,
  handovers,
  merchants,
  neighborhoods,
  routes,
  routeStops,
  routeTasks,
  shipments,
  pushSubscriptions,
} from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { applyCourierRecord, type RecordResult } from "../lib/courier-records.ts";
import { AppError } from "../lib/errors.ts";
import { validate } from "../lib/validate.ts";
import { auditedChange } from "../lib/master-data.ts";
import { uploadPhoto } from "./photos.ts";

/**
 * The courier app's API (feature 003, contracts/http-api.md): the route snapshot, records,
 * photos, notice acknowledgments and push subscriptions for the linked courier only
 * (FR-002, FR-027, FR-040).
 */

const idParam = z.object({ id: z.uuid() });

/** A record's answer; one the server could not take carries why (ROB-3, contracts/http-api.md). */
type CourierRecordResult =
  | RecordResult
  | {
      id: string;
      outcome: "not_applied";
      error: { code: string; message: string; fields?: Record<string, string> };
    };

/** The courier linked to the signed-in account. */
async function signedInCourier(c: Context<AppEnv>): Promise<{ id: string }> {
  const [courier] = await c
    .get("db")
    .select({ id: couriers.id })
    .from(couriers)
    .where(eq(couriers.userId, c.get("user").id));
  if (!courier) {
    throw new AppError("courier_not_linked");
  }
  return courier;
}

const fromCouriers = alias(couriers, "from_couriers");

/** The courier's route in progress with every stop and task (FR-005, FR-016). */
async function loadCourierRoute(db: Executor, courierId: string): Promise<CourierRoute | null> {
  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.courierId, courierId), eq(routes.status, "in_progress")));
  if (!route) return null;
  const [stops, tasks] = await Promise.all([
    db
      .select({
        stop: routeStops,
        neighborhood: { id: neighborhoods.id, name: neighborhoods.name },
      })
      .from(routeStops)
      .leftJoin(neighborhoods, eq(neighborhoods.id, routeStops.neighborhoodId))
      .where(eq(routeStops.routeId, route.id))
      .orderBy(asc(routeStops.position)),
    db
      .select({
        task: routeTasks,
        shipment: shipments,
        merchant: {
          id: merchants.id,
          name: merchants.name,
          whatsappPhone: merchants.whatsappPhone,
        },
        carrier: { id: carriers.id, name: carriers.name },
        fromCourier: { id: fromCouriers.id, name: fromCouriers.name },
      })
      .from(routeTasks)
      .innerJoin(routeStops, eq(routeStops.id, routeTasks.stopId))
      .innerJoin(shipments, eq(shipments.id, routeTasks.shipmentId))
      .innerJoin(merchants, eq(merchants.id, shipments.merchantId))
      .leftJoin(carriers, eq(carriers.id, shipments.carrierId))
      .leftJoin(handovers, eq(handovers.id, routeTasks.blockedByHandoverId))
      .leftJoin(fromCouriers, eq(fromCouriers.id, handovers.fromCourierId))
      .where(eq(routeStops.routeId, route.id))
      .orderBy(asc(routeTasks.id)),
  ]);
  const toTask = ({ task, shipment, merchant, carrier, fromCourier }: (typeof tasks)[number]) =>
    ({
      id: task.id,
      shipmentId: shipment.id,
      kind: task.kind,
      status: task.status,
      trackingNumber: shipment.trackingNumber,
      shipmentKind: shipment.kind,
      shipmentStatus: shipment.status,
      merchant: { id: merchant.id, name: merchant.name },
      recipientName: shipment.recipientName,
      recipientPhone: shipment.recipientPhone,
      carrier: carrier?.id && carrier.name ? { id: carrier.id, name: carrier.name } : null,
      destinationTown: shipment.destinationTown,
      errandDescription: shipment.errandDescription,
      instructions: shipment.instructions,
      packageCount: shipment.packageCount,
      packageSize: shipment.packageSize,
      windowStart: shipment.windowStart?.toISOString() ?? null,
      windowEnd: shipment.windowEnd?.toISOString() ?? null,
      codAmount: shipment.codAmount,
      blockedByHandover:
        task.blockedByHandoverId && fromCourier?.id && fromCourier.name
          ? {
              id: task.blockedByHandoverId,
              fromCourier: { id: fromCourier.id, name: fromCourier.name },
            }
          : null,
      problemNote: task.problemNote,
    }) satisfies CourierTask;
  return {
    id: route.id,
    number: route.number,
    serviceDate: route.serviceDate,
    status: route.status,
    stops: stops.map(({ stop, neighborhood }) => {
      const own = tasks.filter((row) => row.task.stopId === stop.id);
      // The recipient's phone on a delivery or an errand; the merchant's WhatsApp at a pickup
      // or a return (FR-016).
      const contactPhone =
        stop.kind === "pickup" || stop.kind === "return"
          ? (own.find((row) => row.merchant.whatsappPhone)?.merchant.whatsappPhone ?? null)
          : (own.find((row) => row.shipment.recipientPhone)?.shipment.recipientPhone ?? null);
      return {
        id: stop.id,
        position: stop.position,
        kind: stop.kind,
        address: stop.address,
        neighborhood: neighborhood?.id && neighborhood.name ? neighborhood : null,
        contactPhone,
        tasks: own.map(toTask),
      } satisfies CourierStop;
    }),
  };
}

const toCouriers = alias(couriers, "to_couriers");

async function loadHandoversToGive(db: Executor, courierId: string): Promise<HandoverToGive[]> {
  const rows = await db
    .select({
      handoverId: handovers.id,
      shipmentId: shipments.id,
      trackingNumber: shipments.trackingNumber,
      toCourier: { id: toCouriers.id, name: toCouriers.name },
    })
    .from(handovers)
    .innerJoin(shipments, eq(shipments.id, handovers.shipmentId))
    .innerJoin(toCouriers, eq(toCouriers.id, handovers.toCourierId))
    .where(and(eq(handovers.fromCourierId, courierId), eq(handovers.status, "pending")))
    .orderBy(asc(handovers.requestedAt));
  return rows;
}

/** Packages the courier holds on no route, "En mi custodia" (FR-005, FR-031). */
async function loadHeldOffRoute(db: Executor, courierId: string): Promise<HeldShipment[]> {
  const rows = await db
    .select({
      shipmentId: shipments.id,
      trackingNumber: shipments.trackingNumber,
      status: shipments.status,
      serviceDate: shipments.serviceDate,
      merchant: { id: merchants.id, name: merchants.name },
      recipientName: shipments.recipientName,
      returnDecided: shipments.returnDecided,
    })
    .from(shipments)
    .innerJoin(merchants, eq(merchants.id, shipments.merchantId))
    .where(
      and(
        eq(shipments.custodyCourierId, courierId),
        isNull(shipments.routeId),
        notInArray(shipments.status, [...finalStatuses]),
      ),
    )
    .orderBy(asc(shipments.serviceDate), asc(shipments.trackingNumber));
  return rows;
}

/** The changes the courier has not acknowledged (FR-027). */
async function loadNotices(db: Executor, courierId: string): Promise<Notice[]> {
  const rows = await db
    .select({
      id: courierNotices.id,
      type: courierNotices.type,
      routeNumber: routes.number,
      trackingNumber: shipments.trackingNumber,
      createdAt: courierNotices.createdAt,
    })
    .from(courierNotices)
    .leftJoin(routes, eq(routes.id, courierNotices.routeId))
    .leftJoin(shipments, eq(shipments.id, courierNotices.shipmentId))
    .where(and(eq(courierNotices.courierId, courierId), isNull(courierNotices.acknowledgedAt)))
    .orderBy(asc(courierNotices.createdAt));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

/** "Mi día" for today in Bogotá (FR-037); records of the last two days cover any offset. */
async function loadSummary(db: Executor, courierId: string, route: CourierRoute | null, now: Date) {
  const since = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const records = await db
    .select()
    .from(courierRecords)
    .where(and(eq(courierRecords.courierId, courierId), gte(courierRecords.occurredAt, since)));
  const progress = routeProgress(route?.stops ?? []);
  return daySummary(
    records.map((record) => ({
      kind: record.kind,
      outcome: record.outcome,
      reverted: record.revertedAt !== null,
      occurredAt: record.occurredAt,
      cashAmount: record.cashAmount,
      companyTransferAmount: record.companyTransferAmount,
      merchantTransferAmount: record.merchantTransferAmount,
      disbursementAmount: record.disbursementAmount ?? 0,
    })),
    { date: bogotaToday(now), pendingStops: progress.total - progress.completed },
  );
}

export const courierAppRoutes = new Hono<AppEnv>()
  .use(requireRole("courier"))
  .get("/push-config", async (c) => {
    await signedInCourier(c);
    return c.json(courierPushConfig.parse({ publicKey: c.get("push")?.publicKey ?? null }));
  })
  .post("/notices/acknowledge", validate("json", noticeAcknowledgeInput), async (c) => {
    const courier = await signedInCourier(c);
    const { actionId, noticeIds, occurredAt } = c.req.valid("json");
    const acknowledgedAt = new Date(
      Math.min(new Date(occurredAt).getTime(), c.get("clock")().getTime()),
    );
    await auditedChange(c, { type: "user", id: c.get("user").id, actionId }, async (tx) => {
      await tx
        .update(courierNotices)
        .set({ acknowledgedAt })
        .where(
          and(
            eq(courierNotices.courierId, courier.id),
            inArray(courierNotices.id, noticeIds),
            isNull(courierNotices.acknowledgedAt),
          ),
        );
      return null;
    });
    return c.body(null, 204);
  })
  .post("/push-subscriptions", validate("json", pushSubscriptionInput), async (c) => {
    await signedInCourier(c);
    const { actionId, endpoint, keys } = c.req.valid("json");
    const userId = c.get("user").id;
    await auditedChange(c, { type: "user", id: userId, actionId }, async (tx) => {
      const [existing] = await tx
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint));
      if (existing && existing.userId !== userId) throw new AppError("forbidden");
      await tx
        .insert(pushSubscriptions)
        .values({ userId, endpoint, ...keys, createdAt: c.get("clock")() })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: keys,
          setWhere: eq(pushSubscriptions.userId, userId),
        });
      return null;
    });
    return c.body(null, 204);
  })
  .post("/push-subscriptions/remove", validate("json", pushSubscriptionRemoveInput), async (c) => {
    await signedInCourier(c);
    const { actionId, endpoint } = c.req.valid("json");
    const userId = c.get("user").id;
    await auditedChange(c, { type: "user", id: userId, actionId }, async (tx) => {
      await tx
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
      return null;
    });
    return c.body(null, 204);
  })
  // The snapshot the phone keeps to work without signal (FR-005, FR-022, FR-033).
  .get("/route", async (c) => {
    const db = c.get("db");
    const now = c.get("clock")();
    const courier = await signedInCourier(c);
    await db.update(couriers).set({ lastSyncedAt: now }).where(eq(couriers.id, courier.id));
    // DATA-2: every part from one instant, so the snapshot never mixes two states.
    const { route, handoversToGive, heldOffRoute, notices, summary } = await db.transaction(
      async (tx) => {
        const route = await loadCourierRoute(tx, courier.id);
        const handoversToGive = await loadHandoversToGive(tx, courier.id);
        const heldOffRoute = await loadHeldOffRoute(tx, courier.id);
        const notices = await loadNotices(tx, courier.id);
        const summary = await loadSummary(tx, courier.id, route, now);
        return { route, handoversToGive, heldOffRoute, notices, summary };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
    return c.json({
      serverTime: now.toISOString(),
      sessionExpiresAt: c.get("sessionExpiresAt").toISOString(),
      route,
      handoversToGive,
      heldOffRoute,
      notices,
      summary,
    } satisfies CourierSnapshot);
  })
  // Records in the order they happened, each in its own transaction (FR-018–FR-026).
  .post("/records", validate("json", courierRecordsBatch), async (c) => {
    const { deviceNow, records } = c.req.valid("json");
    const db = c.get("db");
    const now = c.get("clock")();
    const user = c.get("user");
    const courier = await signedInCourier(c);
    // The phone's clock corrected by its offset to the server's (FR-019, research R7).
    const offset = now.getTime() - new Date(deviceNow).getTime();
    const results: CourierRecordResult[] = [];
    for (const record of records) {
      const occurredAt = new Date(new Date(record.occurredAt).getTime() + offset).toISOString();
      try {
        results.push(
          await applyCourierRecord(
            db,
            { ...record, occurredAt },
            {
              courierId: courier.id,
              authorUserId: user.id,
              onBehalf: false,
              recordedAt: now,
              noticeIds: c.get("noticeIds"),
            },
          ),
        );
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        // ROB-3, C003-3, FR-024: last resort for a record that cannot be stored at all (its
        // shipment does not exist: foreign key). A record that only does not fit its shipment is
        // stored as `invalid_for_shipment` by the domain. This one is answered as not applied,
        // nothing stored, so the phone drops it and the records after it still sync; the records
        // before it already committed.
        c.get("logger").warn(
          { recordId: record.id, shipmentId: record.shipmentId, code: error.code },
          "courier record not applied",
        );
        results.push({
          id: record.id,
          outcome: "not_applied",
          error: {
            code: error.code,
            message: error.message,
            ...(error.fields && { fields: error.fields }),
          },
        });
      }
    }
    return c.json({ results });
  })
  // A photo after its record (FR-009, FR-023); repeating it is harmless.
  .put("/photos/:id", validate("param", idParam), async (c) => {
    const courier = await signedInCourier(c);
    return uploadPhoto(c, c.req.valid("param").id, courier.id);
  });
