import { normalizeText, type BoardEntry, type DispatchBoard } from "@domy/domain";

/**
 * The day's shipments that match what is typed in the top bar (feature 006, T019, approved
 * with the board): tracking number with or without its dash, merchant, recipient, and
 * neighborhood, without accents or case. Phones and references stay in «Historial», where
 * Enter takes the search.
 */
export function searchBoard(board: DispatchBoard, term: string, limit = 6): BoardEntry[] {
  const needle = normalizeText(term).replace(/\s+/g, " ").trim();
  if (needle.length < 2) return [];
  const compact = needle.replace(/[\s-]/g, "");
  return [...board.shipments, ...board.pendingFromPreviousDays]
    .filter((shipment) => {
      const guide = normalizeText(shipment.trackingNumber).replace(/\s/g, "");
      const text = normalizeText(
        [
          shipment.trackingNumber,
          shipment.merchant.name,
          shipment.recipientName ?? "",
          shipment.recipientNeighborhood?.name ?? "",
        ].join(" "),
      );
      return text.includes(needle) || (compact.length >= 2 && guide.includes(compact));
    })
    .slice(0, limit);
}
