import { neighborhoodKindLabels } from "@domy/domain";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ActiveMark } from "@/components/active-mark";
import { DataList, type DataColumn } from "@/components/data-list";
import { DirectoryEmptyState, QueryErrorAlert, TableSkeleton } from "@/components/query-state";
import { SearchField } from "@/components/search-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  getNeighborhoodSummary,
  listNeighborhoods,
  updateNeighborhood,
} from "@/features/master-data/api";
import { ExportButton } from "@/features/master-data/export-button";
import { ListSheet, MasterHeader } from "@/features/master-data/master-page";
import {
  AddNeighborhoodDialog,
  EditNeighborhoodDialog,
} from "@/features/master-data/neighborhoods/neighborhood-dialogs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ApiError } from "@/lib/api-client";

type Place = Awaited<ReturnType<typeof listNeighborhoods>>[number];

const panelRoute = getRouteApi("/_panel");

export const Route = createFileRoute("/_panel/barrios")({
  head: () => ({ meta: [{ title: "Barrios · Domy" }] }),
  component: NeighborhoodsPage,
});

/** The neighborhood catalog and the owner's review of additions (FR-026, FR-036), as approved
 * in feature 006 (US5): a sentence with the catalog's counts, search with «Por revisar» and
 * «Mostrar inactivos», and a data list whose rows to review read first. */
function NeighborhoodsPage() {
  const queryClient = useQueryClient();
  const { user } = panelRoute.useRouteContext();
  const owner = user.role === "owner";
  const [q, setQ] = useState("");
  const [review, setReview] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const query = useDebouncedValue(q);
  const places = useQuery({
    queryKey: ["master", "neighborhoods", query, review, showInactive],
    queryFn: () =>
      listNeighborhoods({
        q: query,
        active: showInactive ? "all" : "true",
        ...(review && { needsReview: "true" as const }),
      }),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: ["master", "neighborhoods", "summary"],
    queryFn: getNeighborhoodSummary,
  });

  async function change(
    id: string,
    input: { needsReview?: false; isActive?: boolean },
    message: string,
  ) {
    try {
      await updateNeighborhood(id, { actionId: crypto.randomUUID(), ...input });
      await queryClient.invalidateQueries({ queryKey: ["master", "neighborhoods"] });
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No pudimos guardar el cambio.");
    }
  }

  const rows = [...(places.data ?? [])].sort(
    (a, b) => Number(b.needsReview) - Number(a.needsReview),
  );
  const columns: DataColumn<Place>[] = [
    {
      key: "name",
      header: "Barrio",
      card: { order: 1, place: "start" },
      cell: (place) => <span className="font-semibold text-on-surface">{place.name}</span>,
    },
    {
      key: "town",
      header: "Municipio",
      card: { order: 2, place: "end" },
      cell: (place) => place.municipality.name,
    },
    {
      key: "zone",
      header: "Zona de tarifa",
      card: { order: 3, place: "start" },
      cell: (place) => place.rateZone.name,
    },
    {
      key: "kind",
      header: "Tipo",
      card: { order: 4, place: "end" },
      cell: (place) => (
        <span className="text-on-surface-variant">{neighborhoodKindLabels[place.kind]}</span>
      ),
    },
    {
      key: "state",
      header: "Estado",
      card: { order: 5, place: "full" },
      cell: (place) =>
        place.needsReview ? (
          <Badge variant="warning">Por revisar</Badge>
        ) : (
          <ActiveMark active={place.isActive} />
        ),
    },
    {
      key: "actions",
      header: "Acciones",
      card: { order: 6, place: "full" },
      cell: (place) => (
        <div className="flex flex-wrap gap-1">
          <EditNeighborhoodDialog place={place} />
          {owner && place.needsReview && (
            <Button
              variant="ghost"
              onClick={() =>
                void change(place.id, { needsReview: false }, `${place.name} confirmado`)
              }
            >
              Confirmar
            </Button>
          )}
          {owner && (
            <Button
              variant="ghost"
              onClick={() =>
                void change(
                  place.id,
                  { isActive: !place.isActive },
                  place.isActive ? `${place.name} desactivado` : `${place.name} reactivado`,
                )
              }
            >
              {place.isActive ? "Desactivar" : "Reactivar"}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <MasterHeader
        title="Barrios"
        sentence={
          summary.data
            ? [
                {
                  text: `${String(summary.data.active)} barrios`,
                  strong: true,
                },
                {
                  text: ` en ${String(summary.data.municipalities)} municipios, cada uno con su zona de tarifa`,
                },
                ...(summary.data.toReview > 0
                  ? [
                      { text: "; " },
                      {
                        text: `${String(summary.data.toReview)} por revisar`,
                        strong: true,
                      },
                      { text: "." },
                    ]
                  : [{ text: "." }]),
              ]
            : null
        }
        actions={
          <>
            <ExportButton dataset="neighborhoods" />
            <AddNeighborhoodDialog />
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          aria-label="Buscar barrios"
          placeholder="Nombre o variante"
          className="max-w-md flex-[1_1_18rem]"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
          }}
        />
        <Toggle pressed={review} onPressedChange={setReview}>
          Por revisar
        </Toggle>
        {owner && (
          <Toggle pressed={showInactive} onPressedChange={setShowInactive}>
            Mostrar inactivos
          </Toggle>
        )}
      </div>
      {places.isPending ? (
        <TableSkeleton columns={6} rows={6} label="Cargando barrios…" />
      ) : places.isError ? (
        <QueryErrorAlert
          title="No pudimos cargar los barrios"
          message="Revisa tu conexión e inténtalo de nuevo."
          onRetry={() => void places.refetch()}
        />
      ) : rows.length === 0 ? (
        <DirectoryEmptyState
          title={q ? "Nada coincide con la búsqueda" : "Todavía no hay barrios"}
          description={
            q
              ? "Prueba con otro término."
              : !showInactive
                ? "Si buscas un barrio inactivo, activa «Mostrar inactivos»."
                : "Agrega el primer barrio para comenzar."
          }
        />
      ) : (
        <ListSheet
          id="barrios-lista"
          title="Barrios"
          count={rows.length}
          note={
            summary.data && rows.length < summary.data.active && !review
              ? "Los primeros 20; busca para encontrar otro"
              : "Los por revisar, primero"
          }
        >
          <DataList
            label="Barrios"
            columns={columns}
            template="minmax(12rem,1.2fr) 10rem minmax(11rem,1fr) 8rem 9rem minmax(14rem,auto)"
            rows={rows}
            rowKey={(place) => place.id}
            pageSize={Number.POSITIVE_INFINITY}
            moreLabel={(total) => `Ver los ${String(total)} barrios`}
          />
        </ListSheet>
      )}
    </div>
  );
}
