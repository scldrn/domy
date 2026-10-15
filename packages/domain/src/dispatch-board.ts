import type { BoardEntry, BoardQuery, DispatchBoard } from "./schemas/board.ts";
import { shipmentFlag } from "./shipment-flags.ts";
import { shipmentStatuses, type ShipmentStatus } from "./shipment-lifecycle.ts";

/** US3 FR-033, research R11: decided returns no longer need a dispatch decision. */
export function exceptionsToDecide<Entry extends Pick<BoardEntry, "status" | "returnDecided">>(
  shipments: Entry[],
): Entry[] {
  return shipments.filter((shipment) => shipment.status === "exception" && !shipment.returnDecided);
}

/**
 * The board of a date from its shipments (the date's own and the pending ones of earlier
 * days), filtered as the dispatcher asked (FR-021–FR-023). Server and web share it, so the
 * web can recompute flags every 30 seconds without another request. Counts ignore the status
 * filter so every status keeps its number.
 */
export function filterBoard<Entry extends BoardEntry>(
  date: string,
  shipments: Entry[],
  filters: Omit<BoardQuery, "date">,
  now: Date,
): Pick<DispatchBoard, "counts" | "exceptionsToDecide"> & {
  shipments: Entry[];
  pendingFromPreviousDays: Entry[];
} {
  const counts = Object.fromEntries(shipmentStatuses.map((status) => [status, 0])) as Record<
    ShipmentStatus,
    number
  >;
  const listed: Entry[] = [];
  const matching: Entry[] = [];
  for (const shipment of shipments) {
    if (filters.merchantId && shipment.merchant.id !== filters.merchantId) continue;
    if (filters.courierId && shipment.courier?.id !== filters.courierId) continue;
    if (filters.rateZoneId && shipment.rateZone?.id !== filters.rateZoneId) continue;
    if (filters.flag === "fee_review" && !shipment.feeNeedsReview) continue;
    if (filters.flag === "at_risk" || filters.flag === "late") {
      const windowEnd = shipment.windowEnd ? new Date(shipment.windowEnd) : null;
      if (shipmentFlag({ status: shipment.status, windowEnd }, now)?.kind !== filters.flag) {
        continue;
      }
    }
    counts[shipment.status]++;
    matching.push(shipment);
    if (!filters.status || shipment.status === filters.status) listed.push(shipment);
  }
  return {
    counts,
    exceptionsToDecide: exceptionsToDecide(matching).length,
    shipments: listed.filter((shipment) => shipment.serviceDate === date),
    pendingFromPreviousDays: listed.filter((shipment) => shipment.serviceDate < date),
  };
}
