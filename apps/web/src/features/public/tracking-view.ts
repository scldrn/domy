import type { ShipmentKind } from "@domy/domain";
import { formatLongDate, formatTime } from "@/lib/format";

const nextDay = (date: string) => {
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + 1);
  return instant.toISOString().slice(0, 10);
};

/**
 * The day a shipment on its way is expected, first in «Seguimiento» (approved in feature 006,
 * US4 scenario 1): «Llega hoy, jueves 1 de octubre».
 */
export function arrivalDay(kind: ShipmentKind, serviceDate: string, today: string): string {
  const long = formatLongDate(serviceDate, today);
  const day = long.charAt(0).toLowerCase() + long.slice(1);
  const when =
    serviceDate === today
      ? `hoy, ${day}`
      : serviceDate === nextDay(today)
        ? `mañana, ${day}`
        : `el ${day}`;
  return kind === "delivery" ? `Llega ${when}` : `Programado para ${when}`;
}

/** The delivery window as a sentence: «Entre 2:00 p. m. y 5:00 p. m.». */
export function arrivalWindow(window: { start: string | null; end: string | null }): string {
  if (window.start && window.end)
    return `Entre ${formatTime(window.start)} y ${formatTime(window.end)}`;
  if (window.end) return `Antes de las ${formatTime(window.end)}`;
  return `Después de las ${formatTime(window.start ?? "")}`;
}

/** «Eres la siguiente entrega», «1 entrega antes de la tuya», «2 entregas antes de la tuya». */
export function queueText(before: number): string {
  if (before === 0) return "Eres la siguiente entrega";
  return `${String(before)} ${before === 1 ? "entrega" : "entregas"} antes de la tuya`;
}
