import {
  flagLabel,
  formatTrackingNumber,
  recordFlagLabels,
  shipmentFlag,
  shipmentKindLabels,
  type BoardEntry,
  type BoardShipment,
} from "@domy/domain";
import { Link } from "@tanstack/react-router";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { formatCop, formatDate, formatWindow } from "@/lib/format";

const dayMs = 24 * 60 * 60 * 1000;

function daysPending(serviceDate: string, today: string): string {
  const days = Math.round((Date.parse(today) - Date.parse(serviceDate)) / dayMs);
  return days === 1 ? "hace 1 día" : `hace ${String(days)} días`;
}

/** The row of a shipment on the board; the ribbon finds it by this id. */
export const rowId = (shipment: BoardShipment) => `envio-${shipment.trackingNumber}`;

/**
 * The board's shipments (FR-021): tracking number, merchant, recipient and neighborhood,
 * window with its flag (FR-022), COD amount, and status. With `today`, the tracking number
 * carries the original service date and the days pending, so both tables keep one layout.
 */
export function BoardTable({
  shipments,
  now,
  today,
  pointed,
  onPoint,
}: {
  shipments: BoardEntry[];
  now: Date;
  today?: string;
  pointed: string | null;
  onPoint: (id: string | null) => void;
}) {
  return (
    <Table className="min-w-[68rem] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-40">Guía</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Destinatario</TableHead>
          <TableHead className="w-44">Mensajero</TableHead>
          <TableHead className="w-56">Franja</TableHead>
          <TableHead className="w-32 text-right">Recaudo</TableHead>
          <TableHead className="w-40">Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shipments.map((shipment) => {
          const windowEnd = shipment.windowEnd ? new Date(shipment.windowEnd) : null;
          const flag = shipmentFlag({ status: shipment.status, windowEnd }, now);
          return (
            <TableRow
              key={shipment.id}
              id={rowId(shipment)}
              onMouseEnter={() => {
                onPoint(shipment.id);
              }}
              onMouseLeave={() => {
                onPoint(null);
              }}
              data-pointed={pointed === shipment.id || undefined}
              className="scroll-mt-24 data-pointed:bg-secondary/10"
            >
              <TableCell>
                <Link
                  to="/envios/$trackingNumber"
                  params={{ trackingNumber: shipment.trackingNumber }}
                  className="guia rounded-xs text-title-m text-on-surface underline-offset-4 hover:underline"
                >
                  {formatTrackingNumber(shipment.trackingNumber)}
                </Link>
                {today && shipment.serviceDate < today && (
                  <span className="block text-body-s text-on-surface-variant">
                    {formatDate(shipment.serviceDate)}, {daysPending(shipment.serviceDate, today)}
                  </span>
                )}
              </TableCell>
              <TableCell className="truncate">{shipment.merchant.name}</TableCell>
              <TableCell className="truncate">
                {shipment.recipientName ?? shipmentKindLabels[shipment.kind]}
                <span className="block truncate text-body-s text-on-surface-variant">
                  {shipment.recipientNeighborhood?.name ?? "Sin barrio"}
                </span>
              </TableCell>
              <TableCell className="truncate">
                {shipment.courier?.name ?? (
                  <span className="text-on-surface-variant">Sin mensajero</span>
                )}
                {shipment.routeId && shipment.routeNumber !== null && (
                  <Link
                    to="/rutas/$routeId"
                    params={{ routeId: shipment.routeId }}
                    className="block w-fit rounded-xs text-body-s text-on-surface-variant underline-offset-4 hover:underline"
                  >
                    Ruta {shipment.routeNumber}
                  </Link>
                )}
              </TableCell>
              <TableCell>
                {formatWindow(shipment.windowStart, shipment.windowEnd) ?? (
                  <span className="text-on-surface-variant">Sin franja</span>
                )}
                {flag && (
                  <span
                    className={cn(
                      "block text-label-m",
                      flag.kind === "late" ? "text-error" : "text-warning",
                    )}
                  >
                    {flagLabel(flag)}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {shipment.codAmount > 0 ? (
                  formatCop(shipment.codAmount)
                ) : (
                  <span className="text-on-surface-variant">Sin recaudo</span>
                )}
              </TableCell>
              <TableCell>
                <ShipmentStatusMark status={shipment.status} />
                {shipment.feeNeedsReview && (
                  <span className="block text-label-m text-warning">Tarifa por revisar</span>
                )}
                {/* The courier's records: "Sin foto", "Recaudo diferente"… (feature 003, FR-033). */}
                {shipment.recordFlags.map((recordFlag) => (
                  <span
                    key={recordFlag}
                    className={cn(
                      "block text-label-m",
                      recordFlag === "photo_pending" ? "text-on-surface-variant" : "text-warning",
                    )}
                  >
                    {recordFlagLabels[recordFlag]}
                  </span>
                ))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
