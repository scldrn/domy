import { publicOriginSchema } from "./schemas/public-origin.ts";
import type { NotificationMerchant, NotificationShipment } from "./schemas/notifications.ts";
import { formatTrackingNumber } from "./tracking-numbers.ts";

type MessageMerchant = Pick<NotificationMerchant, "name" | "linkCode">;
type MessageShipment = Pick<
  NotificationShipment,
  "trackingNumber" | "trackingCode" | "recipientName" | "neighborhood" | "status" | "notifiedAt"
>;

/** One shared rule for notification counts, selections, and composed messages (FR-016, R8). */
export function eligibleNotificationShipments<
  T extends Pick<NotificationShipment, "status" | "notifiedAt">,
>(shipments: readonly T[], includeNotified = false): T[] {
  return shipments.filter(
    (shipment) => shipment.status !== "voided" && (includeNotified || shipment.notifiedAt === null),
  );
}

function messageValue(value: string | null, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function trackingUrl(origin: string, code: string): string {
  return new URL(`/seguimiento/${encodeURIComponent(code)}`, origin).toString();
}

function merchantUrl(origin: string, code: string): string {
  return new URL(`/cliente/${encodeURIComponent(code)}`, origin).toString();
}

/** Build the deterministic Spanish WhatsApp message for the notification list (FR-016, R8). */
export function composeMerchantMessage(
  merchant: MessageMerchant,
  shipments: readonly MessageShipment[],
  baseUrl: string,
  includeNotified = false,
): string {
  const origin = publicOriginSchema.parse(baseUrl);
  const privateLink = merchantUrl(origin, merchant.linkCode);
  const greeting = `Hola ${merchant.name.trim()}, estos son los enlaces de seguimiento de tus envíos:`;
  const eligible = eligibleNotificationShipments(shipments, includeNotified);

  if (eligible.length > 20) {
    return `${greeting}\n\nTienes ${String(eligible.length)} envíos.\n\nEnlace privado de tu negocio:\n${privateLink}`;
  }

  const entries = eligible.map((shipment) => {
    const recipient = messageValue(shipment.recipientName, "Destinatario no especificado");
    const neighborhood = messageValue(shipment.neighborhood, "Barrio no especificado");
    const trackingNumber = formatTrackingNumber(shipment.trackingNumber);
    const link = trackingUrl(origin, shipment.trackingCode);
    return `${recipient} — ${neighborhood} — ${trackingNumber}\n${link}`;
  });

  const shipmentEntries = entries.length === 0 ? "" : `\n\n${entries.join("\n\n")}`;
  return `${greeting}${shipmentEntries}\n\nEnlace privado de tu negocio:\n${privateLink}`;
}
