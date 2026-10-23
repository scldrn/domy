import {
  deliveriesBefore,
  merchantDayView,
  merchantServiceDateWindow,
  merchantShipmentView,
  publicTrackingView,
  type PublicTrackingContext,
  type RouteStopPlan,
  type ShipmentStatus,
  calendarDate,
} from "@domy/domain";
import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { companySettings } from "../db/schema/settings.ts";
import {
  carriers,
  courierRecords,
  couriers,
  handovers,
  merchants,
  neighborhoods,
  recordPhotos,
  routeStops,
  routeTasks,
  routes,
  shipmentEvents,
  shipments,
} from "../db/schema/index.ts";
import type { Tx } from "../db/client.ts";
import { AppError } from "../lib/errors.ts";
import { validate } from "../lib/validate.ts";

const trackingParams = z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{22}$/u) });
const merchantCode = z.string().regex(/^[A-Za-z0-9_-]{22}$/u);
const merchantParams = z.object({ code: merchantCode });
const merchantShipmentParams = z.object({ code: merchantCode, id: z.uuid() });
const merchantPhotoParams = z.object({ code: merchantCode, photoId: z.uuid() });
const merchantDateQuery = z
  .object({ date: z.union([z.string(), z.array(z.string())]).optional() })
  .transform(({ date }) => ({ date: Array.isArray(date) ? date[0] : date }));
type EffectKind = "delivery" | "exception" | "return";
type EffectStatus = "delivered" | "exception" | "returned";

const effectStatuses: Record<EffectKind, EffectStatus> = {
  delivery: "delivered",
  exception: "exception",
  return: "returned",
};

type PublicShipment = Parameters<typeof publicTrackingView>[0];

type EffectRecord = Pick<
  typeof courierRecords.$inferSelect,
  "id" | "kind" | "outcome" | "authorUserId" | "occurredAt" | "recordedAt" | "revertedAt"
>;

type EffectEvent = Pick<
  typeof shipmentEvents.$inferSelect,
  "id" | "type" | "toStatus" | "courierRecordId" | "actorUserId" | "occurredAt" | "recordedAt"
>;

function matchesLegacyEffect(record: EffectRecord, event: EffectEvent, status: EffectStatus) {
  return (
    event.type === "status_changed" &&
    event.courierRecordId === null &&
    event.toStatus === status &&
    event.actorUserId === record.authorUserId &&
    event.occurredAt.getTime() === record.occurredAt.getTime() &&
    event.recordedAt.getTime() === record.recordedAt.getTime()
  );
}

/** Selects the latest appended, unambiguous effect, never the greatest device occurredAt. */
function effectiveRecordEffect<TRecord extends EffectRecord, TEvent extends EffectEvent>(
  records: TRecord[],
  events: TEvent[],
  kind: EffectKind,
): { record: TRecord; event: TEvent } | null {
  const matchingRecords = records.filter((record) => record.kind === kind);
  const legacyMatches = new Map<string, TEvent[]>();
  const legacyRecordsByEvent = new Map<string, number>();

  for (const record of matchingRecords) {
    const status = effectStatuses[kind];
    const matches = events.filter((event) => matchesLegacyEffect(record, event, status));
    legacyMatches.set(record.id, matches);
    for (const event of matches) {
      legacyRecordsByEvent.set(event.id, (legacyRecordsByEvent.get(event.id) ?? 0) + 1);
    }
  }

  const effective: { record: TRecord; event: TEvent }[] = [];
  for (const record of matchingRecords) {
    if (record.outcome !== "applied" || record.revertedAt !== null) continue;
    const status = effectStatuses[kind];
    const direct = events.filter(
      (event) =>
        event.type === "status_changed" &&
        event.courierRecordId === record.id &&
        event.toStatus === status,
    );
    if (direct.length === 1) {
      const event = direct[0];
      if (event) effective.push({ record, event });
      continue;
    }
    if (direct.length > 1) continue;

    const fallback = legacyMatches.get(record.id) ?? [];
    if (fallback.length !== 1) continue;
    const event = fallback[0];
    if (event && legacyRecordsByEvent.get(event.id) === 1) effective.push({ record, event });
  }

  effective.sort((left, right) => right.event.id.localeCompare(left.event.id));
  return effective[0] ?? null;
}

