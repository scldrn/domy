import { formatDuration, type RouteSummary, type StopMark } from "@domy/domain";
import ArrowIcon from "@material-symbols/svg-400/rounded/arrow_forward.svg?react";
import CallIcon from "@material-symbols/svg-400/rounded/call.svg?react";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { Icon } from "@/components/icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** A courier is out of sync after 20 minutes without news (design-system.md §8). */
const staleMinutes = 20;

type Note = { text: string; tone: string };

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

function initials(name: string): string {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/**
 * The stop track's marks (design-system.md §8): pickup done is a hollow green ring, any other
 * stop done a solid green dot, an exception a red square, pending a ring; the next stop of a
 * route on the street pulses in lime.
 */
function markClass(mark: StopMark, next: boolean): string {
  if (mark.state === "exception") return "rounded-[3px] bg-rail-error";
  if (mark.state === "done")
    return mark.kind === "pickup"
      ? "rounded-full border-[3px] border-rail-success bg-rail"
      : "rounded-full bg-rail-success";
  return cn(
    "rounded-full border-2 bg-rail",
    mark.kind === "pickup" && "border-[3px]",
    next
      ? "border-accent motion-safe:animate-[next-stop_2.2s_ease-out_infinite]"
      : "border-on-rail-variant/60",
  );
}

function sinceMinutes(instant: string | null, now: Date): number | null {
  if (!instant) return null;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(instant)) / 60_000));
}

function notesOf(route: RouteSummary, now: Date): Note[] {
  const notes: Note[] = [];
  if (route.lateCount > 0)
    notes.push({
      text: `${String(route.lateCount)} ${plural(route.lateCount, "atrasado", "atrasados")}`,
      tone: "text-rail-error font-semibold",
    });
  if (route.atRiskCount > 0)
    notes.push({
      text: `${String(route.atRiskCount)} en riesgo`,
      tone: "text-rail-warning font-semibold",
    });
  if (route.pendingHandovers > 0)
    notes.push({
      text: `${String(route.pendingHandovers)} ${plural(route.pendingHandovers, "traspaso", "traspasos")}`,
      tone: "text-rail-tertiary font-semibold",
    });
  if (route.status === "draft") {
    notes.push({ text: "Lista para despachar", tone: "text-accent font-semibold" });
  } else {
    const gap = sinceMinutes(route.courierLastSyncedAt, now);
    if (gap === null)
      notes.push({ text: "Todavía no sincroniza", tone: "text-rail-warning font-semibold" });
    else if (gap >= staleMinutes)
      notes.push({
        text: `Sin sincronizar hace ${formatDuration(gap)}`,
        tone: "text-rail-warning font-semibold",
      });
    else
      notes.push({ text: `Sincronizó hace ${formatDuration(gap)}`, tone: "text-on-rail-variant" });
  }
  return notes;
}

/**
 * Each courier's current route: the one on the street, else the first in preparation. A
 * courier appears once however many routes the day gives them.
 */
function currentRoutes(routes: RouteSummary[]): RouteSummary[] {
  const byCourier = new Map<string, RouteSummary>();
  const rank = (route: RouteSummary) => (route.status === "in_progress" ? 0 : 1);
  for (const route of routes) {
    if (!route.courier || (route.status !== "in_progress" && route.status !== "draft")) continue;
    const current = byCourier.get(route.courier.id);
    if (!current || (rank(route) - rank(current) || route.number - current.number) < 0)
      byCourier.set(route.courier.id, route);
  }
  return [...byCourier.values()];
}

/** Late first, then at risk, then out of sync; routes in preparation last. */
function need(route: RouteSummary, now: Date): number {
  if (route.status === "draft") return 9;
  const gap = sinceMinutes(route.courierLastSyncedAt, now);
  if (route.lateCount > 0) return 0;
  if (route.atRiskCount > 0) return 1;
  return gap === null || gap >= staleMinutes ? 2 : 3;
}

/**
 * The couriers' progress on the board (FR-018, design-system.md §8): one row per courier with
 * a route on the street or in preparation, ordered by need. The name filters the list by that
 * courier; the button calls them, or dispatches a route in preparation.
 */
