import { z } from "zod";
import {
  exceptionReasons,
  noticeTypes,
  recordOutcomes,
  type CourierRecordKind,
  type ExceptionReason,
  type RecordOutcome,
} from "../courier-records.ts";
import { collectedTotal, type DaySummary } from "../day-summary.ts";
import { routeStatuses, stopKinds, taskStatuses } from "../routes.ts";
import { shipmentStatuses } from "../shipment-lifecycle.ts";
import { packageSizes, shipmentKinds, type ShipmentKind } from "./enums.ts";
import { aggregateMoney, calendarDate, money, reason } from "./shipment.ts";

/**
 * The courier app's requests and answers (feature 003, contracts/http-api.md). The phone
 * checks a record with these schemas before saving it, and the server again on receipt
 * (Constitution V).
 */

export const photoKinds = [
  "proof",
  "transfer_receipt",
  "disbursement_receipt",
  "exception",
] as const;
export type PhotoKind = (typeof photoKinds)[number];
export const photoKindLabels: Record<PhotoKind, string> = {
  proof: "Prueba de entrega",
  transfer_receipt: "Comprobante de transferencia",
  disbursement_receipt: "Comprobante de pago",
  exception: "Foto de la novedad",
};

/** The three ways a recipient pays a collection (FR-010). */
export const paymentMethodLabels = {
  cash: "Efectivo",
  companyTransfer: "Transferencia a la empresa",
  merchantTransfer: "Transferencia al cliente",
} as const;

/** Proof photos per record (FR-009); other kinds have the same limit. */
export const maxPhotosPerKind = 3;
/** Records per request (contracts/http-api.md). */
export const maxRecordsPerRequest = 50;

const actionId = z.uuid("Falta el identificador de la acción.");
const instant = z.iso.datetime({ offset: true, error: "Falta la hora en que ocurrió." });
const note = z
  .string()
  .trim()
  .min(5, "Escribe una nota de al menos 5 caracteres.")
  .max(200, "La nota no puede pasar de 200 caracteres.");
const receivedByName = z
  .string({ error: "Escribe el nombre de quien recibe, de al menos 2 letras." })
  .trim()
  .min(2, "Escribe el nombre de quien recibe, de al menos 2 letras.")
  .max(100, "El nombre de quien recibe no puede pasar de 100 caracteres.");
const location = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().int().min(0),
});

function photos<const Kinds extends readonly [PhotoKind, ...PhotoKind[]]>(kinds: Kinds) {
  return z
    .array(z.object({ id: z.uuid(), kind: z.enum(kinds) }))
    .default([])
    .superRefine((list, context) => {
      for (const kind of kinds) {
        if (list.filter((photo) => photo.kind === kind).length > maxPhotosPerKind) {
          context.addIssue({
            code: "custom",
            message:
              kind === "proof"
                ? "Toma máximo 3 fotos de la prueba de entrega."
                : "Toma máximo 3 fotos de cada comprobante.",
          });
        }
      }
    });
}

const base = {
  id: z.uuid("Falta el identificador del registro."),
  shipmentId: z.uuid("Falta el envío."),
  occurredAt: instant,
  location: location.optional(),
};

const pickup = z.object({ ...base, kind: z.literal("pickup") });
/** A delivery, or a completed errand, which has no received-by name (FR-008, FR-010). */
const delivery = z.object({
  ...base,
  kind: z.literal("delivery"),
  receivedByName: receivedByName.optional(),
  cashAmount: money.default(0),
  companyTransferAmount: money.default(0),
  merchantTransferAmount: money.default(0),
  note: note.optional(),
  photos: photos(["proof", "transfer_receipt"]),
});
const exception = z.object({
  ...base,
  kind: z.literal("exception"),
  reason: z.enum(exceptionReasons, { error: "Elige el motivo de la novedad." }),
  note: note.optional(),
  photos: photos(["exception"]),
});
const problem = z.object({ ...base, kind: z.literal("problem"), note });
const returned = z.object({
  ...base,
  kind: z.literal("return"),
  receivedByName,
  photos: photos(["proof"]),
});
const disbursement = z.object({
  ...base,
  kind: z.literal("disbursement"),
  amount: z
    .number({ error: "Escribe el valor del pago." })
    .int("Usa pesos enteros, sin decimales.")
    .positive("El pago debe ser mayor que cero."),
  payee: z
    .string({ error: "Escribe a quién se pagó." })
    .trim()
    .min(2, "Escribe a quién se pagó.")
    .max(100, "El nombre no puede pasar de 100 caracteres."),
  note: note.optional(),
  photos: photos(["disbursement_receipt"]),
});
const handoverConfirmation = z.object({ ...base, kind: z.literal("handover_confirmation") });

