import {
  formatTrackingNumber,
  type RouteEvent,
  type RouteEventType,
  type ShipmentEvent,
} from "@domy/domain";
import { Link } from "@tanstack/react-router";
import { DetailCard } from "@/components/detail-card";
import { OnBehalfMark } from "@/components/on-behalf-mark";
import { cn } from "@/lib/cn";
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
  record_reverted: "Registro revertido",
};

/**
 * Every action on the route, with author, time, couriers, and reason (FR-019, FR-022), newest
 * first, as the shipment's «Historial» shows them (approved «Detalle de ruta», feature 006).
 */
export function RouteHistory({ events }: { events: RouteEvent[] }) {
  return (
    <DetailCard title="Historial de la ruta">
      <ol className="flex flex-col">
        {events.toReversed().map((event) => (
          <li
            key={event.id}
            className={cn(
              "relative pb-3.5 pl-6 text-body-m before:absolute before:top-1.25 before:left-1 before:size-2.5 before:rounded-full before:content-['']",
              "after:absolute after:top-4.25 after:-bottom-px after:left-[8.5px] after:w-px after:bg-outline-variant after:content-[''] last:pb-0 last:after:hidden",
              tone(event.type),
            )}
          >
            <p className="flex flex-wrap items-center gap-x-2 font-semibold text-on-surface">
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
            <p className="text-on-surface-variant">
              {event.actor.name} · {formatDateTime(event.occurredAt)}
            </p>
            {(event.fromCourier ?? event.toCourier) && (
              <p className="text-on-surface">
                {event.fromCourier ? `${event.fromCourier.name} → ` : ""}
                {event.toCourier?.name ?? "Sin mensajero"}
              </p>
            )}
            {event.reason && <p className="text-on-surface">{event.reason}</p>}
          </li>
        ))}
      </ol>
    </DetailCard>
  );
}

/** The dot of an event: handovers in the custody color, a finished route in green. */
function tone(type: RouteEventType): string {
  if (type.startsWith("handover_") || type === "reassigned") return "before:bg-info";
  if (type === "finished") return "before:bg-success";
  if (type === "cancelled") return "before:rounded-[3px] before:bg-error";
  return "before:bg-on-surface-variant";
}

/**
 * Who has the package after an event (SC-005): its pickup, each confirmed handover, and its
 * delivery, read from the custody change; null when the event did not change custody.
 */
export function custodyChange(event: ShipmentEvent): string | null {
  const change = event.changes?.["custodyCourierId"];
  if (!change || change[0] === change[1]) return null;
  const [from, to] = change;
  if (event.type === "record_reverted" && typeof to === "string")
    return `Se restablece la custodia de ${to} por reversión`;
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
}
