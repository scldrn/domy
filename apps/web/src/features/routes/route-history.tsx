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
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-title-m text-on-surface">
        Historial de la ruta
      </h2>
      <ol className="flex flex-col gap-2">
        {events.map((event) => (
          <li key={event.id} className="rounded-sm bg-surface-container-low px-4 py-3">
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
