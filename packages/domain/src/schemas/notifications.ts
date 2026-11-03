import { z } from "zod";
import { shipmentStatus } from "./enums.ts";
import { calendarDate, phone } from "./shipment.ts";

const publicCode = z.string().regex(/^[A-Za-z0-9_-]{22}$/u, "El código del enlace no es válido.");

const notificationDateMessage = "Escribe una fecha válida en formato AAAA-MM-DD.";
const notificationDate = z
  .string({ error: notificationDateMessage })
  .superRefine((value, context) => {
    if (!calendarDate.safeParse(value).success) {
      context.addIssue({ code: "custom", message: notificationDateMessage });
    }
  });

/** `GET /api/notifications?date=...`; the caller supplies today's Bogotá date when omitted. */
export const notificationListQuery = z.strictObject({ date: notificationDate.optional() });

/** "Notificar clientes" works with today or earlier: the merchant page has no future day (FR-015). */
export function isFutureServiceDate(date: string, today: string): boolean {
  return date > today;
}

/** The minimum shipment row needed to compose a merchant message (FR-015/FR-016, R8). */
export const notificationShipmentSchema = z.strictObject({
  id: z.uuid("El identificador del envío no es válido."),
  trackingNumber: z.string().trim().min(1, "El número de guía no es válido."),
  trackingCode: publicCode,
  recipientName: z.string().nullable(),
  neighborhood: z.string().nullable(),
  status: shipmentStatus,
  notifiedAt: z.iso.datetime().nullable(),
});

export const notificationMerchantSchema = z.strictObject({
  merchantId: z.uuid("El identificador del cliente no es válido."),
  name: z.string().trim().min(1, "El nombre del cliente no es válido."),
  whatsappPhone: phone.nullable(),
  linkCode: publicCode,
  isActive: z.boolean(),
  shipments: z.array(notificationShipmentSchema),
});

/** Strict response contract for `GET /api/notifications` (FR-015, R8). */
export const notificationListSchema = z.strictObject({
  merchants: z.array(notificationMerchantSchema),
});

const shipmentIds = z
  .array(z.uuid("El identificador del envío no es válido."))
  .min(1, "Elige al menos un envío.")
  .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, {
    message: "No repitas el mismo envío.",
  });

/** `POST /api/notifications`: one nonempty, distinct, actor-bound notification intent (R15). */
export const notificationMarkInput = z.strictObject({
  actionId: z.uuid("Falta el identificador de la acción."),
  shipmentIds,
});

export type NotificationListQuery = z.infer<typeof notificationListQuery>;
export type NotificationShipment = z.infer<typeof notificationShipmentSchema>;
export type NotificationMerchant = z.infer<typeof notificationMerchantSchema>;
export type NotificationList = z.infer<typeof notificationListSchema>;
export type NotificationMarkInput = z.infer<typeof notificationMarkInput>;
