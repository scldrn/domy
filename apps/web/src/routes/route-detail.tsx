import { routeStatusLabels, type RouteDetail } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourierSelect } from "@/features/routes/courier-select";
import { RouteHistory } from "@/features/routes/route-history";
import { StopList } from "@/features/routes/stop-list";
import { dispatchRoute, getRoute, setRouteCourier, setStopOrder } from "@/features/routes/api";
import { ApiError } from "@/lib/api-client";
import { formatCop, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_panel/rutas/$routeId")({
  head: () => ({ meta: [{ title: "Ruta · Domy" }] }),
  component: RouteDetailPage,
});

const statusVariant = {
  draft: "outline",
  in_progress: "info",
  finished: "success",
  cancelled: "destructive",
} as const;

/** One route: stops in order, courier, dispatch, and history (FR-006–FR-009, FR-019). */
function RouteDetailPage() {
  const { routeId } = Route.useParams();
  const queryClient = useQueryClient();
  const queryKey = ["route", routeId];
  const route = useQuery({ queryKey, queryFn: () => getRoute(routeId), refetchInterval: 20_000 });
  const [problem, setProblem] = useState<{ message: string; routeId?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /** Runs a route action with a new action identifier and the version on screen. */
  async function act(action: (current: RouteDetail, actionId: string) => Promise<RouteDetail>) {
    if (!route.data) return;
    setProblem(null);
    setBusy(true);
    try {
      const updated = await action(route.data, crypto.randomUUID());
      queryClient.setQueryData(queryKey, updated);
      await queryClient.invalidateQueries({ queryKey: ["routes-board"] });
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

  if (route.isPending) return <p className="text-body-l">Cargando la ruta…</p>;
  if (route.isError) return <p className="text-body-l text-error">{route.error.message}</p>;
  const data = route.data;
  const editable = data.status === "draft" || data.status === "in_progress";

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Link to="/rutas" className="text-body-m text-primary">
        ← Rutas
      </Link>
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-headline-s text-on-surface">Ruta {data.number}</h1>
        <Badge variant={statusVariant[data.status]}>{routeStatusLabels[data.status]}</Badge>
        <span className="text-body-m text-on-surface-variant">{formatDate(data.serviceDate)}</span>
      </header>

      <div className="flex flex-wrap items-end gap-6">
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
        <dl className="grid grid-cols-[auto_auto] gap-x-4 text-body-l">
          <dt className="text-on-surface-variant">Paradas completadas</dt>
          <dd className="tabular-nums">
            {data.progress.completed} de {data.progress.total}
          </dd>
          <dt className="text-on-surface-variant">Valor a recaudar</dt>
          <dd className="tabular-nums">{formatCop(data.codToCollect)}</dd>
        </dl>
        {data.status === "draft" && (
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
        )}
      </div>

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

      <StopList
        stops={data.stops}
        locked={!editable || busy}
        onInvalid={(message) => {
          setProblem({ message });
        }}
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

      <RouteHistory events={data.events} />
    </div>
  );
}
