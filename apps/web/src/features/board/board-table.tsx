import {
  flagLabel,
  formatTrackingNumber,
  shipmentFlag,
  shipmentKindLabels,
  type BoardShipment,
} from "@domy/domain";
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
import { formatCop, formatDate, formatWindow } from "@/lib/format";

const dayMs = 24 * 60 * 60 * 1000;

function daysPending(serviceDate: string, today: string): string {
  const days = Math.round((Date.parse(today) - Date.parse(serviceDate)) / dayMs);
  return days === 1 ? "1 día" : `${String(days)} días`;
}

function Flags({ shipment, now }: { shipment: BoardShipment; now: Date }) {
  const windowEnd = shipment.windowEnd ? new Date(shipment.windowEnd) : null;
  const flag = shipmentFlag({ status: shipment.status, windowEnd }, now);
  return (
    <span className="flex gap-1">
      {flag && (
        <Badge variant={flag.kind === "late" ? "destructive" : "warning"}>{flagLabel(flag)}</Badge>
      )}
      {shipment.feeNeedsReview && <Badge variant="outline">Tarifa por revisar</Badge>}
    </span>
  );
}

/**
 * The board's shipments (FR-021). With `today`, it adds the original service date and the
 * days pending, for the section "Pendientes de días anteriores".
 */
export function BoardTable({
  shipments,
  now,
  today,
}: {
  shipments: BoardShipment[];
  now: Date;
  today?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guía</TableHead>
          {today && <TableHead>Fecha del servicio</TableHead>}
          <TableHead>Cliente</TableHead>
          <TableHead>Destinatario</TableHead>
          <TableHead>Barrio</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Franja</TableHead>
          <TableHead className="text-right">Contraentrega</TableHead>
          <TableHead>Alertas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shipments.map((shipment) => (
          <TableRow key={shipment.id}>
            <TableCell>
              <Link
                to="/envios/$trackingNumber"
                params={{ trackingNumber: shipment.trackingNumber }}
                className="text-primary tabular-nums underline-offset-4 hover:underline"
              >
                {formatTrackingNumber(shipment.trackingNumber)}
              </Link>
            </TableCell>
            {today && (
              <TableCell>
                {formatDate(shipment.serviceDate)}
                <span className="block text-body-s text-on-surface-variant">
                  {daysPending(shipment.serviceDate, today)}
                </span>
              </TableCell>
            )}
            <TableCell>{shipment.merchant.name}</TableCell>
            <TableCell>{shipment.recipientName ?? shipmentKindLabels[shipment.kind]}</TableCell>
            <TableCell>{shipment.recipientNeighborhood?.name}</TableCell>
            <TableCell>
              <ShipmentStatusChip status={shipment.status} />
            </TableCell>
            <TableCell>{formatWindow(shipment.windowStart, shipment.windowEnd)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {shipment.codAmount > 0 ? formatCop(shipment.codAmount) : "—"}
            </TableCell>
            <TableCell>
              <Flags shipment={shipment} now={now} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
