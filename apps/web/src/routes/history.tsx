import { bogotaToday, shipmentSearchQuery } from "@domy/domain";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import SearchOffIcon from "@material-symbols/svg-400/rounded/search_off.svg?react";
import { EmptyState } from "@/components/empty-state";
import { SummarySentence } from "@/components/summary-sentence";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { searchShipments, type HistoryFilters } from "@/features/history/api";
import { ExportMenu } from "@/features/history/export-menu";
import { historySentence, shownLine } from "@/features/history/history-sentence";
import { ResultsTable } from "@/features/history/results-table";
import { isFiltered, noFilters, SearchFilters } from "@/features/history/search-filters";
import { now } from "@/lib/clock";

const panelRoute = getRouteApi("/_panel");

export const Route = createFileRoute("/_panel/historial")({
  validateSearch: shipmentSearchQuery.omit({ cursor: true }),
  head: () => ({ meta: [{ title: "Historial · Domy" }] }),
  component: HistoryPage,
});

/**
 * Every shipment ever registered, searchable and exportable (User Story 5), as approved in
 * feature 006: a sentence with the search's counts, one «Exportar» menu, one search sheet, and
 * the results as a data list with «Ver más envíos».
 */
function HistoryPage() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = panelRoute.useRouteContext();
  const results = useInfiniteQuery({
    queryKey: ["history", filters],
    queryFn: ({ pageParam }) => searchShipments(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const items = results.data?.pages.flatMap((page) => page.items) ?? [];
  const counts = results.data?.pages[0]?.counts ?? null;
  const filtered = isFiltered(filters);

  const setFilters = (next: Partial<HistoryFilters>) => {
    void navigate({ search: (previous) => ({ ...previous, ...next }), replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_26rem] flex-col gap-1.5">
          <h1 className="text-headline-l text-on-surface">Historial</h1>
          {counts ? (
            <SummarySentence
              parts={historySentence({ filters, counts, today: bogotaToday(now()) })}
            />
          ) : (
            results.isPending && <Skeleton className="h-7 w-full max-w-md" />
          )}
        </div>
        {user.role === "owner" && <ExportMenu filters={filters} />}
      </header>

      <SearchFilters filters={filters} onChange={setFilters} />

      <section
        aria-labelledby="historial-envios"
        className="overflow-hidden rounded-lg border border-outline-variant bg-sheet"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 py-3.5 max-[820px]:px-4">
          <h2
            id="historial-envios"
            className="flex items-baseline gap-2 text-title-l text-on-surface"
          >
            Envíos{" "}
            <span className="text-body-l text-on-surface-variant tabular-nums">{items.length}</span>
          </h2>
          <span className="text-body-m text-on-surface-variant">Más reciente primero</span>
        </div>

        {results.isPending ? (
          <div
            className="flex flex-col gap-2 border-t border-outline-variant px-5 py-4"
            role="status"
            aria-label="Buscando envíos"
          >
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : results.isError ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-3 border-t border-outline-variant px-5 py-4"
          >
            <p className="text-body-l text-error">{results.error.message}</p>
            <Button variant="outline" onClick={() => void results.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={SearchOffIcon}
            className="mx-5 mb-4 border-0"
            title="No hay envíos que coincidan con la búsqueda"
            description="Prueba con menos filtros o con otra parte del nombre, la guía o el teléfono."
            {...(filtered && {
              action: (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters(noFilters);
                  }}
                >
                  Quitar los filtros
                </Button>
              ),
            })}
          />
        ) : (
          <>
            <ResultsTable items={items} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant px-5 py-3 max-[820px]:px-4">
              <span className="text-body-m text-on-surface-variant" aria-live="polite">
                {shownLine(items.length, counts?.total ?? items.length)}
              </span>
              {results.hasNextPage && (
                <Button
                  variant="outline"
                  disabled={results.isFetchingNextPage}
                  onClick={() => void results.fetchNextPage()}
                >
                  {results.isFetchingNextPage ? "Cargando…" : "Ver más envíos"}
                </Button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
