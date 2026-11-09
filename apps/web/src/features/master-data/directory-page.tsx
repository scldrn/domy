import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import SearchOffIcon from "@material-symbols/svg-400/rounded/search_off.svg?react";
import { ActiveMark } from "@/components/active-mark";
import { DataList, type DataColumn } from "@/components/data-list";
import { EmptyState } from "@/components/empty-state";
import { QueryErrorAlert, TableSkeleton } from "@/components/query-state";
import { SearchField } from "@/components/search-field";
import type { SentencePart } from "@/components/summary-sentence";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ApiError } from "@/lib/api-client";
import { ExportButton } from "./export-button";
import { ListSheet, MasterHeader } from "./master-page";

/**
 * A directory screen (couriers, carriers): search, list, create, edit, and deactivate or
 * reactivate (FR-026, FR-029), as approved in feature 006 (US5): a sentence with the counts,
 * the search with «Mostrar inactivos», and a data list on a sheet whose last columns are the
 * state mark and the row's actions.
 */
export function DirectoryPage<T extends { id: string; name: string; isActive: boolean }>({
  title,
  dataset,
  queryKey,
  list,
  sentence,
  columns,
  template,
  feminine = false,
  create,
  edit,
  setActive,
}: {
  title: string;
  dataset: "couriers" | "carriers";
  queryKey: string;
  list: (q: string) => Promise<T[]>;
  /** The sentence under the title, from every record (active or not). */
  sentence: (items: T[]) => SentencePart[];
  columns: DataColumn<T>[];
  /** `grid-template-columns` of the given columns; the state and actions columns follow. */
  template: string;
  /** «Activa» rather than «Activo» (transportadoras). */
  feminine?: boolean;
  create: ReactNode;
  edit: (item: T) => ReactNode;
  /** Saves the change; a warning it returns replaces the plain confirmation. */
  setActive: (item: T, isActive: boolean) => Promise<string | undefined>;
}) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const query = useDebouncedValue(q);
  const items = useQuery({
    queryKey: ["master", queryKey, query],
    queryFn: () => list(query),
    placeholderData: keepPreviousData,
  });
  const visible = (items.data ?? []).filter((item) => showInactive || item.isActive);
  const lower = title.toLowerCase();

  const toggle = (item: T) => {
    setActive(item, !item.isActive).then(
      async (warning) => {
        await queryClient.invalidateQueries({ queryKey: ["master", queryKey] });
        const done = item.isActive ? `${item.name} desactivado` : `${item.name} reactivado`;
        if (warning) toast.warning(`${done}. ${warning}`);
        else toast.success(done);
      },
      (error: unknown) => {
        toast.error(error instanceof ApiError ? error.message : "No pudimos guardar el cambio.");
      },
    );
  };

  const allColumns: DataColumn<T>[] = [
    ...columns,
    {
      key: "state",
      header: "Estado",
      card: { order: 2, place: "end" },
      cell: (item) => <ActiveMark active={item.isActive} feminine={feminine} />,
    },
    {
      key: "actions",
      header: "Acciones",
      card: { order: 8, place: "full" },
      cell: (item) => (
        <div className="flex flex-wrap gap-1">
          {edit(item)}
          <Button
            variant="ghost"
            onClick={() => {
              toggle(item);
            }}
          >
            {item.isActive ? "Desactivar" : "Reactivar"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <MasterHeader
        title={title}
        sentence={items.data && !q ? sentence(items.data) : null}
        actions={
          <>
            <ExportButton dataset={dataset} />
            {create}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          aria-label={`Buscar ${lower}`}
          placeholder="Nombre o alias"
          className="max-w-md flex-[1_1_18rem]"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
          }}
        />
        <Toggle pressed={showInactive} onPressedChange={setShowInactive}>
          {feminine ? "Mostrar inactivas" : "Mostrar inactivos"}
        </Toggle>
      </div>
      {items.isPending ? (
        <TableSkeleton columns={columns.length + 2} rows={6} label={`Cargando ${lower}…`} />
      ) : items.isError ? (
        <QueryErrorAlert
          title={`No pudimos cargar ${lower}`}
          message="Revisa tu conexión e inténtalo de nuevo."
          onRetry={() => void items.refetch()}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchOffIcon}
          title={q ? "Nada coincide con la búsqueda" : "Todavía no hay registros"}
          {...(!showInactive &&
            (items.data.length > 0 || q) && {
              description: `Si lo que buscas está ${feminine ? "inactiva" : "inactivo"}, activa «${feminine ? "Mostrar inactivas" : "Mostrar inactivos"}».`,
            })}
        />
      ) : (
        <ListSheet id={`${queryKey}-lista`} title={title} count={visible.length}>
          <DataList
            label={title}
            columns={allColumns}
            template={`${template} 8rem minmax(13rem,auto)`}
            rows={visible}
            rowKey={(item) => item.id}
            pageSize={Number.POSITIVE_INFINITY}
            moreLabel={(total) => `Ver los ${String(total)}`}
          />
        </ListSheet>
      )}
    </div>
  );
}
