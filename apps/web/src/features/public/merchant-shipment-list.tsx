import OpenInNewIcon from "@material-symbols/svg-400/rounded/open_in_new.svg?react";
import {
  formatTrackingNumber,
  shipmentKindLabels,
  shipmentStatusLabels,
  type MerchantDay,
  type ShipmentStatus,
} from "@domy/domain";
import { useState } from "react";
import { DayStepper } from "@/components/day-stepper";
import { Icon } from "@/components/icon";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { merchantDaySentence, merchantStatusOrder } from "@/features/public/merchant-view";
import { cn } from "@/lib/cn";
import { formatCop, formatDate, formatWindow } from "@/lib/format";

type MerchantDateSelectorProps = {
  value: string;
  minDate: string;
  maxDate: string;
  onChange: (date: string | null) => void;
};

/** The plain date field, kept for the out-of-range error, where no day is loaded. */
export function MerchantDateSelector({
  value,
  minDate,
  maxDate,
  onChange,
}: MerchantDateSelectorProps) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-label-l">Fecha de los envíos</span>
      <input
        aria-label="Fecha de los envíos"
        type="date"
        min={minDate}
        max={maxDate}
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.value || null);
        }}
        className="min-h-12 w-full min-w-0 rounded-sm border border-outline bg-sheet px-3 text-body-l text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
      />
    </label>
  );
}

/** A state's color on the day's bar; the label next to it carries the meaning. */
const barTone: Record<ShipmentStatus, string> = {
  registered: "bg-outline",
  assigned: "bg-tertiary",
  dispatched: "bg-info",
  picked_up: "bg-info",
  delivered: "bg-success",
  exception: "bg-error",
  returned: "bg-warning",
  voided: "bg-outline-variant",
};

