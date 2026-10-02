import { bogotaLocalTime, shipmentFlag, type BoardShipment } from "@domy/domain";

/** Delivery windows run from 8:00 to 20:00 (validation of the window presets). */
export const dayStart = 8;
export const dayEnd = 20;

/** What a window's color says, worst first: late or with a delivery exception, at risk, … */
export type RibbonTone = "late" | "risk" | "route" | "open" | "done";

export type RibbonBar = {
  shipment: BoardShipment;
  /** Local hours in Bogotá, as decimals (10.5 = 10:30). */
  from: number;
  to: number;
  tone: RibbonTone;
  lane: number;
};

/** Local hour of an instant in Bogotá, as a decimal. */
export function bogotaHours(instant: string): number {
  const [hours = "0", minutes = "0"] = bogotaLocalTime(new Date(instant)).split(":");
  return Number(hours) + Number(minutes) / 60;
}

/** The tone of a shipment on the ribbon, or null for shipments that left the day's work. */
export function ribbonTone(shipment: BoardShipment, now: Date): RibbonTone | null {
  if (shipment.status === "voided" || shipment.status === "returned") return null;
  if (shipment.status === "delivered") return "done";
  if (shipment.status === "exception") return "late";
  const windowEnd = shipment.windowEnd ? new Date(shipment.windowEnd) : null;
  const flag = shipmentFlag({ status: shipment.status, windowEnd }, now)?.kind;
  if (flag === "late") return "late";
  if (flag === "at_risk") return "risk";
  if (shipment.status === "dispatched" || shipment.status === "picked_up") return "route";
  return "open";
}

const clamp = (hours: number) => Math.min(dayEnd, Math.max(dayStart, hours));

/**
 * One bar per window, stacked in as few lanes as possible: a bar goes to the first lane whose
 * last bar ended before it starts. Shipments without a window are returned apart.
 */
export function layoutRibbon(
  shipments: BoardShipment[],
  now: Date,
): { bars: RibbonBar[]; lanes: number; unscheduled: BoardShipment[] } {
  const bars: Omit<RibbonBar, "lane">[] = [];
  const unscheduled: BoardShipment[] = [];
  for (const shipment of shipments) {
    const tone = ribbonTone(shipment, now);
    if (!tone) continue;
    if (!shipment.windowStart && !shipment.windowEnd) {
      unscheduled.push(shipment);
      continue;
    }
    const from = clamp(shipment.windowStart ? bogotaHours(shipment.windowStart) : dayStart);
    const to = clamp(shipment.windowEnd ? bogotaHours(shipment.windowEnd) : dayEnd);
    bars.push({ shipment, from, to: Math.max(to, from + 0.25), tone });
  }
  bars.sort((a, b) => a.from - b.from || a.to - b.to);
  const laneEnds: number[] = [];
  const placed = bars.map((bar) => {
    let lane = laneEnds.findIndex((end) => end <= bar.from);
    if (lane < 0) lane = laneEnds.push(bar.to) - 1;
    else laneEnds[lane] = bar.to;
    return { ...bar, lane };
  });
  return { bars: placed, lanes: laneEnds.length, unscheduled };
}
