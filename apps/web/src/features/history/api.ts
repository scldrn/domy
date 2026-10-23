import type { ShipmentSearchQuery, ShipmentSearchResult } from "@domy/domain";
import { api, unwrap } from "@/lib/api-client";

/** Search filters as they appear in the address; the page cursor is not part of them. */
export type HistoryFilters = Omit<ShipmentSearchQuery, "cursor">;

export async function searchShipments(
  filters: HistoryFilters,
  cursor: string | null,
): Promise<ShipmentSearchResult> {
  return unwrap(
    api.api.shipments.search.$get({ query: { ...filters, ...(cursor && { cursor }) } }),
  );
}

/** The export of the same search, downloaded by the browser (FR-025). */
export function exportUrl(filters: HistoryFilters, format: "csv" | "xlsx"): string {
  const params = new URLSearchParams({ format });
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return `/api/shipments/export?${params.toString()}`;
}
