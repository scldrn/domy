import type { ShipmentKind } from "./schemas/enums.ts";
import { normalizeText } from "./text-normalization.ts";

/**
 * Route rules (feature 002, research R1–R2): a route is an ordered list of stops; each stop
 * has one task per shipment handled there. These pure functions are shared by the server,
 * which saves their result, and the browser, which validates a drag before sending it.
 */

export const routeStatuses = ["draft", "in_progress", "finished", "cancelled"] as const;
export type RouteStatus = (typeof routeStatuses)[number];
export const routeStatusLabels: Record<RouteStatus, string> = {
  draft: "En preparación",
  in_progress: "En curso",
  finished: "Finalizada",
  cancelled: "Cancelada",
};

export const stopKinds = ["pickup", "delivery", "errand"] as const;
export type StopKind = (typeof stopKinds)[number];
export const stopKindLabels: Record<StopKind, string> = {
  pickup: "Recogida",
  delivery: "Entrega",
  errand: "Diligencia",
};

export const taskStatuses = ["pending", "completed", "failed"] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export const taskStatusLabels: Record<TaskStatus, string> = {
  pending: "Pendiente",
  completed: "Completada",
  failed: "Novedad",
};

export const handoverStatuses = ["pending", "confirmed", "cancelled"] as const;
export type HandoverStatus = (typeof handoverStatuses)[number];
export const handoverStatusLabels: Record<HandoverStatus, string> = {
  pending: "Traspaso pendiente",
  confirmed: "Traspaso confirmado",
  cancelled: "Traspaso cancelado",
};

export type Place = { address: string; neighborhoodId: string | null };

/** A shipment as a route sees it: where it is picked up and where it is delivered. */
export type RoutePlanShipment = {
  id: string;
  kind: ShipmentKind;
  pickup: Place;
  /** Null for an errand, which is a single stop at its pickup place. */
  delivery: Place | null;
};

export type RouteTaskPlan = { shipmentId: string; kind: StopKind; status: TaskStatus };
export type RouteStopPlan = {
  id: string;
  kind: StopKind;
  address: string;
  neighborhoodId: string | null;
  tasks: RouteTaskPlan[];
};

/**
 * The places of a shipment (FR-005): a reverse pickup is collected at the recipient and
 * delivered to the merchant; a carrier handoff is delivered at the handoff place.
 */
export function shipmentPlaces(shipment: {
  kind: ShipmentKind;
  pickupAddress: string;
  pickupNeighborhoodId: string;
  recipientAddress: string | null;
  recipientNeighborhoodId: string | null;
  recipientNeighborhoodName: string | null;
}): { pickup: Place; delivery: Place | null } {
  const merchant = {
    address: shipment.pickupAddress,
    neighborhoodId: shipment.pickupNeighborhoodId,
  };
  const recipient = {
    address: shipment.recipientAddress ?? shipment.recipientNeighborhoodName ?? "",
    neighborhoodId: shipment.recipientNeighborhoodId,
  };
  switch (shipment.kind) {
    case "delivery":
    case "carrier_handoff":
      return { pickup: merchant, delivery: recipient };
    case "reverse_pickup":
      return { pickup: recipient, delivery: merchant };
    case "errand":
      return { pickup: merchant, delivery: null };
  }
}

/** Two pickups share a stop when their address and neighborhood match once normalized. */
const placeKey = (place: Place) => `${normalizeText(place.address)}|${place.neighborhoodId ?? ""}`;

/** Only the task statuses matter to progress and finishing. */
type StopTasks = { tasks: { status: TaskStatus }[] };

const isPending = (stop: StopTasks) => stop.tasks.some((task) => task.status === "pending");

function stop(id: string, kind: StopKind, place: Place, shipmentId: string): RouteStopPlan {
  return {
    id,
    kind,
    address: place.address,
    neighborhoodId: place.neighborhoodId,
    tasks: [{ shipmentId, kind, status: "pending" }],
  };
}

/**
 * The stops of a new route (FR-005): one pickup stop per pickup place, then one delivery stop
 * per shipment (an errand is one stop among them), in the order the shipments were selected.
 */
export function buildStops(shipments: RoutePlanShipment[], newId: () => string): RouteStopPlan[] {
  const pickups: RouteStopPlan[] = [];
  const deliveries: RouteStopPlan[] = [];
  for (const shipment of shipments) {
    if (!shipment.delivery) {
      deliveries.push(stop(newId(), "errand", shipment.pickup, shipment.id));
      continue;
    }
    const shared = pickups.find((existing) => placeKey(existing) === placeKey(shipment.pickup));
    if (shared) shared.tasks.push({ shipmentId: shipment.id, kind: "pickup", status: "pending" });
    else pickups.push(stop(newId(), "pickup", shipment.pickup, shipment.id));
    deliveries.push(stop(newId(), "delivery", shipment.delivery, shipment.id));
  }
  return [...pickups, ...deliveries];
}

