import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { DirectoryEmptyState, QueryErrorAlert, TableSkeleton } from "@/components/query-state";
import { SearchField } from "@/components/search-field";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { listMerchants } from "@/features/master-data/api";
import { ExportButton } from "@/features/master-data/export-button";
import { MerchantDialog } from "@/features/master-data/merchants/merchant-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export const Route = createFileRoute("/_panel/clientes")({
  head: () => ({ meta: [{ title: "Clientes · Domy" }] }),
  component: MerchantsPage,
});

/** The merchants directory (FR-026). */
function MerchantsPage() {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const query = useDebouncedValue(q);
  const merchants = useQuery({
    queryKey: ["master", "merchants", query, showInactive],
    queryFn: () => listMerchants(query, showInactive ? undefined : "true"),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        actions={
          <>
            <div className="flex gap-2">
              <ExportButton dataset="merchants" />
              <MerchantDialog />
            </div>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-4">
        <SearchField
          aria-label="Buscar clientes"
          placeholder="Nombre o alias"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
          }}
        />
        <Toggle pressed={showInactive} onPressedChange={setShowInactive}>
          Mostrar inactivos
        </Toggle>
      </div>
      {merchants.isPending ? (
        <TableSkeleton columns={4} rows={6} label="Cargando clientes…" />
      ) : merchants.isError ? (
        <QueryErrorAlert
          title="No pudimos cargar los clientes"
          message="Revisa tu conexión e inténtalo de nuevo."
          onRetry={() => void merchants.refetch()}
        />
      ) : merchants.data.length === 0 ? (
        <DirectoryEmptyState
          title={q ? "Nada coincide con la búsqueda" : "Todavía no hay clientes"}
          description={
            q
              ? "Prueba con otro término."
              : !showInactive
                ? "Si buscas un cliente inactivo, activa «Mostrar inactivos»."
                : "Crea el primer cliente para comenzar."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Alias</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {merchants.data.map((merchant) => (
              <TableRow key={merchant.id}>
                <TableCell>
                  <Link
                    to="/clientes/$merchantId"
                    params={{ merchantId: merchant.id }}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {merchant.name}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-normal">{merchant.aliases.join(", ")}</TableCell>
                <TableCell className="tabular-nums">{merchant.whatsappPhone}</TableCell>
                <TableCell>
                  {merchant.isActive ? (
                    <Badge variant="success">Activo</Badge>
                  ) : (
                    <Badge variant="outline">Inactivo</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