export const courierRecordInput = z.discriminatedUnion("kind", [
  pickup,
  delivery,
  exception,
  problem,
  returned,
  disbursement,
  handoverConfirmation,
]);
export type CourierRecordInput = z.output<typeof courierRecordInput>;

/** `POST /api/courier/records`: the records in the order they happened (FR-019). */
export const courierRecordsBatch = z.object({
  deviceNow: instant,
  records: z.array(courierRecordInput).min(1).max(maxRecordsPerRequest),
});
export type CourierRecordsBatch = z.input<typeof courierRecordsBatch>;

/**
 * A collected total other than the COD amount needs a note (FR-011); null when the
 * collection is in order. The shipment's COD amount is known only with the shipment.
 */
export function collectionProblem(
  codAmount: number,
  collection: {
    cashAmount: number;
    companyTransferAmount: number;
    merchantTransferAmount: number;
    note?: string | undefined;
  },
): string | null {
  if (collectedTotal(collection) === codAmount) return null;
  return note.safeParse(collection.note ?? "").success
    ? null
    : "Lo cobrado es distinto del valor a recaudar: escribe una nota de al menos 5 caracteres.";
}

/**
 * A delivery names who received it, except an errand, which has no recipient (FR-008); null
 * when in order. The shipment's kind is known only with the shipment.
 */
export function receivedByNameProblem(
  shipmentKind: ShipmentKind,
  name: string | undefined,
): string | null {
  return shipmentKind === "errand" || receivedByName.safeParse(name).success
    ? null
    : "Escribe el nombre de quien recibe, de al menos 2 letras.";
}

/**
 * `POST /api/shipments/:id/records`: dispatch records on a courier's behalf (FR-034); the
 * shipment is in the address, the time it happened defaults to now, and a handover is
 * confirmed with feature 002's endpoint.
 */
const withoutShipment = { shipmentId: true } as const;
const whenever = { occurredAt: instant.optional() };
export const recordOnBehalfInput = z.discriminatedUnion("kind", [
  pickup.omit(withoutShipment).extend(whenever),
  delivery.omit(withoutShipment).extend(whenever),
  exception.omit(withoutShipment).extend(whenever),
  problem.omit(withoutShipment).extend(whenever),
  returned.omit(withoutShipment).extend(whenever),
  disbursement.omit(withoutShipment).extend(whenever),
]);
export type RecordOnBehalfInput = z.input<typeof recordOnBehalfInput>;

/** `POST /api/shipments/:id/exception-decision` (FR-029). */
export const exceptionDecisionInput = z.discriminatedUnion("decision", [
  z.object({
    actionId,
    decision: z.literal("new_attempt"),
    serviceDate: calendarDate.optional(),
    routeId: z.uuid().optional(),
  }),
  z.object({ actionId, decision: z.literal("return"), routeId: z.uuid().optional() }),
]);
export type ExceptionDecisionInput = z.input<typeof exceptionDecisionInput>;

/** `POST /api/courier-records/:id/correct` (FR-035): a reason and the values to change. */
export const recordCorrectionInput = z
  .object({
    actionId,
    reason,
    receivedByName: receivedByName.optional(),
    cashAmount: money.optional(),
    companyTransferAmount: money.optional(),
    merchantTransferAmount: money.optional(),
    exceptionReason: exception.shape.reason.optional(),
    note: note.optional(),
    amount: disbursement.shape.amount.optional(),
    payee: disbursement.shape.payee.optional(),
  })
  .refine(
    ({ actionId: _, reason: __, ...values }) =>
      Object.values(values).some((value) => value !== undefined),
    { message: "Indica qué valor corriges." },
  );
export type RecordCorrectionInput = z.input<typeof recordCorrectionInput>;

/** FR-035: the same applicability rule drives dispatch forms and server validation. */
export const recordCorrectionFields = {
  pickup: [],
  delivery: [
    "receivedByName",
    "cashAmount",
    "companyTransferAmount",
    "merchantTransferAmount",
    "note",
  ],
  exception: ["exceptionReason", "note"],
  problem: [],
  return: ["receivedByName"],
  disbursement: ["amount", "payee", "note"],
  handover_confirmation: [],
} as const satisfies Record<CourierRecordKind, readonly string[]>;

