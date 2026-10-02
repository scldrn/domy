import { neighborhoodKindLabels } from "@domy/domain";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { listNeighborhoods, updateNeighborhood } from "@/features/master-data/api";
import { ExportButton } from "@/features/master-data/export-button";
import {
  AddNeighborhoodDialog,
  EditNeighborhoodDialog,
} from "@/features/master-data/neighborhoods/neighborhood-dialogs";
import { ApiError } from "@/lib/api-client";
import { PageHeader } from "@/components/page-header";
import { SearchField } from "@/components/search-field";

const panelRoute = getRouteApi("/_panel");

export const Route = createFileRoute("/_panel/barrios")({
  head: () => ({ meta: [{ title: "Barrios · Domy" }] }),
  component: NeighborhoodsPage,
});

/** The neighborhood catalog and the owner's review of additions (FR-026, FR-036). */
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Barrios"
        actions={
          <>
            <div className="flex gap-2">
              <ExportButton dataset="neighborhoods" />
              <AddNeighborhoodDialog />
            </div>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-4">
        <SearchField
          aria-label="Buscar barrios"
          placeholder="Nombre o variante"
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Barrio</TableHead>
            <TableHead>Municipio</TableHead>
            <TableHead>Zona</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(places.data ?? []).map((place) => (
            <TableRow key={place.id}>
              <TableCell>{place.name}</TableCell>
              <TableCell>{place.municipality.name}</TableCell>
              <TableCell>{place.rateZone.name}</TableCell>
              <TableCell>{neighborhoodKindLabels[place.kind]}</TableCell>
              <TableCell className="flex gap-1">
                {place.needsReview && <Badge variant="warning">Por revisar</Badge>}
                {!place.isActive && <Badge variant="outline">Inactivo</Badge>}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