async function loadSupport(tx: Tx) {
  const [settings] = await tx
    .select({ companyName: companySettings.companyName, phone: companySettings.supportPhone })
    .from(companySettings)
    .limit(1);
  return { companyName: settings?.companyName ?? "Cohex", phone: settings?.phone ?? null };
}

async function loadActiveMerchant(tx: Tx, code: string) {
  const [merchant] = await tx
    .select({ id: merchants.id, name: merchants.name })
    .from(merchants)
    .where(and(eq(merchants.linkCode, code), eq(merchants.isActive, true)))
    .limit(1);
  if (!merchant) throw new AppError("link_not_found");
  return merchant;
}

async function loadStatusTransitionAt(
  tx: Tx,
  shipmentId: string,
  status: ShipmentStatus,
  registeredAt: Date,
): Promise<string | null> {
  const [transition] = await tx
    .select({ occurredAt: shipmentEvents.occurredAt })
    .from(shipmentEvents)
    .where(
      and(
        eq(shipmentEvents.shipmentId, shipmentId),
        eq(shipmentEvents.toStatus, status),
        isNotNull(shipmentEvents.fromStatus),
        ne(shipmentEvents.fromStatus, shipmentEvents.toStatus),
      ),
    )
    .orderBy(desc(shipmentEvents.id))
    .limit(1);
  if (transition) return transition.occurredAt.toISOString();
  if (status !== "registered") return null;
  const [priorTransition] = await tx
    .select({ id: shipmentEvents.id })
    .from(shipmentEvents)
    .where(
      and(
        eq(shipmentEvents.shipmentId, shipmentId),
        isNotNull(shipmentEvents.fromStatus),
        isNotNull(shipmentEvents.toStatus),
        ne(shipmentEvents.fromStatus, shipmentEvents.toStatus),
      ),
    )
    .limit(1);
  return priorTransition ? null : registeredAt.toISOString();
}

async function loadMerchantEffectEvents(tx: Tx, shipmentIds: string[], kinds: EffectKind[]) {
  if (shipmentIds.length === 0) return [];
  const statuses = kinds.map((kind) => effectStatuses[kind]);
  return tx
    .select({
      shipmentId: shipmentEvents.shipmentId,
      id: shipmentEvents.id,
      type: shipmentEvents.type,
      toStatus: shipmentEvents.toStatus,
      courierRecordId: shipmentEvents.courierRecordId,
      actorUserId: shipmentEvents.actorUserId,
      occurredAt: shipmentEvents.occurredAt,
      recordedAt: shipmentEvents.recordedAt,
    })
    .from(shipmentEvents)
    .where(
      and(
        inArray(shipmentEvents.shipmentId, shipmentIds),
        eq(shipmentEvents.type, "status_changed"),
        inArray(shipmentEvents.toStatus, statuses),
      ),
    );
}

async function loadMerchantDayDeliveryRecords(tx: Tx, shipmentIds: string[]) {
  if (shipmentIds.length === 0) return [];
  return tx
    .select({
      id: courierRecords.id,
      kind: courierRecords.kind,
      outcome: courierRecords.outcome,
      authorUserId: courierRecords.authorUserId,
      occurredAt: courierRecords.occurredAt,
      recordedAt: courierRecords.recordedAt,
      revertedAt: courierRecords.revertedAt,
      cashAmount: courierRecords.cashAmount,
      companyTransferAmount: courierRecords.companyTransferAmount,
      merchantTransferAmount: courierRecords.merchantTransferAmount,
      shipmentId: courierRecords.shipmentId,
    })
    .from(courierRecords)
    .where(
      and(inArray(courierRecords.shipmentId, shipmentIds), eq(courierRecords.kind, "delivery")),
    );
}

