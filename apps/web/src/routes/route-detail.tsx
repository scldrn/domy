import RouteIcon from "@material-symbols/svg-400/rounded/route.svg?react";
import { bogotaToday, formatTrackingNumber, type RouteDetail, type RouteTask } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RouteStatusMark } from "@/components/route-status-mark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddShipmentsDialog } from "@/features/routes/add-shipments-dialog";
import { CourierSelect } from "@/features/routes/courier-select";
import { HandoverBadge } from "@/features/routes/handover-badge";
import { ReassignRouteDialog, ReassignShipmentDialog } from "@/features/routes/reassign-dialog";
import { RouteHistory } from "@/features/routes/route-history";
import { CancelRouteDialog, UndoDispatchDialog } from "@/features/routes/route-reason-dialog";
import { StopList } from "@/features/routes/stop-list";
import {
  dispatchRoute,
  getRoute,
  removeRouteShipment,
  setRouteCourier,
  setStopOrder,
} from "@/features/routes/api";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";
import { formatCop, formatLongDate } from "@/lib/format";

export const Route = createFileRoute("/_panel/rutas/$routeId")({
  head: () => ({ meta: [{ title: "Ruta · Domy" }] }),
  component: RouteDetailPage,
});

/**
 * One route: stops in order, courier, dispatch, shipments added, removed, and reassigned,
 * handovers, undoing and cancelling, and history (FR-006–FR-009, FR-011, FR-012, FR-014,
 * FR-015, FR-017, FR-019, FR-025, FR-026).
 */
