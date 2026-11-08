import {
  recordOnBehalfInput,
  deliveryAttempts,
  exceptionDecisionInput,
  exceptionDecisionState,
  officeReceiptInput,
  officeReceiptStatus,
  needsAmountConfirmation,
  boardQuery,
  bogotaToday,
  calculateFee,
  codAmountError,
  feeQuoteInput,
  filterBoard,
  finalStatuses,
  normalizeText,
  normalizeTrackingNumber,
  relocateShipment,
  resolveCodAmount,
  canVoid,
  feeConfirmInput,
  isEditable,
  shipmentCreateInput,
  shipmentStatusLabels,
  shipmentUpdateInput,
  statusOnJoiningRoute,
  shipmentVoidInput,
  shipmentExportQuery,
  shipmentReassignInput,
  shipmentSearchQuery,
  type ShipmentSearchQuery,
  type ShipmentSearchResult,
  type ShipmentSummary,
  type UnassignedShipment,
  type DispatchBoard,
  type Shipment,
  type ShipmentDetail,
  type ShipmentKind,
} from "@domy/domain";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  like,
  lt,
  lte,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Db, Executor } from "../db/client.ts";
import {
  carriers,
  couriers,
  handovers,
  merchantAliases,
  merchants,
  municipalities,
  neighborhoods,
  pickupPoints,
  rateZones,
  routes,
  shipmentEvents,
  shipments,
  users,
} from "../db/schema/index.ts";
import { findShipmentAction } from "../lib/action-id.ts";
import { applyCourierRecord } from "../lib/courier-records.ts";
import { requireRole } from "../lib/auth-guard.ts";
import {
  deliveryWindow,
  insertShipments,
  prepareShipment,
  pricingPlace,
  rateEntriesFor,
  resolvePickup,
} from "../lib/registration.ts";
import { lockRoutes, moveShipment, routeHeldShipment } from "../lib/reassignment.ts";
import { refreshRouteStatus } from "../lib/route-status.ts";
import {
  loadHandovers,
  loadPlan,
  loadOfficePlace,
  loadRouteRow,
  planShipments,
  recordRouteEvents,
  removeFromPlan,
  savePlan,
  touchRoute,
  transitionShipments,
  unassignedUpTo,
} from "../lib/route-store.ts";
import { AppError } from "../lib/errors.ts";
import { notifyCourier } from "../lib/notices.ts";
import { clearReviewInput } from "@domy/domain";
import { loadRecordFlags, loadShipmentRecords } from "../lib/record-views.ts";
import { exportTable, findExportRecords, toCsv, toXlsx } from "../lib/export.ts";
import { isUniqueViolation, validate } from "../lib/validate.ts";

const pickupNeighborhoods = alias(neighborhoods, "pickup_neighborhoods");
const recipientNeighborhoods = alias(neighborhoods, "recipient_neighborhoods");
const recipientMunicipalities = alias(municipalities, "recipient_municipalities");
const routeCouriers = alias(couriers, "route_couriers");
const custodyCouriers = alias(couriers, "custody_couriers");
const handoverSenders = alias(couriers, "handover_senders");
const handoverReceivers = alias(couriers, "handover_receivers");

/** A left-joined record, or null when the join found nothing. */
function present<T extends Record<string, unknown>>(
  record: { [K in keyof T]: T[K] | null } | null,
): T | null {
  if (!record || Object.values(record).some((value) => value === null)) return null;
  return record as T;
}

/** Loads shipments in the shape the API returns. */
async function loadShipments(db: Executor, ids: string[]): Promise<Shipment[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      shipment: shipments,
      merchant: { id: merchants.id, name: merchants.name },
      pickupNeighborhood: { id: pickupNeighborhoods.id, name: pickupNeighborhoods.name },
      recipientNeighborhood: {
        id: recipientNeighborhoods.id,
        name: recipientNeighborhoods.name,
        municipality: recipientMunicipalities.name,
      },
      carrier: { id: carriers.id, name: carriers.name },
      rateZone: { id: rateZones.id, name: rateZones.name },
      registeredBy: { id: users.id, name: users.name },
    })
    .from(shipments)
    .innerJoin(merchants, eq(merchants.id, shipments.merchantId))
    .innerJoin(pickupNeighborhoods, eq(pickupNeighborhoods.id, shipments.pickupNeighborhoodId))
    .leftJoin(
      recipientNeighborhoods,
      eq(recipientNeighborhoods.id, shipments.recipientNeighborhoodId),
    )
    .leftJoin(
      recipientMunicipalities,
      eq(recipientMunicipalities.id, recipientNeighborhoods.municipalityId),
    )
    .leftJoin(carriers, eq(carriers.id, shipments.carrierId))
    .leftJoin(rateZones, eq(rateZones.id, shipments.rateZoneId))
    .innerJoin(users, eq(users.id, shipments.registeredBy))
    .where(inArray(shipments.id, ids));
  return rows.map(({ shipment: s, ...related }) => ({
    id: s.id,
    trackingNumber: s.trackingNumber,
    kind: s.kind,
    status: s.status,
    serviceDate: s.serviceDate,
    merchant: related.merchant,
    pickupPointId: s.pickupPointId,
    pickupAddress: s.pickupAddress,
    pickupNeighborhood: related.pickupNeighborhood,
    recipientName: s.recipientName,
    recipientPhone: s.recipientPhone,
    recipientAddress: s.recipientAddress,
    recipientNeighborhood: present(related.recipientNeighborhood),
    carrier: present(related.carrier),
    destinationTown: s.destinationTown,
    errandDescription: s.errandDescription,
    rateZone: present(related.rateZone),
    serviceLevel: s.serviceLevel,
    calculatedFee: s.calculatedFee,
    fee: s.fee,
    feeOverrideReason: s.feeOverrideReason,
    feeNeedsReview: s.feeNeedsReview,
    paymentMode: s.paymentMode,
    codAmount: s.codAmount,
    windowStart: s.windowStart?.toISOString() ?? null,
    windowEnd: s.windowEnd?.toISOString() ?? null,
    packageSize: s.packageSize,
    packageCount: s.packageCount,
    merchantReference: s.merchantReference,
    instructions: s.instructions,
    voidReason: s.voidReason,
    version: s.version,
    registeredAt: s.registeredAt.toISOString(),
    registeredBy: related.registeredBy,
  }));
}

export async function loadShipment(db: Executor, id: string): Promise<Shipment> {
  const [shipment] = await loadShipments(db, [id]);
  if (!shipment) throw new AppError("not_found", { message: "No encontramos ese envío." });
  return shipment;
}

