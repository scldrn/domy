import { exceptionsToDecide } from "./dispatch-board.ts";
import type { BoardEntry } from "./schemas/board.ts";
import { shipmentFlag } from "./shipment-flags.ts";
import { isFinal, type ShipmentStatus } from "./shipment-lifecycle.ts";

/**
 * The stages the board counts and filters by (feature 006, FR-018, design-system.md §8): each
 * shipment status belongs to exactly one, so the stage counts add up to the list.
 */
export const boardStages = ["open", "street", "delivered", "exception", "closed"] as const;
export type BoardStage = (typeof boardStages)[number];

export const boardStageStatuses: Record<BoardStage, readonly ShipmentStatus[]> = {
  open: ["registered", "assigned"],
  street: ["dispatched", "picked_up"],
  delivered: ["delivered"],
  exception: ["exception"],
  closed: ["returned", "voided"],
};

export const boardStageLabels: Record<BoardStage, string> = {
  open: "Por salir",
  street: "En camino",
  delivered: "Entregados",
  exception: "Novedades",
  closed: "Cerrados",
};

export function stageOf(status: ShipmentStatus): BoardStage {
  return boardStages.find((stage) => boardStageStatuses[stage].includes(status)) ?? "closed";
}

/**
 * What the "Con alerta" filter keeps: a window at risk or late, an exception still to decide,
 * a pending handover, a fee to review, or a courier record flag. A photo still within its wait
 * is not an alert yet.
 */
export function hasAlert(shipment: BoardEntry, now: Date): boolean {
  const windowEnd = shipment.windowEnd ? new Date(shipment.windowEnd) : null;
  return (
    shipmentFlag({ status: shipment.status, windowEnd }, now) !== null ||
    exceptionsToDecide([shipment]).length > 0 ||
    shipment.pendingHandover !== null ||
    shipment.feeNeedsReview ||
    shipment.recordFlags.some((flag) => flag !== "photo_pending")
  );
}

/**
 * The board list's order by need (design-system.md §8, "Shipment list"): exceptions to decide,
 * late, at risk, earlier days, other open alerts, open, closed. Ties go by the window's end.
 */
export function boardListRank(shipment: BoardEntry, date: string, now: Date): number {
  if (exceptionsToDecide([shipment]).length > 0) return 0;
  const windowEnd = shipment.windowEnd ? new Date(shipment.windowEnd) : null;
  const flag = shipmentFlag({ status: shipment.status, windowEnd }, now);
  if (flag?.kind === "late") return 1;
  if (flag?.kind === "at_risk") return 2;
  if (shipment.serviceDate < date) return 3;
  if (isFinal(shipment.status)) return 6;
  return hasAlert(shipment, now) ? 4 : 5;
}
