import {
  canVoid,
  formatTrackingNumber,
  isEditable,
  packageSizeLabels,
  paymentModeLabels,
  serviceLevelLabels,
  shipmentKindLabels,
  shipmentStatusLabels,
  type ShipmentDetail as ShipmentDetailData,
  type ShipmentEvent,
} from "@domy/domain";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useId, type ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatCop, formatDate, formatDateTime, formatWindow } from "@/lib/format";
import { ConfirmFeeDialog } from "./confirm-fee-dialog";
import { VoidDialog } from "./void-dialog";

const panelRoute = getRouteApi("/_panel");

const eventLabels: Record<ShipmentEvent["type"], string> = {
  created: "Creado",
  updated: "Editado",
  fee_confirmed: "Tarifa confirmada",
  voided: "Anulado",
  status_changed: "Cambio de estado",
  reassigned: "Reasignado",
  handover_confirmed: "Traspaso confirmado",
  handover_cancelled: "Traspaso cancelado",
};

/** Field names and value formats of the change history (FR-016). */
const fieldLabels: Record<string, string> = {
  serviceDate: "Fecha del servicio",
  pickupPointId: "Punto de recogida",
  pickupAddress: "Dirección de recogida",
  pickupNeighborhoodId: "Barrio de recogida",
  recipientName: "Destinatario",
  recipientPhone: "Teléfono",
  recipientAddress: "Dirección",
  recipientNeighborhoodId: "Barrio",
  carrierId: "Transportadora",
  destinationTown: "Municipio de destino",
  errandDescription: "Descripción",
  rateZoneId: "Zona tarifaria",
  serviceLevel: "Nivel de servicio",
  calculatedFee: "Tarifa calculada",
  fee: "Tarifa",
  feeOverrideReason: "Motivo de la tarifa",
  feeNeedsReview: "Tarifa por revisar",
  paymentMode: "Modalidad de pago",
  codAmount: "Valor a recaudar",
  windowStart: "Franja desde",
  windowEnd: "Franja hasta",
  packageSize: "Tamaño",
  packageCount: "Unidades",
  merchantReference: "Referencia",
  instructions: "Indicaciones",
};
const moneyFields = new Set(["fee", "calculatedFee", "codAmount"]);
const enumLabels: Record<string, Record<string, string>> = {
  paymentMode: paymentModeLabels,
  serviceLevel: serviceLevelLabels,
  packageSize: packageSizeLabels,
};

function changeValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number" && moneyFields.has(field)) return formatCop(value);
  if (typeof value === "string") {
    if (field === "serviceDate") return formatDate(value);
    if (field === "windowStart" || field === "windowEnd") return formatDateTime(value);
    return enumLabels[field]?.[value] ?? value;
  }
  return typeof value === "number" ? String(value) : JSON.stringify(value);
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
    <section className="rounded-md border border-outline-variant bg-sheet p-6">
      <h2 className="mb-2 text-title-m text-on-surface">{title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

/** A shipment with every recorded value and its history (FR-016). */
export function ShipmentDetail({ shipment }: { shipment: ShipmentDetailData }) {
  const { user } = panelRoute.useRouteContext();
  const historyId = useId();
  const recipientPlace = shipment.recipientNeighborhood
    ? `${shipment.recipientNeighborhood.name}, ${shipment.recipientNeighborhood.municipality}`
    : null;
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title={<span className="guia">{formatTrackingNumber(shipment.trackingNumber)}</span>}
        description={`${shipment.merchant.name} · ${formatDate(shipment.serviceDate)}`}
        actions={
          <>
            {shipment.feeNeedsReview && user.role === "owner" && (
              <ConfirmFeeDialog shipment={shipment} />
            )}
            {canVoid(shipment.status) && <VoidDialog shipment={shipment} />}
            {isEditable(shipment.status) && (
              <Link
                to="/envios/$trackingNumber/editar"
                params={{ trackingNumber: shipment.trackingNumber }}
                className={buttonVariants()}
              >
                Editar
              </Link>
            )}
          </>
        }
      >
        <ShipmentStatusMark status={shipment.status} />
        {shipment.feeNeedsReview && <Badge variant="warning">Tarifa por revisar</Badge>}
      </PageHeader>

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
          <Row label="Franja">
            {formatWindow(shipment.windowStart, shipment.windowEnd) ?? "Sin franja"}
          </Row>
          <Row label="Tamaño">
            {shipment.packageSize && packageSizeLabels[shipment.packageSize]}
          </Row>
          <Row label="Unidades">{shipment.packageCount}</Row>
          <Row label="Referencia">{shipment.merchantReference}</Row>
          <Row label="Indicaciones">{shipment.instructions}</Row>
          <Row label="Motivo de anulación">{shipment.voidReason}</Row>
        </Section>
      </div>

      <section aria-labelledby={historyId}>
        <h2 id={historyId} className="mb-2 text-title-m text-on-surface">
          Historial de cambios
        </h2>
        <ol className="ml-2 flex flex-col border-l-2 border-outline-variant">
          {shipment.events.map((event) => (
            <li
              key={event.id}
              className="relative pb-5 pl-6 before:absolute before:top-1.5 before:-left-[7px] before:size-3 before:rounded-full before:bg-primary before:ring-4 before:ring-surface last:pb-0"
            >
              <p className="text-body-l text-on-surface">
                {eventLabels[event.type]}
                {event.toStatus && event.type === "status_changed"
                  ? `: ${shipmentStatusLabels[event.toStatus]}`
                  : ""}
              </p>
              <p className="text-body-m text-on-surface-variant">
                {event.actor.name} · {formatDateTime(event.occurredAt)}
              </p>
              {event.reason && <p className="text-body-m text-on-surface">{event.reason}</p>}
              {event.changes && (
                <ul className="mt-1 text-body-m text-on-surface">
                  {Object.entries(event.changes).map(([field, [before, after]]) => (
                    <li key={field}>
                      {fieldLabels[field] ?? field}: {changeValue(field, before)} →{" "}
                      {changeValue(field, after)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