/**
 * Where a shipment is on the routes (feature 002): its route and that route's courier, who
 * holds the package, and the handover waiting for confirmation (FR-019, FR-025).
 */
async function loadRouteState(db: Executor, id: string) {
  const [row] = await db
    .select({
      route: {
        id: routes.id,
        number: routes.number,
        serviceDate: routes.serviceDate,
        status: routes.status,
      },
      routeCourier: { id: routeCouriers.id, name: routeCouriers.name },
      custodyCourier: { id: custodyCouriers.id, name: custodyCouriers.name },
      heldAtOffice: shipments.heldAtOffice,
      returnDecided: shipments.returnDecided,
      needsReview: shipments.needsReview,
    })
    .from(shipments)
    .leftJoin(routes, eq(routes.id, shipments.routeId))
    .leftJoin(routeCouriers, eq(routeCouriers.id, routes.courierId))
    .leftJoin(custodyCouriers, eq(custodyCouriers.id, shipments.custodyCourierId))
    .where(eq(shipments.id, id));
  const [handover] = await loadHandovers(
    db,
    and(eq(handovers.shipmentId, id), eq(handovers.status, "pending")),
  );
  const route = present(row?.route ?? null);
  return {
    heldAtOffice: row?.heldAtOffice ?? false,
    returnDecided: row?.returnDecided ?? false,
    needsReview: row?.needsReview ?? false,
    route: route && { ...route, courier: present(row?.routeCourier ?? null) },
    custodyCourier: present(row?.custodyCourier ?? null),
    handover: handover ?? null,
  };
}

async function loadDetail(db: Executor, id: string, now: Date): Promise<ShipmentDetail> {
  const shipment = await loadShipment(db, id);
  const [notificationFields] = await db
    .select({
      trackingCode: shipments.trackingCode,
      notifiedAt: shipments.notifiedAt,
      notifiedBy: shipments.notifiedBy,
    })
    .from(shipments)
    .where(eq(shipments.id, id));
  if (!notificationFields)
    throw new AppError("not_found", { message: "No encontramos ese envío." });
  const records = await loadShipmentRecords(db, id);
  const events = await db
    .select({ event: shipmentEvents, actor: { id: users.id, name: users.name } })
    .from(shipmentEvents)
    .innerJoin(users, eq(users.id, shipmentEvents.actorUserId))
    .where(eq(shipmentEvents.shipmentId, id))
    .orderBy(
      asc(shipmentEvents.occurredAt),
      asc(shipmentEvents.recordedAt),
      asc(shipmentEvents.id),
    );
  const names = await referenceNames(
    db,
    events.flatMap(({ event }) =>
      event.type === "created" ? [] : Object.entries(changesOf(event)),
    ),
  );
  return {
    ...shipment,
    trackingCode: notificationFields.trackingCode,
    notifiedAt: notificationFields.notifiedAt?.toISOString() ?? null,
    notifiedBy: notificationFields.notifiedBy,
    ...(await loadRouteState(db, id)),
    events: events
      .filter(
        ({ event }) =>
          event.type !== "record_corrected" || Object.keys(changesOf(event)).length > 0,
      )
      .map(({ event, actor }) => ({
        id: event.id,
        type: event.type,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        actor,
        occurredAt: event.occurredAt.toISOString(),
        recordedAt: event.recordedAt.toISOString(),
        reason: event.reason,
        changes:
          event.type === "created" || event.type === "notified" || !event.changes
            ? null
            : Object.fromEntries(
                Object.entries(changesOf(event)).map(([field, [before, after]]) => [
                  field,
                  referenceFields.has(field)
                    ? [named(names, before), named(names, after)]
                    : [before, after],
                ]),
              ),
        onBehalf: event.onBehalf,
      })),
    // The courier's records and their flags (feature 003, FR-036).
    records,
    attempts: deliveryAttempts(records),
    recordFlags: (await loadRecordFlags(db, [id], now)).get(id) ?? [],
  };
}

type Changes = Record<string, [unknown, unknown]>;
const changesOf = (event: { changes: unknown }) => (event.changes ?? {}) as Changes;

/** Changed identifiers are shown by name in the history (FR-016; feature 002, FR-016). */
const referenceFields = new Set([
  "recipientNeighborhoodId",
  "pickupNeighborhoodId",
  "pickupPointId",
  "rateZoneId",
  "carrierId",
  "courierId",
  "custodyCourierId",
  "routeId",
]);

const named = (names: Map<string, string>, value: unknown) =>
  (typeof value === "string" && names.get(value)) || value;

async function referenceNames(db: Executor, changes: [string, [unknown, unknown]][]) {
  const ids = changes
    .filter(([field]) => referenceFields.has(field))
    .flatMap(([, values]) => values)
    .filter((value): value is string => typeof value === "string");
  if (ids.length === 0) return new Map<string, string>();
  const rows = await Promise.all([
    db
      .select({ id: neighborhoods.id, name: neighborhoods.name })
      .from(neighborhoods)
      .where(inArray(neighborhoods.id, ids)),
    db
      .select({ id: rateZones.id, name: rateZones.name })
      .from(rateZones)
      .where(inArray(rateZones.id, ids)),
    db
      .select({ id: carriers.id, name: carriers.name })
      .from(carriers)
      .where(inArray(carriers.id, ids)),
    db
      .select({ id: pickupPoints.id, name: pickupPoints.label })
      .from(pickupPoints)
      .where(inArray(pickupPoints.id, ids)),
    db
      .select({ id: couriers.id, name: couriers.name })
      .from(couriers)
      .where(inArray(couriers.id, ids)),
    db
      .select({ id: routes.id, name: sql<string>`'Ruta ' || ${routes.number}` })
      .from(routes)
      .where(inArray(routes.id, ids)),
  ]);
  return new Map(rows.flat().map((row) => [row.id, row.name]));
}

