import { formatTrackingNumber, type ShipmentSummary } from "@domy/domain";
import { Link } from "@tanstack/react-router";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCop, formatDate, formatDateTime } from "@/lib/format";

/** Search results, newest first (FR-024). */
export function ResultsTable({ items }: { items: ShipmentSummary[] }) {
  return (
    <Table className="min-w-[60rem] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-40">Guía</TableHead>
          <TableHead>Cliente y referencia</TableHead>
          <TableHead>Destinatario y barrio</TableHead>
          <TableHead className="w-40">Estado</TableHead>
          <TableHead className="w-48 text-right">Tarifa</TableHead>
          <TableHead className="w-48">Registrado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link
                to="/envios/$trackingNumber"
                params={{ trackingNumber: item.trackingNumber }}
                className="guia rounded-xs text-title-s text-on-surface underline-offset-4 hover:underline"
              >
                {formatTrackingNumber(item.trackingNumber)}
              </Link>
              <span className="block text-body-s text-on-surface-variant">
                {formatDate(item.serviceDate)}
              </span>
            </TableCell>
            <TableCell className="truncate">
              {item.merchant.name}
              <span className="block truncate text-body-s text-on-surface-variant">
                {item.merchantReference ?? "Sin referencia"}
              </span>
            </TableCell>
            <TableCell className="truncate">
              {item.recipientName ?? "—"}
              <span className="block truncate text-body-s text-on-surface-variant tabular-nums">
                {[item.recipientPhone, item.recipientNeighborhood?.name]
                  .filter(Boolean)
                  .join(" · ") || "Sin barrio"}
              </span>
            </TableCell>
            <TableCell>
              <ShipmentStatusMark status={item.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCop(item.fee)}
              {item.feeNeedsReview && (
                <Badge variant="warning" className="mt-1 ml-auto flex">
                  Tarifa por revisar
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-body-s text-on-surface-variant">
              {formatDateTime(item.registeredAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
