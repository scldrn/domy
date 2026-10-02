import type { BoardShipment, ShipmentStatus } from "@domy/domain";
import { describe, expect, it } from "vitest";
import { bogotaHours, layoutRibbon, ribbonTone } from "./ribbon-layout";

const now = new Date("2026-10-01T15:40:00Z"); // 10:40 in Bogotá

let next = 0;
function shipment(
  status: ShipmentStatus,
  window: [start: string | null, end: string | null] = [null, null],
): BoardShipment {
  next++;
  return {
    id: String(next),
    trackingNumber: `T${String(next)}`,
    kind: "delivery",
    status,
    serviceDate: "2026-10-01",
    merchant: { id: "m", name: "Amy Tecnology" },
    recipientName: null,
    recipientNeighborhood: null,
    rateZone: null,
    windowStart: window[0],
    windowEnd: window[1],
    codAmount: 0,
    feeNeedsReview: false,
  };
}

const at = (time: string) => `2026-10-01T${time}:00-05:00`;

describe("bogotaHours", () => {
  it("reads the local hour of an instant as a decimal", () => {
    expect(bogotaHours(at("10:30"))).toBe(10.5);
    expect(bogotaHours("2026-10-01T19:15:00Z")).toBe(14.25);
  });
});

describe("ribbonTone", () => {
  it("puts late and exceptions first, then at risk, on the way, open, and done", () => {
    expect(ribbonTone(shipment("registered", [at("08:00"), at("10:00")]), now)).toBe("late");
    expect(ribbonTone(shipment("exception", [at("14:00"), at("16:00")]), now)).toBe("late");
    expect(ribbonTone(shipment("dispatched", [null, at("11:15")]), now)).toBe("risk");
    expect(ribbonTone(shipment("picked_up", [at("14:00"), at("16:00")]), now)).toBe("route");
    expect(ribbonTone(shipment("assigned", [at("14:00"), at("16:00")]), now)).toBe("open");
    expect(ribbonTone(shipment("delivered", [at("08:00"), at("10:00")]), now)).toBe("done");
  });

  it("leaves out voided and returned shipments", () => {
    expect(ribbonTone(shipment("voided"), now)).toBeNull();
    expect(ribbonTone(shipment("returned"), now)).toBeNull();
  });
});

describe("layoutRibbon", () => {
  it("stacks overlapping windows in as few lanes as possible", () => {
    const { bars, lanes } = layoutRibbon(
      [
        shipment("registered", [at("08:00"), at("12:00")]),
        shipment("registered", [at("09:00"), at("11:00")]),
        shipment("registered", [at("12:00"), at("20:00")]),
        shipment("registered", [at("14:00"), at("16:00")]),
      ],
      now,
    );
    expect(lanes).toBe(2);
    expect(bars.map((bar) => [bar.from, bar.to, bar.lane])).toEqual([
      [8, 12, 0],
      [9, 11, 1],
      [12, 20, 0],
      [14, 16, 1],
    ]);
  });

  it("opens 'before' windows at 8:00, closes 'after' windows at 20:00, and sets apart the rest", () => {
    const loose = shipment("registered");
    const { bars, unscheduled } = layoutRibbon(
      [
        shipment("registered", [null, at("11:15")]),
        shipment("registered", [at("18:00"), null]),
        loose,
        shipment("voided"),
      ],
      now,
    );
    expect(bars.map((bar) => [bar.from, bar.to])).toEqual([
      [8, 11.25],
      [18, 20],
    ]);
    expect(unscheduled).toEqual([loose]);
  });
});
