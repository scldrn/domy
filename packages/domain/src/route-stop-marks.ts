import type { StopKind, TaskStatus } from "./routes.ts";

export type StopMarkState = "done" | "exception" | "pending";
export type StopMark = { kind: StopKind; state: StopMarkState };

type MarkedStop = {
  position: number;
  kind: StopKind;
  tasks: { status: TaskStatus; completedAt: Date | null }[];
};

/**
 * A route's stops as the board's courier progress draws them (feature 006, FR-018, research
 * R5): completed stops by completion time, then pending stops in route order. A stop stays
 * pending while any task is; one with a failed task reads as an exception. Done and exception
 * marks together equal the route's completed stops (`routeProgress`).
 */
export function routeStopMarks(stops: MarkedStop[]): StopMark[] {
  const finishedAt = (stop: MarkedStop) =>
    Math.max(...stop.tasks.map((task) => task.completedAt?.getTime() ?? 0));
  const isPending = (stop: MarkedStop) => stop.tasks.some((task) => task.status === "pending");
  const completed = stops
    .filter((stop) => !isPending(stop))
    .sort((a, b) => finishedAt(a) - finishedAt(b) || a.position - b.position);
  const pending = stops.filter(isPending).sort((a, b) => a.position - b.position);
  return [
    ...completed.map((stop) => ({
      kind: stop.kind,
      state: stop.tasks.some((task) => task.status === "failed")
        ? ("exception" as const)
        : ("done" as const),
    })),
    ...pending.map((stop) => ({ kind: stop.kind, state: "pending" as const })),
  ];
}
