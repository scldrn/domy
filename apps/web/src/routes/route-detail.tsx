import RouteIcon from "@material-symbols/svg-400/rounded/route.svg?react";
import { bogotaToday, formatTrackingNumber, type RouteDetail, type RouteTask } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import BackIcon from "@material-symbols/svg-400/rounded/chevron_left.svg?react";
import { DetailCard } from "@/components/detail-card";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { RouteStatusMark } from "@/components/route-status-mark";
import { StopTrack } from "@/components/stop-track";
import { SummarySentence } from "@/components/summary-sentence";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddShipmentsDialog } from "@/features/routes/add-shipments-dialog";
import { CourierSelect } from "@/features/routes/courier-select";
import { HandoverBadge } from "@/features/routes/handover-badge";
import { ReassignRouteDialog, ReassignShipmentDialog } from "@/features/routes/reassign-dialog";
import { RouteHistory } from "@/features/routes/route-history";
import { routeMarks, routeSentence, stopStates } from "@/features/routes/route-sentences";
import { CancelRouteDialog, UndoDispatchDialog } from "@/features/routes/route-reason-dialog";
import { StopList } from "@/features/routes/stop-list";
import {
  dispatchRoute,
  getRoute,
  joinRoute,
  removeRouteShipment,
  setRouteCourier,
  setStopOrder,
} from "@/features/routes/api";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";
import { formatCop, formatDateTime, formatTime } from "@/lib/format";

export const Route = createFileRoute("/_panel/rutas/$routeId")({
  head: () => ({ meta: [{ title: "Ruta · Domy" }] }),
  // A page per route: a refusal or a dialog of one route never shows on the next one.
  component: function RoutePage() {
    return <RouteDetailPage key={Route.useParams().routeId} />;
  },
});

/**
 * One route as the owner approved «Detalle de ruta» (feature 006): stops in order, courier, dispatch, shipments added, removed, and reassigned,
 * handovers, undoing and cancelling, and history (FR-006–FR-009, FR-011, FR-012, FR-014,
 * FR-015, FR-017, FR-019, FR-025, FR-026).
 */
