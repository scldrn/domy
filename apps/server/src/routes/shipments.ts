import {
  bogotaToday,
  calculateFee,
  codAmountError,
  feeQuoteInput,
  generateTrackingNumber,
  normalizeText,
  normalizeTrackingNumber,
  resolveCodAmount,
  shipmentCreateInput,
  windowFromPreset,
  type RateEntry,
  type Shipment,
  type ShipmentDetail,
  type ShipmentKind,
} from "@domy/domain";
import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import {
  carriers,
  merchants,
  municipalities,
  neighborhoods,
  pickupPoints,
  rateCardEntries,
  rateZones,
  shipmentEvents,
  shipments,
  users,
} from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import { isUniqueViolation, validate } from "../lib/validate.ts";

/** Amounts that require an explicit confirmation before saving (FR-037). */
const feeConfirmationThreshold = 100_000;
const codConfirmationThreshold = 2_000_000;
const handoffKinds = ["terminal", "airport", "carrier_office"] as const;

const pickupNeighborhoods = alias(neighborhoods, "pickup_neighborhoods");
const recipientNeighborhoods = alias(neighborhoods, "recipient_neighborhoods");
const recipientMunicipalities = alias(municipalities, "recipient_municipalities");

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

async function loadShipment(db: Executor, id: string): Promise<Shipment> {
  const [shipment] = await loadShipments(db, [id]);
  if (!shipment) throw new AppError("not_found", { message: "No encontramos ese envío." });
  return shipment;
}

async function loadDetail(db: Executor, id: string): Promise<ShipmentDetail> {
  const shipment = await loadShipment(db, id);
  const events = await db
    .select({ event: shipmentEvents, actor: { id: users.id, name: users.name } })
    .from(shipmentEvents)
    .innerJoin(users, eq(users.id, shipmentEvents.actorUserId))
    .where(eq(shipmentEvents.shipmentId, id))
    .orderBy(asc(shipmentEvents.occurredAt), asc(shipmentEvents.recordedAt));
  return {
    ...shipment,
    events: events.map(({ event, actor }) => ({
      id: event.id,
      type: event.type,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actor,
      occurredAt: event.occurredAt.toISOString(),
      recordedAt: event.recordedAt.toISOString(),
      reason: event.reason,
      changes: event.changes as Record<string, unknown> | null,
    })),
  };
}

/** The rate card entries that can apply to a merchant: its own and the standard ones. */
async function rateEntriesFor(db: Executor, merchantId: string): Promise<RateEntry[]> {
  return db
    .select({
      kind: rateCardEntries.kind,
      merchantId: rateCardEntries.merchantId,
      rateZoneId: rateCardEntries.rateZoneId,
      amount: rateCardEntries.amount,
      effectiveFrom: rateCardEntries.effectiveFrom,
      createdAt: rateCardEntries.createdAt,
    })
    .from(rateCardEntries)
    .where(or(isNull(rateCardEntries.merchantId), eq(rateCardEntries.merchantId, merchantId)));
}

