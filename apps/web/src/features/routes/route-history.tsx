import { formatTrackingNumber, type RouteEvent, type RouteEventType } from "@domy/domain";
import { useId } from "react";
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
            <p className="text-body-l text-on-surface">
              {eventLabels[event.type]}
              {event.shipment && ` · ${formatTrackingNumber(event.shipment.trackingNumber)}`}
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