function withinMerchantDateWindow(
  serviceDate: string,
  firstDate: string,
  lastDate: string,
): boolean {
  return serviceDate >= firstDate && serviceDate <= lastDate;
}

async function loadMerchantDetailRecords(tx: Tx, shipmentId: string) {
  return tx
    .select({
      id: courierRecords.id,
      kind: courierRecords.kind,
      outcome: courierRecords.outcome,
      authorUserId: courierRecords.authorUserId,
      occurredAt: courierRecords.occurredAt,
      recordedAt: courierRecords.recordedAt,
      revertedAt: courierRecords.revertedAt,
      receivedByName: courierRecords.receivedByName,
      exceptionReason: courierRecords.exceptionReason,
      cashAmount: courierRecords.cashAmount,
      companyTransferAmount: courierRecords.companyTransferAmount,
      merchantTransferAmount: courierRecords.merchantTransferAmount,
      note: courierRecords.note,
    })
    .from(courierRecords)
    .where(
      and(
        eq(courierRecords.shipmentId, shipmentId),
        inArray(courierRecords.kind, ["delivery", "exception", "return"]),
      ),
    );
}

function merchantCurrentKind(status: ShipmentStatus): EffectKind | null {
  if (status === "delivered") return "delivery";
  if (status === "returned") return "return";
  if (status === "exception") return "exception";
  return null;
}

async function loadMerchantCurrentRecordPhotos(tx: Tx, recordId: string) {
  const photos = await tx
    .select({ id: recordPhotos.id, kind: recordPhotos.kind, uploadedAt: recordPhotos.uploadedAt })
    .from(recordPhotos)
    .where(and(eq(recordPhotos.recordId, recordId), eq(recordPhotos.kind, "proof")));
  return photos.map((photo) => ({
    id: photo.id,
    kind: photo.kind,
    uploaded: photo.uploadedAt !== null,
  }));
}

async function loadEffectRows(tx: Tx, shipmentId: string, kind: EffectKind) {
  const records = await tx
    .select({
      id: courierRecords.id,
      kind: courierRecords.kind,
      outcome: courierRecords.outcome,
      authorUserId: courierRecords.authorUserId,
      occurredAt: courierRecords.occurredAt,
      recordedAt: courierRecords.recordedAt,
      revertedAt: courierRecords.revertedAt,
      receivedByName: courierRecords.receivedByName,
      exceptionReason: courierRecords.exceptionReason,
    })
    .from(courierRecords)
    .where(and(eq(courierRecords.shipmentId, shipmentId), eq(courierRecords.kind, kind)));
  const events: EffectEvent[] = await tx
    .select({
      id: shipmentEvents.id,
      type: shipmentEvents.type,
      toStatus: shipmentEvents.toStatus,
      courierRecordId: shipmentEvents.courierRecordId,
      actorUserId: shipmentEvents.actorUserId,
      occurredAt: shipmentEvents.occurredAt,
      recordedAt: shipmentEvents.recordedAt,
    })
    .from(shipmentEvents)
    .where(
      and(
        eq(shipmentEvents.shipmentId, shipmentId),
        eq(shipmentEvents.type, "status_changed"),
        inArray(shipmentEvents.toStatus, [effectStatuses[kind]]),
      ),
    );
  return { records, events };
}

async function loadVoidEvent(tx: Tx, shipmentId: string) {
  const [event] = await tx
    .select({ occurredAt: shipmentEvents.occurredAt })
    .from(shipmentEvents)
    .where(
      and(
        eq(shipmentEvents.shipmentId, shipmentId),
        eq(shipmentEvents.type, "voided"),
        eq(shipmentEvents.toStatus, "voided"),
      ),
    )
    .orderBy(desc(shipmentEvents.id))
    .limit(1);
  return event ? { occurredAt: event.occurredAt.toISOString() } : null;
}

