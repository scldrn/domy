import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ApiError } from "@/lib/api-client";
import { ExportButton } from "./export-button";

/**
 * A directory screen (couriers, carriers): search, list, create, edit, and deactivate or
 * reactivate (FR-026, FR-029).
 */
export function DirectoryPage<T extends { id: string; name: string; isActive: boolean }>({
  title,
  dataset,
  queryKey,
  list,
  columns,
  create,
  edit,
  setActive,
}: {
  title: string;
  dataset: "couriers" | "carriers";
  queryKey: string;
  list: (q: string) => Promise<T[]>;
  columns: { header: string; cell: (item: T) => ReactNode }[];
  create: ReactNode;
  edit: (item: T) => ReactNode;
  setActive: (item: T, isActive: boolean) => Promise<unknown>;
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

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-headline-s text-on-surface">{title}</h1>
        <div className="flex gap-2">
          <ExportButton dataset={dataset} />
          {create}
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-4">
        <Input
          type="search"
          aria-label={`Buscar ${title.toLowerCase()}`}
          placeholder="Nombre o alias"
          className="max-w-sm"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
          }}
        />
        <Toggle pressed={showInactive} onPressedChange={setShowInactive}>
          Mostrar inactivos
        </Toggle>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.header}>{column.header}</TableHead>
            ))}
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((item) => (
            <TableRow key={item.id}>
              {columns.map((column) => (
                <TableCell key={column.header}>{column.cell(item)}</TableCell>
              ))}
              <TableCell>
                {item.isActive ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="outline">Inactivo</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {edit(item)}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setActive(item, !item.isActive).then(
                        async () => {
                          await queryClient.invalidateQueries({ queryKey: ["master", queryKey] });
                          toast.success(
                            item.isActive ? `${item.name} desactivado` : `${item.name} reactivado`,
                          );
                        },
                        (error: unknown) => {
                          toast.error(
                            error instanceof ApiError
                              ? error.message
                              : "No pudimos guardar el cambio.",
                          );
                        },
                      );
                    }}
                  >
                    {item.isActive ? "Desactivar" : "Reactivar"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
