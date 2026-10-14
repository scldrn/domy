import CloudOffIcon from "@material-symbols/svg-400/rounded/cloud_off.svg?react";
import RouteIcon from "@material-symbols/svg-400/rounded/route.svg?react";
import { formatTrackingNumber, stopKindLabels, type CourierStop } from "@domy/domain";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/empty-state";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourierState } from "@/features/courier/courier-store";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

/** "Mi ruta": the courier's route in progress (feature 003, US1 scenarios 1 and 11, FR-005). */
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
        <EmptyState icon={RouteIcon} title="No podemos mostrar tu ruta" description={refusal} />
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
        <HeldOffRoute />
      </div>
    );
  }

  const next = route.stops.find((stop) => pendingOf(stop).length > 0);
  const done = route.stops.filter((stop) => pendingOf(stop).length === 0).length;
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-headline-s text-on-surface">Ruta {route.number}</h1>
        <p className="text-body-l text-on-surface-variant">
          {formatDate(route.serviceDate)} · {done} de {route.stops.length} paradas completadas
        </p>
      </header>
      <ol className="flex flex-col gap-3" aria-label="Paradas">
        {route.stops.map((stop, index) => {
          const pending = pendingOf(stop).length;
          const isNext = stop.id === next?.id;
          return (
            <li key={stop.id}>
              <Link
                to="/mensajero/parada/$stopId"
                params={{ stopId: stop.id }}
                aria-current={isNext ? "step" : undefined}
                className={cn(
                  "state-layer flex gap-4 rounded-md border bg-sheet p-4 text-on-surface",
                  isNext ? "border-2 border-primary" : "border-outline-variant",
                  pending === 0 && "bg-surface-container-low",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-title-m tabular-nums",
                    isNext
                      ? "bg-primary text-on-primary"
                      : "bg-secondary-container text-on-secondary-container",
                  )}
                >
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-title-m">{stopKindLabels[stop.kind]}</span>
                    {isNext && (
                      <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-label-m text-on-primary-container">
                        Siguiente
                      </span>
                    )}
                  </span>
                  <span className="text-body-l">{stop.address}</span>
                  {stop.neighborhood && (
                    <span className="text-body-m text-on-surface-variant">
                      {stop.neighborhood.name}
                    </span>
                  )}
                  <span className="text-body-m text-on-surface-variant">
                    {stop.tasks.length === 1 ? "1 envío" : `${String(stop.tasks.length)} envíos`}
                    {" · "}
                    {pending === 0
                      ? "Completada"
                      : pending === stop.tasks.length
                        ? "Pendiente"
                        : `${String(pending)} pendientes`}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <HeldOffRoute />
    </div>
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
