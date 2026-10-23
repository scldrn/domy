import { bogotaLocalTime } from "./bogota-time.ts";
import { deliveryAttempts, type ExceptionReason } from "./courier-records.ts";
import { addCop } from "./money.ts";
import { isFinal } from "./shipment-lifecycle.ts";
import { isWithinPhotoWait } from "./shipment-flags.ts";
import { publicOriginSchema } from "./schemas/public-origin.ts";
import {
  exceptionReasonText,
  merchantDaySchema,
  merchantSupportNotice,
  merchantShipmentSchema,
  merchantShipmentSummarySchema,
  publicTrackingSchema,
} from "./schemas/public.ts";
import type { RouteStatus } from "./routes.ts";
import type { CourierRecord } from "./schemas/courier.ts";
import type { CompanySettings } from "./schemas/courier.ts";
import type { Handover, RouteCourier } from "./schemas/routes.ts";
import type { Shipment, ShipmentDetail, ShipmentEvent } from "./schemas/shipment.ts";
import type { ShipmentKind } from "./schemas/enums.ts";
import type {
  MerchantDay,
  MerchantShipment,
  MerchantShipmentSummary,
  PublicTracking,
} from "./schemas/public.ts";

type PublicTrackingShipmentBase = Pick<
  Shipment,
  "trackingNumber" | "status" | "serviceDate" | "windowStart" | "windowEnd" | "codAmount"
> & {
  merchant: Pick<Shipment["merchant"], "name">;
};

type PublicTrackingShipment = PublicTrackingShipmentBase &
  (
    | {
        kind: "carrier_handoff";
        carrier: Pick<NonNullable<Shipment["carrier"]>, "name">;
        destinationTown: string;
      }
    | {
        kind: Exclude<ShipmentKind, "carrier_handoff">;
        recipientNeighborhood: Pick<NonNullable<Shipment["recipientNeighborhood"]>, "name"> | null;
      }
  );

type PublicCourier = Pick<RouteCourier, "name" | "phone">;

type MerchantShipmentSource = Pick<
  Shipment,
  | "id"
  | "trackingNumber"
  | "kind"
  | "status"
  | "serviceDate"
  | "merchantReference"
  | "recipientName"
  | "fee"
  | "feeNeedsReview"
  | "codAmount"
> & {
  trackingCode: string;
  neighborhood: string | null;
  windowStart: string | null;
  windowEnd: string | null;
};

type MerchantEffectiveDelivery = Pick<
  CourierRecord,
  "kind" | "outcome" | "cashAmount" | "companyTransferAmount" | "merchantTransferAmount"
> & { reverted: Pick<NonNullable<CourierRecord["reverted"]>, "at"> | null };

type MerchantDayInput = {
  merchant: Pick<Shipment["merchant"], "name">;
  date: string;
  support: Pick<CompanySettings, "companyName"> & { phone: CompanySettings["supportPhone"] };
  publicBaseUrl: string;
  shipments: readonly (MerchantShipmentSource & {
    effectiveDelivery: MerchantEffectiveDelivery | null;
  })[];
};

type MerchantDetailRecord = Pick<
  CourierRecord,
  | "kind"
  | "outcome"
  | "occurredAt"
  | "recordedAt"
  | "receivedByName"
  | "cashAmount"
  | "companyTransferAmount"
  | "merchantTransferAmount"
  | "exceptionReason"
  | "note"
  | "photos"
> & { reverted: Pick<NonNullable<CourierRecord["reverted"]>, "at"> | null };

type MerchantAttemptRecord = Pick<
  CourierRecord,
  "kind" | "outcome" | "occurredAt" | "exceptionReason" | "note"
> & { reverted: Pick<NonNullable<CourierRecord["reverted"]>, "at"> | null };

type MerchantShipmentInput = {
  shipment: MerchantShipmentSource;
  publicBaseUrl: string;
  now: Date;
  statusAt: string | null;
  effectiveRecord: MerchantDetailRecord | null;
  attempts: readonly MerchantAttemptRecord[];
};

