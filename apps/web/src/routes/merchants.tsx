import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import type { MerchantListItem } from "@domy/domain";
import { ActiveMark } from "@/components/active-mark";
import { DataList, type DataColumn } from "@/components/data-list";
import { DirectoryEmptyState, QueryErrorAlert, TableSkeleton } from "@/components/query-state";
import { SearchField } from "@/components/search-field";
import { Toggle } from "@/components/ui/toggle";
import { listMerchants } from "@/features/master-data/api";
import { ExportButton } from "@/features/master-data/export-button";
import { ListSheet, MasterHeader } from "@/features/master-data/master-page";
import { MerchantDialog } from "@/features/master-data/merchants/merchant-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export const Route = createFileRoute("/_panel/clientes")({
  head: () => ({ meta: [{ title: "Clientes · Domy" }] }),
  component: MerchantsPage,
});

const plural = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`;

const columns: DataColumn<MerchantListItem>[] = [
  {
    key: "name",
    header: "Cliente",
    card: { order: 1, place: "start" },
    cell: (merchant) => (
      <span className="flex min-w-0 flex-col">
        <Link
          to="/clientes/$merchantId"
          params={{ merchantId: merchant.id }}
          className="w-fit font-semibold text-on-surface underline decoration-transparent underline-offset-4 hover:decoration-current"
        >
          {merchant.name}
        </Link>
        {merchant.aliases.length > 0 && (
          <span className="truncate text-body-m text-on-surface-variant">
            {merchant.aliases.join(" · ")}
          </span>
        )}
      </span>
    ),
  },
  {
    key: "phone",
    header: "WhatsApp",
    card: { order: 3, place: "start" },
    cell: (merchant) => (
      <span className="tabular-nums">{merchant.whatsappPhone ?? "Sin WhatsApp"}</span>
    ),
  },
  {
    key: "pickup",
    header: "Recoger en",
    card: { order: 4, place: "full" },
    cell: (merchant) =>
      merchant.defaultPickupPoint ? (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">
            {merchant.defaultPickupPoint.label} · {merchant.defaultPickupPoint.neighborhood}
          </span>
          <span className="text-body-m text-on-surface-variant">
            {plural(merchant.pickupPoints, "punto", "puntos")}
          </span>
        </span>
      ) : (
        <span className="text-on-surface-variant">Sin punto de recogida</span>
      ),
  },
  {
    key: "open",
    header: "Envíos abiertos",
    align: "end",
    card: { order: 5, place: "end" },
    cell: (merchant) => (
      <span className="font-semibold tabular-nums">
        <span className="min-[821px]:hidden">Abiertos: </span>
        {merchant.openShipments}
      </span>
    ),
  },
  {
    key: "state",
    header: "Estado",
    card: { order: 2, place: "end" },
    cell: (merchant) => <ActiveMark active={merchant.isActive} />,
  },
];

/**
 * The merchants directory (FR-026), as approved in feature 006 (US5): a sentence with the
 * counts, search and «Mostrar inactivos», and a data list with each merchant's default pickup
 * point and open shipments, the busiest first. The link column of the proposal is left out:
 * a merchant's link works exactly while the merchant is active, so it repeated «Estado».
 */
function MerchantsPage() {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const query = useDebouncedValue(q);
  const merchants = useQuery({
    queryKey: ["master", "merchants", query, showInactive],
    queryFn: () => listMerchants(query, showInactive ? undefined : "true"),
    placeholderData: keepPreviousData,
  });
  const items = merchants.data ?? [];
  const active = items.filter((merchant) => merchant.isActive).length;
  const busy = items.filter((merchant) => merchant.openShipments > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <MasterHeader
        title="Clientes"
        sentence={
          merchants.data && !q
            ? [
                { text: plural(active, "cliente activo", "clientes activos"), strong: true },
                {
                  text:
                    busy > 0
                      ? `; ${plural(busy, "tiene", "tienen")} envíos abiertos.`
                      : "; ninguno tiene envíos abiertos.",
                },
              ]
            : null
        }
        actions={
          <>
            <ExportButton dataset="merchants" />
            <MerchantDialog />
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          aria-label="Buscar clientes"
          placeholder="Nombre o alias"
          className="max-w-md flex-[1_1_18rem]"
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
        <TableSkeleton columns={5} rows={6} label="Cargando clientes…" />
      ) : merchants.isError ? (
        <QueryErrorAlert
          title="No pudimos cargar los clientes"
          message="Revisa tu conexión e inténtalo de nuevo."
          onRetry={() => void merchants.refetch()}
        />
      ) : items.length === 0 ? (
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
        <ListSheet
          id="clientes-lista"
          title="Clientes"
          count={items.length}
          note="Los de más envíos abiertos, primero"
        >
          <DataList
            label="Clientes"
            columns={columns}
            template="minmax(12rem,1.3fr) 10rem minmax(12rem,1.2fr) 9rem 8rem"
            rows={items}
            rowKey={(merchant) => merchant.id}
            pageSize={Number.POSITIVE_INFINITY}
            moreLabel={(total) => `Ver los ${String(total)} clientes`}
          />
        </ListSheet>
      )}
    </div>
  );
}
