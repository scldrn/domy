import {
  formatTrackingNumber,
  type RouteEvent,
  type RouteEventType,
  type ShipmentEvent,
} from "@domy/domain";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { OnBehalfMark } from "@/components/on-behalf-mark";
import { formatDateTime } from "@/lib/format";

const eventLabels: Record<RouteEventType, string> = {
  created: "Ruta creada",
  shipment_added: "Envío agregado",
  shipment_removed: "Envío quitado",
  reordered: "Paradas reordenadas",
  courier_set: "Mensajero asignado",
  dispatched: "Ruta despachada",
  dispatch_undone: "Despacho deshecho",
  reassigned: "Reasignación",
  handover_requested: "Traspaso solicitado",
  handover_confirmed: "Traspaso confirmado",
  handover_cancelled: "Traspaso cancelado",
  cancelled: "Ruta cancelada",
  finished: "Ruta finalizada",
};

/** Every action on the route, with author, time, couriers, and reason (FR-019, FR-022). */
export function RouteHistory({ events }: { events: RouteEvent[] }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-2 text-title-m text-on-surface">
        Historial de la ruta
      </h2>
      <ol className="ml-2 flex flex-col border-l-2 border-outline-variant">
        {events.map((event) => (
          <li
            key={event.id}
            className="relative pb-5 pl-6 before:absolute before:top-1.5 before:-left-[7px] before:size-3 before:rounded-full before:bg-primary before:ring-4 before:ring-surface last:pb-0"
          >
            <p className="flex flex-wrap items-center gap-x-2 text-body-l text-on-surface">
              <span>
                {eventLabels[event.type]}
                {event.shipment && (
                  <>
                    {" · "}
                    <Link
                      to="/envios/$trackingNumber"
                      params={{ trackingNumber: event.shipment.trackingNumber }}
                      className="guia rounded-xs underline-offset-4 hover:underline"
                    >
                      {formatTrackingNumber(event.shipment.trackingNumber)}
                    </Link>
                  </>
                )}
              </span>
              {event.onBehalf && <OnBehalfMark />}
            </p>
            <p className="text-body-m text-on-surface-variant">
              {event.actor.name} · {formatDateTime(event.occurredAt)}
            </p>
            {(event.fromCourier ?? event.toCourier) && (
              <p className="text-body-m text-on-surface">
                {event.fromCourier ? `${event.fromCourier.name} → ` : ""}
                {event.toCourier?.name ?? "Sin mensajero"}
              </p>
            )}
            {event.reason && <p className="text-body-m text-on-surface">{event.reason}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Who held a package and from when (SC-005): its pickup, each confirmed handover, and its
 * delivery, from the custody changes in the shipment's history.
 */
export function CustodyHistory({ events }: { events: ShipmentEvent[] }) {
  const headingId = useId();
  const records = events.flatMap((event) => {
    const change = event.changes?.["custodyCourierId"];
    return change ? [{ event, from: change[0], to: change[1] }] : [];
  });
  if (records.length === 0) return null;
  const text = ({ event, from, to }: (typeof records)[number]) => {
    // US4 FR-041: a change to office custody is not a delivery.
    if (event.type === "office_received") return "La recibe la oficina";
    if (typeof to === "string" && event.changes?.["heldAtOffice"]?.[0] === true)
      return `La recoge ${to} en la oficina`;
    if (typeof to === "string") {
      return event.type === "handover_confirmed"
        ? `Lo recibe ${to} de ${String(from)}`
        : `Lo recoge ${to}`;
    }
    return event.toStatus === "returned"
      ? `Lo devuelve ${String(from)}`
      : `Lo entrega ${String(from)}`;
  };
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-2 text-title-m text-on-surface">
        Custodia del paquete
      </h2>
      <ol className="ml-2 flex flex-col border-l-2 border-outline-variant">
        {records.map((record) => (
          <li
            key={record.event.id}
            className="relative pb-5 pl-6 before:absolute before:top-1.5 before:-left-[7px] before:size-3 before:rounded-full before:bg-primary before:ring-4 before:ring-surface last:pb-0"
          >
            <p className="flex flex-wrap items-center gap-x-2 text-body-l text-on-surface">
              {text(record)}
              {record.event.onBehalf && <OnBehalfMark />}
            </p>
            <p className="text-body-m text-on-surface-variant">
              {formatDateTime(record.event.occurredAt)} · Registró {record.event.actor.name}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