/** Shipments in the short shape of the board and the history (FR-021, FR-024). */
async function findSummaries(
  db: Executor,
  where: SQL | undefined,
  order: (SQL | PgColumn)[],
  limit?: number,
): Promise<ShipmentSummary[]> {
  const query = db
    .select({
      id: shipments.id,
      trackingNumber: shipments.trackingNumber,
      kind: shipments.kind,
      status: shipments.status,
      serviceDate: shipments.serviceDate,
      merchant: { id: merchants.id, name: merchants.name },
      recipientName: shipments.recipientName,
      recipientPhone: shipments.recipientPhone,
      recipientNeighborhood: { id: neighborhoods.id, name: neighborhoods.name },
      rateZone: { id: rateZones.id, name: rateZones.name },
      merchantReference: shipments.merchantReference,
      windowStart: shipments.windowStart,
      windowEnd: shipments.windowEnd,
      codAmount: shipments.codAmount,
      fee: shipments.fee,
      feeNeedsReview: shipments.feeNeedsReview,
      registeredAt: shipments.registeredAt,
      routeId: shipments.routeId,
      routeNumber: routes.number,
      routeCourier: { id: routeCouriers.id, name: routeCouriers.name },
      custodyCourier: { id: custodyCouriers.id, name: custodyCouriers.name },
    })
    .from(shipments)
    .innerJoin(merchants, eq(merchants.id, shipments.merchantId))
    .leftJoin(neighborhoods, eq(neighborhoods.id, shipments.recipientNeighborhoodId))
    .leftJoin(rateZones, eq(rateZones.id, shipments.rateZoneId))
    .leftJoin(routes, eq(routes.id, shipments.routeId))
    .leftJoin(routeCouriers, eq(routeCouriers.id, routes.courierId))
    .leftJoin(custodyCouriers, eq(custodyCouriers.id, shipments.custodyCourierId))
    .where(where)
    .orderBy(...order)
    .$dynamic();
  const rows = await (limit === undefined ? query : query.limit(limit));
  return rows.map(({ routeCourier, custodyCourier, ...row }) => ({
    ...row,
    recipientNeighborhood: present(row.recipientNeighborhood),
    rateZone: present(row.rateZone),
    windowStart: row.windowStart?.toISOString() ?? null,
    windowEnd: row.windowEnd?.toISOString() ?? null,
    registeredAt: row.registeredAt.toISOString(),
    // Who is responsible: the courier holding the package, else the route's (feature 002).
    courier: present(custodyCourier) ?? present(routeCourier),
  }));
}

/** SEC-7: what the office types is matched literally; `\` is PostgreSQL's LIKE escape. */
function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * History search conditions (FR-024): `q` matches the tracking number, the merchant
 * reference, the merchant's name or alias, the recipient's name (with typos), or the
 * recipient's phone (digits only).
 */
function searchConditions(db: Executor, query: Omit<ShipmentSearchQuery, "cursor">) {
  const { q, from, to, status, merchantId, neighborhoodId, feeReview } = query;
  const term = q ? normalizeText(q) : "";
  const trackingNumber = q ? normalizeTrackingNumber(q) : null;
  const digits = q?.replace(/[\s\-()+]/g, "") ?? "";
  return and(
    q
      ? or(
          trackingNumber ? eq(shipments.trackingNumber, trackingNumber) : undefined,
          ilike(shipments.merchantReference, `%${likeLiteral(q)}%`),
          term
            ? inArray(
                shipments.merchantId,
                db
                  .select({ id: merchants.id })
                  .from(merchants)
                  .where(like(merchants.nameNormalized, `%${term}%`))
                  .union(
                    db
                      .select({ id: merchantAliases.merchantId })
                      .from(merchantAliases)
                      .where(like(merchantAliases.aliasNormalized, `%${term}%`)),
                  ),
              )
            : undefined,
          term ? like(shipments.recipientNameNormalized, `%${term}%`) : undefined,
          term ? sql`${shipments.recipientNameNormalized} % ${term}` : undefined,
          /^\d{4,}$/.test(digits) ? like(shipments.recipientPhone, `%${digits}%`) : undefined,
        )
      : undefined,
    from ? gte(shipments.serviceDate, from) : undefined,
    to ? lte(shipments.serviceDate, to) : undefined,
    status ? eq(shipments.status, status) : undefined,
    merchantId ? eq(shipments.merchantId, merchantId) : undefined,
    neighborhoodId ? eq(shipments.recipientNeighborhoodId, neighborhoodId) : undefined,
    feeReview ? eq(shipments.feeNeedsReview, true) : undefined,
  );
}

const unassignedQuery = z.object({
  date: z.iso.date().optional(),
  rateZoneId: z.uuid().optional(),
  merchantId: z.uuid().optional(),
});

const pageSize = 50;
const newestFirst = [desc(shipments.registeredAt), desc(shipments.id)];

const cursorPayload = z.tuple([z.iso.datetime({ offset: true }), z.uuid()]);

function decodeCursor(cursor: string) {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString());
    const [registeredAt, id] = cursorPayload.parse(decoded);
    return { registeredAt, id };
  } catch {
    throw new AppError("invalid_request", { fields: { cursor: "Página no válida." } });
  }
}

const idParam = z.object({ id: z.uuid() });

type ShipmentRow = typeof shipments.$inferSelect;
/** Values to change; `undefined` leaves a field as it is. */
type ShipmentChange = { [Field in keyof ShipmentRow]?: ShipmentRow[Field] | undefined };

/** Fields every kind has, and the fields that only some kinds have (FR-015). */
const commonFields = new Set([
  "serviceDate",
  "pickupPointId",
  "pickupAddress",
  "pickupNeighborhoodId",
  "serviceLevel",
  "fee",
  "feeOverrideReason",
  "paymentMode",
  "codAmount",
  "packageSize",
  "packageCount",
  "merchantReference",
  "instructions",
]);
const recipientFields = ["recipientName", "recipientPhone", "recipientNeighborhoodId"];
const kindFields: Record<ShipmentKind, Set<string>> = {
  delivery: new Set([...recipientFields, "recipientAddress"]),
  reverse_pickup: new Set([...recipientFields, "recipientAddress"]),
  carrier_handoff: new Set([...recipientFields, "carrierId", "destinationTown"]),
  errand: new Set(["errandDescription"]),
};

async function loadVersion(db: Executor, id: string, version: number): Promise<ShipmentRow> {
  const [current] = await db.select().from(shipments).where(eq(shipments.id, id));
  if (!current) throw new AppError("not_found", { message: "No encontramos ese envío." });
  if (current.version !== version) {
    throw new AppError("version_conflict", {
      message: "Este envío cambió; revisa la versión más reciente.",
    });
  }
  return current;
}

