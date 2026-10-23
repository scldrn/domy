import {
  codConfirmationThreshold,
  feeConfirmationThreshold,
  bogotaToday,
  calculateFee,
  codAmountError,
  generateTrackingNumber,
  normalizeText,
  resolveCodAmount,
  windowFromPreset,
  type DeliveryWindow,
  type RateEntry,
  type shipmentCreateInput,
  type ShipmentKind,
  type WindowPreset,
} from "@domy/domain";
import { and, eq, isNull, or } from "drizzle-orm";
import type { z } from "zod";
import type { Db, Executor } from "../db/client.ts";
import {
  carriers,
  merchants,
  neighborhoods,
  pickupPoints,
  rateCardEntries,
  rateZones,
  shipmentEvents,
  shipments,
} from "../db/schema/index.ts";
import { AppError } from "./errors.ts";
import { generateSecretCode } from "./secret-code.ts";
import { isUniqueViolation } from "./validate.ts";

/**
 * Shipment registration shared by single and bulk registration, and the pricing helpers
 * that edits reuse (FR-001–FR-013, FR-035, FR-037).
 */

const handoffKinds = ["terminal", "airport", "carrier_office"] as const;

/** The rate card entries that can apply to a merchant: its own and the standard ones. */
export async function rateEntriesFor(db: Executor, merchantId: string): Promise<RateEntry[]> {
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
export async function pricingPlace(
  db: Executor,
  kind: ShipmentKind,
  neighborhoodId: string | null,
) {
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

/** The pickup of a shipment: a merchant's active pickup point, or a one-off address. */
export async function resolvePickup(
  db: Executor,
  merchantId: string,
  pickup: { pickupPointId: string | null; pickupAddress: string; pickupNeighborhoodId: string },
) {
  if (!pickup.pickupPointId) return pickup;
  const [point] = await db
    .select()
    .from(pickupPoints)
    .where(and(eq(pickupPoints.id, pickup.pickupPointId), eq(pickupPoints.merchantId, merchantId)));
  if (!point?.isActive) {
    throw new AppError("invalid_request", {
      fields: { pickupPointId: "Elige un punto de recogida activo del cliente." },
    });
  }
  return {
    pickupPointId: point.id,
    pickupAddress: point.address,
    pickupNeighborhoodId: point.neighborhoodId,
  };
}

export function deliveryWindow(serviceDate: string, preset: WindowPreset | null): DeliveryWindow {
  if (!preset) return { windowStart: null, windowEnd: null };
  try {
    return windowFromPreset(serviceDate, preset);
  } catch (error) {
    throw new AppError("invalid_request", {
      fields: { window: error instanceof Error ? error.message : "Franja no válida." },
    });
  }
}

/** Deactivated merchants, carriers, and places are not offered for new shipments (FR-029). */
async function requireActive(
  db: Executor,
  input: { merchantId: string; carrierId?: string; recipientNeighborhoodId?: string },
) {
  const [merchant] = await db
    .select({ isActive: merchants.isActive })
    .from(merchants)
    .where(eq(merchants.id, input.merchantId));
  if (!merchant?.isActive) {
    throw new AppError("invalid_request", { fields: { merchantId: "Elige un cliente activo." } });
  }
  if (input.carrierId) {
    const [carrier] = await db
      .select({ isActive: carriers.isActive })
      .from(carriers)
      .where(eq(carriers.id, input.carrierId));
    if (!carrier?.isActive) {
      throw new AppError("invalid_request", {
        fields: { carrierId: "Elige una transportadora activa." },
      });
    }
  }
  if (input.recipientNeighborhoodId) {
    const [place] = await db
      .select({ isActive: neighborhoods.isActive })
      .from(neighborhoods)
      .where(eq(neighborhoods.id, input.recipientNeighborhoodId));
    if (place && !place.isActive) {
      throw new AppError("invalid_request", {
        fields: { recipientNeighborhoodId: "Ese lugar ya no está activo; elige otro." },
      });
    }
  }
}

export type NewShipment = typeof shipments.$inferInsert & { id: string; registeredBy: string };

/**
 * Validates a registration against the catalog, the rate card, and the payment rules, and
 * returns the row to insert. Problems are `invalid_request` with fields, or
 * `confirmation_required` for amounts above the thresholds.
 */
export async function prepareShipment(
  db: Executor,
  input: z.output<typeof shipmentCreateInput>,
  context: { userId: string; registeredAt: Date; entries?: RateEntry[] },
): Promise<NewShipment> {
  const { registeredAt } = context;
  const serviceDate = input.serviceDate ?? bogotaToday(registeredAt);
  await requireActive(db, input);

  const { pickupAddress, pickupNeighborhoodId } = await resolvePickup(db, input.merchantId, {
    pickupPointId: input.pickupPointId ?? null,
    pickupAddress: input.pickupAddress ?? "",
    pickupNeighborhoodId: input.pickupNeighborhoodId ?? "",
  });

  const neighborhoodId = input.kind === "errand" ? null : input.recipientNeighborhoodId;
  const place = await pricingPlace(db, input.kind, neighborhoodId);
  const fee = calculateFee({
    kind: input.kind,
    merchantId: input.merchantId,
    rateZoneId: place?.rateZone.id ?? null,
    serviceLevel: input.serviceLevel,
    registeredAt,
    entries: context.entries ?? (await rateEntriesFor(db, input.merchantId)),
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

  const window = deliveryWindow(serviceDate, input.window ?? null);

  const recipient =
    input.kind === "delivery" || input.kind === "reverse_pickup" || input.kind === "carrier_handoff"
      ? {
          recipientName: input.recipientName ?? null,
          recipientNameNormalized: input.recipientName ? normalizeText(input.recipientName) : null,
          recipientPhone: input.recipientPhone ?? null,
          recipientNeighborhoodId: input.recipientNeighborhoodId,
        }
      : {};
  return {
    id: input.id,
    trackingNumber: "",
    kind: input.kind,
    serviceDate,
    merchantId: input.merchantId,
    pickupPointId: input.pickupPointId ?? null,
    pickupAddress,
    pickupNeighborhoodId,
    ...recipient,
    recipientAddress:
      input.kind === "delivery" || input.kind === "reverse_pickup" ? input.recipientAddress : null,
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
    registeredBy: context.userId,
  };
}

export type InsertShipmentsResult = {
  created: boolean;
  createdCount: number;
  insertedIds: string[];
};

/**
 * Inserts registrations with their "created" events in one transaction, with new tracking
 * numbers (retried on the rare collision). `before` runs first in the same transaction, for
 * the bulk batch row, and `after` runs with the actually inserted rows before commit.
 */
export async function insertShipments(
  db: Db,
  rows: NewShipment[],
  before?: (tx: Executor) => Promise<void>,
  after?: (tx: Executor, inserted: { id: string }[]) => Promise<void>,
): Promise<InsertShipmentsResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        await before?.(tx);
        const prepared = rows.map((row) => ({
          ...row,
          trackingNumber: generateTrackingNumber(),
          trackingCode: generateSecretCode(),
        }));
        const inserted = await tx
          .insert(shipments)
          .values(prepared)
          .onConflictDoNothing({ target: shipments.id })
          .returning({ id: shipments.id });
        const insertedIds = new Set(inserted.map((r) => r.id));
        const newlyInserted = prepared.filter((row) => insertedIds.has(row.id));
        if (newlyInserted.length > 0) {
          await tx.insert(shipmentEvents).values(
            newlyInserted.map(
              ({
                recipientNameNormalized: _,
                trackingNumber: __,
                trackingCode: ___,
                ...values
              }) => ({
                shipmentId: values.id,
                type: "created" as const,
                toStatus: "registered" as const,
                actorUserId: values.registeredBy,
                occurredAt: values.registeredAt,
                reason: values.feeOverrideReason,
                changes: Object.fromEntries(
                  Object.entries(values).map(([field, value]) => [field, [null, value]]),
                ),
              }),
            ),
          );
        }
        await after?.(tx, inserted);
        return {
          created: inserted.length > 0,
          createdCount: inserted.length,
          insertedIds: inserted.map((r) => r.id),
        };
      });
    } catch (error) {
      if (attempt < 5 && isUniqueViolation(error, "shipments_tracking_number_key")) continue;
      throw error;
    }
  }
}