export type PublicTrackingContext = {
  support: Pick<CompanySettings, "companyName"> & { phone: CompanySettings["supportPhone"] };
  route: { status: RouteStatus; courier: PublicCourier | null } | null;
  custodyCourier: PublicCourier | null;
  heldAtOffice: ShipmentDetail["heldAtOffice"];
  returnDecided: ShipmentDetail["returnDecided"];
  handover: Pick<Handover, "status"> | null;
  exceptionReason: ExceptionReason | null;
  reprogrammedAfterException?: boolean;
  deliveriesBefore: number | null;
  effectiveFinalEvent: Pick<ShipmentEvent, "occurredAt"> | null;
  effectiveDeliveryRecord: Pick<
    CourierRecord,
    "kind" | "outcome" | "receivedByName" | "occurredAt" | "reverted"
  > | null;
};

const dayMs = 24 * 60 * 60 * 1000;

function parseInstant(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function utcIso(value: string | null): string | null {
  const instant = parseInstant(value);
  return instant?.toISOString() ?? null;
}

function formatBogotaTime(instant: Date): string {
  const time = bogotaLocalTime(instant);
  const hour24 = Number(time.slice(0, 2));
  const minute = time.slice(3, 5);
  const hour12 = hour24 % 12 || 12;
  const period = hour24 < 12 ? "a. m." : "p. m.";
  return `${String(hour12)}:${minute} ${period}`;
}

function formatServiceDate(date: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(`${date}T12:00:00-05:00`));
}

function effectiveDeliveredInstant(context: PublicTrackingContext): Date | null {
  const eventInstant = parseInstant(context.effectiveFinalEvent?.occurredAt);
  if (eventInstant) return eventInstant;

  const record = context.effectiveDeliveryRecord;
  if (record?.kind !== "delivery" || record.outcome !== "applied" || record.reverted !== null) {
    return null;
  }
  return parseInstant(record.occurredAt);
}

function receiverName(context: PublicTrackingContext): string | null {
  const record = context.effectiveDeliveryRecord;
  if (record?.kind !== "delivery" || record.outcome !== "applied" || record.reverted !== null) {
    return null;
  }
  return record.receivedByName;
}

function carrierDescriptor(shipment: PublicTrackingShipment): string | null {
  if (shipment.kind !== "carrier_handoff") {
    return null;
  }
  return `${shipment.carrier.name} para ${shipment.destinationTown}`;
}

function isActiveRoute(context: PublicTrackingContext): boolean {
  return context.route?.status === "in_progress";
}

function hasPendingHandover(context: PublicTrackingContext): boolean {
  return context.handover?.status === "pending";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/u)[0] ?? "";
}

function routeCourier(context: PublicTrackingContext): PublicCourier | null {
  const courier = context.route?.courier;
  if (!courier || courier.name.trim() === "" || courier.phone.trim() === "") return null;
  return courier;
}

function eligibleCourier(
  shipment: PublicTrackingShipment,
  context: PublicTrackingContext,
): PublicCourier | null {
  if (
    (shipment.status !== "dispatched" && shipment.status !== "picked_up") ||
    !isActiveRoute(context) ||
    context.heldAtOffice ||
    hasPendingHandover(context)
  ) {
    return null;
  }

  if (shipment.status === "picked_up") {
    const custodian = context.custodyCourier;
    if (!custodian || custodian.name.trim() === "" || custodian.phone.trim() === "") return null;
    return custodian;
  }

  return routeCourier(context);
}

function eligibleQueueCount(
  shipment: PublicTrackingShipment,
  context: PublicTrackingContext,
): number | undefined {
  if (
    !isActiveRoute(context) ||
    context.heldAtOffice ||
    context.returnDecided ||
    context.deliveriesBefore === null
  ) {
    return undefined;
  }

  if (shipment.kind === "reverse_pickup") {
    return shipment.status === "dispatched" ? context.deliveriesBefore : undefined;
  }

  if (shipment.kind === "errand") return undefined;
  return shipment.status === "picked_up" ? context.deliveriesBefore : undefined;
}

