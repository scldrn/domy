import type { ServiceLevel, ShipmentKind } from "./schemas/enums.ts";

/** One row of the append-only rate card (data-model.md §Geography and rates). */
export type RateEntry = {
  kind: "zone_rate" | "express_surcharge";
  merchantId: string | null;
  rateZoneId: string | null;
  amount: number;
  effectiveFrom: Date;
  createdAt: Date;
};

export type FeeResult = {
  /** Null when the fee must be entered by hand. */
  calculatedFee: number | null;
  needsManualFee: boolean;
  /** True only when no zone rate existed: the owner confirms the manual fee (FR-035). */
  needsReview: boolean;
};

/** The entry in force at an instant: latest effective date, ties won by the latest created. */
function inForce(entries: RateEntry[], at: Date): RateEntry | undefined {
  return entries
    .filter((entry) => entry.effectiveFrom.getTime() <= at.getTime())
    .sort(
      (a, b) =>
        b.effectiveFrom.getTime() - a.effectiveFrom.getTime() ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
}

/**
 * The fee rule (FR-006, FR-007a, FR-035): the zone rate (merchant override, else standard)
 * plus, for express, the express surcharge (merchant override, else standard; 0 is valid).
 * Errands always get a manual fee.
 */
export function calculateFee(input: {
  kind: ShipmentKind;
  merchantId: string;
  rateZoneId: string | null;
  serviceLevel: ServiceLevel;
  registeredAt: Date;
  entries: RateEntry[];
}): FeeResult {
  if (input.kind === "errand") {
    return { calculatedFee: null, needsManualFee: true, needsReview: false };
  }
  const pick = (kind: RateEntry["kind"], merchantId: string | null) =>
    inForce(
      input.entries.filter(
        (entry) =>
          entry.kind === kind &&
          entry.merchantId === merchantId &&
          (kind === "express_surcharge" || entry.rateZoneId === input.rateZoneId),
      ),
      input.registeredAt,
    );

  const zoneRate =
    input.rateZoneId === null
      ? undefined
      : (pick("zone_rate", input.merchantId) ?? pick("zone_rate", null));
  if (!zoneRate) {
    return { calculatedFee: null, needsManualFee: true, needsReview: true };
  }
  const surcharge =
    input.serviceLevel === "express"
      ? ((pick("express_surcharge", input.merchantId) ?? pick("express_surcharge", null))?.amount ??
        0)
      : 0;
  return { calculatedFee: zoneRate.amount + surcharge, needsManualFee: false, needsReview: false };
}
