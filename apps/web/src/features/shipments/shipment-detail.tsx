import {
  bogotaToday,
  canMoveBetweenRoutes,
  canVoid,
  exceptionReasonLabels,
  isEditable,
  packageSizeLabels,
  paymentModeLabels,
  publicOriginSchema,
  recordFlagLabels,
  resolveCodAmount,
  routeStatusLabels,
  serviceLevelLabels,
  shipmentKindLabels,
  shipmentStatusLabels,
  type ShipmentDetail as ShipmentDetailData,
} from "@domy/domain";
import BackIcon from "@material-symbols/svg-400/rounded/chevron_left.svg?react";
import ReportIcon from "@material-symbols/svg-400/rounded/report.svg?react";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Money } from "@/components/money";
import { OnBehalfMark } from "@/components/on-behalf-mark";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { SummarySentence } from "@/components/summary-sentence";
import { TrackingNumber } from "@/components/tracking-number";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { HandoverBadge } from "@/features/routes/handover-badge";
import { ReassignShipmentDialog } from "@/features/routes/reassign-dialog";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatCop, formatDate, formatDateTime, formatLongDate, formatWindow } from "@/lib/format";
import { ClearReviewDialog } from "./clear-review-dialog";
import { DetailCard } from "@/components/detail-card";
import { ConfirmFeeDialog } from "./confirm-fee-dialog";
import { ExceptionActions } from "./exception-decision-dialog";
import { RecordOnBehalfDialog } from "./record-on-behalf-dialog";
import {
  collectedOn,
  deliveryOf,
  detailSentence,
  historyItems,
  holderOf,
  journeySteps,
  whenOf,
  type HistoryItem,
  type JourneyStep,
} from "./shipment-journey";
import { ShipmentRecords } from "./shipment-records";
import { VoidDialog } from "./void-dialog";