/**
 * A shipment added to a route (FR-011): it joins the pending pickup stop of its place, or a
 * new pickup stop goes at the end right before its new delivery stop. A shipment already
 * picked up brings only its delivery stop (FR-014).
 */
export function addShipmentToStops(
  stops: RouteStopPlan[],
  shipment: RoutePlanShipment,
  newId: () => string,
  options: { deliveryOnly?: boolean } = {},
): RouteStopPlan[] {
  if (!shipment.delivery) return [...stops, stop(newId(), "errand", shipment.pickup, shipment.id)];
  const deliveryStop = stop(newId(), "delivery", shipment.delivery, shipment.id);
  if (options.deliveryOnly) return [...stops, deliveryStop];
  const shared = stops.find(
    (existing) =>
      existing.kind === "pickup" &&
      isPending(existing) &&
      placeKey(existing) === placeKey(shipment.pickup),
  );
  if (shared) {
    return [
      ...stops.map((existing) =>
        existing === shared
          ? {
              ...existing,
              tasks: [
                ...existing.tasks,
                { shipmentId: shipment.id, kind: "pickup" as const, status: "pending" as const },
              ],
            }
          : existing,
      ),
      deliveryStop,
    ];
  }
  return [...stops, stop(newId(), "pickup", shipment.pickup, shipment.id), deliveryStop];
}

/** A shipment leaving a route (FR-012): its pending tasks go, and so does a stop left empty. */
export function removeShipmentFromStops(
  stops: RouteStopPlan[],
  shipmentId: string,
): RouteStopPlan[] {
  return stops
    .map((existing) => ({
      ...existing,
      tasks: existing.tasks.filter(
        (task) => !(task.shipmentId === shipmentId && task.status === "pending"),
      ),
    }))
    .filter((existing) => existing.tasks.length > 0);
}

export function moveStop(stops: RouteStopPlan[], stopId: string, toIndex: number): RouteStopPlan[] {
  const moving = stops.find((existing) => existing.id === stopId);
  if (!moving) return stops;
  const rest = stops.filter((existing) => existing !== moving);
  return [...rest.slice(0, toIndex), moving, ...rest.slice(toIndex)];
}

/**
 * Why a new stop order is refused (FR-006), or null when it is valid: it must hold the same
 * stops, completed stops keep their place, and each delivery stays after its pickup.
 */
export function validateStopOrder(before: RouteStopPlan[], after: RouteStopPlan[]): string | null {
  const ids = (list: RouteStopPlan[]) =>
    list
      .map((existing) => existing.id)
      .sort()
      .join();
  if (before.length !== after.length || ids(before) !== ids(after)) {
    return "El orden enviado no corresponde a las paradas de la ruta.";
  }
  const moved = before.some(
    (existing, index) => !isPending(existing) && after[index]?.id !== existing.id,
  );
  if (moved) return "Las paradas completadas no se mueven.";
  const pickupIndex = new Map<string, number>();
  for (const [index, existing] of after.entries()) {
    for (const task of existing.tasks) {
      if (task.kind === "pickup") pickupIndex.set(task.shipmentId, index);
      if (task.kind === "delivery") {
        const pickedAt = pickupIndex.get(task.shipmentId);
        const hasPickup = after.some((other) =>
          other.tasks.some((t) => t.kind === "pickup" && t.shipmentId === task.shipmentId),
        );
        if (hasPickup && (pickedAt === undefined || pickedAt > index)) {
          return "La entrega de un envío debe quedar después de su recogida.";
        }
      }
    }
  }
  return null;
}

/** Stops with no pending task, out of all stops (FR-007). */
export function routeProgress(stops: StopTasks[]): { completed: number; total: number } {
  return {
    completed: stops.filter((existing) => !isPending(existing)).length,
    total: stops.length,
  };
}

/** A route in progress finishes with no pending task and no pending handover (FR-012). */
export function isRouteFinished(stops: StopTasks[], pendingHandovers: number): boolean {
  return pendingHandovers === 0 && stops.every((existing) => !isPending(existing));
}

/** A dispatch can be undone only before any task is done and any package picked up (FR-026). */
export function canUndoDispatch(stops: StopTasks[], anyPickedUp: boolean): boolean {
  return (
    !anyPickedUp &&
    stops.every((existing) => existing.tasks.every((task) => task.status === "pending"))
  );
}
