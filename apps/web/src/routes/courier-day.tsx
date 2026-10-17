import { createFileRoute } from "@tanstack/react-router";
import TodayIcon from "@material-symbols/svg-400/rounded/today.svg?react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourierState } from "@/features/courier/courier-store";
import { formatCop, formatDate } from "@/lib/format";

/** "Mi día": the courier's summary of the day (feature 003, US7, FR-037). */
export const Route = createFileRoute("/_courier/mensajero/mi-dia")({
  head: () => ({ meta: [{ title: "Mi día · Domy" }] }),
  component: CourierDay,
});

function CourierDay() {
  const { loaded, view, offline, refusal, pendingRecords } = useCourierState();
  const summary = view?.summary;
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-headline-s text-on-surface">Mi día</h1>
        {summary && (
          <p className="text-body-l text-on-surface-variant">{formatDate(summary.date)}</p>
        )}
      </header>
      {!summary ? (
        !loaded || (!offline && !refusal) ? (
          <div aria-busy="true" aria-label="Cargando resumen" className="flex flex-col gap-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-48" />
          </div>
        ) : (
          <EmptyState
            icon={TodayIcon}
            title="Tu resumen aún no está disponible"
            description={
              refusal
                ? "Revisa el aviso de arriba para saber cómo continuar. Tus registros pendientes siguen guardados."
                : "Conéctate para cargar tu resumen. Tus registros pendientes siguen guardados en este teléfono."
            }
          />
        )
      ) : (
        <>
          <p className="text-body-m text-on-surface-variant">
            Estimado hasta el cierre de caja. Incluye tus registros pendientes por sincronizar.
          </p>
          {pendingRecords > 0 && (
            <p className="rounded-sm bg-warning-container p-3 text-body-m text-on-warning-container">
              Los totales pueden cambiar al sincronizar o si despacho corrige un registro.
            </p>
          )}
          <dl className="rounded-md bg-primary-container p-4 text-on-primary-container">
            <div className="flex flex-col gap-1">
              <dt className="text-title-m">Efectivo por entregar</dt>
              <dd className="text-headline-m tabular-nums">{formatCop(summary.cashToHandOver)}</dd>
            </div>
          </dl>
          <section aria-labelledby="my-day-activity" className="flex flex-col gap-2">
            <h2 id="my-day-activity" className="text-title-m text-on-surface">
              Actividad
            </h2>
            <dl className="grid grid-cols-2 gap-3 rounded-md border border-outline-variant bg-sheet p-4">
              {(
                [
                  ["Entregas", summary.deliveries],
                  ["Novedades", summary.exceptions],
                  ["Devoluciones", summary.returns],
                  ["Paradas pendientes", summary.pendingStops],
                ] as const
              ).map(([label, count]) => (
                <div key={label} className="flex min-w-0 flex-col gap-1">
                  <dt className="text-body-m text-on-surface-variant">{label}</dt>
                  <dd className="text-headline-s text-on-surface tabular-nums">{count}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="my-day-money" className="flex flex-col gap-2">
            <h2 id="my-day-money" className="text-title-m text-on-surface">
              Recaudos y pagos
            </h2>
            <dl className="divide-y divide-outline-variant rounded-md border border-outline-variant bg-sheet px-4">
              {(
                [
                  ["Efectivo", summary.cash],
                  ["Transferencia a la empresa", summary.companyTransfer],
                  ["Transferencia al cliente", summary.merchantTransfer],
                  ["Pagos por cuenta del cliente", summary.disbursements],
                ] as const
              ).map(([label, amount]) => (
                <div
                  key={label}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
                >
                  <dt className="min-w-0 text-body-l text-on-surface-variant">{label}</dt>
                  <dd className="text-title-m text-on-surface tabular-nums">{formatCop(amount)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
