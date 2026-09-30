import type { ShipmentStatus } from "./shipment-lifecycle.ts";

/** "En riesgo" with minutes remaining, or "Atrasado" with minutes overdue (FR-022). */
export type ShipmentFlag = { kind: "at_risk" | "late"; minutes: number };
export type ShipmentFlagKind = ShipmentFlag["kind"];

const flaggable: ReadonlySet<ShipmentStatus> = new Set([
  "registered",
  "assigned",
  "dispatched",
  "picked_up",
  "exception",
]);
const atRiskMinutes = 45;
const minuteMs = 60 * 1000;
const dayMinutes = 24 * 60;

export function shipmentFlag(
  shipment: { status: ShipmentStatus; windowEnd: Date | null },
  now: Date,
): ShipmentFlag | null {
  if (!shipment.windowEnd || !flaggable.has(shipment.status)) return null;
  const overdueMs = now.getTime() - shipment.windowEnd.getTime();
  if (overdueMs >= 0) return { kind: "late", minutes: Math.floor(overdueMs / minuteMs) };
  const minutes = Math.ceil(-overdueMs / minuteMs);
  return minutes <= atRiskMinutes ? { kind: "at_risk", minutes } : null;
}

export const shipmentFlagLabels: Record<ShipmentFlagKind, string> = {
  at_risk: "En riesgo",
  late: "Atrasado",
};

function duration(minutes: number): string {
  if (minutes > dayMinutes) {
    const days = Math.floor(minutes / dayMinutes);
    return days === 1 ? "1 día" : `${String(days)} días`;
  }
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = `${String(Math.floor(minutes / 60))} h`;
  return minutes % 60 === 0 ? hours : `${hours} ${String(minutes % 60)} min`;
}

export function flagLabel(flag: ShipmentFlag): string {
  const time = duration(flag.minutes);
  return `${shipmentFlagLabels[flag.kind]} · ${flag.kind === "at_risk" ? `quedan ${time}` : time}`;
}
