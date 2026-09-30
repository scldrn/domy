import {
  boardQuery,
  bogotaToday,
  filterBoard,
  type BoardQuery,
  type BoardShipment,
  type DispatchBoard,
} from "@domy/domain";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BoardFilters } from "@/features/board/board-filters";
import { BoardTable } from "@/features/board/board-table";
import { PendingSection } from "@/features/board/pending-section";
import { StatusCounts } from "@/features/board/status-counts";
import { api, unwrap } from "@/lib/api-client";
import { now, syncClock } from "@/lib/clock";
import { formatDate } from "@/lib/format";

/** Changes by any user appear within 30 seconds (FR-023, research R9). */
const pollMs = 20_000;
const flagRefreshMs = 30_000;

async function getBoard(date: string | undefined): Promise<DispatchBoard> {
  const board = await unwrap<DispatchBoard>(
    api.api.shipments.board.$get({ query: date ? { date } : {} }),
  );
  syncClock(board.serverTime);
  return board;
}

/** Re-renders every `ms` so time-based flags stay current between polls. */
function useTicker(ms: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTick((tick) => tick + 1);
    }, ms);
    return () => {
      clearInterval(id);
    };
  }, [ms]);
}

function distinctById(items: ({ id: string; name: string } | null)[]) {
  const byId = new Map(items.filter((item) => item !== null).map((item) => [item.id, item]));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export const Route = createFileRoute("/_panel/")({
  validateSearch: boardQuery,
  head: () => ({ meta: [{ title: "Tablero · Domy" }] }),
  component: DispatchBoardPage,
});

function DispatchBoardPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const board = useQuery({
    queryKey: ["board", search.date ?? "today"],
    queryFn: () => getBoard(search.date),
    refetchInterval: pollMs,
  });
  useTicker(flagRefreshMs);

  const setFilters = (next: Partial<BoardQuery>) => {
    void navigate({ search: (previous) => ({ ...previous, ...next }), replace: true });
  };

  const data = board.data;
  const currentTime = now();
  const today = bogotaToday(currentTime);
  const all: BoardShipment[] = data ? [...data.shipments, ...data.pendingFromPreviousDays] : [];
  const view = data ? filterBoard(data.date, all, search, currentTime) : null;
  const date = data?.date ?? search.date ?? today;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-s text-on-surface">Tablero de despacho</h1>
          <p className="text-body-m text-on-surface-variant">
            {date === today ? `Hoy, ${formatDate(date)}` : formatDate(date)}
          </p>
        </div>
        <div className="flex gap-2">
          {date !== today && (
            <Button
              variant="outline"
              onClick={() => {
                setFilters({ date: undefined });
              }}
            >
              Ver hoy
            </Button>
          )}
          <Button render={<Link to="/envios/nuevo" />}>Nuevo envío</Button>
        </div>
      </header>

      <BoardFilters
        date={date}
        filters={search}
        merchants={distinctById(all.map((shipment) => shipment.merchant))}
        rateZones={distinctById(all.map((shipment) => shipment.rateZone))}
        onChange={setFilters}
      />

      {board.isPending ? (
        <div className="flex flex-col gap-2" aria-label="Cargando el tablero">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : board.isError && !data ? (
        <p role="alert" className="text-body-l text-error">
          {board.error.message}
        </p>
      ) : view ? (
        <>
          <StatusCounts
            counts={view.counts}
            selected={search.status}
            onSelect={(status) => {
              setFilters({ status });
            }}
          />
          {date === today && (
            <PendingSection
              shipments={view.pendingFromPreviousDays}
              now={currentTime}
              today={today}
            />
          )}
          {view.shipments.length > 0 ? (
            <BoardTable shipments={view.shipments} now={currentTime} />
          ) : (
            <p className="rounded-lg bg-surface-container-low p-6 text-body-l text-on-surface-variant">
              {all.length > 0
                ? "Ningún envío de esta fecha coincide con los filtros."
                : "No hay envíos registrados para esta fecha."}
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