export function recordCorrectionProblem(
  record: {
    kind: CourierRecordKind;
    cashAmount: number;
    companyTransferAmount: number;
    merchantTransferAmount: number;
    note: string | null;
  },
  values: Omit<RecordCorrectionInput, "actionId" | "reason">,
  codAmount: number,
): string | null {
  const allowed: readonly string[] = recordCorrectionFields[record.kind];
  if (Object.keys(values).some((field) => !allowed.includes(field)))
    return "Ese dato no corresponde a este registro. Revisa los campos que puedes corregir.";
  return record.kind === "delivery"
    ? collectionProblem(codAmount, {
        cashAmount: values.cashAmount ?? record.cashAmount,
        companyTransferAmount: values.companyTransferAmount ?? record.companyTransferAmount,
        merchantTransferAmount: values.merchantTransferAmount ?? record.merchantTransferAmount,
        note: values.note ?? record.note ?? undefined,
      })
    : null;
}

/** `POST /api/courier-records/:id/revert` (FR-035). */
export const recordRevertInput = z.object({ actionId, reason });
export type RecordRevertInput = z.input<typeof recordRevertInput>;

/** `POST /api/shipments/:id/office-receipt` (FR-041). */
export const officeReceiptInput = z.object({ actionId });
export type OfficeReceiptInput = z.input<typeof officeReceiptInput>;

/** `POST /api/shipments/:id/clear-review` (FR-026). */
export const clearReviewInput = z.object({ actionId, note });
export type ClearReviewInput = z.input<typeof clearReviewInput>;

/** `PATCH /api/settings` (FR-041): the office, the single place that can hold packages. */
export const companySettingsInput = z.object({
  actionId,
  officeAddress: z
    .string({ error: "Escribe la dirección de la oficina." })
    .trim()
    .min(5, "Escribe la dirección de la oficina.")
    .max(200, "La dirección no puede pasar de 200 caracteres."),
  officeNeighborhoodId: z.uuid("Elige el barrio de la oficina."),
});
export type CompanySettingsInput = z.input<typeof companySettingsInput>;

/** `POST /api/courier/notices/acknowledge`: "Entendido" for the notices shown (FR-027). */
export const maxNoticesPerAcknowledgment = 200;
export const noticeAcknowledgeInput = z.object({
  actionId,
  noticeIds: z.array(z.uuid()).min(1).max(maxNoticesPerAcknowledgment),
  occurredAt: instant,
});
export type NoticeAcknowledgeInput = z.input<typeof noticeAcknowledgeInput>;

/** `POST /api/courier/push-subscriptions` and its removal (FR-040). */
export const pushSubscriptionInput = z.object({
  actionId,
  endpoint: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === "fcm.googleapis.com" ||
        url.hostname.endsWith(".push.apple.com") ||
        url.hostname === "updates.push.services.mozilla.com")
    );
  }, "La dirección de notificaciones no corresponde a un navegador compatible."),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
export type PushSubscriptionInput = z.input<typeof pushSubscriptionInput>;
export const pushSubscriptionRemoveInput = z.object({ actionId, endpoint: z.url() });
export type PushSubscriptionRemoveInput = z.input<typeof pushSubscriptionRemoveInput>;

/** FR-040: runtime public configuration, never private VAPID material. */
export const courierPushConfig = z.object({ publicKey: z.string().min(1).nullable() });
export const courierPushMessage = z.object({
  type: z.enum(noticeTypes),
  routeNumber: z.number().int().positive().optional(),
});

const named = z.object({ id: z.uuid(), name: z.string() });
type Named = z.output<typeof named>;

/** One shipment at one stop of the courier's route (FR-005). */
export const courierTask = z.object({
  id: z.uuid(),
  shipmentId: z.uuid(),
  kind: z.enum(stopKinds),
  status: z.enum(taskStatuses),
  trackingNumber: z.string(),
  shipmentKind: z.enum(shipmentKinds),
  shipmentStatus: z.enum(shipmentStatuses),
  merchant: named,
  recipientName: z.string().nullable(),
  recipientPhone: z.string().nullable(),
  /** A carrier handoff's carrier, proposed as who received it (FR-008). */
  carrier: named.nullable(),
  destinationTown: z.string().nullable(),
  /** What an errand is about. */
  errandDescription: z.string().nullable(),
  instructions: z.string().nullable(),
  packageCount: z.number().int().positive().nullable(),
  packageSize: z.enum(packageSizes).nullable(),
  windowStart: instant.nullable(),
  windowEnd: instant.nullable(),
  codAmount: money,
  /**
   * The handover this delivery waits for (feature 002, FR-025). The at-risk or late flag is
   * computed on the phone with `shipmentFlag` and its corrected clock, so it stays right
   * without signal (FR-005, FR-022).
   */
  blockedByHandover: z.object({ id: z.uuid(), fromCourier: named }).nullable(),
  problemNote: z.string().nullable(),
});
export type CourierTask = z.output<typeof courierTask>;

