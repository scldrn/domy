import {
  bogotaToday,
  courierRecordsBatch,
  daySummary,
  type CourierRoute,
  type CourierSnapshot,
  type CourierStop,
  type CourierTask,
  type HandoverToGive,
  type HeldShipment,
  type Notice,
} from "@domy/domain";
import { and, asc, eq, gte, isNull, notInArray } from "drizzle-orm";
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
  recordPhotos,
  routes,
  routeStops,
  routeTasks,
  shipments,
} from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { applyCourierRecord } from "../lib/courier-records.ts";
import { AppError } from "../lib/errors.ts";
import { validate } from "../lib/validate.ts";

/**
 * The courier app's API (feature 003, contracts/http-api.md): the route snapshot, records,
 * and photos, for the signed-in courier only (FR-002). Notices and push subscriptions arrive
 * with user story 5 (tasks.md T066).
 */

const idParam = z.object({ id: z.uuid() });

/** The courier linked to the signed-in account. */
async function signedInCourier(c: Context<AppEnv>): Promise<{ id: string }> {
  const [courier] = await c
    .get("db")
    .select({ id: couriers.id })
    .from(couriers)
    .where(eq(couriers.userId, c.get("user").id));
  if (!courier) {
    throw new AppError("forbidden", {
      message: "Tu cuenta no está vinculada a un mensajero. Pide al propietario que la vincule.",
    });
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
        notInArray(shipments.status, ["delivered", "returned", "voided"]),
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
  const pendingStops = (route?.stops ?? []).filter((stop) =>
    stop.tasks.some((task) => task.status === "pending"),
  ).length;
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
    { date: bogotaToday(now), pendingStops },
  );
}

/** Photos are JPEG, reduced on the phone (research R6). */
const photoType = "image/jpeg";

export const courierAppRoutes = new Hono<AppEnv>()
  .use(requireRole("courier"))
  // The snapshot the phone keeps to work without signal (FR-005, FR-022, FR-033).
  .get("/route", async (c) => {
    const db = c.get("db");
    const now = c.get("clock")();
    const courier = await signedInCourier(c);
    await db.update(couriers).set({ lastSyncedAt: now }).where(eq(couriers.id, courier.id));
    const route = await loadCourierRoute(db, courier.id);
    const [handoversToGive, heldOffRoute, notices, summary] = await Promise.all([
      loadHandoversToGive(db, courier.id),
      loadHeldOffRoute(db, courier.id),
      loadNotices(db, courier.id),
      loadSummary(db, courier.id, route, now),
    ]);
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
    const results = [];
    for (const record of records) {
      const occurredAt = new Date(new Date(record.occurredAt).getTime() + offset).toISOString();
      results.push(
        await applyCourierRecord(
          db,
          { ...record, occurredAt },
          { courierId: courier.id, authorUserId: user.id, onBehalf: false, recordedAt: now },
        ),
      );
    }
    return c.json({ results });
  })
  // A photo after its record (FR-009, FR-023); repeating it is harmless.
  .put("/photos/:id", validate("param", idParam), async (c) => {
    const db = c.get("db");
    const courier = await signedInCourier(c);
    const [photo] = await db
      .select({ id: recordPhotos.id, storageKey: recordPhotos.storageKey })
      .from(recordPhotos)
      .innerJoin(courierRecords, eq(courierRecords.id, recordPhotos.recordId))
      .where(
        and(eq(recordPhotos.id, c.req.valid("param").id), eq(courierRecords.courierId, courier.id)),
      );
    if (!photo) throw new AppError("not_found", { message: "No encontramos esa foto." });
    if (c.req.header("content-type") !== photoType) {
      throw new AppError("invalid_request", { message: "La foto debe ser una imagen JPEG." });
    }
    const image = new Uint8Array(await c.req.arrayBuffer());
    if (image.byteLength === 0) {
      throw new AppError("invalid_request", { message: "La foto llegó vacía." });
    }
    await c.get("storage").putPhoto(photo.storageKey, image);
    await db
      .update(recordPhotos)
      .set({ uploadedAt: c.get("clock")(), byteSize: image.byteLength })
      .where(eq(recordPhotos.id, photo.id));
    return c.body(null, 204);
  });