/** A shipment that can still be edited or voided: not picked up yet (FR-015). */
async function loadEditable(
  db: Executor,
  id: string,
  version: number,
  action: "edit" | "void",
  actionId: string,
) {
  const [found] = await db.select().from(shipments).where(eq(shipments.id, id));
  if (!found) throw new AppError("not_found", { message: "No encontramos ese envío." });
  const allowed = action === "edit" ? isEditable(found.status) : canVoid(found.status);
  // A retry may have checked its receipt immediately before the first request committed.
  if ((!allowed || found.version !== version) && (await findShipmentAction(db, actionId)) === id)
    return null;
  if (!allowed) {
    throw new AppError("invalid_transition", {
      message:
        found.status === "voided"
          ? "Este envío ya está anulado."
          : `Este envío ya fue recogido (estado «${shipmentStatusLabels[found.status]}»); no se puede ${action === "edit" ? "editar" : "anular"}.`,
    });
  }
  if (found.version !== version)
    throw new AppError("version_conflict", {
      message: "Este envío cambió; revisa la versión más reciente.",
    });
  return found;
}

/** `{ field: [old, new] }` for every field whose value changes. */
function diff(current: ShipmentRow, next: ShipmentChange): Record<string, unknown> {
  const plain = (value: unknown) => (value instanceof Date ? value.toISOString() : value);
  const changes: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(next)) {
    if (value === undefined || field === "recipientNameNormalized") continue;
    const before = plain(current[field as keyof ShipmentRow]);
    if (before !== plain(value)) changes[field] = [before, plain(value)];
  }
  return changes;
}

/**
 * Applies a change and its event together, only on the version the user saw (FR-018). An
 * action already recorded by a concurrent retry counts as applied (FR-042). `onRoute` changes
 * the shipment's route in the same transaction (feature 002, FR-013); the route is locked
 * first, in the order route actions lock it.
 */
async function saveChange(
  db: Db,
  current: ShipmentRow,
  values: ShipmentChange,
  event: Omit<typeof shipmentEvents.$inferInsert, "shipmentId">,
  onRoute?: (tx: Executor, routeId: string) => Promise<void>,
) {
  await db
    .transaction(async (tx) => {
      if (onRoute && current.routeId) {
        await tx
          .select({ id: routes.id })
          .from(routes)
          .where(eq(routes.id, current.routeId))
          .for("update");
      }
      const [row] = await tx
        .update(shipments)
        .set({ ...values, version: current.version + 1, updatedAt: event.occurredAt })
        .where(and(eq(shipments.id, current.id), eq(shipments.version, current.version)))
        .returning({ id: shipments.id });
      if (!row) {
        if (
          event.clientEventId &&
          (await findShipmentAction(tx, event.clientEventId)) === current.id
        )
          return;
        throw new AppError("version_conflict", {
          message: "Este envío cambió; revisa la versión más reciente.",
        });
      }
      await tx.insert(shipmentEvents).values({ ...event, shipmentId: current.id });
      if (onRoute && current.routeId) await onRoute(tx, current.routeId);
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error, "shipment_events_client_event_id_key")) return;
      throw error;
    });
}

const duplicatesQuery = z.object({
  merchantId: z.uuid(),
  serviceDate: z.iso.date(),
  merchantReference: z.string().optional(),
  recipientPhone: z.string().optional(),
});

