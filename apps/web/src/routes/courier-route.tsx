import CheckCircleIcon from "@material-symbols/svg-400/rounded/check_circle.svg?react";
import ChevronRightIcon from "@material-symbols/svg-400/rounded/chevron_right.svg?react";
import CloudOffIcon from "@material-symbols/svg-400/rounded/cloud_off.svg?react";
import ErrorIcon from "@material-symbols/svg-400/rounded/error.svg?react";
import PackageIcon from "@material-symbols/svg-400/rounded/inventory_2.svg?react";
import RouteIcon from "@material-symbols/svg-400/rounded/route.svg?react";
import ScheduleIcon from "@material-symbols/svg-400/rounded/schedule.svg?react";
import {
  bogotaToday,
  flagLabel,
  formatTrackingNumber,
  shipmentFlag,
  stopKindLabels,
  type CourierStop,
} from "@domy/domain";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { StopTrack } from "@/components/stop-track";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourierState } from "@/features/courier/courier-store";
import { NoticeList, HandoversToGive } from "@/features/courier/notice-list";
import {
  courierRouteMarks,
  nextStop,
  stopState,
  type CourierStopState,
} from "@/features/courier/route-view";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatLongDate, formatWindow } from "@/lib/format";

/**
 * "Mi ruta": the courier's route in progress (feature 003, US1 scenarios 1 and 11, FR-005), as
 * approved in feature 006: the day and progress with the board's stop track, the next stop with
 * «Abrir parada» in lime, then every stop.
 */
export const Route = createFileRoute("/_courier/mensajero")({
  head: () => ({ meta: [{ title: "Mi ruta · Domy" }] }),
  component: CourierRoute,
});

const pendingOf = (stop: CourierStop) => stop.tasks.filter((task) => task.status === "pending");

