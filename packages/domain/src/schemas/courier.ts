import { z } from "zod";
import {
  exceptionReasons,
  type CourierRecordKind,
  type ExceptionReason,
  type NoticeType,
  type RecordOutcome,
} from "../courier-records.ts";
import { collectedTotal, type DaySummary } from "../day-summary.ts";
import type { RouteStatus, StopKind, TaskStatus } from "../routes.ts";
import type { ShipmentStatus } from "../shipment-lifecycle.ts";
import type { PackageSize, ShipmentKind } from "./enums.ts";
import { calendarDate, money, reason } from "./shipment.ts";

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
    exceptionReason: z.enum(exceptionReasons).optional(),
    note: note.optional(),
    amount: z.number().int().positive().optional(),
    payee: z.string().trim().min(2).max(100).optional(),
  })
  .refine(
    ({ actionId: _, reason: __, ...values }) =>
      Object.values(values).some((value) => value !== undefined),
    { message: "Indica qué valor corriges." },
  );
export type RecordCorrectionInput = z.input<typeof recordCorrectionInput>;

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
export const noticeAcknowledgeInput = z.object({
  actionId,
  noticeIds: z.array(z.uuid()).min(1).max(200),
  occurredAt: instant,
});
export type NoticeAcknowledgeInput = z.input<typeof noticeAcknowledgeInput>;

/** `POST /api/courier/push-subscriptions` and its removal (FR-040). */
export const pushSubscriptionInput = z.object({
  actionId,
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
export type PushSubscriptionInput = z.input<typeof pushSubscriptionInput>;
export const pushSubscriptionRemoveInput = z.object({ actionId, endpoint: z.url() });
export type PushSubscriptionRemoveInput = z.input<typeof pushSubscriptionRemoveInput>;

type Named = { id: string; name: string };

/** One shipment at one stop of the courier's route (FR-005). */
export type CourierTask = {
  id: string;
  shipmentId: string;
  kind: StopKind;
  status: TaskStatus;
  trackingNumber: string;
  shipmentKind: ShipmentKind;
  shipmentStatus: ShipmentStatus;
  merchant: Named;
  recipientName: string | null;
  recipientPhone: string | null;
  instructions: string | null;
  packageCount: number | null;
  packageSize: PackageSize | null;
  windowStart: string | null;
  windowEnd: string | null;
  codAmount: number;
  /** The handover this delivery waits for (feature 002, FR-025). */
  blockedByHandover: { id: string; fromCourier: Named } | null;
  problemNote: string | null;
};

export type CourierStop = {
  id: string;
  position: number;
  kind: StopKind;
  address: string;
  neighborhood: Named | null;
  /** The recipient's on a delivery, the merchant's WhatsApp on a pickup or return (FR-016). */
  contactPhone: string | null;
  tasks: CourierTask[];
};

export type CourierRoute = {
  id: string;
  number: number;
  serviceDate: string;
  status: RouteStatus;
  stops: CourierStop[];
};

/** A package the courier holds that is on no route ("En mi custodia", FR-005, FR-031). */
export type HeldShipment = {
  shipmentId: string;
  trackingNumber: string;
  status: ShipmentStatus;
  serviceDate: string;
  merchant: Named;
  recipientName: string | null;
  returnDecided: boolean;
};

/** A package the courier must hand to another ("Entregar a {mensajero}", FR-028). */
export type HandoverToGive = {
  handoverId: string;
  shipmentId: string;
  trackingNumber: string;
  toCourier: Named;
};

export type Notice = {
  id: string;
  type: NoticeType;
  routeNumber: number | null;
  trackingNumber: string | null;
  createdAt: string;
};

/** `GET /api/courier/route`: everything the courier app needs, also without signal (FR-022). */
export type CourierSnapshot = {
  serverTime: string;
  sessionExpiresAt: string;
  route: CourierRoute | null;
  handoversToGive: HandoverToGive[];
  heldOffRoute: HeldShipment[];
  notices: Notice[];
  summary: DaySummary;
};

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
