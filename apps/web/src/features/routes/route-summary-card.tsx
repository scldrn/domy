import type { RouteSummary } from "@domy/domain";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { RouteStatusMark } from "@/components/route-status-mark";
import { cn } from "@/lib/cn";
import { formatCop } from "@/lib/format";

const plural = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`;

/**
 * One route on the routes board (FR-018): courier, status, progress, COD to collect, its
 * shipments late and at risk, and the handovers waiting for its courier.
 */
export function RouteSummaryCard({ route }: { route: RouteSummary }) {
  const headingId = useId();
  const alerts = [
    route.lateCount > 0 && {
      text: plural(route.lateCount, "atrasado", "atrasados"),
      tone: "text-error",
    },
    route.atRiskCount > 0 && {
      text: `${String(route.atRiskCount)} en riesgo`,
      tone: "text-warning",
    },
    route.pendingHandovers > 0 && {
      text: plural(route.pendingHandovers, "traspaso pendiente", "traspasos pendientes"),
      tone: "text-warning",
    },
  ].filter((alert) => alert !== false);
  return (
    <article
      aria-labelledby={headingId}
      className="flex h-full flex-col gap-3 rounded-md border border-outline-variant bg-sheet p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 id={headingId} className="text-title-m text-on-surface">
          <Link
            to="/rutas/$routeId"
            params={{ routeId: route.id }}
            className="rounded-xs underline-offset-4 hover:underline"
          >
            Ruta {route.number}
          </Link>
        </h3>
        <RouteStatusMark status={route.status} />
      </div>
      <p
        className={cn("text-body-l", route.courier ? "text-on-surface" : "text-on-surface-variant")}
      >
        {route.courier?.name ?? "Sin mensajero"}
      </p>
      <dl className="grid grid-cols-2 gap-x-4">
        <div>
          <dt className="text-body-s text-on-surface-variant">Avance</dt>
          <dd className="text-title-s text-on-surface tabular-nums">
            {route.completedStops} de {route.totalStops} paradas
          </dd>
        </div>
        <div>
          <dt className="text-body-s text-on-surface-variant">Valor a recaudar</dt>
          <dd className="text-title-s text-on-surface tabular-nums">
            {formatCop(route.codToCollect)}
          </dd>
        </div>
      </dl>
      {alerts.length > 0 && (
        <p className="flex flex-wrap gap-x-3 text-label-m">
          {alerts.map((alert) => (
            <span key={alert.text} className={alert.tone}>
              {alert.text}
            </span>
          ))}
        </p>
      )}
    </article>
  );
}
