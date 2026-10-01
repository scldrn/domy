import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { listMerchants } from "@/features/master-data/api";
import { ExportButton } from "@/features/master-data/export-button";
import { MerchantDialog } from "@/features/master-data/merchants/merchant-dialog";

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
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-headline-s text-on-surface">Clientes</h1>
        <div className="flex gap-2">
          <ExportButton dataset="merchants" />
          <MerchantDialog />
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-4">
        <Input
          type="search"
          aria-label="Buscar clientes"
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
            <TableHead>Cliente</TableHead>
            <TableHead>Alias</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(merchants.data ?? []).map((merchant) => (
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
    </div>
  );
}
