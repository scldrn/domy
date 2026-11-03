import { z } from "zod";
import type { RecordFlagKind } from "../shipment-flags.ts";
import type { ShipmentStatus } from "../shipment-lifecycle.ts";
import { shipmentKind, shipmentStatus } from "./enums.ts";
import { calendarDate } from "./shipment.ts";

/** Board filters (FR-023); `fee_review` marks shipments whose fee the owner must confirm. */
export const boardFlag = z.enum(["at_risk", "late", "fee_review"]);
export type BoardFlag = z.infer<typeof boardFlag>;

export const boardQuery = z.object({
  date: calendarDate.optional(),
  status: shipmentStatus.optional(),
  merchantId: z.uuid().optional(),
  courierId: z.uuid().optional(),
  rateZoneId: z.uuid().optional(),
  flag: boardFlag.optional(),
});
export type BoardQuery = z.infer<typeof boardQuery>;

export type BoardShipment = {
  id: string;
  trackingNumber: string;
  kind: z.infer<typeof shipmentKind>;
  status: ShipmentStatus;
  serviceDate: string;
  merchant: { id: string; name: string };
  recipientName: string | null;
  recipientNeighborhood: { id: string; name: string } | null;
  rateZone: { id: string; name: string } | null;
  windowStart: string | null;
  windowEnd: string | null;
  codAmount: number;
  feeNeedsReview: boolean;
  /** The route carrying the shipment (feature 002, FR-018). */
  routeId: string | null;
  routeNumber: number | null;
  /** Who is responsible for it: the courier holding the package, else the route's courier. */
  courier: { id: string; name: string } | null;
};

/**
 * A shipment on the board, with the flags of its courier records (feature 003, FR-033) and
 * the handover still waiting for the receiving courier, if any (feature 006, FR-018).
 */
export type BoardEntry = BoardShipment & {
  recordFlags: RecordFlagKind[];
  returnDecided: boolean;
  pendingHandover: {
    id: string;
    fromCourier: { id: string; name: string };
    toCourier: { id: string; name: string };
    requestedAt: string;
  } | null;
};

/** The dispatch board of a date (FR-021); `serverTime` corrects the client's clock (R9). */
export type DispatchBoard = {
  date: string;
  serverTime: string;
  counts: Record<ShipmentStatus, number>;
  exceptionsToDecide: number;
  shipments: BoardEntry[];
  pendingFromPreviousDays: BoardEntry[];
};
