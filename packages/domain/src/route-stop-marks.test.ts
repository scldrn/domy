import { describe, expect, it } from "vitest";
import { routeStopMarks } from "./route-stop-marks.ts";
import type { StopKind, TaskStatus } from "./routes.ts";

const stop = (
  position: number,
  kind: StopKind,
  ...tasks: [TaskStatus, string | null][]
): Parameters<typeof routeStopMarks>[0][number] => ({
  position,
  kind,
  tasks: tasks.map(([status, completedAt]) => ({
    status,
    completedAt: completedAt ? new Date(completedAt) : null,
  })),
});

/** The board's courier progress (feature 006, FR-018, research R5, contracts/board-read.md). */
describe("route stop marks", () => {
  it("lists completed stops by completion time, then pending stops in route order", () => {
    const marks = routeStopMarks([
      stop(1, "pickup", ["completed", "2026-11-02T14:00:00Z"]),
      stop(2, "delivery", ["pending", null]),
      stop(3, "delivery", ["completed", "2026-11-02T15:30:00Z"]),
      stop(4, "delivery", ["failed", "2026-11-02T15:00:00Z"]),
      stop(5, "pickup", ["pending", null]),
    ]);
    expect(marks).toEqual([
      { kind: "pickup", state: "done" },
      { kind: "delivery", state: "exception" },
      { kind: "delivery", state: "done" },
      { kind: "delivery", state: "pending" },
      { kind: "pickup", state: "pending" },
    ]);
  });

  it("keeps a stop pending while any of its tasks is, and marks a failure as an exception", () => {
    expect(
      routeStopMarks([
        stop(1, "delivery", ["completed", "2026-11-02T14:00:00Z"], ["pending", null]),
        stop(
          2,
          "delivery",
          ["completed", "2026-11-02T14:00:00Z"],
          ["failed", "2026-11-02T14:10:00Z"],
        ),
      ]),
    ).toEqual([
      { kind: "delivery", state: "exception" },
      { kind: "delivery", state: "pending" },
    ]);
  });

  it("orders a stop by its last completed task and agrees with the route's progress", () => {
    const marks = routeStopMarks([
      stop(
        1,
        "delivery",
        ["completed", "2026-11-02T16:00:00Z"],
        ["completed", "2026-11-02T13:00:00Z"],
      ),
      stop(2, "return", ["completed", "2026-11-02T15:00:00Z"]),
      stop(3, "errand", ["pending", null]),
    ]);
    expect(marks.map((mark) => mark.kind)).toEqual(["return", "delivery", "errand"]);
    expect(marks.filter((mark) => mark.state !== "pending")).toHaveLength(2);
  });

  it("marks every stop of a route in preparation as pending", () => {
    expect(
      routeStopMarks([
        stop(2, "delivery", ["pending", null]),
        stop(1, "pickup", ["pending", null]),
      ]),
    ).toEqual([
      { kind: "pickup", state: "pending" },
      { kind: "delivery", state: "pending" },
    ]);
  });

  it("returns nothing for a route without stops", () => {
    expect(routeStopMarks([])).toEqual([]);
  });
});