function statusText(
  shipment: PublicTrackingShipment,
  context: PublicTrackingContext,
  deliveredAt: Date | null,
): string {
  const { kind, status } = shipment;
  if (status === "exception") {
    return context.returnDecided
      ? "Tu envío será devuelto al remitente"
      : "No pudimos entregar tu envío";
  }
  if (status === "returned") return "Devuelto al remitente";
  if (status === "voided") return "Este envío fue anulado";
  if (
    status === "picked_up" &&
    kind !== "errand" &&
    (!isActiveRoute(context) || context.heldAtOffice)
  ) {
    return `Reprogramado para ${formatServiceDate(shipment.serviceDate)}`;
  }

  if (kind === "reverse_pickup") {
    if (status === "registered" || status === "assigned" || status === "dispatched") {
      return "Recogeremos el paquete en tu dirección";
    }
    if (status === "picked_up") return "En camino al remitente";
    return deliveredAt
      ? `Entregado al remitente a las ${formatBogotaTime(deliveredAt)}`
      : "Entregado al remitente";
  }

  if (kind === "errand") {
    if (status === "registered" || status === "assigned") return "Programada";
    if (status === "dispatched" || status === "picked_up") return "En curso";
    return "Realizada";
  }

  if (status === "registered" || status === "assigned") {
    if (context.reprogrammedAfterException) {
      return `Reprogramado para ${formatServiceDate(shipment.serviceDate)}`;
    }
    return "Recibimos tu envío";
  }
  if (status === "dispatched") return "Tu envío va a ser recogido";
  if (status === "picked_up") {
    return isActiveRoute(context) && !context.heldAtOffice
      ? "En camino"
      : `Reprogramado para ${formatServiceDate(shipment.serviceDate)}`;
  }
  if (kind === "carrier_handoff") {
    const descriptor = carrierDescriptor(shipment);
    return descriptor
      ? `Entregado a la transportadora ${descriptor}`
      : "Entregado a la transportadora";
  }

  const receivedBy = receiverName(context);
  if (!deliveredAt) return "Entregado";
  return receivedBy
    ? `Entregado a ${receivedBy} a las ${formatBogotaTime(deliveredAt)}`
    : `Entregado a las ${formatBogotaTime(deliveredAt)}`;
}

function deliveryTo(
  shipment: PublicTrackingShipment,
  context: PublicTrackingContext,
): string | null | undefined {
  if (shipment.kind === "carrier_handoff") return carrierDescriptor(shipment) ?? undefined;
  if (shipment.kind === "errand") return null;
  return receiverName(context);
}

/**
 * Projects the explicitly approved public fields from bounded model inputs (FR-003–FR-014).
 * The strict shared schema is the final allowlist for every returned property.
 */
export function publicTrackingView(
  shipment: PublicTrackingShipment,
  context: PublicTrackingContext,
  now: Date,
): PublicTracking {
  const support = {
    phone: context.support.phone,
    companyName: context.support.companyName,
  };

  const finalEventInstant = parseInstant(context.effectiveFinalEvent?.occurredAt);
  const deliveredInstant =
    shipment.status === "delivered" ? effectiveDeliveredInstant(context) : null;
  const effectiveFinalInstant = isFinal(shipment.status)
    ? shipment.status === "delivered"
      ? deliveredInstant
      : finalEventInstant
    : null;
  if (
    effectiveFinalInstant !== null &&
    now.getTime() > effectiveFinalInstant.getTime() + 7 * dayMs
  ) {
    return publicTrackingSchema.parse({ expired: true, support });
  }

  const start = utcIso(shipment.windowStart);
  const end = utcIso(shipment.windowEnd);
  const window = start === null && end === null ? null : { start, end };
  const output: Record<string, unknown> = {
    expired: false,
    merchantName: shipment.merchant.name,
    trackingNumber: shipment.trackingNumber,
    kind: shipment.kind,
    serviceDate: shipment.serviceDate,
    window,
    support,
    statusText: statusText(shipment, context, deliveredInstant),
  };

  if (shipment.kind === "carrier_handoff") {
    output["carrierName"] = shipment.carrier.name;
    output["destinationTown"] = shipment.destinationTown;
  } else {
    output["neighborhood"] =
      shipment.kind === "errand" ? null : (shipment.recipientNeighborhood?.name ?? null);
  }

  if (shipment.status === "exception" && !context.returnDecided && context.exceptionReason) {
    output["reasonText"] = exceptionReasonText[context.exceptionReason];
  }

  const queueCount = eligibleQueueCount(shipment, context);
  if (queueCount !== undefined) output["deliveriesBefore"] = queueCount;

  const courier = eligibleCourier(shipment, context);
  if (courier) {
    output["courier"] = { firstName: firstName(courier.name), phone: courier.phone };
  }

  if (shipment.codAmount > 0 && !isFinal(shipment.status)) {
    output["amountToPay"] = shipment.codAmount;
  }

  if (deliveredInstant) {
    output["deliveredAt"] = deliveredInstant.toISOString();
    output["deliveredTo"] = deliveryTo(shipment, context);
  }

  return publicTrackingSchema.parse(output);
}

