import { formatTrackingNumber, type ShipmentSummary } from "@domy/domain";
import { Link } from "@tanstack/react-router";
import { ShipmentStatusChip } from "@/components/shipment-status-chip";
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guía</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Referencia</TableHead>
          <TableHead>Destinatario</TableHead>
          <TableHead>Teléfono</TableHead>
          <TableHead>Barrio</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Tarifa</TableHead>
          <TableHead>Registrado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link
                to="/envios/$trackingNumber"
                params={{ trackingNumber: item.trackingNumber }}
                className="text-primary tabular-nums underline-offset-4 hover:underline"
              >
                {formatTrackingNumber(item.trackingNumber)}
              </Link>
            </TableCell>
            <TableCell>{formatDate(item.serviceDate)}</TableCell>
            <TableCell>{item.merchant.name}</TableCell>
            <TableCell>{item.merchantReference}</TableCell>
            <TableCell>{item.recipientName}</TableCell>
            <TableCell className="tabular-nums">{item.recipientPhone}</TableCell>
            <TableCell>{item.recipientNeighborhood?.name}</TableCell>
            <TableCell>
              <ShipmentStatusChip status={item.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCop(item.fee)}
              {item.feeNeedsReview && (
                <Badge variant="warning" className="ml-2">
                  Tarifa por revisar
                </Badge>
              )}
            </TableCell>
            <TableCell>{formatDateTime(item.registeredAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