export const courierStop = z.object({
  id: z.uuid(),
  position: z.number().int().nonnegative(),
  kind: z.enum(stopKinds),
  address: z.string(),
  neighborhood: named.nullable(),
  /** The recipient's on a delivery, the merchant's WhatsApp on a pickup or return (FR-016). */
  contactPhone: z.string().nullable(),
  tasks: z.array(courierTask),
});
export type CourierStop = z.output<typeof courierStop>;

export const courierRoute = z.object({
  id: z.uuid(),
  number: z.number().int().positive(),
  serviceDate: calendarDate,
  status: z.enum(routeStatuses),
  stops: z.array(courierStop),
});
export type CourierRoute = z.output<typeof courierRoute>;

/** A package the courier holds that is on no route ("En mi custodia", FR-005, FR-031). */
export const heldShipment = z.object({
  shipmentId: z.uuid(),
  trackingNumber: z.string(),
  status: z.enum(shipmentStatuses),
  serviceDate: calendarDate,
  merchant: named,
  recipientName: z.string().nullable(),
  returnDecided: z.boolean(),
});
export type HeldShipment = z.output<typeof heldShipment>;

/** A package the courier must hand to another ("Entregar a {mensajero}", FR-028). */
export const handoverToGive = z.object({
  handoverId: z.uuid(),
  shipmentId: z.uuid(),
  trackingNumber: z.string(),
  toCourier: named,
});
export type HandoverToGive = z.output<typeof handoverToGive>;

export const courierNotice = z.object({
  id: z.uuid(),
  type: z.enum(noticeTypes),
  routeNumber: z.number().int().positive().nullable(),
  trackingNumber: z.string().nullable(),
  createdAt: instant,
});
export type Notice = z.output<typeof courierNotice>;

const courierDaySummary = z.object({
  date: calendarDate,
  deliveries: z.number().int().nonnegative(),
  exceptions: z.number().int().nonnegative(),
  returns: z.number().int().nonnegative(),
  pendingStops: z.number().int().nonnegative(),
  cash: aggregateMoney,
  companyTransfer: aggregateMoney,
  merchantTransfer: aggregateMoney,
  disbursements: aggregateMoney,
  cashToHandOver: z.number().int(),
}) satisfies z.ZodType<DaySummary>;

/** `GET /api/courier/route`: everything the courier app needs, also without signal (FR-022). */
export const courierSnapshot = z.object({
  serverTime: instant,
  sessionExpiresAt: instant,
  route: courierRoute.nullable(),
  handoversToGive: z.array(handoverToGive),
  heldOffRoute: z.array(heldShipment),
  notices: z.array(courierNotice),
  summary: courierDaySummary,
});
export type CourierSnapshot = z.output<typeof courierSnapshot>;

/** Only a valid, known outcome acknowledges a record (FR-019, Constitution V). */
export const courierRecordResults = z.object({
  results: z.array(z.object({ id: z.uuid(), outcome: z.enum(recordOutcomes) })),
});

/** A courier record as the panel shows it (FR-036). */
export type CourierRecord = {
  id: string;
  shipmentId: string;
  kind: CourierRecordKind;
  outcome: RecordOutcome;
  courier: Named;
  author: Named;
  onBehalf: boolean;
  occurredAt: string;
  recordedAt: string;
  location: { latitude: number; longitude: number; accuracyM: number } | null;
  receivedByName: string | null;
  cashAmount: number;
  companyTransferAmount: number;
  merchantTransferAmount: number;
  exceptionReason: ExceptionReason | null;
  note: string | null;
  disbursementAmount: number | null;
  payee: string | null;
  photos: { id: string; kind: PhotoKind; uploaded: boolean }[];
  reverted: { at: string; by: Named; reason: string } | null;
};

export type CompanySettings = {
  officeAddress: string | null;
  officeNeighborhood: Named | null;
};
