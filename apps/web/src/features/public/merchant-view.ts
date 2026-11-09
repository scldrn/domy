import type { MerchantDay, ShipmentStatus } from "@domy/domain";
import { formatLongDate } from "@/lib/format";

export type SentencePart = { text: string; strong?: boolean };

/** The order states are told in, the finished first (approved «Enlace del cliente»). */
export const merchantStatusOrder: ShipmentStatus[] = [
  "delivered",
  "picked_up",
  "dispatched",
  "exception",
  "assigned",
  "registered",
  "returned",
  "voided",
];

const phrases: Record<ShipmentStatus, [string, string]> = {
  registered: ["registrado", "registrados"],
  assigned: ["asignado", "asignados"],
  dispatched: ["en ruta", "en ruta"],
  picked_up: ["recogido", "recogidos"],
  delivered: ["entregado", "entregados"],
  exception: ["con novedad", "con novedad"],
  returned: ["devuelto", "devueltos"],
  voided: ["anulado", "anulados"],
};

/**
 * The lede of «Enlace del cliente» (feature 006, US4): how many shipments the day has and how
 * they stand, delivered first and in bold.
 */
export function merchantDaySentence(
  day: Pick<MerchantDay, "date" | "shipments" | "totals">,
  today: string,
): SentencePart[] {
  const long = formatLongDate(day.date, today);
  const date = long.charAt(0).toLowerCase() + long.slice(1);
  const when = day.date === today ? `hoy, ${date}` : `el ${date}`;
  const total = day.shipments.length;
  if (total === 0) return [{ text: `Sin envíos ${when}.` }];
  const parts: SentencePart[] = [
    { text: `${String(total)} ${total === 1 ? "envío" : "envíos"}`, strong: true },
    { text: ` ${when}: ` },
  ];
  const states = merchantStatusOrder.filter((status) => day.totals.byStatus[status] > 0);
  states.forEach((status, index) => {
    if (index > 0) parts.push({ text: index === states.length - 1 ? " y " : ", " });
    const count = day.totals.byStatus[status];
    parts.push({
      text: `${String(count)} ${phrases[status][count === 1 ? 0 : 1]}`,
      ...(status === "delivered" && { strong: true }),
    });
  });
  parts.push({ text: "." });
  return parts;
}