export function CourierProgress({
  routes,
  phones,
  now,
  date,
  selectedCourierId,
  dispatching,
  onSelectCourier,
  onDispatch,
}: {
  routes: RouteSummary[];
  phones: Map<string, string>;
  now: Date;
  date: string;
  selectedCourierId: string | undefined;
  dispatching: string | null;
  onSelectCourier: (courierId: string | undefined) => void;
  onDispatch: (route: RouteSummary) => void;
}) {
  const active = currentRoutes(routes).sort(
    (a, b) => need(a, now) - need(b, now) || a.number - b.number,
  );
  const onStreet = active.filter((route) => route.status === "in_progress").length;
  return (
    <section
      aria-labelledby="mensajeros"
      className="on-rail flex flex-col rounded-lg bg-rail px-5 pt-5 pb-3 text-on-rail max-[820px]:px-4"
    >
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <h2 id="mensajeros" className="flex items-baseline gap-2 text-title-l">
          Mensajeros{" "}
          <span className="text-body-l text-on-rail-variant tabular-nums">{onStreet}</span>
          <span className="sr-only">{plural(onStreet, "en ruta", "en ruta")}</span>
        </h2>
        <Link
          to="/rutas"
          search={{ date }}
          className="min-h-6 rounded-xs text-label-l whitespace-nowrap text-accent underline underline-offset-4"
        >
          Ver rutas
        </Link>
      </div>
      {active.length === 0 ? (
        <p className="flex-1 border-t border-rail-line py-8 text-center text-body-m text-on-rail-variant">
          Ningún mensajero tiene una ruta en curso ni en preparación.
        </p>
      ) : (
        <ul className="flex-1">
          {active.map((route) => {
            const courier = route.courier;
            if (!courier) return null;
            const marks = route.stopMarks;
            const done = marks.filter((mark) => mark.state !== "pending").length;
            const nextIndex =
              route.status === "in_progress"
                ? marks.findIndex((mark) => mark.state === "pending")
                : -1;
            const phone = phones.get(courier.id);
            const notes = notesOf(route, now);
            return (
              <li
                key={route.id}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.75rem] items-center gap-x-3 border-t border-rail-line py-3"
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 place-items-center rounded-full bg-rail-raised text-label-m font-bold text-on-rail"
                >
                  {initials(courier.name)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2.5">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <button
                        type="button"
                        aria-pressed={selectedCourierId === courier.id}
                        onClick={() => {
                          onSelectCourier(
                            selectedCourierId === courier.id ? undefined : courier.id,
                          );
                        }}
                        className="min-h-6 cursor-pointer truncate rounded-xs text-left text-label-l text-on-rail underline-offset-3 hover:underline aria-pressed:text-accent"
                      >
                        {courier.name}
                      </button>
                      <span className="text-body-s whitespace-nowrap text-on-rail-variant">
                        Ruta {route.number}
                      </span>
                    </span>
                    <span className="text-label-m whitespace-nowrap">
                      {done} de {marks.length} paradas
                    </span>
                  </div>
                  <div
                    role="img"
                    aria-label={`${String(done)} de ${String(marks.length)} paradas completadas`}
                    className="my-1.5 flex min-h-3.5 items-center"
                  >
                    {marks.map((mark, index) => (
                      <Fragment key={index}>
                        <span
                          className={cn("size-3 shrink-0", markClass(mark, index === nextIndex))}
                        />
                        {index < marks.length - 1 && (
                          <span
                            className={cn(
                              "h-0.5 min-w-1 flex-[1_1_6px]",
                              mark.state !== "pending" && marks[index + 1]?.state !== "pending"
                                ? "bg-rail-success/50"
                                : "bg-rail-line",
                            )}
                          />
                        )}
                      </Fragment>
                    ))}
                  </div>
                  <p className="flex flex-wrap gap-x-3 text-body-s">
                    {notes.map((note) => (
                      <span key={note.text} className={note.tone}>
                        {note.text}
                      </span>
                    ))}
                  </p>
                </div>
                {route.status === "draft" ? (
                  <Button
                    variant="accent"
                    size="icon"
                    className="size-11"
                    disabled={dispatching === route.id}
                    aria-label={`Despachar la ruta ${String(route.number)} a ${courier.name}`}
                    onClick={() => {
                      onDispatch(route);
                    }}
                  >
                    <Icon symbol={ArrowIcon} size={20} />
                  </Button>
                ) : phone ? (
                  <a
                    href={`tel:${phone}`}
                    aria-label={`Llamar a ${courier.name}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "icon",
                      className:
                        "size-11 border-rail-line bg-transparent text-on-rail hover:bg-rail-raised",
                    })}
                  >
                    <Icon symbol={CallIcon} size={20} />
                  </a>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div
        aria-hidden="true"
        className="flex flex-wrap gap-x-4 gap-y-1 border-t border-rail-line pt-2.5 pb-1 text-body-s text-on-rail-variant"
      >
        {[
          ["Recogida", markClass({ kind: "pickup", state: "done" }, false)],
          ["Entrega", markClass({ kind: "delivery", state: "done" }, false)],
          ["Novedad", markClass({ kind: "delivery", state: "exception" }, false)],
          ["Pendiente", markClass({ kind: "delivery", state: "pending" }, false)],
          ["Próxima", "rounded-full border-2 border-accent bg-rail"],
        ].map(([label, mark]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-3 shrink-0", mark)} />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
