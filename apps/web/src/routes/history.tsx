import { shipmentSearchQuery } from "@domy/domain";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import SearchOffIcon from "@material-symbols/svg-400/rounded/search_off.svg?react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { exportUrl, searchShipments, type HistoryFilters } from "@/features/history/api";
import { ResultsTable } from "@/features/history/results-table";
import { SearchFilters } from "@/features/history/search-filters";

const panelRoute = getRouteApi("/_panel");

export const Route = createFileRoute("/_panel/historial")({
  validateSearch: shipmentSearchQuery.omit({ cursor: true }),
  head: () => ({ meta: [{ title: "Historial · Domy" }] }),
  component: HistoryPage,
});

/** Every shipment ever registered, searchable and exportable (User Story 5). */
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

  const setFilters = (next: Partial<HistoryFilters>) => {
    void navigate({ search: (previous) => ({ ...previous, ...next }), replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Historial"
        description="Todos los envíos registrados, con búsqueda y filtros."
        actions={
          user.role === "owner" && (
            <div className="flex flex-wrap items-center gap-2">
              <a
                className={buttonVariants({ variant: "outline" })}
                href={exportUrl(filters, "csv")}
                download
              >
                Exportar CSV
              </a>
              <a
                className={buttonVariants({ variant: "outline" })}
                href={exportUrl(filters, "xlsx")}
                download
              >
                Exportar Excel
              </a>
              <a
                className={buttonVariants({ variant: "outline" })}
                href="/api/export/courier-records?format=csv"
                download
              >
                Exportar registros
              </a>
              <a
                className={buttonVariants({ variant: "outline" })}
                href="/api/export/routes?format=csv"
                download
              >
                Exportar rutas
              </a>
              <a
                className={buttonVariants({ variant: "outline" })}
                href="/api/export/handovers?format=csv"
                download
              >
                Exportar traspasos
              </a>
            </div>
          )
        }
      />

      <SearchFilters filters={filters} onChange={setFilters} />

      {results.isPending ? (
        <div className="flex flex-col gap-2" aria-label="Buscando envíos">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : results.isError ? (
        <p role="alert" className="text-body-l text-error">
          {results.error.message}
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={SearchOffIcon}
          title="No hay envíos que coincidan con la búsqueda"
          description="Prueba con menos filtros o con otra parte del nombre, la guía o el teléfono."
        />
      ) : (
        <>
          <ResultsTable items={items} />
          {results.hasNextPage && (
            <Button
              variant="outline"
              className="self-start"
              disabled={results.isFetchingNextPage}
              onClick={() => void results.fetchNextPage()}
            >
              {results.isFetchingNextPage ? "Cargando…" : "Ver más envíos"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
