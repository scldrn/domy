import {
  boardQuery,
  bogotaToday,
  filterBoard,
  type BoardQuery,
  type BoardEntry,
  type BoardShipment,
  type DispatchBoard,
} from "@domy/domain";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import InboxIcon from "@material-symbols/svg-400/rounded/inbox.svg?react";
import FilterOffIcon from "@material-symbols/svg-400/rounded/filter_alt_off.svg?react";
import { EmptyState } from "@/components/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BoardFilters } from "@/features/board/board-filters";
import { BoardSection } from "@/features/board/board-section";
import { rowId } from "@/features/board/board-table";
import { DayRibbon } from "@/features/board/day-ribbon";
import { daySentence } from "@/features/board/day-sentence";
import { DayStepper } from "@/features/board/day-stepper";
import { api, unwrap } from "@/lib/api-client";
import { now, syncClock } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatDate, formatLongDate } from "@/lib/format";

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
  const [pointed, setPointed] = useState<string | null>(null);

  const setFilters = (next: Partial<BoardQuery>) => {
    void navigate({ search: (previous) => ({ ...previous, ...next }), replace: true });
  };

  const data = board.data;
  const currentTime = now();
  const today = bogotaToday(currentTime);
  const all: BoardEntry[] = data ? [...data.shipments, ...data.pendingFromPreviousDays] : [];
  const view = data ? filterBoard(data.date, all, search, currentTime) : null;
  const date = data?.date ?? search.date ?? today;
  const isToday = date === today;
  const filtered = Boolean(search.merchantId ?? search.rateZoneId ?? search.flag ?? search.status);

  /** From the ribbon to the row: scroll it into view and put the focus on its tracking number. */
  const pick = (shipment: BoardShipment) => {
    const row = document.getElementById(rowId(shipment));
    if (!row) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    row.querySelector("a")?.focus({ preventScroll: true });
    setPointed(shipment.id);
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <h1 className="text-headline-l text-on-surface">
            <span className="sr-only">Tablero de despacho, </span>
            {formatLongDate(date, today)}
          </h1>
          <DayStepper
            date={date}
            today={today}
            onChange={(next) => {
              setFilters({ date: next === today ? undefined : next });
            }}
          />
        </div>
        {data ? (
          <p className="max-w-[68ch] text-lede text-on-surface-variant" aria-live="polite">
            {daySentence({
              isToday,
              shipments: data.shipments,
              pending: isToday ? data.pendingFromPreviousDays : [],
              now: currentTime,
            }).map((segment, index) =>
              segment.strong ? (
                <strong
                  key={index}
                  className={cn(
                    "font-semibold whitespace-nowrap tabular-nums",
                    segment.tone === "error" ? "text-error" : "text-on-surface",
                  )}
                >
                  {segment.text}
                </strong>
              ) : (
                segment.text
              ),
            )}
          </p>
        ) : (
          <Skeleton className="h-7 w-full max-w-2xl" />
        )}
      </header>

      {board.isPending ? (
        <div className="flex flex-col gap-3" aria-label="Cargando el tablero">
          <Skeleton className="h-56 w-full rounded-md" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : board.isError && !data ? (
        <p
          role="alert"
          className="rounded-sm bg-error-container p-4 text-body-l text-on-error-container"
        >
          {board.error.message}
        </p>
      ) : view && data ? (
        <>
          <DayRibbon
            shipments={view.shipments}
            pending={view.pendingFromPreviousDays}
            now={currentTime}
            isToday={isToday}
            isPast={date < today}
            pointed={pointed}
            onPoint={setPointed}
            onPick={pick}
          />

          <div className="flex flex-col gap-6">
            <BoardFilters
              filters={search}
              merchants={distinctById(all.map((shipment) => shipment.merchant))}
              couriers={distinctById(all.map((shipment) => shipment.courier))}
              rateZones={distinctById(all.map((shipment) => shipment.rateZone))}
              counts={view.counts}
              onChange={setFilters}
            />

            {isToday && view.pendingFromPreviousDays.length > 0 && (
              <BoardSection
                title="Pendientes de días anteriores"
                hint="Siguen abiertos desde otros días; resuélvelos antes que los de hoy."
                shipments={view.pendingFromPreviousDays}
                now={currentTime}
                today={today}
                pointed={pointed}
                onPoint={setPointed}
              />
            )}
            {view.shipments.length > 0 ? (
              <BoardSection
                title={isToday ? "Para hoy" : `Para el ${formatDate(date)}`}
                hint="Ordenados por la hora en que cierra su franja; los que no tienen franja van al final."
                shipments={[...view.shipments].sort(byWindowEnd)}
                now={currentTime}
                pointed={pointed}
                onPoint={setPointed}
              />
            ) : (
              <EmptyState
                icon={filtered ? FilterOffIcon : InboxIcon}
                {...(filtered
                  ? {
                      title: "Ningún envío de este día coincide con los filtros",
                      action: (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setFilters({
                              merchantId: undefined,
                              rateZoneId: undefined,
                              flag: undefined,
                              status: undefined,
                            });
                          }}
                        >
                          Quitar filtros
                        </Button>
                      ),
                    }
                  : {
                      title: isToday
                        ? "Todavía no hay envíos para hoy"
                        : "No hay envíos registrados para este día",
                      description: "Los envíos que registres para esta fecha aparecerán aquí.",
                      action: (
                        <Link to="/envios/nuevo" className={buttonVariants()}>
                          Registrar un envío
                        </Link>
                      ),
                    })}
              />
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Windows that close first come first; shipments without a window go last. */
function byWindowEnd(a: BoardShipment, b: BoardShipment): number {
  const end = (shipment: BoardShipment) =>
    shipment.windowEnd ? Date.parse(shipment.windowEnd) : Number.POSITIVE_INFINITY;
  return end(a) - end(b);
}