const panelRoute = getRouteApi("/_panel");

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
  routeId: "Ruta",
  courierId: "Mensajero",
  custodyCourierId: "Tiene el paquete",
  heldAtOffice: "En oficina",
  returnDecided: "Devolución decidida",
  needsReview: "Por revisar",
  receivedByName: "Recibido por",
  cashAmount: "Efectivo",
  companyTransferAmount: "Transferencia a la empresa",
  merchantTransferAmount: "Transferencia al cliente",
  exceptionReason: "Motivo de la novedad",
  note: "Nota",
  disbursementAmount: "Valor del pago",
  payee: "A quién se pagó",
  status: "Estado",
};
const moneyFields = new Set([
  "fee",
  "calculatedFee",
  "codAmount",
  "cashAmount",
  "companyTransferAmount",
  "merchantTransferAmount",
  "disbursementAmount",
]);
const enumLabels: Record<string, Record<string, string>> = {
  paymentMode: paymentModeLabels,
  serviceLevel: serviceLevelLabels,
  packageSize: packageSizeLabels,
  exceptionReason: exceptionReasonLabels,
  status: shipmentStatusLabels,
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

/** A term and its value; nothing when there is no value. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "" || children === false)
    return null;
  return (
    <div className="contents">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="font-medium break-words text-on-surface">{children}</dd>
    </div>
  );
}

function Terms({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl
      className={cn("grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-body-m", className)}
    >
      {children}
    </dl>
  );
}

const stepDot: Record<JourneyStep["state"], string> = {
  done: "border-success bg-success",
  now: "border-info bg-sheet ring-4 ring-info/22 after:size-2 after:rounded-full after:bg-info after:content-['']",
  todo: "border-outline-variant bg-sheet",
  exception: "rounded-[5px] border-error bg-error",
};

/** "Recorrido": the steps with their times, the current one ringed (approved detail). */
function Journey({ shipment, className }: { shipment: ShipmentDetailData; className?: string }) {
  const steps = journeySteps(shipment);
  const exception =
    shipment.status === "exception"
      ? shipment.records.findLast(
          (record) =>
            record.kind === "exception" && record.outcome === "applied" && !record.reverted,
        )
      : undefined;
  return (
    <DetailCard title="Recorrido" className={className}>
      <div className="@container">
        <ol
          className="grid gap-y-2.5 @max-[34rem]:grid-cols-1!"
          style={{ gridTemplateColumns: `repeat(${String(steps.length)}, minmax(0, 1fr))` }}
        >
          {steps.map((step, index) => (
            <li
              key={step.label}
              aria-current={step.state === "now" ? "step" : undefined}
              className={cn(
                "relative flex flex-col gap-0.5 pr-2 @max-[34rem]:flex-row @max-[34rem]:items-center @max-[34rem]:gap-2.5",
                // The connector to the next step; the last step has none.
                index < steps.length - 1 && [
                  "before:absolute before:top-2.25 before:right-0 before:left-3.5 before:h-0.5 before:content-[''] @max-[34rem]:before:top-5 @max-[34rem]:before:-bottom-3 @max-[34rem]:before:left-2.25 @max-[34rem]:before:h-auto @max-[34rem]:before:w-0.5",
                  step.state === "done" ? "before:bg-success" : "before:bg-outline-variant",
                ],
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-1 grid size-5 shrink-0 place-items-center rounded-full border-2",
                  stepDot[step.state],
                )}
              />
              <span className="flex flex-col">
                <span
                  className={cn(
                    "mt-2 text-body-m @max-[34rem]:mt-0",
                    step.state === "todo"
                      ? "font-medium text-on-surface-variant"
                      : "font-semibold text-on-surface",
                  )}
                >
                  {step.label}
                </span>
                <span className="text-body-s text-on-surface-variant">
                  {step.at ? whenOf(step.at, shipment.serviceDate) : "Pendiente"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      {exception && (
        <div className="flex items-start gap-3 rounded-md bg-error-container px-4 py-3.5 text-body-m text-on-error-container">
          <Icon symbol={ReportIcon} size={20} className="mt-0.5" />
          <p>
            <strong className="block font-bold">
              {exception.exceptionReason
                ? exceptionReasonLabels[exception.exceptionReason]
                : "Novedad"}{" "}
              · {whenOf(exception.occurredAt, shipment.serviceDate)}
            </strong>
            {exception.note ?? `${exception.courier.name} reportó la novedad.`}
          </p>
        </div>
      )}
      {shipment.status === "voided" && shipment.voidReason && (
        <p className="rounded-md bg-sheet-alt px-4 py-3.5 text-body-m text-on-surface">
          <strong className="block font-bold">Motivo de anulación</strong>
          {shipment.voidReason}
        </p>
      )}
    </DetailCard>
  );
}

const historyDot: Record<HistoryItem["tone"], string> = {
  exception: "before:rounded-[3px] before:bg-error",
  delivered: "before:bg-success",
  custody: "before:bg-info",
  neutral: "before:bg-on-surface-variant",
};

/** One history for changes, custody, and decisions, newest first (approved detail). */
function History({ shipment }: { shipment: ShipmentDetailData }) {
  const items = historyItems(shipment.events);
  return (
    <DetailCard title="Historial">
      <p className="-mt-1 text-body-m text-on-surface-variant">
        Cambios, custodia del paquete y decisiones, del más reciente al más antiguo.
      </p>
      <ol className="flex flex-col">
        {items.map(({ event, title, custody, tone }) => (
          <li
            key={event.id}
            className={cn(
              "relative pb-3.5 pl-6 text-body-m before:absolute before:top-1.25 before:left-1 before:size-2.5 before:rounded-full before:content-['']",
              "after:absolute after:top-4.25 after:-bottom-px after:left-[8.5px] after:w-px after:bg-outline-variant after:content-[''] last:pb-0 last:after:hidden",
              historyDot[tone],
            )}
          >
            <p className="flex flex-wrap items-center gap-x-2 font-semibold text-on-surface">
              {title}
              {event.onBehalf && <OnBehalfMark />}
            </p>
            <p className="text-on-surface-variant">
              {event.actor.name} · {formatDateTime(event.occurredAt)}
            </p>
            {custody && <p className="text-on-surface">{custody}</p>}
            {event.reason && <p className="text-on-surface">{event.reason}</p>}
            {event.changes && (
              <ul className="text-on-surface">
                {Object.entries(event.changes)
                  .filter(([field]) => !(custody && field === "custodyCourierId"))
                  .map(([field, [before, after]]) => (
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
    </DetailCard>
  );
}

/** "Pago y tarifa": what the courier collects, or collected once delivered (FR-009). */
function Payment({ shipment, className }: { shipment: ShipmentDetailData; className?: string }) {
  const delivery = shipment.status === "delivered" ? deliveryOf(shipment.records) : null;
  const collects = resolveCodAmount(shipment.paymentMode, shipment.fee, shipment.codAmount);
  return (
    <DetailCard title="Pago y tarifa" className={className}>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-body-m">
        <dt className="text-on-surface-variant">Tarifa</dt>
        <dd className="text-right font-semibold">
          <Money amount={shipment.fee} emptyLabel="Sin tarifa" />
        </dd>
        {shipment.calculatedFee !== shipment.fee && (
          <>
            <dt className="text-on-surface-variant">Tarifa calculada</dt>
            <dd className="text-right font-semibold">
              <Money amount={shipment.calculatedFee} emptyLabel="Sin tarifa" />
            </dd>
          </>
        )}
        <dt className="text-on-surface-variant">Valor a recaudar</dt>
        <dd className="text-right font-semibold">
          <Money amount={shipment.codAmount} emptyLabel="Sin recaudo" />
        </dd>
        {shipment.status !== "voided" && (
          <>
            <dt className="text-body-l font-bold text-on-surface">
              {delivery ? "Cobró el mensajero" : "El mensajero cobra"}
            </dt>
            <dd className="text-right text-body-l font-bold tabular-nums">
              {formatCop(delivery ? collectedOn(delivery) : collects)}
            </dd>
          </>
        )}
      </dl>
      <Terms className="border-t border-outline-variant pt-3">
        <Row label="Modalidad">{paymentModeLabels[shipment.paymentMode]}</Row>
        <Row label="Motivo de la tarifa">{shipment.feeOverrideReason}</Row>
        <Row label="Zona tarifaria">{shipment.rateZone?.name}</Row>
        <Row label="Nivel de servicio">{serviceLevelLabels[shipment.serviceLevel]}</Row>
        <Row label="Notificado">
          {shipment.notifiedAt === null ? "Sin notificar" : formatDateTime(shipment.notifiedAt)}
        </Row>
      </Terms>
    </DetailCard>
  );
}

/** "Ruta y custodia": the route, its courier, who has the package, a pending handover. */
function Custody({
  shipment,
  onResolved,
  className,
}: {
  shipment: ShipmentDetailData;
  onResolved: () => Promise<void>;
  className?: string;
}) {
  const route = shipment.route;
  return (
    <DetailCard title="Ruta y custodia" className={className}>
      <Terms>
        <Row label="Ruta">
          {route ? (
            <>
              <Link
                to="/rutas/$routeId"
                params={{ routeId: route.id }}
                className="rounded-xs underline underline-offset-3"
              >
                Ruta {route.number}
              </Link>{" "}
              · {routeStatusLabels[route.status]}
              {route.serviceDate !== shipment.serviceDate && ` · ${formatDate(route.serviceDate)}`}
            </>
          ) : (
            "Sin ruta"
          )}
        </Row>
        {route && <Row label="Mensajero">{route.courier?.name ?? "Sin mensajero"}</Row>}
        <Row label="Lo tiene">{holderOf(shipment)}</Row>
      </Terms>
      {shipment.handover && (
        <HandoverBadge handover={shipment.handover} onResolved={onResolved} layout="box" />
      )}
    </DetailCard>
  );
}

function Destination({ shipment }: { shipment: ShipmentDetailData }) {
  const place = shipment.recipientNeighborhood
    ? `${shipment.recipientNeighborhood.name}, ${shipment.recipientNeighborhood.municipality}`
    : null;
  return (
    <DetailCard title={shipment.kind === "errand" ? "Diligencia" : "Destino"}>
      <Terms>
        <Row label="Descripción">{shipment.errandDescription}</Row>
        <Row label="Destinatario">{shipment.recipientName}</Row>
        <Row label="Teléfono">
          {shipment.recipientPhone && (
            <span className="tabular-nums">{shipment.recipientPhone}</span>
          )}
        </Row>
        <Row label="Dirección">{shipment.recipientAddress}</Row>
        <Row label={shipment.kind === "carrier_handoff" ? "Punto de entrega" : "Barrio"}>
          {place}
        </Row>
        <Row label="Transportadora">{shipment.carrier?.name}</Row>
        <Row label="Municipio de destino">{shipment.destinationTown}</Row>
        <Row label="Franja">
          {formatWindow(shipment.windowStart, shipment.windowEnd) ?? "Sin franja"}
        </Row>
        <Row label="Indicaciones">{shipment.instructions}</Row>
      </Terms>
    </DetailCard>
  );
}

function Origin({ shipment }: { shipment: ShipmentDetailData }) {
  const parcel = [
    shipment.packageSize && packageSizeLabels[shipment.packageSize],
    shipment.packageCount !== null &&
      `${String(shipment.packageCount)} ${shipment.packageCount === 1 ? "unidad" : "unidades"}`,
  ].filter(Boolean);
  return (
    <DetailCard title="Cliente y recogida">
      <Terms>
        <Row label="Cliente">{shipment.merchant.name}</Row>
        <Row label="Tipo">
          {shipmentKindLabels[shipment.kind]} · {serviceLevelLabels[shipment.serviceLevel]}
        </Row>
        <Row label="Recogida">
          {shipment.pickupAddress}, {shipment.pickupNeighborhood.name}
        </Row>
        <Row label="Fecha">{formatLongDate(shipment.serviceDate, bogotaToday(now()))}</Row>
        <Row label="Referencia">{shipment.merchantReference}</Row>
        <Row label="Paquete">{parcel.length > 0 && parcel.join(" · ")}</Row>
      </Terms>
    </DetailCard>
  );
}

/** The marks beside the state: the record flags, a return, the office, a handover, a fee. */
function tagsOf(shipment: ShipmentDetailData): [string, "warning" | "outline" | "tertiary"][] {
  const tags: [string, "warning" | "outline" | "tertiary"][] = [];
  if (shipment.returnDecided && shipment.status === "exception")
    tags.push(["Devolución en curso", "warning"]);
  if (shipment.heldAtOffice) tags.push(["En oficina", "outline"]);
  if (shipment.handover) tags.push(["Traspaso pendiente", "tertiary"]);
  if (shipment.feeNeedsReview) tags.push(["Tarifa por revisar", "warning"]);
  if (shipment.needsReview) tags.push(["Por revisar", "warning"]);
  for (const flag of shipment.recordFlags)
    if (flag !== "needs_review" || !shipment.needsReview)
      tags.push([recordFlagLabels[flag], "warning"]);
  return tags;
}

/**
 * A shipment with every recorded value and its history (FR-016), as the owner approved
 * "Detalle de envío" (feature 006): the tracking number, a sentence of what is left to know,
 * the state's main action first, then "Recorrido", destination and origin, the courier's
 * records, and one "Historial", with payment and custody in a sticky aside. As a `panel` it
 * fills the board's side panel (FR-019) in one column, whose header carries the tracking
 * number and state; `initialAction` opens the reassign dialog straight away.
 */
export function ShipmentDetail({
  shipment,
  variant = "page",
  initialAction,
}: {
  shipment: ShipmentDetailData;
  variant?: "page" | "panel";
  initialAction?: "reassign";
}) {
  const { user } = panelRoute.useRouteContext();
  const queryClient = useQueryClient();
  const [reassigning, setReassigning] = useState(initialAction === "reassign");
  async function copyTrackingLink() {
    try {
      const origin = publicOriginSchema.parse(import.meta.env.PUBLIC_BASE_URL);
      const trackingUrl = new URL(
        `/seguimiento/${encodeURIComponent(shipment.trackingCode)}`,
        origin,
      ).toString();
      await navigator.clipboard.writeText(trackingUrl);
      toast.success("Enlace de seguimiento copiado");
    } catch {
      toast.error(
        "No pudimos copiar el enlace de seguimiento. Revisa el permiso del portapapeles e inténtalo de nuevo.",
      );
    }
  }
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["shipment", shipment.trackingNumber] });
    await queryClient.invalidateQueries({ queryKey: ["routes-board"] });
    await queryClient.invalidateQueries({ queryKey: ["board"] });
  };
  // A shipment on a route can move to another one (feature 002, FR-014): a planned one with its
  // stops, or a picked-up one through a handover (DESIGN-1). Unlike the server, the detail does
  // not offer a package awaiting its return ("Novedad" with return decided) or one off-route.
  const movable =
    shipment.route !== null &&
    (canMoveBetweenRoutes(shipment.status) || shipment.status === "picked_up");
  const editable = isEditable(shipment.status);
  // The state's main action goes first, in slate (approved detail): the decision on a novelty,
  // editing until pickup, then reassigning a picked-up package.
  const primary =
    shipment.status === "exception" ? "decision" : editable ? "edit" : movable ? "reassign" : null;
  const reassign = movable && (
    <Button
      variant={primary === "reassign" ? "default" : "outline"}
      onClick={() => {
        setReassigning(true);
      }}
    >
      Reasignar
    </Button>
  );
  const actions = (
    <>
      {editable && (
        <Link
          to="/envios/$trackingNumber/editar"
          params={{ trackingNumber: shipment.trackingNumber }}
          className={buttonVariants()}
        >
          Editar
        </Link>
      )}
      {primary === "reassign" && reassign}
      <ExceptionActions shipment={shipment} primary={primary === "decision"} />
      {primary !== "reassign" && reassign}
      <ClearReviewDialog shipment={shipment} />
      <RecordOnBehalfDialog shipment={shipment} />
      {shipment.feeNeedsReview && user.role === "owner" && <ConfirmFeeDialog shipment={shipment} />}
      {(user.role === "owner" || user.role === "dispatcher") && (
        <Button
          variant="ghost"
          onClick={() => {
            void copyTrackingLink();
          }}
        >
          Copiar enlace de seguimiento
        </Button>
      )}
      {canVoid(shipment.status) && <VoidDialog shipment={shipment} />}
    </>
  );
  const tags = tagsOf(shipment).map(([text, tone]) => (
    <Badge key={text} variant={tone}>
      {text}
    </Badge>
  ));
  const sentence = <SummarySentence parts={detailSentence(shipment)} />;
  const records = (
    <ShipmentRecords records={shipment.records} attempts={shipment.attempts} shipment={shipment} />
  );
  const reassignDialog = reassigning && shipment.route && (
    <ReassignShipmentDialog
      shipment={shipment}
      fromRoute={shipment.route}
      onClose={() => {
        setReassigning(false);
      }}
      onReassigned={async ({ handover }, target) => {
        setReassigning(false);
        await refresh();
        toast.success(
          handover
            ? `Pasa a la Ruta ${String(target.number)}: queda «Traspaso pendiente» hasta que ${handover.toCourier.name} lo reciba`
            : `Reasignado a la Ruta ${String(target.number)}`,
        );
      }}
    />
  );

  if (variant === "panel")
    return (
      <div className="flex flex-col gap-4">
        {tags.length > 0 && <div className="flex flex-wrap items-center gap-2">{tags}</div>}
        {sentence}
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
        <Journey shipment={shipment} />
        <Payment shipment={shipment} />
        <Custody shipment={shipment} onResolved={refresh} />
        <Destination shipment={shipment} />
        <Origin shipment={shipment} />
        {records}
        <History shipment={shipment} />
        <Link
          to="/envios/$trackingNumber"
          params={{ trackingNumber: shipment.trackingNumber }}
          className="w-fit rounded-xs text-label-l text-on-surface underline decoration-outline-variant underline-offset-4 hover:decoration-current"
        >
          Abrir la página del envío
        </Link>
        {reassignDialog}
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link
          to="/"
          className="flex w-fit items-center gap-1 rounded-xs text-label-l text-on-surface-variant underline-offset-4 hover:text-on-surface hover:underline"
        >
          <Icon symbol={BackIcon} size={20} />
          Tablero
        </Link>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <h1 className="text-headline-l text-on-surface">
            <TrackingNumber value={shipment.trackingNumber} />
          </h1>
          <ShipmentStatusMark status={shipment.status} className="text-title-m" />
          {tags}
        </div>
        {sentence}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 max-[820px]:*:flex-auto">
          {actions}
        </div>
      </header>

      {/* On a phone both columns become one, with payment and custody right after "Recorrido". */}
      <div className="flex flex-wrap items-start gap-5 max-[820px]:flex-col max-[820px]:items-stretch max-[820px]:gap-4">
        <div className="flex min-w-0 flex-[999_1_36rem] flex-col gap-4 max-[820px]:contents">
          <Journey shipment={shipment} className="max-[820px]:-order-2" />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1100px]:grid-cols-2">
            <Destination shipment={shipment} />
            <Origin shipment={shipment} />
          </div>
          {records}
          <History shipment={shipment} />
        </div>
        <aside
          aria-label="Lo esencial del envío"
          className="sticky top-4 flex max-w-95 min-w-0 flex-[1_1_18.75rem] flex-col gap-4 max-[820px]:contents"
        >
          <Payment shipment={shipment} className="max-[820px]:-order-1" />
          <Custody shipment={shipment} onResolved={refresh} className="max-[820px]:-order-1" />
        </aside>
      </div>
      {reassignDialog}
    </div>
  );
}