export const shipmentRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  .post("/fee-quote", validate("json", feeQuoteInput), async (c) => {
    const input = c.req.valid("json");
    const db = c.get("db");
    const place = await pricingPlace(db, input.kind, input.neighborhoodId);
    const result = calculateFee({
      kind: input.kind,
      merchantId: input.merchantId,
      rateZoneId: place?.rateZone.id ?? null,
      serviceLevel: input.serviceLevel,
      registeredAt: input.registeredAt ? new Date(input.registeredAt) : c.get("clock")(),
      entries: await rateEntriesFor(db, input.merchantId),
    });
    return c.json({
      calculatedFee: result.calculatedFee,
      rateZone: place?.rateZone ?? null,
      needsManualFee: result.needsManualFee,
    });
  })
  // Registration (FR-001–FR-013, FR-035, FR-037, FR-042).
  .post("/", validate("json", shipmentCreateInput), async (c) => {
    const input = c.req.valid("json");
    const db = c.get("db");
    const user = c.get("user");

    const [existing] = await db
      .select({ id: shipments.id })
      .from(shipments)
      .where(eq(shipments.id, input.id));
    if (existing) {
      return c.json(await loadShipment(db, existing.id), 200);
    }

    const registeredAt = c.get("clock")();
    const values = await prepareShipment(db, input, { userId: user.id, registeredAt });
    const { created } = await insertShipments(db, [values]);
    return c.json(await loadShipment(db, input.id), created ? 201 : 200);
  })
  // Possible duplicates (FR-013): the same reference or, without one, the same phone.
  .get("/duplicates", validate("query", duplicatesQuery), async (c) => {
    const { merchantId, serviceDate, merchantReference, recipientPhone } = c.req.valid("query");
    const match = merchantReference
      ? eq(shipments.merchantReference, merchantReference)
      : recipientPhone
        ? eq(shipments.recipientPhone, recipientPhone)
        : undefined;
    if (!match) return c.json({ trackingNumbers: [] as string[] });
    const rows = await c
      .get("db")
      .select({ trackingNumber: shipments.trackingNumber })
      .from(shipments)
      .where(
        and(
          eq(shipments.merchantId, merchantId),
          eq(shipments.serviceDate, serviceDate),
          ne(shipments.status, "voided"),
          match,
        ),
      );
    return c.json({ trackingNumbers: rows.map((row) => row.trackingNumber) });
  })
  // Dispatch board (FR-021–FR-023, FR-039): the date's shipments and, on today's board, the
  // pending ones of earlier days; filters and flags use the server clock.
  .get("/board", validate("query", boardQuery), async (c) => {
    const { date: requested, ...filters } = c.req.valid("query");
    const now = c.get("clock")();
    const today = bogotaToday(now);
    const date = requested ?? today;
    const all = await findSummaries(
      c.get("db"),
      date === today
        ? or(
            eq(shipments.serviceDate, date),
            and(lt(shipments.serviceDate, date), notInArray(shipments.status, [...finalStatuses])),
          )
        : eq(shipments.serviceDate, date),
      [
        asc(shipments.serviceDate),
        sql`${shipments.windowEnd} asc nulls last`,
        asc(shipments.registeredAt),
      ],
    );
    // The flags of the courier's records (feature 003, FR-033).
    const db = c.get("db");
    const ids = all.map((shipment) => shipment.id);
    const [flags, decisions, waiting] = await Promise.all([
      loadRecordFlags(db, ids, now),
      db
        .select({ id: shipments.id, returnDecided: shipments.returnDecided })
        .from(shipments)
        .where(inArray(shipments.id, ids)),
      // The handover each shipment still waits on, for "Por resolver" (feature 006, FR-018).
      db
        .select({
          id: handovers.id,
          shipmentId: handovers.shipmentId,
          fromCourier: { id: handoverSenders.id, name: handoverSenders.name },
          toCourier: { id: handoverReceivers.id, name: handoverReceivers.name },
          requestedAt: handovers.requestedAt,
        })
        .from(handovers)
        .innerJoin(handoverSenders, eq(handoverSenders.id, handovers.fromCourierId))
        .innerJoin(handoverReceivers, eq(handoverReceivers.id, handovers.toCourierId))
        .where(and(eq(handovers.status, "pending"), inArray(handovers.shipmentId, ids))),
    ]);
    const returned = new Map(decisions.map((shipment) => [shipment.id, shipment.returnDecided]));
    const pending = new Map(waiting.map(({ shipmentId, ...handover }) => [shipmentId, handover]));
    const entries = all.map((shipment) => {
      const handover = pending.get(shipment.id);
      return {
        ...shipment,
        recordFlags: flags.get(shipment.id) ?? [],
        returnDecided: returned.get(shipment.id) ?? false,
        pendingHandover: handover
          ? { ...handover, requestedAt: handover.requestedAt.toISOString() }
          : null,
      };
    });
    return c.json({
      date,
      serverTime: now.toISOString(),
      ...filterBoard(date, entries, filters, now),
    } satisfies DispatchBoard);
  })
  // Shipments on no route up to a date, grouped by pickup place, by zone and neighborhood (FR-001).
  .get("/unassigned", validate("query", unassignedQuery), async (c) => {
    const { date, rateZoneId, merchantId } = c.req.valid("query");
    const db = c.get("db");
    const items = await findSummaries(
      db,
      and(
        unassignedUpTo(date ?? bogotaToday(c.get("clock")())),
        rateZoneId ? eq(shipments.rateZoneId, rateZoneId) : undefined,
        merchantId ? eq(shipments.merchantId, merchantId) : undefined,
      ),
      [
        asc(shipments.pickupAddress),
        asc(rateZones.name),
        asc(neighborhoods.name),
        asc(shipments.registeredAt),
      ],
    );
    const pickups =
      items.length === 0
        ? []
        : await db
            .select({
              id: shipments.id,
              pickupAddress: shipments.pickupAddress,
              pickupPoint: { id: pickupPoints.id, label: pickupPoints.label },
              pickupNeighborhood: { id: pickupNeighborhoods.id, name: pickupNeighborhoods.name },
              heldAtOffice: shipments.heldAtOffice,
              holder: { id: custodyCouriers.id, name: custodyCouriers.name },
            })
            .from(shipments)
            .leftJoin(pickupPoints, eq(pickupPoints.id, shipments.pickupPointId))
            .leftJoin(custodyCouriers, eq(custodyCouriers.id, shipments.custodyCourierId))
            .innerJoin(
              pickupNeighborhoods,
              eq(pickupNeighborhoods.id, shipments.pickupNeighborhoodId),
            )
            .where(
              inArray(
                shipments.id,
                items.map((item) => item.id),
              ),
            );
    const byId = new Map(pickups.map((pickup) => [pickup.id, pickup]));
    return c.json({
      shipments: items.flatMap((item): UnassignedShipment[] => {
        const pickup = byId.get(item.id);
        const holder = present(pickup?.holder ?? null);
        return pickup
          ? [
              {
                ...item,
                heldBy: pickup.heldAtOffice ? "office" : holder ? { courier: holder } : null,
                pickupAddress: pickup.pickupAddress,
                pickupPoint: present(pickup.pickupPoint),
                pickupNeighborhood: pickup.pickupNeighborhood,
              },
            ]
          : [];
      }),
    });
  })
  // History search, newest first, a page at a time (FR-024, SC-006).
  .get("/search", validate("query", shipmentSearchQuery), async (c) => {
    const { cursor, ...query } = c.req.valid("query");
    const db = c.get("db");
    const after = cursor ? decodeCursor(cursor) : null;
    // The whole search's counts open «Historial»'s sentence; later pages skip them
    // (feature 006, contracts/history-read.md).
    const counts = after
      ? null
      : await db
          .select({
            total: sql<number>`count(*)::int`,
            feeReview: sql<number>`(count(*) filter (where ${shipments.feeNeedsReview}))::int`,
          })
          .from(shipments)
          .where(searchConditions(db, query))
          .then(([row]) => row ?? { total: 0, feeReview: 0 });
    const items = await findSummaries(
      db,
      and(
        searchConditions(db, query),
        after
          ? sql`(${shipments.registeredAt}, ${shipments.id}) < (${after.registeredAt}::timestamptz, ${after.id}::uuid)`
          : undefined,
      ),
      newestFirst,
      pageSize + 1,
    );
    const page = items.slice(0, pageSize);
    const last = page.at(-1);
    // The shipment of a tracking number comes first (US5 scenario 1).
    const trackingNumber = query.q ? normalizeTrackingNumber(query.q) : null;
    const exact = page.findIndex((item) => item.trackingNumber === trackingNumber);
    if (exact > 0) page.unshift(...page.splice(exact, 1));
    return c.json({
      items: page,
      nextCursor:
        items.length > pageSize && last
          ? Buffer.from(JSON.stringify([last.registeredAt, last.id])).toString("base64url")
          : null,
      counts,
    } satisfies ShipmentSearchResult);
  })
  // Export of the same search with Spanish headers (FR-025); owner only.
  .get("/export", requireRole("owner"), validate("query", shipmentExportQuery), async (c) => {
    const { format, ...query } = c.req.valid("query");
    const db = c.get("db");
    const records = await findExportRecords(db, searchConditions(db, query), newestFirst);
    const table = exportTable(records);
    const name = `envios-${bogotaToday(c.get("clock")())}.${format}`;
    c.header("Content-Disposition", `attachment; filename="${name}"`);
    if (format === "csv") {
      c.header("Content-Type", "text/csv; charset=utf-8");
      return c.body(toCsv(table));
    }
    c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return c.body(new Uint8Array(await toXlsx(table)));
  })
  .get("/", validate("query", z.object({ trackingNumber: z.string() })), async (c) => {
    const trackingNumber = normalizeTrackingNumber(c.req.valid("query").trackingNumber);
    const db = c.get("db");
    const [row] = trackingNumber
      ? await db
          .select({ id: shipments.id })
          .from(shipments)
          .where(eq(shipments.trackingNumber, trackingNumber))
      : [];
    if (!row)
      throw new AppError("not_found", { message: "No hay un envío con ese número de guía." });
    return c.json(await loadDetail(db, row.id, c.get("clock")()));
  })
  .get("/:id", validate("param", idParam), async (c) => {
    return c.json(await loadDetail(c.get("db"), c.req.valid("param").id, c.get("clock")()));
  })
  // 003 T074 / FR-034: the same transactional application as the phone, attributed under lock.
  .post(
    "/:id/records",
    validate("param", idParam),
    validate("json", recordOnBehalfInput),
    async (c) => {
      const now = c.get("clock")();
      const input = c.req.valid("json");
      return c.json(
        await applyCourierRecord(
          c.get("db"),
          {
            ...input,
            shipmentId: c.req.valid("param").id,
            occurredAt: input.occurredAt ?? now.toISOString(),
          },
          {
            authorUserId: c.get("user").id,
            onBehalf: true,
            recordedAt: now,
            noticeIds: c.get("noticeIds"),
          },
        ),
      );
    },
  )
  // FR-026: clearing review is a traced action, never a shipment/custody correction.
  .post(
    "/:id/clear-review",
    validate("param", idParam),
    validate("json", clearReviewInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const { actionId, note } = c.req.valid("json");
      const db = c.get("db");
      if (!(await findShipmentAction(db, actionId)))
        await db
          .transaction(async (tx) => {
            const [current] = await tx
              .select()
              .from(shipments)
              .where(eq(shipments.id, id))
              .for("update");
            if (!current) throw new AppError("not_found");
            if (await findShipmentAction(tx, actionId)) return;
            const now = c.get("clock")();
            await tx
              .update(shipments)
              .set({ needsReview: false, updatedAt: now, version: sql`${shipments.version} + 1` })
              .where(eq(shipments.id, id));
            await tx.insert(shipmentEvents).values({
              shipmentId: id,
              type: "review_cleared",
              actorUserId: c.get("user").id,
              occurredAt: now,
              recordedAt: now,
              clientEventId: actionId,
              reason: note,
              changes: { needsReview: [current.needsReview, false] },
            });
          })
          .catch((error: unknown) => {
            if (!isUniqueViolation(error, "shipment_events_client_event_id_key")) throw error;
          });
      return c.json(await loadShipment(db, id));
    },
  )
  // 003 T056, FR-029–FR-032: a decision and all route effects share one receipt/transaction.
  .post(
    "/:id/exception-decision",
    validate("param", idParam),
    validate("json", exceptionDecisionInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const db = c.get("db");
      const now = c.get("clock")();
      const by = {
        actorUserId: c.get("user").id,
        noticeIds: c.get("noticeIds"),
        now,
        reason: input.decision === "return" ? "Devolver al remitente" : "Nuevo intento",
      };
      if (!(await findShipmentAction(db, input.actionId))) {
        await db
          .transaction(async (tx) => {
            const [before] = await tx.select().from(shipments).where(eq(shipments.id, id));
            if (!before) throw new AppError("not_found");
            const waiting = await tx
              .select()
              .from(handovers)
              .where(and(eq(handovers.shipmentId, id), eq(handovers.status, "pending")));
            await lockRoutes(tx, [
              before.routeId,
              input.routeId ?? null,
              ...waiting.flatMap((h) => [h.fromRouteId, h.toRouteId]),
            ]);
            const [current] = await tx
              .select()
              .from(shipments)
              .where(eq(shipments.id, id))
              .for("update");
            // Another copy may have committed while this request waited on the shared locks.
            if (await findShipmentAction(tx, input.actionId)) return;
            if (!current || current.version !== before.version)
              throw new AppError("version_conflict");
            const state = exceptionDecisionState(current, input, bogotaToday(now));
            if (!state) throw new AppError("no_exception_to_decide");
            await routeHeldShipment(
              tx,
              { ...current, ...state, routeId: current.routeId },
              state.routeId,
              by,
            );
            await tx
              .update(shipments)
              .set({
                ...state,
                routeId: state.status === "registered" ? null : state.routeId,
                version: sql`${shipments.version} + 1`,
                updatedAt: now,
              })
              .where(eq(shipments.id, id));
            await tx.insert(shipmentEvents).values({
              shipmentId: id,
              type: "exception_decided",
              actorUserId: by.actorUserId,
              occurredAt: now,
              recordedAt: now,
              fromStatus: current.status,
              toStatus: state.status,
              routeId: state.routeId,
              reason: by.reason,
              clientEventId: input.actionId,
              changes: {
                returnDecided: [current.returnDecided, state.returnDecided],
                routeId: [current.routeId, state.routeId],
                serviceDate: [current.serviceDate, state.serviceDate],
              },
            });
            const recipients = new Set([
              current.custodyCourierId,
              ...(current.routeId ? [(await loadRouteRow(tx, current.routeId)).courierId] : []),
              ...(state.routeId ? [(await loadRouteRow(tx, state.routeId)).courierId] : []),
            ]);
            for (const courierId of recipients)
              await notifyCourier(
                tx,
                courierId,
                "exception_decided",
                { routeId: state.routeId ?? current.routeId, shipmentId: id },
                now,
                by.noticeIds,
              );
            // FR-041: office-held new attempts re-enter the ordinary assignment flow.
            if (state.status === "registered" && state.routeId) {
              const target = await loadRouteRow(tx, state.routeId);
              await transitionShipments(tx, {
                ids: [id],
                from: ["registered"],
                to: statusOnJoiningRoute(target.status),
                routeId: target.id,
                eventRouteId: target.id,
                actorUserId: by.actorUserId,
                occurredAt: now,
              });
            }
          })
          .catch((error: unknown) => {
            if (isUniqueViolation(error, "shipment_events_client_event_id_key")) return;
            throw error;
          });
      }
      return c.json(await loadShipment(db, id));
    },
  )
  // 003 T057, FR-041: receipt ends courier custody without relaxing route transitions.
  .post(
    "/:id/office-receipt",
    validate("param", idParam),
    validate("json", officeReceiptInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const { actionId } = c.req.valid("json");
      const db = c.get("db");
      const now = c.get("clock")();
      const by = {
        actorUserId: c.get("user").id,
        now,
        reason: "Recibido en oficina",
        noticeIds: c.get("noticeIds"),
      };
      if (!(await findShipmentAction(db, actionId)))
        await db
          .transaction(async (tx) => {
            const [before] = await tx.select().from(shipments).where(eq(shipments.id, id));
            if (!before) throw new AppError("not_found");
            const waiting = await tx
              .select()
              .from(handovers)
              .where(and(eq(handovers.shipmentId, id), eq(handovers.status, "pending")));
            await lockRoutes(tx, [
              before.routeId,
              ...waiting.flatMap((h) => [h.fromRouteId, h.toRouteId]),
            ]);
            const [current] = await tx
              .select()
              .from(shipments)
              .where(eq(shipments.id, id))
              .for("update");
            if (await findShipmentAction(tx, actionId)) return;
            if (!current || current.version !== before.version)
              throw new AppError("version_conflict");
            await loadOfficePlace(tx);
            const status = officeReceiptStatus(current);
            if (!status)
              throw new AppError("not_held_by_courier", {
                ...(current.status === "picked_up" &&
                  current.routeId && {
                    message:
                      "Este envío sigue en una ruta. Reporta una novedad antes de recibirlo en oficina.",
                  }),
              });
            if (current.returnDecided && current.routeId)
              await routeHeldShipment(
                tx,
                { ...current, status, custodyCourierId: null, heldAtOffice: true },
                current.routeId,
                by,
              );
            await tx
              .update(shipments)
              .set({
                status,
                custodyCourierId: null,
                heldAtOffice: true,
                version: sql`${shipments.version} + 1`,
                updatedAt: now,
              })
              .where(eq(shipments.id, id));
            await tx.insert(shipmentEvents).values({
              shipmentId: id,
              type: "office_received",
              actorUserId: by.actorUserId,
              occurredAt: now,
              recordedAt: now,
              fromStatus: current.status,
              toStatus: status,
              routeId: current.routeId,
              clientEventId: actionId,
              changes: {
                custodyCourierId: [current.custodyCourierId, null],
                heldAtOffice: [false, true],
              },
            });
            await notifyCourier(
              tx,
              current.custodyCourierId,
              "office_received",
              { routeId: current.routeId, shipmentId: id },
              now,
              by.noticeIds,
            );
          })
          .catch((error: unknown) => {
            if (isUniqueViolation(error, "shipment_events_client_event_id_key")) return;
            throw error;
          });
      const shipment = await loadShipment(db, id);
      const [state] = await db
        .select({ heldAtOffice: shipments.heldAtOffice })
        .from(shipments)
        .where(eq(shipments.id, id));
      return c.json({ ...shipment, heldAtOffice: state?.heldAtOffice ?? false });
    },
  )
  // Corrections while the shipment is not picked up (FR-015, FR-016, FR-018, FR-042).
  .patch("/:id", validate("param", idParam), validate("json", shipmentUpdateInput), async (c) => {
    const { id } = c.req.valid("param");
    const { actionId, version, confirmed, window: windowInput, ...input } = c.req.valid("json");
    const db = c.get("db");
    if (await findShipmentAction(db, actionId)) return c.json(await loadShipment(db, id));
    const current = await loadEditable(db, id, version, "edit", actionId);
    if (!current) return c.json(await loadShipment(db, id));

    const misplaced = Object.keys(input).find(
      (field) => !kindFields[current.kind].has(field) && !commonFields.has(field),
    );
    if (misplaced) {
      throw new AppError("invalid_request", {
        fields: { [misplaced]: "Este dato no aplica a este tipo de envío." },
      });
    }

    const serviceDate = input.serviceDate ?? current.serviceDate;
    const pickup =
      input.pickupPointId !== undefined || input.pickupAddress || input.pickupNeighborhoodId
        ? await resolvePickup(db, current.merchantId, {
            pickupPointId:
              input.pickupPointId !== undefined ? input.pickupPointId : current.pickupPointId,
            pickupAddress: input.pickupAddress ?? current.pickupAddress,
            pickupNeighborhoodId: input.pickupNeighborhoodId ?? current.pickupNeighborhoodId,
          })
        : {};

    // T147: The fee and rate-zone snapshots are preserved unless pricing inputs explicitly change.
    // If the destination neighborhood or service level is changed, fee is recalculated with the
    // rate card in force at registration (scenario 1); a new rate zone or service level discards
    // an earlier override (scenario 5). Non-pricing edits (e.g. instructions, phone) change neither.
    const neighborhoodChanged =
      input.recipientNeighborhoodId !== undefined &&
      input.recipientNeighborhoodId !== current.recipientNeighborhoodId;
    const serviceLevelChanged =
      input.serviceLevel !== undefined && input.serviceLevel !== current.serviceLevel;
    const pricingChanged = neighborhoodChanged || serviceLevelChanged;

    let rateZoneId = current.rateZoneId;
    if (neighborhoodChanged) {
      const place = await pricingPlace(db, current.kind, input.recipientNeighborhoodId ?? null);
      rateZoneId = place?.rateZone.id ?? null;
    }
    const serviceLevel = input.serviceLevel ?? current.serviceLevel;
    const pricing = pricingChanged
      ? calculateFee({
          kind: current.kind,
          merchantId: current.merchantId,
          rateZoneId,
          serviceLevel,
          registeredAt: current.registeredAt,
          entries: await rateEntriesFor(db, current.merchantId),
        })
      : { calculatedFee: current.calculatedFee, needsReview: current.feeNeedsReview };
    const fee =
      input.fee ?? (pricingChanged ? (pricing.calculatedFee ?? current.fee) : current.fee);
    const overridden = pricing.calculatedFee === null || fee !== pricing.calculatedFee;
    const keepsOverride = !pricingChanged && fee === current.fee;
    const feeOverrideReason = overridden
      ? (input.feeOverrideReason ?? (keepsOverride ? current.feeOverrideReason : null))
      : null;
    if (overridden && !feeOverrideReason) {
      throw new AppError("invalid_request", {
        fields: {
          feeOverrideReason:
            pricing.calculatedFee === null
              ? "Escribe el motivo de la tarifa manual."
              : "Escribe el motivo del cambio de tarifa.",
        },
      });
    }

    const paymentMode = input.paymentMode ?? current.paymentMode;
    const enteredCod = input.codAmount ?? current.codAmount;
    const codError = codAmountError(paymentMode, enteredCod);
    if (codError) throw new AppError("invalid_request", { fields: { codAmount: codError } });
    const codAmount = resolveCodAmount(paymentMode, fee, enteredCod);
    // FR-037: only a large amount this edit changes asks for confirmation again.
    if (!confirmed && needsAmountConfirmation({ fee, codAmount }, current)) {
      throw new AppError("confirmation_required");
    }

    // A new service date moves the window with it unless a new window is given.
    const shiftMs = Date.parse(serviceDate) - Date.parse(current.serviceDate);
    const shift = (instant: Date | null) => instant && new Date(instant.getTime() + shiftMs);
    const window =
      windowInput !== undefined
        ? deliveryWindow(serviceDate, windowInput)
        : { windowStart: shift(current.windowStart), windowEnd: shift(current.windowEnd) };

    const recipientName = input.recipientName ?? current.recipientName;
    const next = {
      ...input,
      ...pickup,
      ...window,
      serviceDate,
      recipientName,
      recipientNameNormalized: recipientName ? normalizeText(recipientName) : null,
      rateZoneId,
      serviceLevel,
      calculatedFee: pricing.calculatedFee,
      fee,
      feeOverrideReason,
      feeNeedsReview: pricing.needsReview,
      paymentMode,
      codAmount,
      merchantReference: input.merchantReference === "" ? null : input.merchantReference,
      instructions: input.instructions === "" ? null : input.instructions,
    };
    const changes = diff(current, next);
    if (Object.keys(changes).length === 0) return c.json(await loadShipment(db, id));
    const occurredAt = c.get("clock")();
    await saveChange(
      db,
      current,
      next,
      {
        type: "updated",
        reason: "feeOverrideReason" in changes ? feeOverrideReason : null,
        changes,
        actorUserId: c.get("user").id,
        occurredAt,
        clientEventId: actionId,
      },
      // A new pickup place or address moves its stops (feature 002, FR-013).
      async (tx, routeId) => {
        const route = await loadRouteRow(tx, routeId);
        if (route.status === "in_progress")
          await notifyCourier(
            tx,
            route.courierId,
            "shipment_updated",
            { routeId, shipmentId: id },
            occurredAt,
            c.get("noticeIds"),
          );
        const before = await loadPlan(tx, routeId);
        const [edited] = await planShipments(tx, [id]);
        const after = edited ? relocateShipment(before, edited, () => crypto.randomUUID()) : before;
        if (after === before) return;
        await savePlan(tx, routeId, before, after);
        await touchRoute(tx, routeId, occurredAt);
      },
    );
    return c.json(await loadShipment(db, id));
  })
  // Voiding with a reason; shipments are never deleted (FR-014, FR-017, FR-040).
  .post("/:id/void", validate("param", idParam), validate("json", shipmentVoidInput), async (c) => {
    const { id } = c.req.valid("param");
    const { actionId, version, reason } = c.req.valid("json");
    const db = c.get("db");
    if (await findShipmentAction(db, actionId)) return c.json(await loadShipment(db, id));
    const current = await loadEditable(db, id, version, "void", actionId);
    if (!current) return c.json(await loadShipment(db, id));
    const actorUserId = c.get("user").id;
    const occurredAt = c.get("clock")();
    await saveChange(
      db,
      current,
      { status: "voided", voidReason: reason, routeId: null },
      {
        type: "voided",
        fromStatus: current.status,
        toStatus: "voided",
        reason,
        actorUserId,
        occurredAt,
        routeId: current.routeId,
        clientEventId: actionId,
      },
      // A voided shipment leaves its route in the same operation (feature 002, FR-013).
      async (tx, routeId) => {
        const removed = await removeFromPlan(tx, routeId, id, { actorUserId, occurredAt, reason });
        await touchRoute(tx, routeId, occurredAt);
        await recordRouteEvents(tx, [removed], undefined, false);
        const route = await loadRouteRow(tx, routeId);
        if (route.dispatchedAt)
          await notifyCourier(
            tx,
            route.courierId,
            "shipment_voided",
            { routeId, shipmentId: id },
            occurredAt,
            c.get("noticeIds"),
          );
        await refreshRouteStatus(tx, routeId, { actorUserId, now: occurredAt });
      },
    );
    return c.json(await loadShipment(db, id));
  })
  // Moving a shipment to another route with a reason (feature 002, FR-014, FR-016, FR-025).
  .post(
    "/:id/reassign",
    validate("param", idParam),
    validate("json", shipmentReassignInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const { actionId, toRouteId, reason } = c.req.valid("json");
      const db = c.get("db");
      if (!(await findShipmentAction(db, actionId))) {
        const by = {
          actorUserId: c.get("user").id,
          now: c.get("clock")(),
          reason,
          actionId,
          noticeIds: c.get("noticeIds"),
        };
        await db
          .transaction(async (tx) => {
            const [found] = await tx
              .select({ routeId: shipments.routeId })
              .from(shipments)
              .where(eq(shipments.id, id));
            if (!found) throw new AppError("not_found", { message: "No encontramos ese envío." });
            // Routes first, in the order every route action locks them.
            const pending = await tx
              .select()
              .from(handovers)
              .where(and(eq(handovers.shipmentId, id), eq(handovers.status, "pending")));
            await lockRoutes(tx, [
              found.routeId,
              toRouteId,
              ...pending.flatMap((h) => [h.fromRouteId, h.toRouteId]),
            ]);
            if (await findShipmentAction(tx, actionId)) return;
            const [shipment] = await tx
              .select()
              .from(shipments)
              .where(eq(shipments.id, id))
              .for("update");
            if (!shipment || shipment.routeId !== found.routeId) {
              throw new AppError("version_conflict", {
                message: "Este envío cambió; revisa la versión más reciente.",
              });
            }
            await moveShipment(tx, shipment, toRouteId, by);
          })
          .catch((error: unknown) => {
            if (isUniqueViolation(error, "shipment_events_client_event_id_key")) return;
            throw error;
          });
      }
      const { handover } = await loadRouteState(db, id);
      return c.json({ shipment: await loadShipment(db, id), handover });
    },
  )
  // The owner confirms or corrects a fee marked "Tarifa por revisar" (FR-035).
  .post(
    "/:id/confirm-fee",
    requireRole("owner"),
    validate("param", idParam),
    validate("json", feeConfirmInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const { actionId, version, fee } = c.req.valid("json");
      const db = c.get("db");
      if (await findShipmentAction(db, actionId)) return c.json(await loadShipment(db, id));
      const current = await loadVersion(db, id, version);
      if (!current.feeNeedsReview) {
        throw new AppError("invalid_transition", {
          message: "Este envío no tiene la tarifa por revisar.",
        });
      }
      const next = {
        fee,
        feeNeedsReview: false,
        codAmount: resolveCodAmount(current.paymentMode, fee, current.codAmount),
        feeOverrideReason:
          current.calculatedFee !== null && fee === current.calculatedFee
            ? null
            : current.feeOverrideReason,
      };
      await saveChange(db, current, next, {
        type: "fee_confirmed",
        changes: diff(current, next),
        actorUserId: c.get("user").id,
        occurredAt: c.get("clock")(),
        clientEventId: actionId,
      });
      return c.json(await loadShipment(db, id));
    },
  );