function CourierRoute() {
  const { loaded, view, offline, refusal } = useCourierState();

  if (!view && refusal) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-headline-s text-on-surface">Mi ruta</h1>
        <EmptyState
          icon={RouteIcon}
          title="No podemos mostrar tu ruta"
          description="Revisa el aviso de arriba para saber cómo continuar."
        />
      </div>
    );
  }
  if (!loaded || (!view && !offline)) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <h1 className="text-headline-s text-on-surface">Mi ruta</h1>
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (!view) {
    // Never loaded and no signal (FR-022): the app retries by itself.
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-headline-s text-on-surface">Mi ruta</h1>
        <EmptyState
          icon={CloudOffIcon}
          title="Sin conexión"
          description="Tu ruta aún no se ha cargado en este teléfono. La cargaremos en cuanto haya señal."
        />
      </div>
    );
  }
  const route = view.route;
  if (!route) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-headline-s text-on-surface">Mi ruta</h1>
        <EmptyState
          icon={RouteIcon}
          title="No tienes una ruta despachada"
          description="Cuando el coordinador te despache una ruta, aparecerá aquí."
        />
        <NoticeList />
        <HandoversToGive />
        <HeldOffRoute />
      </div>
    );
  }

  const next = nextStop(route.stops);
  const done = route.stops.filter((stop) => stopState(stop) !== "pending").length;
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-headline-m text-on-surface">Ruta {route.number}</h1>
        <p className="text-body-l text-on-surface-variant">
          {formatLongDate(route.serviceDate, bogotaToday(now()))} ·{" "}
          <strong className="font-[650] text-on-surface">
            {done} de {route.stops.length} paradas
          </strong>{" "}
          completadas
        </p>
        <StopTrack
          marks={courierRouteMarks(route.stops)}
          next={next !== undefined}
          className="mt-2.5"
        />
      </header>
      <NoticeList />
      <HandoversToGive />
      {next && <NextStopCard stop={next} index={route.stops.indexOf(next)} />}
      <section aria-labelledby="paradas" className="flex flex-col gap-2.5">
        <h2 id="paradas" className="flex items-baseline gap-2 text-title-l text-on-surface">
          Paradas{" "}
          <span className="text-body-l text-on-surface-variant tabular-nums">
            {route.stops.length}
          </span>
        </h2>
        <ol
          className="overflow-hidden rounded-lg border border-outline-variant bg-sheet"
          aria-label="Paradas"
        >
          {route.stops.map((stop, index) => {
            const state = stopState(stop);
            const isNext = stop.id === next?.id;
            const pending = pendingOf(stop).length;
            return (
              <li key={stop.id} className="border-t border-outline-variant first:border-t-0">
                <Link
                  to="/mensajero/parada/$stopId"
                  params={{ stopId: stop.id }}
                  aria-current={isNext ? "step" : undefined}
                  className="state-layer grid min-h-18 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-accent-strong"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full text-title-s tabular-nums",
                      isNext
                        ? "bg-on-surface text-sheet"
                        : state === "done"
                          ? "bg-success-container text-on-success-container"
                          : state === "exception"
                            ? "bg-error-container text-on-error-container"
                            : "bg-secondary-container text-on-secondary-container",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={cn(
                        "truncate text-title-m",
                        state !== "pending" && "font-normal text-on-surface-variant",
                      )}
                    >
                      {stop.address}
                    </span>
                    <span className="text-body-m text-on-surface-variant">
                      <span>{stopKindLabels[stop.kind]}</span>
                      {stop.neighborhood && ` · ${stop.neighborhood.name}`}
                      {` · ${stop.tasks.length === 1 ? "1 envío" : `${String(stop.tasks.length)} envíos`}`}
                    </span>
                  </span>
                  <StopStateLabel
                    state={state}
                    next={isNext}
                    pending={pending}
                    total={stop.tasks.length}
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
      <HeldOffRoute />
    </div>
  );
}

/**
 * The next stop, large, with its one primary action in lime (approved app del mensajero); the
 * same stop also stays in the list, so its place in the route is never lost.
 */
function NextStopCard({ stop, index }: { stop: CourierStop; index: number }) {
  const first = pendingOf(stop).find((task) => task.windowStart ?? task.windowEnd);
  const window = first ? formatWindow(first.windowStart, first.windowEnd) : null;
  const flag = first
    ? shipmentFlag(
        {
          status: first.shipmentStatus,
          windowEnd: first.windowEnd ? new Date(first.windowEnd) : null,
        },
        now(),
      )
    : null;
  return (
    <Link
      to="/mensajero/parada/$stopId"
      params={{ stopId: stop.id }}
      className="flex flex-col gap-3 rounded-lg border-2 border-on-surface bg-sheet p-4 text-on-surface outline-none focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-label-l tracking-wide text-on-surface-variant uppercase">
          Siguiente · Parada {index + 1}
        </span>
        <span className="rounded-xs bg-secondary-container px-2.5 py-0.5 text-label-l text-on-secondary-container">
          {stopKindLabels[stop.kind]}
        </span>
      </span>
      <span className="flex flex-col">
        <span className="text-title-l">{stop.address}</span>
        {stop.neighborhood && (
          <span className="text-body-l text-on-surface-variant">{stop.neighborhood.name}</span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-body-m text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <Icon symbol={PackageIcon} size={20} />
          {stop.tasks.length === 1 ? "1 envío" : `${String(stop.tasks.length)} envíos`}
        </span>
        {window && (
          <span className="inline-flex items-center gap-1.5">
            <Icon symbol={ScheduleIcon} size={20} />
            {window}
          </span>
        )}
        {flag && (
          <span className={cn("font-[650]", flag.kind === "late" ? "text-error" : "text-warning")}>
            {flagLabel(flag)}
          </span>
        )}
      </span>
      <span className="flex min-h-14 items-center justify-center gap-2 rounded-md bg-accent text-title-m text-on-accent">
        Abrir parada
        <Icon symbol={ChevronRightIcon} />
      </span>
    </Link>
  );
}

/**
 * A stop's state in the list. The next stop keeps «Pendiente», in ink, under its dark number:
 * the card above already names it «Siguiente». A hidden comma keeps the state apart from the
 * row's facts when read aloud.
 */
function StopStateLabel({
  state,
  next,
  pending,
  total,
}: {
  state: CourierStopState;
  next: boolean;
  pending: number;
  total: number;
}) {
  if (state === "done")
    return (
      <span className="inline-flex items-center gap-1 text-label-l text-success">
        <span className="sr-only">, </span>
        <Icon symbol={CheckCircleIcon} size={20} />
        Completada
      </span>
    );
  if (state === "exception")
    return (
      <span className="inline-flex items-center gap-1 text-label-l text-error">
        <span className="sr-only">, </span>
        <Icon symbol={ErrorIcon} size={20} />
        Novedad
      </span>
    );
  return (
    <span className={cn("text-label-l", next ? "text-on-surface" : "text-on-surface-variant")}>
      <span className="sr-only">, </span>
      {pending === total
        ? "Pendiente"
        : `${String(pending)} ${pending === 1 ? "pendiente" : "pendientes"}`}
    </span>
  );
}

/** "En mi custodia": packages the courier holds on no route, for reference (FR-005, FR-031). */
function HeldOffRoute() {
  const { view } = useCourierState();
  const held = view?.heldOffRoute ?? [];
  if (held.length === 0) return null;
  return (
    <section aria-labelledby="en-mi-custodia" className="flex flex-col gap-2">
      <h2 id="en-mi-custodia" className="text-title-m text-on-surface">
        En mi custodia
      </h2>
      <ul className="flex flex-col divide-y divide-outline-variant rounded-md border border-outline-variant bg-sheet">
        {held.map((shipment) => (
          <li key={shipment.shipmentId} className="flex flex-col gap-1 px-4 py-3">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="guia text-title-m text-on-surface">
                {formatTrackingNumber(shipment.trackingNumber)}
              </span>
              <ShipmentStatusMark status={shipment.status} />
            </span>
            <span className="text-body-m text-on-surface-variant">
              {shipment.merchant.name}
              {shipment.recipientName ? ` · ${shipment.recipientName}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
