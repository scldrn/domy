import {
  formatTrackingNumber,
  shipmentKindLabels,
  shipmentStatuses,
  shipmentStatusLabels,
  type MerchantDay,
} from "@domy/domain";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import type { ShipmentStatus } from "@domy/domain";
import { formatCop, formatDate, formatWindow } from "@/lib/format";

type MerchantDateSelectorProps = {
  value: string;
  minDate: string;
  maxDate: string;
  onChange: (date: string | null) => void;
};

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
        className="min-h-12 w-full min-w-0 rounded-sm border border-outline bg-sheet px-3 text-body-l text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid"
      />
    </label>
  );
}

type MerchantShipmentListProps = {
  day: MerchantDay;
  selectedDate: string;
  minDate: string;
  maxDate: string;
  onDateChange: (date: string | null) => void;
  onOpenShipment: (shipmentId: string) => void;
};

function StatusTotals({ byStatus }: { byStatus: MerchantDay["totals"]["byStatus"] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {shipmentStatuses.map((status: ShipmentStatus) => (
        <div
          key={status}
          className="flex min-w-0 items-center justify-between gap-2 rounded-sm bg-surface-container-low p-3"
        >
          <dt className="text-body-s text-on-surface-variant">{shipmentStatusLabels[status]}</dt>
          <dd className="text-title-m tabular-nums">{byStatus[status]}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MerchantShipmentList({
  day,
  selectedDate,
  minDate,
  maxDate,
  onDateChange,
  onOpenShipment,
}: MerchantShipmentListProps) {
  const { totals } = day;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex min-w-0 flex-col gap-2">
        <h2 className="text-headline-m">{day.merchantName}</h2>
        <p className="text-body-m text-on-surface-variant">Envíos del {formatDate(day.date)}</p>
      </header>

      <MerchantDateSelector
        value={selectedDate}
        minDate={minDate}
        maxDate={maxDate}
        onChange={onDateChange}
      />

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="merchant-totals-heading">
        <h2 id="merchant-totals-heading" className="text-title-l">
          Totales del día
        </h2>
        <dl className="grid min-w-0 gap-3 rounded-md border border-outline-variant bg-sheet p-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-body-m text-on-surface-variant">Tarifas confirmadas</dt>
            <dd className="text-title-m tabular-nums">{formatCop(totals.confirmedFees)}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-body-m text-on-surface-variant">Tarifas por confirmar</dt>
            <dd className="text-title-m tabular-nums">{totals.feeToConfirmCount}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-body-m text-on-surface-variant">Valores por recaudar</dt>
            <dd className="text-title-m tabular-nums">{formatCop(totals.codToCollect)}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-body-m text-on-surface-variant">Recaudos recibidos</dt>
            <dd className="flex min-w-0 flex-col gap-1 text-body-m">
              <span>{`Efectivo: ${formatCop(totals.collectedByMethod.cash)}`}</span>
              <span>{`Transferencia a la empresa: ${formatCop(totals.collectedByMethod.companyTransfer)}`}</span>
              <span>{`Transferencia al cliente: ${formatCop(totals.collectedByMethod.merchantTransfer)}`}</span>
            </dd>
          </div>
        </dl>

        <h3 className="text-title-m">Envíos por estado</h3>
        <StatusTotals byStatus={totals.byStatus} />
      </section>

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="merchant-shipments-heading">
        <h2 id="merchant-shipments-heading" className="text-title-l">
          Envíos
        </h2>
        {day.shipments.length === 0 ? (
          <p
            className="rounded-md border border-outline-variant bg-surface-container-low p-4 text-body-l text-on-surface-variant"
            role="status"
          >
            No hay envíos para esta fecha.
          </p>
        ) : (
          <ul
            aria-label={`Envíos del ${formatDate(day.date)}`}
            className="flex min-w-0 flex-col gap-3"
          >
            {day.shipments.map((shipment) => {
              const window = shipment.window
                ? formatWindow(shipment.window.start, shipment.window.end)
                : null;
              return (
                <li
                  key={shipment.id}
                  className="min-w-0 overflow-hidden rounded-md border border-outline-variant bg-sheet"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onOpenShipment(shipment.id);
                    }}
                    className="state-layer flex min-h-12 w-full min-w-0 flex-col items-start gap-2 p-4 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid"
                  >
                    <span className="flex w-full min-w-0 items-start justify-between gap-3">
                      <span className="guia min-w-0 break-all text-title-m">
                        {formatTrackingNumber(shipment.trackingNumber)}
                      </span>
                      <ShipmentStatusMark status={shipment.status} />
                    </span>
                    <span className="min-w-0 wrap-anywhere text-body-l font-medium">
                      {shipment.recipientName ?? shipmentKindLabels[shipment.kind]}
                    </span>
                    <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-body-m text-on-surface-variant">
                      <span>{shipmentKindLabels[shipment.kind]}</span>
                      {shipment.merchantReference && (
                        <span>{`Referencia: ${shipment.merchantReference}`}</span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-body-m text-on-surface-variant">
                      {shipment.neighborhood && <span>{shipment.neighborhood}</span>}
                      {window && <span>{window}</span>}
                    </span>
                    <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-body-m">
                      <span>
                        Tarifa:{" "}
                        {shipment.feeToConfirm || shipment.fee === null
                          ? "Por confirmar"
                          : formatCop(shipment.fee)}
                      </span>
                      <span>{`Valor a recaudar: ${formatCop(shipment.codAmount)}`}</span>
                    </span>
                  </button>
                  <div className="border-t border-outline-variant px-4">
                    <a
                      href={shipment.trackingLink}
                      className="inline-flex min-h-12 items-center text-label-l text-primary underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid"
                    >
                      Abrir seguimiento
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
