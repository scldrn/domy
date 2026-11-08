import { createFileRoute, Link } from "@tanstack/react-router";
import InfoIcon from "@material-symbols/svg-400/rounded/info.svg?react";
import TodayIcon from "@material-symbols/svg-400/rounded/today.svg?react";
import { bogotaToday, formatCop } from "@domy/domain";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourierState } from "@/features/courier/courier-store";
import { cashExplanation, daySentence } from "@/features/courier/day-view";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatLongDate } from "@/lib/format";

/**
 * "Mi día": the courier's summary of the day (feature 003, US7, FR-037), as approved in feature
 * 006: a sentence first, «Efectivo por entregar» as the large figure with how it is reached,
 * then the activity and the money by payment method.
 */
export const Route = createFileRoute("/_courier/mensajero/mi-dia")({
  head: () => ({ meta: [{ title: "Mi día · Domy" }] }),
  component: CourierDay,
});

const activity = [
  ["Entregas", "deliveries", "bg-success"],
  ["Novedades", "exceptions", "bg-error"],
  ["Devoluciones", "returns", "bg-tertiary"],
  ["Paradas pendientes", "pendingStops", "bg-outline"],
] as const;

const money = [
  ["Efectivo", "cash"],
  ["Transferencia a la empresa", "companyTransfer"],
  ["Transferencia al cliente", "merchantTransfer"],
  ["Pagos por cuenta del cliente", "disbursements"],
] as const;

function CourierDay() {
  const { loaded, view, offline, refusal, pendingRecords } = useCourierState();
  const summary = view?.summary;
  if (!summary)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-headline-m text-on-surface">Mi día</h1>
        {!loaded || (!offline && !refusal) ? (
          <div aria-busy="true" aria-label="Cargando resumen" className="flex flex-col gap-3">
            <Skeleton className="h-40" />
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
        )}
      </div>
    );

  const explanation = cashExplanation(summary);
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-label-l tracking-wide text-on-surface-variant uppercase">
          {formatLongDate(summary.date, bogotaToday(now()))}
        </p>
        <h1 className="text-headline-m text-on-surface">Mi día</h1>
        <p className="text-body-l text-on-surface-variant">
          {daySentence(summary).map((part, index) =>
            part.strong ? (
              <strong key={index} className="font-[650] text-on-surface">
                {part.text}
              </strong>
            ) : (
              part.text
            ),
          )}
        </p>
      </header>
      {pendingRecords > 0 && (
        <div className="flex gap-2.5 rounded-lg bg-warning-container px-3.5 pt-3 pb-1 text-body-m text-on-warning-container">
          <Icon symbol={InfoIcon} size={20} className="mt-0.5" />
          <div className="flex flex-col items-start">
            <p>
              Estos totales incluyen{" "}
              {pendingRecords === 1
                ? "1 registro que aún no llega"
                : `${String(pendingRecords)} registros que aún no llegan`}{" "}
              a despacho; pueden cambiar al sincronizar o si despacho corrige un registro.
            </p>
            {/* 48 px tall like every courier target (FR-038). */}
            <Link
              to="/mensajero/pendientes"
              className="flex min-h-12 items-center font-bold underline underline-offset-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              Ver pendientes
            </Link>
          </div>
        </div>
      )}
      <section
        aria-labelledby="my-day-cash"
        className="flex flex-col gap-1 rounded-lg border-2 border-on-surface bg-sheet px-4.5 pt-4.5 pb-4"
      >
        <dl className="flex flex-col gap-1">
          <dt
            id="my-day-cash"
            className="text-label-l tracking-wide text-on-surface-variant uppercase"
          >
            Efectivo por entregar
          </dt>
          <dd className="text-display-m text-on-surface tabular-nums">
            {formatCop(summary.cashToHandOver)}
          </dd>
        </dl>
        {explanation && <p className="text-body-l text-on-surface">{explanation}</p>}
        <p className="mt-1.5 border-t border-outline-variant pt-2.5 text-body-m text-on-surface-variant">
          Estimado hasta el cierre de caja.
        </p>
      </section>
      <section aria-labelledby="my-day-activity" className="flex flex-col gap-2.5">
        <h2 id="my-day-activity" className="text-title-l text-on-surface">
          Actividad
        </h2>
        <dl className="grid grid-cols-2 gap-2">
          {activity.map(([label, key, dot]) => (
            <div
              key={key}
              className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-outline-variant bg-sheet px-3.5 py-3"
            >
              <dt className="flex items-center gap-2 text-body-m text-on-surface-variant">
                <span aria-hidden="true" className={cn("size-2.5 flex-none rounded-full", dot)} />
                {label}
              </dt>
              <dd className="text-figure text-on-surface tabular-nums">{summary[key]}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="my-day-money" className="flex flex-col gap-2.5">
        <h2 id="my-day-money" className="text-title-l text-on-surface">
          Recaudos y pagos
        </h2>
        <div className="rounded-lg border border-outline-variant bg-sheet px-4">
          <dl className="divide-y divide-outline-variant">
            {money.map(([label, key]) => (
              <div
                key={key}
                className={cn(
                  "flex items-baseline justify-between gap-4 py-3",
                  key === "disbursements" && "border-t-2",
                )}
              >
                <dt className="min-w-0 text-body-l text-on-surface-variant">{label}</dt>
                <dd className="text-title-m whitespace-nowrap text-on-surface tabular-nums">
                  {formatCop(summary[key])}
                </dd>
              </div>
            ))}
          </dl>
          <p className="-mt-2 pb-3 text-body-m text-on-surface-variant">
            Los pagos por cuenta del cliente se descuentan del efectivo por entregar.
          </p>
        </div>
      </section>
    </div>
  );
}
