import { type ShipmentSummary } from "@domy/domain";
import { Link } from "@tanstack/react-router";
import { DataList, type DataColumn } from "@/components/data-list";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { TrackingNumber } from "@/components/tracking-number";
import { Badge } from "@/components/ui/badge";
import { formatCop, formatDate, formatDateTime } from "@/lib/format";

const columns: DataColumn<ShipmentSummary>[] = [
  {
    key: "guia",
    header: "Guía",
    card: { order: 1, place: "start" },
    cell: (item) => (
      <>
        <Link
          to="/envios/$trackingNumber"
          params={{ trackingNumber: item.trackingNumber }}
          className="rounded-xs text-on-surface underline-offset-4 hover:underline"
        >
          <TrackingNumber value={item.trackingNumber} className="text-title-m" />
        </Link>
        <span className="block text-body-s text-on-surface-variant max-[820px]:hidden">
          {formatDate(item.serviceDate)}
        </span>
      </>
    ),
  },
  {
    key: "cliente",
    header: "Cliente y referencia",
    card: { order: 4, place: "full" },
    cell: (item) => (
      <>
        <span className="block truncate max-[820px]:inline max-[820px]:text-body-s max-[820px]:text-on-surface-variant">
          {item.merchant.name}
        </span>
        <span className="block truncate text-body-s text-on-surface-variant max-[820px]:inline">
          <span className="min-[821px]:hidden"> · </span>
          {item.merchantReference ?? "Sin referencia"}
        </span>
      </>
    ),
  },
  {
    key: "destinatario",
    header: "Destinatario y barrio",
    card: { order: 3, place: "full" },
    cell: (item) => (
      <>
        <span className="block truncate max-[820px]:font-[600]">{item.recipientName ?? "—"}</span>
        <span className="block truncate text-body-s text-on-surface-variant tabular-nums">
          {[item.recipientPhone, item.recipientNeighborhood?.name].filter(Boolean).join(" · ") ||
            "Sin barrio"}
        </span>
      </>
    ),
  },
  {
    key: "estado",
    header: "Estado",
    card: { order: 2, place: "end" },
    cell: (item) => <ShipmentStatusMark status={item.status} />,
  },
  {
    key: "tarifa",
    header: "Tarifa",
    align: "end",
    card: { order: 6, place: "end" },
    cell: (item) => (
      <>
        <span className="font-[600] tabular-nums">{formatCop(item.fee)}</span>
        {item.feeNeedsReview && (
          <Badge variant="warning" className="mt-1 ml-auto flex w-fit">
            Tarifa por revisar
          </Badge>
        )}
      </>
    ),
  },
  {
    key: "registrado",
    header: "Registrado",
    card: { order: 5, place: "start" },
    cell: (item) => (
      <span className="text-body-s text-on-surface-variant">
        {formatDateTime(item.registeredAt)}
      </span>
    ),
  },
];

/**
 * Search results, newest first (FR-024; approved «Historial»): the design system's data list,
 * a table on wide screens and cards under 820 px. Paging stays with the server's «Ver más
 * envíos», so the list shows every row it has.
 */
export function ResultsTable({ items }: { items: ShipmentSummary[] }) {
  return (
    <DataList
      label="Envíos encontrados"
      columns={columns}
      template="10rem minmax(10rem,1fr) minmax(11rem,1.15fr) 9rem 10rem 11rem"
      rows={items}
      rowKey={(item) => item.id}
      pageSize={Number.POSITIVE_INFINITY}
      moreLabel={(total) => `Ver los ${String(total)} envíos`}
    />
  );
}
