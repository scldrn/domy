import { routeStopMarks, type CourierStop, type StopMark } from "@domy/domain";

export type CourierStopState = "done" | "exception" | "pending";

/** A stop stays pending while any task is; a failed task makes a finished stop an exception. */
export function stopState(stop: CourierStop): CourierStopState {
  if (stop.tasks.some((task) => task.status === "pending")) return "pending";
  return stop.tasks.some((task) => task.status === "failed") ? "exception" : "done";
}

/**
 * The route's marks as the board draws them (feature 006, research R5), from the phone's own
 * snapshot, which has no completion times: finished stops in route order, then pending ones.
 */
export function courierRouteMarks(stops: CourierStop[]): StopMark[] {
  return routeStopMarks(
    stops.map((stop) => ({
      position: stop.position,
      kind: stop.kind,
      tasks: stop.tasks.map((task) => ({ status: task.status, completedAt: null })),
    })),
  );
}

/** The first stop in route order with work left (feature 003, FR-005). */
export function nextStop(stops: CourierStop[]): CourierStop | undefined {
  return stops.find((stop) => stopState(stop) === "pending");
}
