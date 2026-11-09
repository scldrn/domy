import type { DispatchBoard } from "@domy/domain";
import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api-client";
import { syncClock } from "@/lib/clock";

async function getBoard(date: string | undefined): Promise<DispatchBoard> {
  const board = await unwrap(api.api.shipments.board.$get({ query: date ? { date } : {} }));
  syncClock(board.serverTime);
  return board;
}

/**
 * The dispatch board of a date, or of today: shared by the board and the top bar's search
 * results, so both read the same cached day (feature 006, T019).
 */
export function boardQueryOptions(date?: string) {
  return queryOptions({
    queryKey: ["board", date ?? "today"],
    queryFn: () => getBoard(date),
  });
}
