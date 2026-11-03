import { exceptionsToDecide } from "./dispatch-board.ts";
import type { UserRole } from "./schemas/enums.ts";
import type { BoardEntry } from "./schemas/board.ts";
import { shipmentFlag } from "./shipment-flags.ts";

/** What needs a person now, most urgent first (feature 006, FR-018, research R6). */
export const attentionKinds = [
  "exception_to_decide",
  "late",
  "pending_handover",
  "at_risk",
  "pickup_problem",
] as const;
export type AttentionKind = (typeof attentionKinds)[number];

export type AttentionAction = "decide" | "reassign" | "confirm_handover" | "assign";

export type AttentionItem = {
  kind: AttentionKind;
  shipmentId: string;
  trackingNumber: string;
  action: AttentionAction;
};

/** Flags counted in one line under the list ("Además: …"), not listed one by one. */
export type MinorFlag = "collection_differs" | "needs_review" | "no_photo" | "fee_to_review";

/**
 * The board's "Por resolver" list: each shipment once, under its most urgent reason, ordered
 * by that reason and then by the end of its delivery window (no window last). Fees to review
 * count only for the owner, who is the one to confirm them.
 */
export function buildAttention({
  shipments,
  role,
  now,
}: {
  shipments: BoardEntry[];
  role: UserRole;
  now: Date;
}): { items: AttentionItem[]; minor: Record<MinorFlag, number> } {
  const toDecide = new Set(exceptionsToDecide(shipments).map((shipment) => shipment.id));
  const ranked: { item: AttentionItem; windowEnd: number }[] = [];
  for (const shipment of shipments) {
    const kind = attentionKind(shipment, toDecide.has(shipment.id), now);
    if (!kind) continue;
    ranked.push({
      item: {
        kind,
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        action: attentionAction(kind, shipment.routeId !== null),
      },
      windowEnd: shipment.windowEnd ? new Date(shipment.windowEnd).getTime() : Infinity,
    });
  }
  ranked.sort(
    (a, b) =>
      attentionKinds.indexOf(a.item.kind) - attentionKinds.indexOf(b.item.kind) ||
      a.windowEnd - b.windowEnd ||
      a.item.trackingNumber.localeCompare(b.item.trackingNumber),
  );
  const count = (flag: BoardEntry["recordFlags"][number]) =>
    shipments.filter((shipment) => shipment.recordFlags.includes(flag)).length;
  return {
    items: ranked.map(({ item }) => item),
    minor: {
      collection_differs: count("collection_differs"),
      needs_review: count("needs_review"),
      no_photo: count("no_photo"),
      fee_to_review:
        role === "owner" ? shipments.filter((shipment) => shipment.feeNeedsReview).length : 0,
    },
  };
}

function attentionKind(shipment: BoardEntry, toDecide: boolean, now: Date): AttentionKind | null {
  if (toDecide) return "exception_to_decide";
  const flag = shipmentFlag(
    {
      status: shipment.status,
      windowEnd: shipment.windowEnd ? new Date(shipment.windowEnd) : null,
    },
    now,
  );
  if (flag?.kind === "late") return "late";
  if (shipment.pendingHandover) return "pending_handover";
  if (flag?.kind === "at_risk") return "at_risk";
  if (shipment.recordFlags.includes("pickup_problem")) return "pickup_problem";
  return null;
}

function attentionAction(kind: AttentionKind, onRoute: boolean): AttentionAction {
  if (kind === "exception_to_decide") return "decide";
  if (kind === "pending_handover") return "confirm_handover";
  return onRoute ? "reassign" : "assign";
}