function RouteDetailPage() {
  const { routeId } = Route.useParams();
  const queryClient = useQueryClient();
  const queryKey = ["route", routeId];
  const route = useQuery({ queryKey, queryFn: () => getRoute(routeId), refetchInterval: 20_000 });
  const navigate = useNavigate();
  const [problem, setProblem] = useState<{
    message: string;
    routeId?: string;
    routeNumber?: number;
    /** The join beyond 15 shipments waits for this confirmation (FR-005). */
    confirmJoin?: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reassigning, setReassigning] = useState<RouteTask | null>(null);
  const shipmentCount = new Set(
    route.data?.stops.flatMap((stop) => stop.tasks.map((task) => task.shipmentId)),
  ).size;

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
        ...(error instanceof ApiError &&
          typeof error.details["routeNumber"] === "number" && {
            routeNumber: error.details["routeNumber"],
          }),
      });
    } finally {
      setBusy(false);
    }
  }

  /**
   * The courier already has a route in progress: this route's shipments join it, and this
   * route, left empty, is cancelled (FR-009, US1 scenario 5).
   */
  async function join(target: { id: string; number: number }, confirmed: boolean) {
    if (!route.data) return;
    setBusy(true);
    try {
      await joinRoute(route.data.id, {
        actionId: crypto.randomUUID(),
        version: route.data.version,
        toRouteId: target.id,
        confirmed,
      });
      await queryClient.invalidateQueries({ queryKey: ["routes-board"] });
      toast.success(
        `${shipmentCount === 1 ? "Envío agregado" : `${String(shipmentCount)} envíos agregados`} a la Ruta ${String(target.number)}; la Ruta ${String(route.data.number)} quedó cancelada`,
      );
      await navigate({ to: "/rutas/$routeId", params: { routeId: target.id } });
    } catch (error) {
      await route.refetch();
      setProblem({
        message: error instanceof ApiError ? error.message : "No pudimos agregar los envíos.",
        routeId: target.id,
        routeNumber: target.number,
        ...(error instanceof ApiError &&
          error.code === "confirmation_required" && { confirmJoin: true }),
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

  const states = stopStates(data);
  const marks = routeMarks(data);
  const deliveries = data.stops.flatMap((stop) =>
    stop.tasks.filter((task) => task.kind !== "pickup"),
  );
  const handovers = data.handovers.filter((handover) => handover.status === "pending").length;
  const today = bogotaToday(now());
  /** "a las 9:03 a. m." on the route's day, "el 2 nov 2026, 9:03 a. m." on any other. */
  const when = (instant: string) =>
    bogotaToday(new Date(instant)) === data.serviceDate
      ? `a las ${formatTime(instant)}`
      : `el ${formatDateTime(instant)}`;
  /** Ends a sentence once: a time already ends in "p. m.". */
  const closed = (text: string) => (text.endsWith(".") ? text : `${text}.`);
  const actions =
    data.status === "in_progress" ? (
      <>
        <AddShipmentsDialog
          route={data}
          disabled={busy}
          onAdded={onAdded}
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
        <UndoDispatchDialog
          route={data}
          disabled={busy}
          onDone={async (updated) => {
            await showUpdated(updated);
            toast.success(`Ruta ${String(updated.number)} de nuevo en preparación`);
          }}
          onRefused={() => route.refetch()}
        />
      </>
    ) : data.status === "draft" ? (
      <>
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
        <AddShipmentsDialog
          route={data}
          disabled={busy}
          onAdded={onAdded}
          onRefused={() => route.refetch()}
        />
        <CancelRouteDialog
          route={data}
          disabled={busy}
          onDone={async (updated) => {
            await showUpdated(updated);
            toast.success(`Ruta ${String(updated.number)} cancelada`);
          }}
          onRefused={() => route.refetch()}
        />
      </>
    ) : null;

  async function onAdded(updated: RouteDetail, count: number) {
    await showUpdated(updated);
    toast.success(
      `${count === 1 ? "1 envío agregado" : `${String(count)} envíos agregados`} a la Ruta ${String(updated.number)}`,
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link
          to="/rutas"
          search={data.serviceDate === today ? {} : { date: data.serviceDate }}
          className="flex w-fit items-center gap-1 rounded-xs text-label-l text-on-surface-variant underline-offset-4 hover:text-on-surface hover:underline"
        >
          <Icon symbol={BackIcon} size={20} />
          Rutas
        </Link>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <h1 className="text-headline-l text-on-surface">Ruta {data.number}</h1>
          <RouteStatusMark status={data.status} className="text-title-m" />
          {handovers > 0 && (
            <Badge variant="tertiary">
              {handovers === 1
                ? "1 traspaso pendiente"
                : `${String(handovers)} traspasos pendientes`}
            </Badge>
          )}
        </div>
        <SummarySentence parts={routeSentence(data, today)} />
        {actions && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 max-[820px]:*:flex-auto">
            {actions}
          </div>
        )}
      </header>

      {problem && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm bg-error-container p-3 text-body-m text-on-error-container"
        >
          <p className="min-w-60 flex-1">
            {problem.message}{" "}
            {problem.routeId && (
              <Link
                to="/rutas/$routeId"
                params={{ routeId: problem.routeId }}
                className="underline"
              >
                Ver esa ruta
              </Link>
            )}
          </p>
          {problem.routeId &&
            problem.routeNumber !== undefined &&
            data.status === "draft" &&
            shipmentCount > 0 && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (problem.routeId && problem.routeNumber !== undefined) {
                    void join(
                      { id: problem.routeId, number: problem.routeNumber },
                      problem.confirmJoin === true,
                    );
                  }
                }}
              >
                {problem.confirmJoin
                  ? "Agregar de todos modos"
                  : shipmentCount === 1
                    ? `Agregar el envío a la Ruta ${String(problem.routeNumber)}`
                    : `Agregar los ${String(shipmentCount)} envíos a la Ruta ${String(problem.routeNumber)}`}
              </Button>
            )}
        </div>
      )}

      {/* The stops beside the courier and the progress (approved «Detalle de ruta»); on a phone
          the courier and the progress come first. */}
      <div className="flex flex-wrap items-start gap-5 max-[820px]:flex-col max-[820px]:items-stretch max-[820px]:gap-4">
        <div className="flex min-w-0 flex-[999_1_36rem] flex-col gap-4 max-[820px]:contents">
          <DetailCard title="Paradas" count={data.stops.length}>
            {editable && data.stops.length > 0 && (
              <p className="-mt-1 text-body-m text-on-surface-variant">
                El orden es una recomendación para el mensajero. Arrastra una parada, o usa su botón
                con el teclado, para cambiarlo.
              </p>
            )}
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
                states={states}
                locked={!editable || busy}
                reorderable={editable}
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
          </DetailCard>
          <RouteHistory events={data.events} />
        </div>

        <aside
          aria-label="Lo esencial de la ruta"
          className="sticky top-4 flex max-w-95 min-w-0 flex-[1_1_18.75rem] flex-col gap-4 max-[820px]:contents"
        >
          <DetailCard title="Mensajero" className="max-[820px]:-order-1">
            <CourierSelect
              hideLabel
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
            <p className="text-body-s text-on-surface-variant">
              {data.status === "draft"
                ? "Lo puedes cambiar hasta despacharla. Al despacharla, la ruta aparece en su celular."
                : data.status === "in_progress"
                  ? "Al reasignar la ruta, los paquetes que ya recogió quedan en traspaso hasta que el otro mensajero los reciba."
                  : "La ruta ya no admite cambios de mensajero."}
            </p>
          </DetailCard>
          <DetailCard title="Avance" className="max-[820px]:-order-1">
            {marks.length > 0 && <StopTrack marks={marks} next={data.status === "in_progress"} />}
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-body-m">
              <dt className="text-on-surface-variant">Paradas completadas</dt>
              <dd className="text-right font-semibold tabular-nums">
                {data.progress.completed} de {data.progress.total}
              </dd>
              <dt className="text-on-surface-variant">Entregados</dt>
              <dd className="text-right font-semibold tabular-nums">
                {deliveries.filter((task) => task.status === "completed").length}
              </dd>
              <dt className="text-on-surface-variant">Novedades</dt>
              <dd className="text-right font-semibold tabular-nums">
                {deliveries.filter((task) => task.status === "failed").length}
              </dd>
              <dt className="text-body-l font-bold text-on-surface">Valor a recaudar</dt>
              <dd className="text-right text-body-l font-bold tabular-nums">
                {formatCop(data.codToCollect)}
              </dd>
            </dl>
            {data.dispatchedAt && (
              <p className="text-body-s text-on-surface-variant">
                {closed(
                  data.finishedAt
                    ? `Salió ${when(data.dispatchedAt)} y terminó ${when(data.finishedAt)}`
                    : `Salió ${when(data.dispatchedAt)}`,
                )}
              </p>
            )}
          </DetailCard>
        </aside>
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
    </div>
  );
}