/** The place that gives the rate zone: the recipient's neighborhood or the handoff place. */
async function pricingPlace(db: Executor, kind: ShipmentKind, neighborhoodId: string | null) {
  if (kind === "errand" || !neighborhoodId) return null;
  const [place] = await db
    .select({
      id: neighborhoods.id,
      kind: neighborhoods.kind,
      rateZone: { id: rateZones.id, name: rateZones.name },
    })
    .from(neighborhoods)
    .innerJoin(rateZones, eq(rateZones.id, neighborhoods.rateZoneId))
    .where(eq(neighborhoods.id, neighborhoodId));
  if (!place) {
    throw new AppError("invalid_request", {
      fields: { recipientNeighborhoodId: "Elige un lugar del catálogo." },
    });
  }
  const isHandoffPlace = (handoffKinds as readonly string[]).includes(place.kind);
  if (kind === "carrier_handoff" && !isHandoffPlace) {
    throw new AppError("invalid_request", {
      fields: {
        recipientNeighborhoodId:
          "Elige una terminal, un aeropuerto o una oficina de transportadora.",
      },
    });
  }
  return place;
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
      registeredAt: c.get("clock")(),
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
    const serviceDate = input.serviceDate ?? bogotaToday(registeredAt);

    let pickupAddress = input.pickupAddress ?? "";
    let pickupNeighborhoodId = input.pickupNeighborhoodId ?? "";
    if (input.pickupPointId) {
      const [point] = await db
        .select()
        .from(pickupPoints)
        .where(
          and(
            eq(pickupPoints.id, input.pickupPointId),
            eq(pickupPoints.merchantId, input.merchantId),
          ),
        );
      if (!point?.isActive) {
        throw new AppError("invalid_request", {
          fields: { pickupPointId: "Elige un punto de recogida activo del cliente." },
        });
      }
      pickupAddress = point.address;
      pickupNeighborhoodId = point.neighborhoodId;
    }

    const neighborhoodId = input.kind === "errand" ? null : input.recipientNeighborhoodId;
    const place = await pricingPlace(db, input.kind, neighborhoodId);
    const fee = calculateFee({
      kind: input.kind,
      merchantId: input.merchantId,
      rateZoneId: place?.rateZone.id ?? null,
      serviceLevel: input.serviceLevel,
      registeredAt,
      entries: await rateEntriesFor(db, input.merchantId),
    });
    const overridden = fee.calculatedFee === null || input.fee !== fee.calculatedFee;
    if (overridden && !input.feeOverrideReason) {
      throw new AppError("invalid_request", {
        fields: {
          feeOverrideReason:
            fee.calculatedFee === null
              ? "Escribe el motivo de la tarifa manual."
              : "Escribe el motivo del cambio de tarifa.",
        },
      });
    }

    const codError = codAmountError(input.paymentMode, input.codAmount ?? null);
    if (codError) {
      throw new AppError("invalid_request", { fields: { codAmount: codError } });
    }
    const codAmount = resolveCodAmount(input.paymentMode, input.fee, input.codAmount ?? 0);

    if (
      !input.confirmed &&
      (input.fee > feeConfirmationThreshold || codAmount > codConfirmationThreshold)
    ) {
      throw new AppError("confirmation_required");
    }

    let window: ReturnType<typeof windowFromPreset> = { windowStart: null, windowEnd: null };
    if (input.window) {
      try {
        window = windowFromPreset(serviceDate, input.window);
      } catch (error) {
        throw new AppError("invalid_request", {
          fields: { window: error instanceof Error ? error.message : "Franja no válida." },
        });
      }
    }

    const recipient =
      input.kind === "delivery" ||
      input.kind === "reverse_pickup" ||
      input.kind === "carrier_handoff"
        ? {
            recipientName: input.recipientName ?? null,
            recipientNameNormalized: input.recipientName
              ? normalizeText(input.recipientName)
              : null,
            recipientPhone: input.recipientPhone ?? null,
            recipientNeighborhoodId: input.recipientNeighborhoodId,
          }
        : {};
    const values = {
      id: input.id,
      kind: input.kind,
      serviceDate,
      merchantId: input.merchantId,
      pickupPointId: input.pickupPointId ?? null,
      pickupAddress,
      pickupNeighborhoodId,
      ...recipient,
      recipientAddress:
        input.kind === "delivery" || input.kind === "reverse_pickup"
          ? input.recipientAddress
          : null,
      carrierId: input.kind === "carrier_handoff" ? input.carrierId : null,
      destinationTown: input.kind === "carrier_handoff" ? input.destinationTown : null,
      errandDescription: input.kind === "errand" ? input.errandDescription : null,
      rateZoneId: place?.rateZone.id ?? null,
      serviceLevel: input.serviceLevel,
      calculatedFee: fee.calculatedFee,
      fee: input.fee,
      feeOverrideReason: overridden ? (input.feeOverrideReason ?? null) : null,
      feeNeedsReview: fee.needsReview,
      paymentMode: input.paymentMode,
      codAmount,
      ...window,
      packageSize: input.packageSize ?? null,
      packageCount: input.packageCount ?? null,
      merchantReference: input.merchantReference || null,
      instructions: input.instructions || null,
      registeredAt,
      registeredBy: user.id,
    };

    for (let attempt = 0; ; attempt++) {
      try {
        const created = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(shipments)
            .values({ ...values, trackingNumber: generateTrackingNumber() })
            .onConflictDoNothing({ target: shipments.id })
            .returning({ id: shipments.id });
          if (!row) return false;
          const { recipientNameNormalized: _, ...changes } = values;
          await tx.insert(shipmentEvents).values({
            shipmentId: row.id,
            type: "created",
            toStatus: "registered",
            actorUserId: user.id,
            occurredAt: registeredAt,
            reason: values.feeOverrideReason,
            changes: Object.fromEntries(
              Object.entries(changes).map(([field, value]) => [field, [null, value]]),
            ),
          });
          return true;
        });
        return c.json(await loadShipment(db, input.id), created ? 201 : 200);
      } catch (error) {
        if (attempt < 5 && isUniqueViolation(error, "shipments_tracking_number_key")) continue;
        throw error;
      }
    }
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
    return c.json(await loadDetail(db, row.id));
  })
  .get("/:id", validate("param", z.object({ id: z.uuid() })), async (c) => {
    return c.json(await loadDetail(c.get("db"), c.req.valid("param").id));
  });