async function loadQueueStops(
  tx: Tx,
  routeId: string,
): Promise<Pick<RouteStopPlan, "kind" | "tasks">[]> {
  const rows = await tx
    .select({
      stopId: routeStops.id,
      kind: routeStops.kind,
      shipmentId: routeTasks.shipmentId,
      taskKind: routeTasks.kind,
      taskStatus: routeTasks.status,
    })
    .from(routeStops)
    .leftJoin(routeTasks, eq(routeTasks.stopId, routeStops.id))
    .where(eq(routeStops.routeId, routeId))
    .orderBy(asc(routeStops.position), asc(routeTasks.id));

  const stops = new Map<string, Pick<RouteStopPlan, "kind" | "tasks">>();
  for (const row of rows) {
    let stop = stops.get(row.stopId);
    if (!stop) {
      stop = { kind: row.kind, tasks: [] };
      stops.set(row.stopId, stop);
    }
    if (row.shipmentId && row.taskKind && row.taskStatus) {
      stop.tasks.push({ shipmentId: row.shipmentId, kind: row.taskKind, status: row.taskStatus });
    }
  }
  return [...stops.values()];
}

/** FR-011/R14: public endpoints are anonymous and share the app's bounded boundary policy. */
export const publicRoutes = new Hono<AppEnv>()
  .get("/tracking/:code", async (c) => {
    const params = trackingParams.safeParse(c.req.param());
    if (!params.success) throw new AppError("link_not_found");

    const view = await c.get("db").transaction(async (tx) => {
      await tx.execute(sql`set transaction isolation level repeatable read read only`);
      const [row] = await tx
        .select({
          id: shipments.id,
          trackingNumber: shipments.trackingNumber,
          kind: shipments.kind,
          status: shipments.status,
          serviceDate: shipments.serviceDate,
          windowStart: shipments.windowStart,
          windowEnd: shipments.windowEnd,
          codAmount: shipments.codAmount,
          merchantName: merchants.name,
          recipientNeighborhoodName: neighborhoods.name,
          carrierName: carriers.name,
          destinationTown: shipments.destinationTown,
          routeId: shipments.routeId,
          custodyCourierId: shipments.custodyCourierId,
          heldAtOffice: shipments.heldAtOffice,
          returnDecided: shipments.returnDecided,
        })
        .from(shipments)
        .innerJoin(merchants, eq(merchants.id, shipments.merchantId))
        .leftJoin(neighborhoods, eq(neighborhoods.id, shipments.recipientNeighborhoodId))
        .leftJoin(carriers, eq(carriers.id, shipments.carrierId))
        .where(eq(shipments.trackingCode, params.data.code))
        .limit(1);
      if (!row) throw new AppError("link_not_found");

      const shipmentBase = {
        trackingNumber: row.trackingNumber,
        status: row.status,
        serviceDate: row.serviceDate,
        windowStart: row.windowStart?.toISOString() ?? null,
        windowEnd: row.windowEnd?.toISOString() ?? null,
        codAmount: row.codAmount,
        merchant: { name: row.merchantName },
      };
      let shipment: PublicShipment;
      if (row.kind === "carrier_handoff") {
        if (row.carrierName === null || row.destinationTown === null) {
          throw new AppError("link_not_found");
        }
        shipment = {
          ...shipmentBase,
          kind: "carrier_handoff",
          carrier: { name: row.carrierName },
          destinationTown: row.destinationTown,
        };
      } else {
        shipment = {
          ...shipmentBase,
          kind: row.kind,
          recipientNeighborhood:
            row.recipientNeighborhoodName === null ? null : { name: row.recipientNeighborhoodName },
        };
      }

      const [route] = row.routeId
        ? await tx
            .select({ status: routes.status, name: couriers.name, phone: couriers.phone })
            .from(routes)
            .leftJoin(couriers, eq(couriers.id, routes.courierId))
            .where(eq(routes.id, row.routeId))
            .limit(1)
        : [];
      const [custodyCourier] = row.custodyCourierId
        ? await tx
            .select({ name: couriers.name, phone: couriers.phone })
            .from(couriers)
            .where(eq(couriers.id, row.custodyCourierId))
            .limit(1)
        : [];
      const [pendingHandover] = await tx
        .select({ status: handovers.status })
        .from(handovers)
        .where(and(eq(handovers.shipmentId, row.id), eq(handovers.status, "pending")))
        .limit(1);

      const context: PublicTrackingContext = {
        support: await loadSupport(tx),
        route: route
          ? {
              status: route.status,
              courier:
                route.name === null || route.phone === null
                  ? null
                  : { name: route.name, phone: route.phone },
            }
          : null,
        custodyCourier: custodyCourier ?? null,
        heldAtOffice: row.heldAtOffice,
        returnDecided: row.returnDecided,
        handover: pendingHandover ?? null,
        exceptionReason: null,
        deliveriesBefore: null,
        effectiveFinalEvent: null,
        effectiveDeliveryRecord: null,
      };

      if (row.status === "delivered") {
        const { records, events } = await loadEffectRows(tx, row.id, "delivery");
        const effect = effectiveRecordEffect(records, events, "delivery");
        if (effect) {
          context.effectiveFinalEvent = { occurredAt: effect.event.occurredAt.toISOString() };
          context.effectiveDeliveryRecord = {
            kind: "delivery",
            outcome: "applied",
            receivedByName: effect.record.receivedByName,
            occurredAt: effect.record.occurredAt.toISOString(),
            reverted: null,
          };
        }
      } else if (row.status === "returned") {
        const { records, events } = await loadEffectRows(tx, row.id, "return");
        const effect = effectiveRecordEffect(records, events, "return");
        if (effect)
          context.effectiveFinalEvent = { occurredAt: effect.event.occurredAt.toISOString() };
      } else if (row.status === "voided") {
        context.effectiveFinalEvent = await loadVoidEvent(tx, row.id);
      } else if (row.status === "exception" && !row.returnDecided) {
        const { records, events } = await loadEffectRows(tx, row.id, "exception");
        context.exceptionReason =
          effectiveRecordEffect(records, events, "exception")?.record.exceptionReason ?? null;
      }

      if (row.status === "registered" || row.status === "assigned") {
        const [decision] = await tx
          .select({ reason: shipmentEvents.reason })
          .from(shipmentEvents)
          .where(
            and(
              eq(shipmentEvents.shipmentId, row.id),
              eq(shipmentEvents.type, "exception_decided"),
              eq(shipmentEvents.fromStatus, "exception"),
              eq(shipmentEvents.reason, "Nuevo intento"),
            ),
          )
          .orderBy(desc(shipmentEvents.id))
          .limit(1);
        context.reprogrammedAfterException = decision !== undefined;
      }

      if (row.routeId) {
        context.deliveriesBefore = deliveriesBefore(
          await loadQueueStops(tx, row.routeId),
          row.id,
          row.kind,
        );
      }

      return publicTrackingView(shipment, context, c.get("clock")());
    });

    return c.json(view);
  })
  .get("/merchant/:code", validate("query", merchantDateQuery), async (c) => {
    const params = merchantParams.safeParse(c.req.param());
    if (!params.success) throw new AppError("link_not_found");
    const query = c.req.valid("query");

    const view = await c.get("db").transaction(async (tx) => {
      await tx.execute(sql`set transaction isolation level repeatable read read only`);
      const merchant = await loadActiveMerchant(tx, params.data.code);
      const parsedDate = query.date === undefined ? undefined : calendarDate.safeParse(query.date);
      if (parsedDate && !parsedDate.success) throw new AppError("date_out_of_range");
      const now = c.get("clock")();
      const window = merchantServiceDateWindow(now);
      const date = (parsedDate?.success ? parsedDate.data : undefined) ?? window.lastDate;
      if (!withinMerchantDateWindow(date, window.firstDate, window.lastDate)) {
        throw new AppError("date_out_of_range");
      }

      const rows = await tx
        .select({
          id: shipments.id,
          trackingNumber: shipments.trackingNumber,
          trackingCode: shipments.trackingCode,
          kind: shipments.kind,
          status: shipments.status,
          serviceDate: shipments.serviceDate,
          merchantReference: shipments.merchantReference,
          recipientName: shipments.recipientName,
          neighborhood: neighborhoods.name,
          windowStart: shipments.windowStart,
          windowEnd: shipments.windowEnd,
          fee: shipments.fee,
          feeNeedsReview: shipments.feeNeedsReview,
          codAmount: shipments.codAmount,
        })
        .from(shipments)
        .leftJoin(neighborhoods, eq(neighborhoods.id, shipments.recipientNeighborhoodId))
        .where(and(eq(shipments.merchantId, merchant.id), eq(shipments.serviceDate, date)))
        .orderBy(asc(shipments.registeredAt), asc(shipments.id));
      const shipmentIds = rows.map((row) => row.id);
      const [records, events, support] = await Promise.all([
        loadMerchantDayDeliveryRecords(tx, shipmentIds),
        loadMerchantEffectEvents(tx, shipmentIds, ["delivery"]),
        loadSupport(tx),
      ]);

      return merchantDayView({
        merchant,
        date,
        support,
        publicBaseUrl: c.get("publicBaseUrl"),
        shipments: rows.map((row) => {
          const rowRecords = records.filter((record) => record.shipmentId === row.id);
          const rowEvents = events.filter((event) => event.shipmentId === row.id);
          const effect =
            row.status === "delivered"
              ? effectiveRecordEffect(rowRecords, rowEvents, "delivery")
              : null;
          return {
            ...row,
            windowStart: row.windowStart?.toISOString() ?? null,
            windowEnd: row.windowEnd?.toISOString() ?? null,
            effectiveDelivery: effect
              ? {
                  kind: effect.record.kind,
                  outcome: effect.record.outcome,
                  reverted: effect.record.revertedAt
                    ? { at: effect.record.revertedAt.toISOString() }
                    : null,
                  cashAmount: effect.record.cashAmount,
                  companyTransferAmount: effect.record.companyTransferAmount,
                  merchantTransferAmount: effect.record.merchantTransferAmount,
                }
              : null,
          };
        }),
      });
    });

    return c.json(view);
  })
  .get("/merchant/:code/shipments/:id", async (c) => {
    const params = merchantShipmentParams.safeParse(c.req.param());
    if (!params.success) throw new AppError("link_not_found");

    const view = await c.get("db").transaction(async (tx) => {
      await tx.execute(sql`set transaction isolation level repeatable read read only`);
      const merchant = await loadActiveMerchant(tx, params.data.code);
      const now = c.get("clock")();
      const [row] = await tx
        .select({
          id: shipments.id,
          trackingNumber: shipments.trackingNumber,
          trackingCode: shipments.trackingCode,
          kind: shipments.kind,
          status: shipments.status,
          serviceDate: shipments.serviceDate,
          merchantReference: shipments.merchantReference,
          recipientName: shipments.recipientName,
          neighborhood: neighborhoods.name,
          windowStart: shipments.windowStart,
          windowEnd: shipments.windowEnd,
          fee: shipments.fee,
          feeNeedsReview: shipments.feeNeedsReview,
          codAmount: shipments.codAmount,
          registeredAt: shipments.registeredAt,
        })
        .from(shipments)
        .leftJoin(neighborhoods, eq(neighborhoods.id, shipments.recipientNeighborhoodId))
        .where(and(eq(shipments.id, params.data.id), eq(shipments.merchantId, merchant.id)))
        .limit(1);
      if (!row) throw new AppError("link_not_found");

      const window = merchantServiceDateWindow(now);
      if (!withinMerchantDateWindow(row.serviceDate, window.firstDate, window.lastDate)) {
        throw new AppError("link_not_found");
      }

      const [records, events] = await Promise.all([
        loadMerchantDetailRecords(tx, row.id),
        loadMerchantEffectEvents(tx, [row.id], ["delivery", "exception", "return"]),
      ]);
      const currentKind = merchantCurrentKind(row.status);
      const effect = currentKind ? effectiveRecordEffect(records, events, currentKind) : null;
      const photos = effect ? await loadMerchantCurrentRecordPhotos(tx, effect.record.id) : [];
      const shipment = {
        id: row.id,
        trackingNumber: row.trackingNumber,
        trackingCode: row.trackingCode,
        kind: row.kind,
        status: row.status,
        serviceDate: row.serviceDate,
        merchantReference: row.merchantReference,
        recipientName: row.recipientName,
        neighborhood: row.neighborhood,
        windowStart: row.windowStart?.toISOString() ?? null,
        windowEnd: row.windowEnd?.toISOString() ?? null,
        fee: row.fee,
        feeNeedsReview: row.feeNeedsReview,
        codAmount: row.codAmount,
      };

      return merchantShipmentView({
        shipment,
        publicBaseUrl: c.get("publicBaseUrl"),
        now,
        statusAt:
          effect?.record.occurredAt.toISOString() ??
          (await loadStatusTransitionAt(tx, row.id, row.status, row.registeredAt)),
        effectiveRecord: effect
          ? {
              kind: effect.record.kind,
              outcome: effect.record.outcome,
              reverted: null,
              occurredAt: effect.record.occurredAt.toISOString(),
              recordedAt: effect.record.recordedAt.toISOString(),
              receivedByName: effect.record.receivedByName,
              cashAmount: effect.record.cashAmount,
              companyTransferAmount: effect.record.companyTransferAmount,
              merchantTransferAmount: effect.record.merchantTransferAmount,
              exceptionReason: effect.record.exceptionReason,
              note: effect.record.note,
              photos,
            }
          : null,
        attempts: records.map((record) => ({
          kind: record.kind,
          outcome: record.outcome,
          reverted: record.revertedAt ? { at: record.revertedAt.toISOString() } : null,
          occurredAt: record.occurredAt.toISOString(),
          exceptionReason: record.exceptionReason,
          note: record.note,
        })),
      });
    });

    return c.json(view);
  })
  .get("/merchant/:code/photos/:photoId", async (c) => {
    const params = merchantPhotoParams.safeParse(c.req.param());
    if (!params.success) throw new AppError("link_not_found");

    const key = await c.get("db").transaction(async (tx) => {
      await tx.execute(sql`set transaction isolation level repeatable read read only`);
      const merchant = await loadActiveMerchant(tx, params.data.code);
      const window = merchantServiceDateWindow(c.get("clock")());
      const [photo] = await tx
        .select({
          id: recordPhotos.id,
          recordId: recordPhotos.recordId,
          storageKey: recordPhotos.storageKey,
          uploadedAt: recordPhotos.uploadedAt,
          shipmentId: shipments.id,
          serviceDate: shipments.serviceDate,
          status: shipments.status,
          recordKind: courierRecords.kind,
        })
        .from(recordPhotos)
        .innerJoin(courierRecords, eq(courierRecords.id, recordPhotos.recordId))
        .innerJoin(shipments, eq(shipments.id, courierRecords.shipmentId))
        .where(
          and(
            eq(recordPhotos.id, params.data.photoId),
            eq(recordPhotos.kind, "proof"),
            eq(shipments.merchantId, merchant.id),
            isNotNull(recordPhotos.uploadedAt),
          ),
        )
        .limit(1);
      if (!photo?.uploadedAt) throw new AppError("link_not_found");

      if (!withinMerchantDateWindow(photo.serviceDate, window.firstDate, window.lastDate)) {
        throw new AppError("link_not_found");
      }
      const kind =
        photo.status === "delivered" && photo.recordKind === "delivery"
          ? "delivery"
          : photo.status === "returned" && photo.recordKind === "return"
            ? "return"
            : null;
      if (!kind) throw new AppError("link_not_found");

      const { records, events } = await loadEffectRows(tx, photo.shipmentId, kind);
      const effect = effectiveRecordEffect(records, events, kind);
      if (!effect || effect.record.id !== photo.recordId) throw new AppError("link_not_found");
      return photo.storageKey;
    });

    const image = await c.get("storage").getPhoto(key);
    if (!image) throw new AppError("link_not_found");
    return c.body(image, 200, { "content-type": "image/jpeg" });
  });
