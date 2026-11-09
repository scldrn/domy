import { z } from "zod";
import { aggregateMoney, calendarDate, money, phone } from "./shipment.ts";
import { shipmentKind, shipmentStatus } from "./enums.ts";
import type { ExceptionReason } from "../courier-records.ts";

const support = z.strictObject({
  phone: phone.nullable(),
  companyName: z.string().trim().min(1),
});

const window = z
  .strictObject({
    start: z.iso.datetime().nullable(),
    end: z.iso.datetime().nullable(),
  })
  .refine((value) => value.start !== null || value.end !== null);

export const exceptionReasonText = {
  recipient_absent: "No encontramos a nadie",
  wrong_address: "La dirección no es correcta",
  rejected: "El envío no fue recibido",
} as const satisfies Record<ExceptionReason, string>;
const exceptionReasonTextSchema = z.enum(exceptionReasonText);

export const merchantShipmentSummarySchema = z.strictObject({
  id: z.uuid(),
  trackingNumber: z.string().trim().min(1),
  kind: shipmentKind,
  status: shipmentStatus,
  serviceDate: calendarDate,
  merchantReference: z.string().nullable(),
  recipientName: z.string().nullable(),
  neighborhood: z.string().nullable(),
  window: window.nullable(),
  fee: money.nullable(),
  feeToConfirm: z.boolean(),
  codAmount: money,
  trackingLink: z.url(),
});

export const merchantDayTotalsSchema = z.strictObject({
  byStatus: z.strictObject({
    registered: z.number().int().nonnegative(),
    assigned: z.number().int().nonnegative(),
    dispatched: z.number().int().nonnegative(),
    picked_up: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    exception: z.number().int().nonnegative(),
    returned: z.number().int().nonnegative(),
    voided: z.number().int().nonnegative(),
  }),
  confirmedFees: aggregateMoney,
  feeToConfirmCount: z.number().int().nonnegative(),
  codToCollect: aggregateMoney,
  collectedByMethod: z.strictObject({
    cash: aggregateMoney,
    companyTransfer: aggregateMoney,
    merchantTransfer: aggregateMoney,
  }),
});

export const merchantDaySchema = z.strictObject({
  merchantName: z.string().trim().min(1),
  date: calendarDate,
  support,
  shipments: z.array(merchantShipmentSummarySchema),
  totals: merchantDayTotalsSchema,
});

export const merchantSupportNotice = "Para conocer más detalles, contacta con soporte.";
const merchantNote = z.union([z.literal(merchantSupportNotice), z.null()]);

const merchantAttempt = z.strictObject({
  kind: z.enum(["delivery", "exception"]),
  occurredAt: z.iso.datetime(),
  reason: exceptionReasonTextSchema.nullable(),
  note: merchantNote,
});

export const merchantShipmentSchema = z.strictObject({
  ...merchantShipmentSummarySchema.shape,
  statusAt: z.iso.datetime().nullable(),
  receivedByName: z.string().nullable(),
  collected: z.strictObject({
    cash: aggregateMoney,
    companyTransfer: aggregateMoney,
    merchantTransfer: aggregateMoney,
    total: aggregateMoney,
  }),
  photos: z.array(
    z.strictObject({
      id: z.uuid(),
      status: z.enum(["pending", "uploaded", "unavailable"]),
    }),
  ),
  exception: z
    .strictObject({
      reason: merchantAttempt.shape.reason,
      note: merchantNote,
      attempts: z.array(merchantAttempt),
    })
    .optional(),
});

export type MerchantShipmentSummary = z.infer<typeof merchantShipmentSummarySchema>;
export type MerchantDay = z.infer<typeof merchantDaySchema>;
export type MerchantShipment = z.infer<typeof merchantShipmentSchema>;

const courier = z.strictObject({
  firstName: z.string().trim().min(1),
  phone,
});

const fullPublicTracking = z
  .strictObject({
    expired: z.literal(false),
    merchantName: z.string().trim().min(1),
    trackingNumber: z.string().trim().min(1),
    kind: shipmentKind,
    serviceDate: calendarDate,
    window: window.nullable(),
    support,
    neighborhood: z.string().trim().min(1).nullable().optional(),
    carrierName: z.string().trim().min(1).optional(),
    destinationTown: z.string().trim().min(1).optional(),
    statusText: z.string().trim().min(1),
    reasonText: exceptionReasonTextSchema.optional(),
    deliveriesBefore: z.number().int().nonnegative().optional(),
    courier: courier.optional(),
    amountToPay: money.min(1).optional(),
    deliveredTo: z.string().trim().min(1).nullable().optional(),
    deliveredAt: z.iso.datetime().optional(),
  })
  .superRefine((value, context) => {
    const isCarrier = value.kind === "carrier_handoff";
    if (isCarrier) {
      if (value.carrierName === undefined) {
        context.addIssue({ code: "custom", path: ["carrierName"], message: "Required." });
      }
      if (value.destinationTown === undefined) {
        context.addIssue({ code: "custom", path: ["destinationTown"], message: "Required." });
      }
      if (value.neighborhood !== undefined) {
        context.addIssue({ code: "custom", path: ["neighborhood"], message: "Not applicable." });
      }
    } else {
      if (value.neighborhood === undefined) {
        context.addIssue({ code: "custom", path: ["neighborhood"], message: "Required." });
      }
      if (value.carrierName !== undefined || value.destinationTown !== undefined) {
        context.addIssue({ code: "custom", path: ["carrierName"], message: "Not applicable." });
      }
    }

    if ((value.deliveredAt === undefined) !== (value.deliveredTo === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["deliveredAt"],
        message: "Delivered metadata must include both timestamp and receiver.",
      });
    }

    if (value.deliveredTo !== undefined) {
      const carrierName = value.carrierName;
      const destinationTown = value.destinationTown;
      if (value.kind === "errand" && value.deliveredTo !== null) {
        context.addIssue({
          code: "custom",
          path: ["deliveredTo"],
          message: "Errands have no receiver.",
        });
      }
      if (
        value.kind === "carrier_handoff" &&
        carrierName !== undefined &&
        destinationTown !== undefined &&
        value.deliveredTo !== `${carrierName} para ${destinationTown}`
      ) {
        context.addIssue({
          code: "custom",
          path: ["deliveredTo"],
          message: "Carrier deliveries use the carrier destination descriptor.",
        });
      }
    }
  });

const expiredPublicTracking = z.strictObject({
  expired: z.literal(true),
  support,
});

/** Explicit allowlist returned by a public tracking link (FR-003–FR-014, R18). */
export const publicTrackingSchema = z.discriminatedUnion("expired", [
  fullPublicTracking,
  expiredPublicTracking,
]);

export type PublicTracking = z.infer<typeof publicTrackingSchema>;
