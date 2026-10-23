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

/** A return stop gives an undeliverable package back where it was picked up (feature 003). */
export const stopKinds = ["pickup", "delivery", "errand", "return"] as const;
export type StopKind = (typeof stopKinds)[number];
export const stopKindLabels: Record<StopKind, string> = {
  pickup: "Recogida",
  delivery: "Entrega",
  errand: "Diligencia",
  return: "Devolución",
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
 * Pending delivery/return stops before the public queue anchor (feature 004, FR-006/FR-008,
 * research R4/R17). Route and shipment-state eligibility is checked by the caller.
 */
export function deliveriesBefore(
  stops: Pick<RouteStopPlan, "kind" | "tasks">[],
  shipmentId: string,
  kind: ShipmentKind,
): number | null {
  if (kind === "errand") return null;

  const anchorKind = kind === "reverse_pickup" ? "pickup" : "delivery";
  const anchorIndex = stops.findIndex(
    (existing) =>
      existing.kind === anchorKind &&
      existing.tasks.some(
        (task) =>
          task.shipmentId === shipmentId && task.kind === anchorKind && task.status === "pending",
      ),
  );
  if (anchorIndex === -1) return null;

  return stops
    .slice(0, anchorIndex)
    .filter(
      (existing) =>
        (existing.kind === "delivery" || existing.kind === "return") &&
        existing.tasks.some((task) => task.kind === existing.kind && task.status === "pending"),
    ).length;
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
  return [...withPickup(stops, shipment.pickup, shipment.id, newId), deliveryStop];
}

/** A pickup at a place: in the route's pending pickup stop of that place, or a new last stop. */
function withPickup(
  stops: RouteStopPlan[],
  place: Place,
  shipmentId: string,
  newId: () => string,
): RouteStopPlan[] {
  const shared = stops.find(
    (existing) =>
      existing.kind === "pickup" && isPending(existing) && placeKey(existing) === placeKey(place),
  );
  if (!shared) return [...stops, stop(newId(), "pickup", place, shipmentId)];
  return stops.map((existing) =>
    existing === shared
      ? {
          ...existing,
          tasks: [
            ...existing.tasks,
            { shipmentId, kind: "pickup" as const, status: "pending" as const },
          ],
        }
      : existing,
  );
}

/**
 * A package someone holds joins a route (feature 003, FR-029, FR-031, FR-041). Held by a
 * courier, it needs no pickup: only its delivery stop, or a return stop where it was picked up
 * (the recipient, for a reverse pickup). Held by the office, it is picked up there first, at
 * the office's pending pickup stop if the route has one.
 */
export function addHeldShipmentToStops(
  stops: RouteStopPlan[],
  shipment: RoutePlanShipment,
  newId: () => string,
  held:
    | { holder: "courier"; purpose: "delivery" | "return" }
    | {
        holder: "office";
        office: Place;
        purpose: "delivery" | "return";
      },
): RouteStopPlan[] {
  const picked =
    held.holder === "office" ? withPickup(stops, held.office, shipment.id, newId) : stops;
  const last =
    held.purpose === "return" || !shipment.delivery
      ? stop(newId(), "return", shipment.pickup, shipment.id)
      : stop(newId(), "delivery", shipment.delivery, shipment.id);
  return [...picked, last];
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

const samePlace = (stop: Place, place: Place) =>
  stop.address === place.address && stop.neighborhoodId === place.neighborhoodId;

/**
 * A shipment on a route whose places were edited (FR-013, EC-05). Its delivery or errand stop
 * takes the new place where it is. A new pickup place joins a pending pickup stop of that
 * place before its delivery, or else moves the pickup stop when the shipment has it alone,
 * or else gets a new pickup stop right before its delivery. Returns `stops` itself when
 * nothing changes.
 */
export function relocateShipment(
  stops: RouteStopPlan[],
  shipment: RoutePlanShipment,
  newId: () => string,
): RouteStopPlan[] {
  const owns = (stop: RouteStopPlan, kind: (k: StopKind) => boolean) =>
    stop.tasks.some(
      (task) => task.shipmentId === shipment.id && task.status === "pending" && kind(task.kind),
    );
  const finalPlace = shipment.delivery ?? shipment.pickup;
  let changed = false;
  // A return stop stays where the package was picked up; edits end at pickup anyway.
  let next = stops.map((stop) => {
    if (!owns(stop, (kind) => kind === "delivery" || kind === "errand")) return stop;
    if (samePlace(stop, finalPlace)) return stop;
    changed = true;
    return { ...stop, address: finalPlace.address, neighborhoodId: finalPlace.neighborhoodId };
  });

  const pickupIndex = next.findIndex(
    (stop) => stop.kind === "pickup" && owns(stop, (kind) => kind === "pickup"),
  );
  const pickupStop = next[pickupIndex];
  if (pickupStop && !samePlace(pickupStop, shipment.pickup)) {
    changed = true;
    const deliveryIndex = next.findIndex((stop) => owns(stop, (kind) => kind === "delivery"));
    const task = { shipmentId: shipment.id, kind: "pickup" as const, status: "pending" as const };
    const target = next.findIndex(
      (stop, index) =>
        index !== pickupIndex &&
        index < deliveryIndex &&
        stop.kind === "pickup" &&
        isPending(stop) &&
        placeKey(stop) === placeKey(shipment.pickup),
    );
    const alone = pickupStop.tasks.length === 1;
    if (target === -1 && alone) {
      next[pickupIndex] = {
        ...pickupStop,
        address: shipment.pickup.address,
        neighborhoodId: shipment.pickup.neighborhoodId,
      };
    } else {
      next = next.map((stop, index) => {
        if (index === pickupIndex) {
          return {
            ...stop,
            tasks: stop.tasks.filter(
              (existing) => !(existing.shipmentId === shipment.id && existing.kind === "pickup"),
            ),
          };
        }
        return index === target ? { ...stop, tasks: [...stop.tasks, task] } : stop;
      });
      if (target === -1) {
        next.splice(deliveryIndex, 0, stop(newId(), "pickup", shipment.pickup, shipment.id));
      }
      next = next.filter((existing) => existing.tasks.length > 0);
    }
  }
  return changed ? next : stops;
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
      // A return stop, like a delivery, comes after the pickup that brings its package.
      if (task.kind === "delivery" || task.kind === "return") {
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

/** Creating or growing a route beyond this many shipments asks for confirmation (FR-005). */
export const largeRouteThreshold = 15;

export function needsLargeRouteConfirmation(shipmentCount: number): boolean {
  return shipmentCount > largeRouteThreshold;
}