function merchantTrackingLink(publicBaseUrl: string, trackingCode: string): string {
  const origin = publicOriginSchema.parse(publicBaseUrl);
  return new URL(`/seguimiento/${encodeURIComponent(trackingCode)}`, origin).toString();
}

function merchantSummary(
  shipment: MerchantShipmentSource,
  publicBaseUrl: string,
): MerchantShipmentSummary {
  const start = utcIso(shipment.windowStart);
  const end = utcIso(shipment.windowEnd);
  return merchantShipmentSummarySchema.parse({
    id: shipment.id,
    trackingNumber: shipment.trackingNumber,
    kind: shipment.kind,
    status: shipment.status,
    serviceDate: shipment.serviceDate,
    merchantReference: shipment.merchantReference,
    recipientName: shipment.recipientName,
    neighborhood: shipment.neighborhood,
    window: start === null && end === null ? null : { start, end },
    fee: shipment.feeNeedsReview ? null : shipment.fee,
    feeToConfirm: shipment.feeNeedsReview,
    codAmount: shipment.codAmount,
    trackingLink: merchantTrackingLink(publicBaseUrl, shipment.trackingCode),
  });
}

function isEffectiveRecord<
  T extends {
    outcome: CourierRecord["outcome"];
    reverted: Pick<NonNullable<CourierRecord["reverted"]>, "at"> | null;
  },
>(record: T | null): record is T & { outcome: "applied"; reverted: null } {
  return record?.outcome === "applied" && record.reverted === null;
}

function merchantCollected(record: MerchantEffectiveDelivery | null): {
  cash: number;
  companyTransfer: number;
  merchantTransfer: number;
} {
  if (!record || record.kind !== "delivery" || !isEffectiveRecord(record)) {
    return { cash: 0, companyTransfer: 0, merchantTransfer: 0 };
  }
  return {
    cash: addCop(record.cashAmount),
    companyTransfer: addCop(record.companyTransferAmount),
    merchantTransfer: addCop(record.merchantTransferAmount),
  };
}

function merchantNote(note: string | null): string | null {
  return note === null || note.trim() === "" ? null : merchantSupportNotice;
}

function merchantPhotoStatus(
  uploaded: boolean,
  recordedAt: string,
  now: Date,
): "pending" | "uploaded" | "unavailable" {
  if (uploaded) return "uploaded";
  return isWithinPhotoWait(new Date(recordedAt), now) ? "pending" : "unavailable";
}

function merchantExceptionReason(reason: ExceptionReason | null): string | null {
  return reason === null ? null : exceptionReasonText[reason];
}

function merchantCurrentRecord(input: MerchantShipmentInput): MerchantDetailRecord | null {
  const record = input.effectiveRecord;
  if (!record || !isEffectiveRecord(record)) return null;

  if (
    (input.shipment.status === "delivered" && record.kind === "delivery") ||
    (input.shipment.status === "returned" && record.kind === "return")
  ) {
    return record;
  }
  return null;
}

