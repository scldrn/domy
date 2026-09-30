import {
  formatTrackingNumber,
  packageSizeLabels,
  paymentModeLabels,
  serviceLevelLabels,
  shipmentKindLabels,
  shipmentStatusLabels,
  type ShipmentDetail as ShipmentDetailData,
  type ShipmentEvent,
} from "@domy/domain";
import type { ReactNode } from "react";
import { ShipmentStatusChip } from "@/components/shipment-status-chip";
import { Badge } from "@/components/ui/badge";
import { formatCop, formatDate, formatDateTime, formatTime } from "@/lib/format";

const eventLabels: Record<ShipmentEvent["type"], string> = {
  created: "Creado",
  updated: "Editado",
  fee_confirmed: "Tarifa confirmada",
  voided: "Anulado",
  status_changed: "Cambio de estado",
};

function windowText(start: string | null, end: string | null): string | null {
  if (start && end) return `${formatTime(start)} – ${formatTime(end)}`;
  if (end) return `Antes de las ${formatTime(end)}`;
  if (start) return `Después de las ${formatTime(start)}`;
  return null;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-4 py-2">
      <dt className="text-body-m text-on-surface-variant">{label}</dt>
      <dd className="text-body-l text-on-surface">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg bg-surface-container-low p-4">
      <h2 className="mb-2 text-title-m text-on-surface">{title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

/** A shipment with every recorded value and its history (FR-016). */
export function ShipmentDetail({ shipment }: { shipment: ShipmentDetailData }) {
  const recipientPlace = shipment.recipientNeighborhood
    ? `${shipment.recipientNeighborhood.name}, ${shipment.recipientNeighborhood.municipality}`
    : null;
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-headline-s text-on-surface tabular-nums">
          {formatTrackingNumber(shipment.trackingNumber)}
        </h1>
        <ShipmentStatusChip status={shipment.status} />
        {shipment.feeNeedsReview && <Badge variant="warning">Tarifa por revisar</Badge>}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Cliente y recogida">
          <Row label="Cliente">{shipment.merchant.name}</Row>
          <Row label="Tipo">{shipmentKindLabels[shipment.kind]}</Row>
          <Row label="Recogida">
            {shipment.pickupAddress}, {shipment.pickupNeighborhood.name}
          </Row>
          <Row label="Fecha del servicio">{formatDate(shipment.serviceDate)}</Row>
        </Section>

        <Section title={shipment.kind === "errand" ? "Diligencia" : "Destino"}>
          <Row label="Descripción">{shipment.errandDescription}</Row>
          <Row label="Destinatario">{shipment.recipientName}</Row>
          <Row label="Teléfono">{shipment.recipientPhone}</Row>
          <Row label="Dirección">{shipment.recipientAddress}</Row>
          <Row label={shipment.kind === "carrier_handoff" ? "Punto de entrega" : "Barrio"}>
            {recipientPlace}
          </Row>
          <Row label="Transportadora">{shipment.carrier?.name}</Row>
          <Row label="Municipio de destino">{shipment.destinationTown}</Row>
        </Section>

        <Section title="Pago y tarifa">
          <Row label="Modalidad">{paymentModeLabels[shipment.paymentMode]}</Row>
          <Row label="Valor a recaudar">
            <span className="tabular-nums">{formatCop(shipment.codAmount)}</span>
          </Row>
          <Row label="Tarifa">
            <span className="tabular-nums">{formatCop(shipment.fee)}</span>
          </Row>
          {shipment.calculatedFee !== shipment.fee && (
            <Row label="Tarifa calculada">
              {shipment.calculatedFee === null ? "Sin tarifa" : formatCop(shipment.calculatedFee)}
            </Row>
          )}
          <Row label="Motivo">{shipment.feeOverrideReason}</Row>
          <Row label="Zona tarifaria">{shipment.rateZone?.name}</Row>
          <Row label="Nivel de servicio">{serviceLevelLabels[shipment.serviceLevel]}</Row>
        </Section>

        <Section title="Detalles">
          <Row label="Franja">{windowText(shipment.windowStart, shipment.windowEnd)}</Row>
          <Row label="Tamaño">
            {shipment.packageSize && packageSizeLabels[shipment.packageSize]}
          </Row>
          <Row label="Unidades">{shipment.packageCount}</Row>
          <Row label="Referencia">{shipment.merchantReference}</Row>
          <Row label="Indicaciones">{shipment.instructions}</Row>
          <Row label="Motivo de anulación">{shipment.voidReason}</Row>
        </Section>
      </div>

      <section>
        <h2 className="mb-2 text-title-m text-on-surface">Historial de cambios</h2>
        <ol className="flex flex-col gap-2">
          {shipment.events.map((event) => (
            <li key={event.id} className="rounded-sm bg-surface-container-low px-4 py-3">
              <p className="text-body-l text-on-surface">
                {eventLabels[event.type]}
                {event.toStatus && event.type !== "created"
                  ? `: ${shipmentStatusLabels[event.toStatus]}`
                  : ""}
              </p>
              <p className="text-body-m text-on-surface-variant">
                {event.actor.name} · {formatDateTime(event.occurredAt)}
              </p>
              {event.reason && <p className="text-body-m text-on-surface">{event.reason}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
