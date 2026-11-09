import { z } from "zod";
import type { BoardShipment } from "./board.ts";
import { shipmentStatus } from "./enums.ts";
import { calendarDate } from "./shipment.ts";

/**
 * History search (FR-024): `q` matches the tracking number, the merchant reference, the
 * merchant's name or alias, the recipient's name, or the recipient's phone.
 */
export const shipmentSearchQuery = z.object({
  q: z.string().trim().optional(),
  from: calendarDate.optional(),
  to: calendarDate.optional(),
  status: shipmentStatus.optional(),
  merchantId: z.uuid().optional(),
  neighborhoodId: z.uuid().optional(),
  feeReview: z.enum(["true"]).optional(),
  cursor: z.string().optional(),
});
export type ShipmentSearchQuery = z.infer<typeof shipmentSearchQuery>;

/** Export of the same search (FR-025), owner only. */
export const shipmentExportQuery = shipmentSearchQuery
  .omit({ cursor: true })
  .extend({ format: z.enum(["csv", "xlsx"]) });

export type ShipmentSummary = BoardShipment & {
  recipientPhone: string | null;
  merchantReference: string | null;
  fee: number;
  registeredAt: string;
};

/**
 * How many shipments the whole search finds, and how many of them have their fee to review;
 * on the first page only, `null` on the next ones (feature 006, approved «Historial»).
 */
export type ShipmentSearchCounts = { total: number; feeReview: number };

export type ShipmentSearchResult = {
  items: ShipmentSummary[];
  nextCursor: string | null;
  counts: ShipmentSearchCounts | null;
};