function merchantException(input: MerchantShipmentInput) {
  if (input.shipment.status !== "exception") return undefined;
  const record = input.effectiveRecord;
  const currentException =
    record?.kind === "exception" && isEffectiveRecord(record) ? record : null;
  const attempts = deliveryAttempts(input.attempts).map((attempt) => ({
    kind: attempt.kind,
    occurredAt: utcIso(attempt.occurredAt) ?? attempt.occurredAt,
    reason: attempt.kind === "exception" ? merchantExceptionReason(attempt.exceptionReason) : null,
    note: merchantNote(attempt.note),
  }));

  return {
    reason: merchantExceptionReason(currentException?.exceptionReason ?? null),
    note: merchantNote(currentException?.note ?? null),
    attempts,
  };
}

/** Projects one bounded service-date cohort into the merchant's strict list and totals (FR-019). */
export function merchantDayView(input: MerchantDayInput): MerchantDay {
  const cohort = input.shipments.filter((shipment) => shipment.serviceDate === input.date);
  const byStatus = {
    registered: 0,
    assigned: 0,
    dispatched: 0,
    picked_up: 0,
    delivered: 0,
    exception: 0,
    returned: 0,
    voided: 0,
  };
  let confirmedFees = 0;
  let feeToConfirmCount = 0;
  let codToCollect = 0;
  let cash = 0;
  let companyTransfer = 0;
  let merchantTransfer = 0;

  for (const shipment of cohort) {
    if (shipment.status === "voided") continue;

    byStatus[shipment.status] += 1;
    if (shipment.feeNeedsReview) {
      feeToConfirmCount += 1;
    } else {
      confirmedFees = addCop(confirmedFees, shipment.fee);
    }
    if (shipment.codAmount > 0 && !isFinal(shipment.status)) {
      codToCollect = addCop(codToCollect, shipment.codAmount);
    }

    if (
      shipment.status === "delivered" &&
      shipment.effectiveDelivery?.kind === "delivery" &&
      isEffectiveRecord(shipment.effectiveDelivery)
    ) {
      const collected = merchantCollected(shipment.effectiveDelivery);
      cash = addCop(cash, collected.cash);
      companyTransfer = addCop(companyTransfer, collected.companyTransfer);
      merchantTransfer = addCop(merchantTransfer, collected.merchantTransfer);
    }
  }

  return merchantDaySchema.parse({
    merchantName: input.merchant.name,
    date: input.date,
    support: {
      phone: input.support.phone,
      companyName: input.support.companyName,
    },
    shipments: cohort.map((shipment) => merchantSummary(shipment, input.publicBaseUrl)),
    totals: {
      byStatus,
      confirmedFees,
      feeToConfirmCount,
      codToCollect,
      collectedByMethod: { cash, companyTransfer, merchantTransfer },
    },
  });
}

/** Projects only effective current delivery/return and exception details (FR-020, R19). */
export function merchantShipmentView(input: MerchantShipmentInput): MerchantShipment {
  const shipment = input.shipment;
  const currentRecord = merchantCurrentRecord(input);
  const exception = merchantException(input);
  const collected =
    shipment.status === "delivered" && currentRecord?.kind === "delivery"
      ? merchantCollected(currentRecord)
      : { cash: 0, companyTransfer: 0, merchantTransfer: 0 };
  const photos =
    currentRecord && (currentRecord.kind === "delivery" || currentRecord.kind === "return")
      ? currentRecord.photos
          .filter((photo) => photo.kind === "proof")
          .map((photo) => ({
            id: photo.id,
            status: merchantPhotoStatus(photo.uploaded, currentRecord.recordedAt, input.now),
          }))
      : [];

  return merchantShipmentSchema.parse({
    ...merchantSummary(shipment, input.publicBaseUrl),
    statusAt: utcIso(input.statusAt),
    receivedByName: currentRecord?.receivedByName ?? null,
    collected: {
      ...collected,
      total: addCop(collected.cash, collected.companyTransfer, collected.merchantTransfer),
    },
    photos,
    ...(exception === undefined ? {} : { exception }),
  });
}
