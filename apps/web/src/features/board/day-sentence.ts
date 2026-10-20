import { addCop, formatCop, shipmentFlag, type BoardShipment } from "@domy/domain";

/** A piece of the board's opening sentence; strong pieces carry the numbers. */
export type Segment = { text: string; strong?: boolean; tone?: "error" };

const closed = new Set(["delivered", "returned", "voided"]);
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * The day in one paragraph, the first thing the dispatcher reads: how many shipments, how
 * many delivered, what is pending from earlier days, what needs attention now (FR-022), and
 * the cash still to collect. Numbers are strong so the eye can scan them.
 */
export function daySentence({
  isToday,
  shipments,
  pending,
  now,
}: {
  isToday: boolean;
  /** The date's own shipments, unfiltered. */
  shipments: BoardShipment[];
  /** Earlier days' open shipments (only today's board has them). */
  pending: BoardShipment[];
  now: Date;
}): Segment[] {
  const live = shipments.filter((shipment) => shipment.status !== "voided");
  const all = [...live, ...pending];
  const delivered = live.filter((shipment) => shipment.status === "delivered").length;
  let late = 0;
  let atRisk = 0;
  for (const shipment of all) {
    const windowEnd = shipment.windowEnd ? new Date(shipment.windowEnd) : null;
    const kind = shipmentFlag({ status: shipment.status, windowEnd }, now)?.kind;
    if (kind === "late") late++;
    if (kind === "at_risk") atRisk++;
  }
  const cod = all
    .filter((shipment) => !closed.has(shipment.status))
    .reduce((sum, shipment) => addCop(sum, shipment.codAmount), 0);

  const segments: Segment[] = [];
  const say = (text: string, strong = false, tone?: "error") => {
    segments.push({ text, ...(strong && { strong }), ...(tone && { tone }) });
  };

  const count = live.length;
  if (count === 0) {
    say(isToday ? "Hoy no hay envíos." : "Este día no tiene envíos.");
  } else {
    say(isToday ? "Hoy hay " : "Este día tiene ");
    say(`${String(count)} ${plural(count, "envío", "envíos")}`, true);
    if (delivered === 0) say(" y todavía no se ha entregado ninguno.");
    else if (delivered === count)
      say(count === 1 ? " y ya se entregó." : " y ya se entregaron todos.");
    else {
      say(" y ");
      say(String(delivered), true);
      say(plural(delivered, " ya se entregó.", " ya se entregaron."));
    }
  }

  if (pending.length > 0) {
    say(" Además hay ");
    say(String(pending.length), true);
    say(` ${plural(pending.length, "pendiente", "pendientes")} de días anteriores.`);
  }

  if (all.length > 0) {
    if (late === 0 && atRisk === 0) say(" Ninguno está atrasado ni en riesgo.");
    if (late > 0) {
      say(" ");
      say(`${String(late)} ${plural(late, "está atrasado", "están atrasados")}`, true, "error");
      say(atRisk > 0 ? " y " : ".");
    }
    if (atRisk > 0) {
      if (late === 0) say(" ");
      say(String(atRisk), true);
      say(` ${plural(atRisk, "está", "están")} en riesgo de llegar tarde.`);
    }
  }

  if (cod > 0) {
    say(" Falta recaudar ");
    say(formatCop(cod), true);
    say(".");
  }
  return segments;
}
