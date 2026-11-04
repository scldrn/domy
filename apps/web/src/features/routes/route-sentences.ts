import {
  routeStopMarks,
  shipmentFlag,
  type RouteDetail,
  type RouteStatus,
  type RouteSummary,
  type StopMark,
  type UnassignedShipment,
} from "@domy/domain";
import type { SentencePart } from "@/components/summary-sentence";
import { formatLongDate, formatTime } from "@/lib/format";

const count = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** How a group of routes reads by state; cancelled routes are not counted (feature 006). */
const statusWords: [RouteStatus, string, string][] = [
  ["in_progress", "en curso", "en curso"],
  ["draft", "en preparación", "en preparación"],
  ["finished", "finalizada", "finalizadas"],
];

function list(words: string[]): string {
  return words.length < 2
    ? (words[0] ?? "")
    : `${words.slice(0, -1).join(", ")} y ${words.at(-1) ?? ""}`;
}

/**
 * The sentence of «Rutas» (FR-007; approved «Rutas»): the day's routes by state, then the
 * shipments without a route and how many of them are late or at risk.
 */
export function routesDaySentence({
  date,
  today,
  routes,
  unassigned,
  now,
}: {
  date: string;
  today: string;
  routes: RouteSummary[];
  unassigned: UnassignedShipment[] | undefined;
  now: Date;
}): SentencePart[] {
  const day = formatLongDate(date, today);
  const live = routes.filter((route) => route.status !== "cancelled");
  const parts: SentencePart[] =
    live.length === 0
      ? [{ text: `${day}: todavía no hay rutas.` }]
      : [
          { text: `${day}: ` },
          { text: count(live.length, "ruta", "rutas"), strong: true },
          {
            text: `, ${list(
              statusWords.flatMap(([status, one, many]) => {
                const n = live.filter((route) => route.status === status).length;
                return n === 0 ? [] : [count(n, one, many)];
              }),
            )}.`,
          },
        ];
  if (!unassigned) return parts;
  if (unassigned.length === 0) return [...parts, { text: " Todos los envíos tienen ruta." }];
  const flags = unassigned.map((shipment) =>
    shipmentFlag(
      {
        status: shipment.status,
        windowEnd: shipment.windowEnd ? new Date(shipment.windowEnd) : null,
      },
      now,
    ),
  );
  const late = flags.filter((flag) => flag?.kind === "late").length;
  const atRisk = flags.filter((flag) => flag?.kind === "at_risk").length;
  const alerts: SentencePart[][] = [
    late > 0
      ? [{ text: count(late, "atrasado", "atrasados"), strong: true, tone: "error" as const }]
      : [],
    atRisk > 0
      ? [{ text: `${String(atRisk)} en riesgo`, strong: true, tone: "warning" as const }]
      : [],
  ].filter((alert) => alert.length > 0);
  return [
    ...parts,
    { text: " " },
    { text: count(unassigned.length, "envío", "envíos"), strong: true },
    { text: unassigned.length === 1 ? " sigue sin ruta" : " siguen sin ruta" },
    ...(alerts.length === 0
      ? [{ text: "." }]
      : [
          { text: "; " },
          ...alerts.flatMap((alert, i) => (i === 0 ? alert : [{ text: " y " }, ...alert])),
          { text: "." },
        ]),
  ];
}

/** The route's stops as the board draws them, from the detail's tasks (`routeStopMarks`). */
export function routeMarks(route: Pick<RouteDetail, "stops">): StopMark[] {
  return routeStopMarks(
    route.stops.map((stop) => ({
      position: stop.position,
      kind: stop.kind,
      tasks: stop.tasks.map((task) => ({
        status: task.status,
        completedAt: task.completedAt ? new Date(task.completedAt) : null,
      })),
    })),
  );
}

/** How a stop reads: done, an exception, the next one of a route on the street, or ahead. */
export type StopState = "done" | "exception" | "next" | "pending";

export function stopStates(route: Pick<RouteDetail, "status" | "stops">): StopState[] {
  const pending = route.stops.map((stop) => stop.tasks.some((task) => task.status === "pending"));
  const next = route.status === "in_progress" ? pending.indexOf(true) : -1;
  return route.stops.map((stop, index) =>
    pending[index]
      ? index === next
        ? "next"
        : "pending"
      : stop.tasks.some((task) => task.status === "failed")
        ? "exception"
        : "done",
  );
}

/**
 * The sentence of «Detalle de ruta» (FR-007; approved «Detalle de ruta»): what is left to do
 * with the route in its state.
 */
export function routeSentence(
  route: Pick<
    RouteDetail,
    "status" | "serviceDate" | "courier" | "stops" | "finishedAt" | "progress"
  >,
  today: string,
): SentencePart[] {
  const stops = count(route.stops.length, "parada", "paradas");
  const deliveries = route.stops.flatMap((stop) =>
    stop.tasks.filter((task) => task.kind !== "pickup"),
  );
  switch (route.status) {
    case "draft":
      if (route.stops.length === 0) return [{ text: "La ruta no tiene envíos todavía." }];
      return [
        {
          text: `En preparación para el ${formatLongDate(route.serviceDate, today).toLowerCase()}: `,
        },
        { text: stops, strong: true },
        ...(route.courier
          ? [
              { text: " de " },
              { text: route.courier.name, strong: true },
              { text: ". Revisa el orden y despáchala cuando salga." },
            ]
          : [{ text: ", todavía sin mensajero. Elígelo y despáchala cuando salga." }]),
      ];
    case "in_progress": {
      const states = stopStates(route);
      const nextIndex = states.indexOf("next");
      const next = route.stops[nextIndex];
      return [
        ...(route.courier
          ? [{ text: route.courier.name, strong: true }, { text: " lleva " }]
          : [{ text: "La ruta lleva " }]),
        {
          text: `${String(route.progress.completed)} de ${String(route.progress.total)} paradas`,
          strong: true,
        },
        ...(next
          ? [
              { text: ". La próxima es la " },
              { text: String(nextIndex + 1), strong: true },
              { text: `, en ${next.neighborhood?.name ?? next.address}.` },
            ]
          : [{ text: "." }]),
      ];
    }
    case "finished": {
      const delivered = deliveries.filter((task) => task.status === "completed").length;
      const failed = deliveries.filter((task) => task.status === "failed").length;
      return [
        ...(route.finishedAt
          ? [
              { text: "Finalizó a las " },
              { text: formatTime(route.finishedAt), strong: true },
              { text: ": " },
            ]
          : [{ text: "Finalizó: " }]),
        { text: count(delivered, "entrega", "entregas"), strong: true },
        ...(failed > 0
          ? [
              { text: " y " },
              { text: count(failed, "novedad", "novedades"), strong: true, tone: "error" as const },
            ]
          : []),
        { text: "." },
      ];
    }
    case "cancelled":
      return [{ text: "Se canceló; sus envíos volvieron a «Sin asignar»." }];
  }
}