/** The merchant, the day as a sentence, and the day stepper (approved «Enlace del cliente»). */
export function MerchantDayHeader({
  day,
  today,
  minDate,
  maxDate,
  onDateChange,
}: {
  day: MerchantDay;
  today: string;
  minDate: string;
  maxDate: string;
  onDateChange: (date: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 className="text-headline-m wrap-anywhere">{day.merchantName}</h2>
        <p className="max-w-2xl text-body-l text-on-surface-variant">
          {merchantDaySentence(day, today).map((part, index) =>
            part.strong ? (
              <strong key={index} className="font-[650] text-on-surface">
                {part.text}
              </strong>
            ) : (
              part.text
            ),
          )}
        </p>
      </div>
      <DayStepper
        surface="public"
        label="Fecha de los envíos"
        date={day.date}
        today={today}
        min={minDate}
        max={maxDate}
        onChange={onDateChange}
      />
    </div>
  );
}

/** The day's states as a bar with its legend, then the money in three tiles. */
export function MerchantTotals({ day }: { day: MerchantDay }) {
  const { totals } = day;
  const states = merchantStatusOrder.filter((status) => totals.byStatus[status] > 0);
  const collected =
    totals.collectedByMethod.cash +
    totals.collectedByMethod.companyTransfer +
    totals.collectedByMethod.merchantTransfer;
  return (
    <section aria-labelledby="merchant-totals-heading" className="flex min-w-0 flex-col gap-4">
      <h2 id="merchant-totals-heading" className="sr-only">
        Totales del día
      </h2>
      {states.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {states.map((status) => (
              <span
                key={status}
                className={barTone[status]}
                style={{ flexGrow: totals.byStatus[status] }}
              />
            ))}
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-1.5">
            {states.map((status) => (
              <div key={status} className="flex items-center gap-1.5">
                <dt>
                  <ShipmentStatusMark status={status} />
                </dt>
                <dd className="text-title-s tabular-nums">{totals.byStatus[status]}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <dl className="grid min-w-0 gap-2.5 md:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-outline-variant bg-sheet px-4 py-3.5">
          <dt className="text-label-l text-on-surface-variant">Recaudos recibidos</dt>
          <dd className="flex flex-col gap-1">
            <span className="text-figure tabular-nums">{formatCop(collected)}</span>
            <span className="flex flex-col text-body-m text-on-surface-variant">
              <span>{`Efectivo: ${formatCop(totals.collectedByMethod.cash)}`}</span>
              <span>{`Transferencia a la empresa: ${formatCop(totals.collectedByMethod.companyTransfer)}`}</span>
              <span>{`Transferencia al cliente: ${formatCop(totals.collectedByMethod.merchantTransfer)}`}</span>
            </span>
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-outline-variant bg-sheet px-4 py-3.5">
          <dt className="text-label-l text-on-surface-variant">Valores por recaudar</dt>
          <dd className="text-figure tabular-nums">{formatCop(totals.codToCollect)}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-outline-variant bg-sheet px-4 py-3.5">
          <dt className="text-label-l text-on-surface-variant">Tarifas confirmadas</dt>
          <dd className="flex flex-col gap-1">
            <span className="text-figure tabular-nums">{formatCop(totals.confirmedFees)}</span>
            {totals.feeToConfirmCount > 0 && (
              <span className="text-body-m text-on-surface-variant">
                {totals.feeToConfirmCount === 1
                  ? "1 tarifa por confirmar"
                  : `${String(totals.feeToConfirmCount)} tarifas por confirmar`}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * Columns of a row on desktop, stacked as a card on phones: one list for both, so every
 * shipment exists once on the page.
 */
const rowLayout =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 [grid-template-areas:'guia_state''name_name''place_place''money_money'] lg:grid-cols-[7.5rem_minmax(0,1.3fr)_8.5rem_minmax(0,1.2fr)_7rem_7.5rem] lg:gap-x-4 lg:[grid-template-areas:'guia_name_state_place_fee_cod']";
/** Beside an open detail the row keeps guía, recipient, state, and what is left to collect. */
const compactRowLayout =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 [grid-template-areas:'guia_state''name_name''place_place''money_money'] lg:grid-cols-[7.5rem_minmax(0,1fr)_8.5rem_7.5rem] lg:gap-x-4 lg:[grid-template-areas:'guia_name_state_cod']";

export function MerchantShipmentList({
  day,
  openShipmentId,
  onOpenShipment,
}: {
  day: MerchantDay;
  openShipmentId: string | null;
  onOpenShipment: (shipmentId: string) => void;
}) {
  const [filter, setFilter] = useState<ShipmentStatus | null>(null);
  const compact = openShipmentId !== null;
  const layout = compact ? compactRowLayout : rowLayout;
  const wideOnly = compact && "lg:hidden";
  const states = merchantStatusOrder.filter((status) => day.totals.byStatus[status] > 0);
  const shown = filter
    ? day.shipments.filter((shipment) => shipment.status === filter)
    : day.shipments;
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="merchant-shipments-heading">
      <h2
        id="merchant-shipments-heading"
        className="flex items-baseline gap-2 text-title-l text-on-surface"
      >
        Envíos{" "}
        <span className="text-body-l text-on-surface-variant tabular-nums">
          {day.shipments.length}
        </span>
      </h2>
      {day.shipments.length === 0 ? (
        <p
          className="rounded-lg border border-outline-variant bg-sheet p-4 text-body-l text-on-surface-variant"
          role="status"
        >
          No hay envíos para esta fecha.
        </p>
      ) : (
        <>
          {states.length > 1 && (
            <div
              role="group"
              aria-label="Filtrar por estado"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5"
            >
              {[null, ...states].map((status) => {
                const pressed = filter === status;
                return (
                  <button
                    key={status ?? "all"}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => {
                      setFilter(status);
                    }}
                    className={cn(
                      "state-layer inline-flex min-h-12 flex-none items-center gap-2 rounded-full border px-4 text-label-l outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-accent-strong",
                      pressed
                        ? "border-on-surface bg-on-surface text-sheet"
                        : "border-outline bg-sheet text-on-surface",
                    )}
                  >
                    {status ? shipmentStatusLabels[status] : "Todos"}
                    <span
                      className={cn(
                        "tabular-nums",
                        pressed ? "opacity-75" : "text-on-surface-variant",
                      )}
                    >
                      {status ? day.totals.byStatus[status] : day.shipments.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="overflow-hidden rounded-lg border border-outline-variant bg-sheet">
            <div
              aria-hidden="true"
              className={cn(
                layout,
                "hidden border-b border-outline-variant py-3 pr-16 pl-4 text-label-m text-on-surface-variant lg:grid",
              )}
            >
              <span className="[grid-area:guia]">Guía</span>
              <span className="[grid-area:name]">Destinatario</span>
              <span className="[grid-area:state]">Estado</span>
              <span className={cn("[grid-area:place]", wideOnly)}>Barrio · franja</span>
              <span className={cn("text-right [grid-area:fee]", wideOnly)}>Tarifa</span>
              <span className="text-right [grid-area:cod]">Por recaudar</span>
            </div>
            <ul aria-label={`Envíos del ${formatDate(day.date)}`} className="min-w-0">
              {shown.map((shipment) => {
                const window = shipment.window
                  ? formatWindow(shipment.window.start, shipment.window.end)
                  : null;
                const tracking = formatTrackingNumber(shipment.trackingNumber);
                const open = shipment.id === openShipmentId;
                const fee =
                  shipment.feeToConfirm || shipment.fee === null
                    ? "Por confirmar"
                    : formatCop(shipment.fee);
                return (
                  <li
                    key={shipment.id}
                    className={cn(
                      "flex min-w-0 items-stretch border-t border-outline-variant first:border-t-0",
                      open && "bg-sheet-alt",
                    )}
                  >
                    <button
                      type="button"
                      aria-current={open ? "true" : undefined}
                      onClick={() => {
                        onOpenShipment(shipment.id);
                      }}
                      className={cn(
                        layout,
                        "state-layer min-h-12 w-full min-w-0 flex-1 px-4 py-3.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-accent-strong lg:items-start lg:py-3",
                      )}
                    >
                      <span className="guia text-title-s [grid-area:guia]">{tracking}</span>
                      <span className="justify-self-end [grid-area:state] lg:justify-self-start">
                        <ShipmentStatusMark status={shipment.status} />
                      </span>
                      <span className="flex min-w-0 flex-col [grid-area:name]">
                        <span className="text-title-m wrap-anywhere">
                          {shipment.recipientName ?? shipmentKindLabels[shipment.kind]}
                        </span>
                        {shipment.merchantReference && (
                          <span className="text-body-m text-on-surface-variant wrap-anywhere">
                            {`Referencia: ${shipment.merchantReference}`}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "flex min-w-0 flex-wrap gap-x-1.5 text-body-m text-on-surface-variant [grid-area:place] lg:flex-col lg:text-on-surface",
                          wideOnly,
                        )}
                      >
                        <span>{shipment.neighborhood ?? "Sin barrio"}</span>
                        <span aria-hidden="true" className="lg:hidden">
                          ·
                        </span>
                        <span className="lg:text-on-surface-variant">{window ?? "Sin franja"}</span>
                      </span>
                      <span className="flex flex-wrap gap-x-3.5 text-body-m text-on-surface-variant [grid-area:money] lg:contents">
                        <span
                          className={cn(
                            "lg:text-right lg:text-body-m lg:text-on-surface lg:[grid-area:fee]",
                            wideOnly,
                          )}
                        >
                          <span className="lg:sr-only">Tarifa </span>
                          <b className="font-[650] text-on-surface lg:font-normal">{fee}</b>
                        </span>
                        <span className="lg:text-right lg:text-body-m lg:text-on-surface lg:[grid-area:cod]">
                          <span className="lg:sr-only">Por recaudar </span>
                          <b className="font-[650] text-on-surface lg:font-normal">
                            {formatCop(shipment.codAmount)}
                          </b>
                        </span>
                      </span>
                    </button>
                    <a
                      href={shipment.trackingLink}
                      aria-label={`Abrir seguimiento de ${tracking}`}
                      className="state-layer my-1.5 mr-2 hidden size-12 flex-none items-center justify-center rounded-md text-on-surface-variant outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-accent-strong lg:flex"
                    >
                      <Icon symbol={OpenInNewIcon} size={20} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
