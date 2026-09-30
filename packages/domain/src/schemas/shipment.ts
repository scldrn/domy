import { z } from "zod";
import { packageSize, paymentMode, serviceLevel, shipmentKind, shipmentStatus } from "./enums.ts";

/** Reasons (fee override, errand fee, missing rate, voiding) are 5–200 characters (FR-040). */
export const reason = z
  .string()
  .trim()
  .min(5, "Escribe un motivo de al menos 5 caracteres.")
  .max(200, "El motivo no puede pasar de 200 caracteres.");

export const money = z
  .number({ error: "Escribe un valor en pesos." })
  .int("Usa pesos enteros, sin decimales.")
  .min(0, "El valor no puede ser negativo.");

export const phone = z.string().regex(/^\d{10}$/, "Escribe un teléfono de 10 dígitos.");
export const calendarDate = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Escribe una hora válida.");
const required = (message: string) => z.string().trim().min(1, message);

export const windowPreset = z.discriminatedUnion("preset", [
  z.object({ preset: z.literal("before"), end: time }),
  z.object({ preset: z.literal("after"), start: time }),
  z.object({ preset: z.literal("between"), start: time, end: time }),
  z.object({ preset: z.literal("morning") }),
  z.object({ preset: z.literal("afternoon") }),
]);

const optionalText = z.string().trim().max(500).optional();

const common = {
  id: z.uuid("Falta el identificador del envío."),
  merchantId: z.uuid("Elige un cliente."),
  serviceDate: calendarDate.optional(),
  pickupPointId: z.uuid().nullable().optional(),
  pickupAddress: z.string().trim().min(3, "Escribe la dirección de recogida.").optional(),
  pickupNeighborhoodId: z.uuid().optional(),
  serviceLevel: serviceLevel.default("standard"),
  fee: money.min(1, "La tarifa debe ser mayor que cero."),
  feeOverrideReason: reason.optional(),
  paymentMode,
  codAmount: money.optional(),
  window: windowPreset.nullable().optional(),
  packageSize: packageSize.optional(),
  packageCount: z.number().int().min(1, "Debe haber al menos una unidad.").optional(),
  merchantReference: z.string().trim().max(60).optional(),
  instructions: optionalText,
  /** Explicit confirmation of a fee above COP 100.000 or a COD above COP 2.000.000 (FR-037). */
  confirmed: z.boolean().optional(),
};

const recipient = {
  recipientName: required("Escribe el nombre del destinatario."),
  recipientPhone: phone,
  recipientAddress: required("Escribe la dirección de entrega."),
  recipientNeighborhoodId: z.uuid("Elige el barrio."),
};

/** Input of `POST /api/shipments` (FR-001–FR-013, FR-042). */
export const shipmentCreateInput = z
  .discriminatedUnion("kind", [
    z.object({ ...common, kind: z.literal("delivery"), ...recipient }),
    z.object({ ...common, kind: z.literal("reverse_pickup"), ...recipient }),
    z.object({
      ...common,
      kind: z.literal("carrier_handoff"),
      recipientNeighborhoodId: z.uuid("Elige el punto de entrega a transportadora."),
      carrierId: z.uuid("Elige la transportadora."),
      destinationTown: required("Escribe el municipio de destino."),
      recipientName: z.string().trim().optional(),
      recipientPhone: phone.optional(),
    }),
    z.object({
      ...common,
      kind: z.literal("errand"),
      errandDescription: required("Describe la diligencia."),
    }),
  ])
  .superRefine((input, context) => {
    if (!input.pickupPointId) {
      if (!input.pickupAddress) {
        context.addIssue({
          code: "custom",
          path: ["pickupAddress"],
          message: "Elige un punto de recogida o escribe la dirección.",
        });
      }
      if (!input.pickupNeighborhoodId) {
        context.addIssue({
          code: "custom",
          path: ["pickupNeighborhoodId"],
          message: "Elige el barrio de recogida.",
        });
      }
    }
  });

export type ShipmentCreateInput = z.input<typeof shipmentCreateInput>;

/** Input of `POST /api/shipments/fee-quote`. */
export const feeQuoteInput = z.object({
  merchantId: z.uuid(),
  kind: shipmentKind,
  neighborhoodId: z.uuid().nullable(),
  serviceLevel,
});
export type FeeQuoteInput = z.infer<typeof feeQuoteInput>;

export type FeeQuote = {
  calculatedFee: number | null;
  rateZone: { id: string; name: string } | null;
  needsManualFee: boolean;
};

export const shipmentEventType = z.enum([
  "created",
  "updated",
  "fee_confirmed",
  "voided",
  "status_changed",
]);

/** A shipment as the API returns it. */
export type Shipment = {
  id: string;
  trackingNumber: string;
  kind: z.infer<typeof shipmentKind>;
  status: z.infer<typeof shipmentStatus>;
  serviceDate: string;
  merchant: { id: string; name: string };
  pickupPointId: string | null;
  pickupAddress: string;
  pickupNeighborhood: { id: string; name: string };
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAddress: string | null;
  recipientNeighborhood: { id: string; name: string; municipality: string } | null;
  carrier: { id: string; name: string } | null;
  destinationTown: string | null;
  errandDescription: string | null;
  rateZone: { id: string; name: string } | null;
  serviceLevel: z.infer<typeof serviceLevel>;
  calculatedFee: number | null;
  fee: number;
  feeOverrideReason: string | null;
  feeNeedsReview: boolean;
  paymentMode: z.infer<typeof paymentMode>;
  codAmount: number;
  windowStart: string | null;
  windowEnd: string | null;
  packageSize: z.infer<typeof packageSize> | null;
  packageCount: number | null;
  merchantReference: string | null;
  instructions: string | null;
  voidReason: string | null;
  version: number;
  registeredAt: string;
  registeredBy: { id: string; name: string };
};

export type ShipmentEvent = {
  id: string;
  type: z.infer<typeof shipmentEventType>;
  fromStatus: z.infer<typeof shipmentStatus> | null;
  toStatus: z.infer<typeof shipmentStatus> | null;
  actor: { id: string; name: string };
  occurredAt: string;
  recordedAt: string;
  reason: string | null;
  changes: Record<string, unknown> | null;
};

export type ShipmentDetail = Shipment & { events: ShipmentEvent[] };
