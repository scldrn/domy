import type { CourierStop, CourierTask } from "@domy/domain";
import { describe, expect, it } from "vitest";
import { courierRouteMarks, nextStop, stopState } from "./route-view";

const task = (status: CourierTask["status"]) => ({ status }) as CourierTask;
const stop = (position: number, kind: CourierStop["kind"], ...statuses: CourierTask["status"][]) =>
  ({ id: String(position), position, kind, tasks: statuses.map(task) }) as unknown as CourierStop;

describe("courier route view (approved app del mensajero)", () => {
  it("reads a stop as done, exception, or pending", () => {
    expect(stopState(stop(0, "pickup", "completed", "completed"))).toBe("done");
    expect(stopState(stop(1, "delivery", "failed"))).toBe("exception");
    expect(stopState(stop(2, "delivery", "completed", "pending"))).toBe("pending");
  });

  it("draws the board's stop track and finds the next stop", () => {
    const stops = [
      stop(0, "pickup", "completed"),
      stop(1, "delivery", "pending"),
      stop(2, "delivery", "failed"),
      stop(3, "errand", "pending"),
    ];
    expect(courierRouteMarks(stops)).toEqual([
      { kind: "pickup", state: "done" },
      { kind: "delivery", state: "exception" },
      { kind: "delivery", state: "pending" },
      { kind: "errand", state: "pending" },
    ]);
    expect(nextStop(stops)?.position).toBe(1);
    expect(nextStop([stop(0, "pickup", "completed")])).toBeUndefined();
  });
});