function RouteDetailPage() {
  const { routeId } = Route.useParams();
  const queryClient = useQueryClient();
  const queryKey = ["route", routeId];
  const route = useQuery({ queryKey, queryFn: () => getRoute(routeId), refetchInterval: 20_000 });
  const [problem, setProblem] = useState<{ message: string; routeId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reassigning, setReassigning] = useState<RouteTask | null>(null);

  /** Reloads the route after a change made through a shipment or a handover. */
  async function refresh() {
    await route.refetch();
    await queryClient.invalidateQueries({ queryKey: ["routes-board"] });
  }

  async function showUpdated(updated: RouteDetail) {
    queryClient.setQueryData(queryKey, updated);
    await queryClient.invalidateQueries({ queryKey: ["routes-board"] });
    await queryClient.invalidateQueries({ queryKey: ["unassigned"] });
  }

  /** Runs a route action with a new action identifier and the version on screen. */
  async function act(action: (current: RouteDetail, actionId: string) => Promise<RouteDetail>) {
    if (!route.data) return;
    setProblem(null);
    setBusy(true);
    try {
      const updated = await action(route.data, crypto.randomUUID());
      await showUpdated(updated);
      return updated;
    } catch (error) {
      // The latest version replaces anything shown before the refusal (FR-021).
      await route.refetch();
      setProblem({
        message: error instanceof ApiError ? error.message : "No pudimos guardar el cambio.",
        ...(error instanceof ApiError &&
          typeof error.details["routeId"] === "string" && { routeId: error.details["routeId"] }),
      });
    } finally {
      setBusy(false);
    }
  }

  if (route.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-label="Cargando la ruta">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-72 w-full rounded-md" />
      </div>
    );
  }
  if (route.isError) {
    return (
      <p
        role="alert"
        className="rounded-sm bg-error-container p-4 text-body-l text-on-error-container"
      >
        {route.error.message}
      </p>
    );
  }
  const data = route.data;
  const editable = data.status === "draft" || data.status === "in_progress";

  /** Remove, reassign, or resolve the handover of a shipment at a stop (FR-012, FR-014, FR-025). */
  function taskActions(task: RouteTask) {
    if (task.blockedByHandoverId) {
      const handover = data.handovers.find((each) => each.id === task.blockedByHandoverId);
      return handover && <HandoverBadge handover={handover} onResolved={refresh} />;
    }
    if (!editable || task.kind === "pickup" || task.status !== "pending") return null;
    const guide = formatTrackingNumber(task.shipment.trackingNumber);
    const notPickedUp =
      task.shipment.status === "assigned" || task.shipment.status === "dispatched";
    return (
      <>
        {(notPickedUp || task.shipment.status === "picked_up") && (
          <Button
            variant="ghost"
            size="sm"
            className="-my-3"
            disabled={busy}
            aria-label={`Reasignar ${guide}`}
            onClick={() => {
              setReassigning(task);
            }}
          >
            Reasignar
          </Button>
        )}
        {notPickedUp && (
          <Button
            variant="ghost"
            size="sm"
            className="-my-3"
            disabled={busy}
            aria-label={`Quitar ${guide} de la ruta`}
            onClick={() => {
              void act((current, actionId) =>
                removeRouteShipment(current.id, task.shipmentId, {
                  actionId,
                  version: current.version,
                }),
              ).then((updated) => {
                if (updated) toast.success(`${guide} quitado de la ruta`);
              });
            }}
          >
            Quitar
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Ruta ${String(data.number)}`}
        description={`${formatLongDate(data.serviceDate, bogotaToday(now()))} · ${data.courier?.name ?? "Sin mensajero"}`}
        actions={
          data.status === "in_progress" ? (
            <>
              <UndoDispatchDialog
                route={data}
                disabled={busy}
                onDone={async (updated) => {
                  await showUpdated(updated);
                  toast.success(`Ruta ${String(updated.number)} de nuevo en preparación`);
                }}
                onRefused={() => route.refetch()}
              />
              <ReassignRouteDialog
                route={data}
                disabled={busy}
                onReassigned={async (updated) => {
                  await showUpdated(updated);
                  toast.success(
                    `Ruta ${String(updated.number)} reasignada a ${updated.courier?.name ?? ""}`,
                  );
                }}
              />
            </>
          ) : (
            data.status === "draft" && (
              <>
                <CancelRouteDialog
                  route={data}
                  disabled={busy}
                  onDone={async (updated) => {
                    await showUpdated(updated);
                    toast.success(`Ruta ${String(updated.number)} cancelada`);
                  }}
                  onRefused={() => route.refetch()}
                />
                <Button
                  disabled={busy}
                  onClick={() =>
                    void act((current, actionId) =>
                      dispatchRoute(current.id, { actionId, version: current.version }),
                    ).then((updated) => {
                      if (updated) toast.success(`Ruta ${String(updated.number)} despachada`);
                    })
                  }
                >
                  Despachar
                </Button>
              </>
            )
          )
        }
      >
        <RouteStatusMark status={data.status} />
      </PageHeader>

      {problem && (
        <p
          role="alert"
          className="rounded-sm bg-error-container p-3 text-body-m text-on-error-container"
        >
          {problem.message}{" "}
          {problem.routeId && (
            <Link to="/rutas/$routeId" params={{ routeId: problem.routeId }} className="underline">
              Ver esa ruta
            </Link>
          )}
        </p>
      )}

      {/* The route editor in the supporting pane layout (design-system.md §5); the summary,
          with the courier, comes first when the panes stack. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          aria-labelledby="summary-title"
          className="flex flex-col gap-4 rounded-md border border-outline-variant bg-sheet p-6 xl:sticky xl:top-6 xl:col-start-2 xl:row-start-1"
        >
          <h2 id="summary-title" className="text-title-m text-on-surface">
            Resumen
          </h2>
          <CourierSelect
            value={data.courier}
            disabled={data.status !== "draft" || busy}
            onChange={(courier) =>
              void act((current, actionId) =>
                setRouteCourier(current.id, {
                  actionId,
                  version: current.version,
                  courierId: courier.id,
                }),
              )
            }
          />
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="text-body-m text-on-surface-variant">Paradas completadas</dt>
              <dd className="text-title-m text-on-surface tabular-nums">
                {data.progress.completed} de {data.progress.total}
              </dd>
            </div>
            <div>
              <dt className="text-body-m text-on-surface-variant">Valor a recaudar</dt>
              <dd className="text-title-m text-on-surface tabular-nums">
                {formatCop(data.codToCollect)}
              </dd>
            </div>
          </dl>
        </section>
        <section
          aria-labelledby="stops-title"
          className="flex min-w-0 flex-col gap-3 xl:col-start-1 xl:row-start-1"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-72 flex-1">
              <h2
                id="stops-title"
                className="flex items-baseline gap-2 text-title-m text-on-surface"
              >
                Paradas
                <span className="text-body-l text-on-surface-variant tabular-nums">
                  {data.stops.length}
                </span>
              </h2>
              {editable && data.stops.length > 0 && (
                <p className="text-body-m text-on-surface-variant">
                  El orden es una recomendación para el mensajero. Arrastra una parada, o usa su
                  botón con el teclado, para cambiarlo.
                </p>
              )}
            </div>
            {editable && (
              <AddShipmentsDialog
                route={data}
                disabled={busy}
                onAdded={async (updated, count) => {
                  await showUpdated(updated);
                  toast.success(
                    `${count === 1 ? "1 envío agregado" : `${String(count)} envíos agregados`} a la Ruta ${String(updated.number)}`,
                  );
                }}
                onRefused={() => route.refetch()}
              />
            )}
          </div>
          {data.stops.length === 0 ? (
            // A cancelled route, or one left without shipments (EC-08, FR-027).
            <EmptyState
              icon={RouteIcon}
              title={data.status === "cancelled" ? "Ruta cancelada" : "La ruta no tiene envíos"}
              description={
                data.status === "cancelled"
                  ? `Motivo: ${(data.cancelReason ?? "").replace(/[.\s]+$/, "")}. Sus envíos volvieron a «Sin asignar».`
                  : editable
                    ? "Agrega envíos o cancela la ruta."
                    : "Sus envíos se quitaron o se reasignaron."
              }
            />
          ) : (
            <StopList
              stops={data.stops}
              locked={!editable || busy}
              onInvalid={(message) => {
                setProblem({ message });
              }}
              taskActions={taskActions}
              onReorder={(stopIds) => {
                // Show the new order at once; the server's answer replaces it.
                queryClient.setQueryData(queryKey, {
                  ...data,
                  stops: stopIds.flatMap((id) => data.stops.filter((stop) => stop.id === id)),
                });
                void act((current, actionId) =>
                  setStopOrder(current.id, { actionId, version: current.version, stopIds }),
                );
              }}
            />
          )}
        </section>
      </div>

      {reassigning && (
        <ReassignShipmentDialog
          key={reassigning.id}
          shipment={{
            id: reassigning.shipmentId,
            trackingNumber: reassigning.shipment.trackingNumber,
            status: reassigning.shipment.status,
          }}
          fromRoute={data}
          onClose={() => {
            setReassigning(null);
          }}
          onReassigned={async ({ handover }, target) => {
            const guide = formatTrackingNumber(reassigning.shipment.trackingNumber);
            setReassigning(null);
            await refresh();
            toast.success(
              handover
                ? `${guide} pasa a la Ruta ${String(target.number)}: queda «Traspaso pendiente» hasta que ${handover.toCourier.name} lo reciba`
                : `${guide} reasignado a la Ruta ${String(target.number)}`,
            );
          }}
        />
      )}

      <RouteHistory events={data.events} />
    </div>
  );
}
