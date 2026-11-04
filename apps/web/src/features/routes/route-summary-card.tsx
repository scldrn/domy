import { formatDuration, type RouteSummary } from "@domy/domain";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { RouteStatusMark } from "@/components/route-status-mark";
import { StopTrack } from "@/components/stop-track";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatCop } from "@/lib/format";

const plural = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`;

function initials(name: string): string {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/** When the courier last synced and whether they understood every change (FR-018). */
function syncLine(route: RouteSummary, now: Date): string {
  if (route.status === "draft") return "Aún no sale";
  if (!route.courierLastSyncedAt) return "Aún no se ha conectado";
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(route.courierLastSyncedAt)) / 60_000),
  );
  const notices =
    route.unacknowledgedNotices === 0
      ? "todo entendido"
      : plural(route.unacknowledgedNotices, "cambio sin confirmar", "cambios sin confirmar");
  return `Sincronizó hace ${formatDuration(minutes)} · ${notices}`;
}

/**
 * One route on «Rutas» as the owner approved it (feature 006, FR-018): number and state,
 * courier with their last sync, the stop track, progress and COD to collect, and its late,
 * at-risk, and handover marks. The whole card opens the route.
 */
export function RouteSummaryCard({ route, now }: { route: RouteSummary; now: Date }) {
  const headingId = useId();
  const tags = [
    route.lateCount > 0 && {
      text: plural(route.lateCount, "atrasado", "atrasados"),
      variant: "destructive" as const,
    },
    route.atRiskCount > 0 && {
      text: `${String(route.atRiskCount)} en riesgo`,
      variant: "warning" as const,
    },
    route.pendingHandovers > 0 && {
      text: plural(route.pendingHandovers, "traspaso pendiente", "traspasos pendientes"),
      variant: "tertiary" as const,
    },
  ].filter((tag) => tag !== false);
  return (
    <article
      aria-labelledby={headingId}
      className="relative flex h-full flex-col gap-3 rounded-lg border border-outline-variant bg-sheet px-4.5 py-4 transition-colors hover:border-outline hover:bg-sheet-alt has-focus-visible:border-outline"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="text-headline-s text-on-surface">
          <Link
            to="/rutas/$routeId"
            params={{ routeId: route.id }}
            className="rounded-xs underline-offset-4 after:absolute after:inset-0 after:rounded-lg after:content-[''] hover:underline"
          >
            Ruta {route.number}
          </Link>
        </h3>
        <RouteStatusMark status={route.status} />
      </div>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary-container text-label-m font-bold text-on-secondary-container"
        >
          {route.courier ? initials(route.courier.name) : "—"}
        </span>
        <p className="min-w-0 text-body-m">
          <span
            className={cn(
              "block font-semibold",
              route.courier ? "text-on-surface" : "text-on-surface-variant",
            )}
          >
            {route.courier?.name ?? "Sin mensajero"}
          </span>
          <span className="block text-body-s text-on-surface-variant">
            {route.courier ? syncLine(route, now) : "Elige el mensajero en la ruta"}
          </span>
        </p>
      </div>
      <StopTrack marks={route.stopMarks} next={route.status === "in_progress"} />
      <p className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-body-m text-on-surface-variant">
        <span>
          <strong className="font-semibold text-on-surface tabular-nums">
            {route.completedStops} de {route.totalStops}
          </strong>{" "}
          paradas
        </span>
        <span>
          <strong className="font-semibold text-on-surface tabular-nums">
            {formatCop(route.codToCollect)}
          </strong>{" "}
          por recaudar
        </span>
      </p>
      {tags.length > 0 && (
        <p className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag.text} variant={tag.variant}>
              {tag.text}
            </Badge>
          ))}
        </p>
      )}
    </article>
  );
}
