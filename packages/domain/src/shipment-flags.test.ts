import { describe, expect, it } from "vitest";
import { flagLabel, shipmentFlag } from "./shipment-flags.ts";
import { shipmentStatuses, type ShipmentStatus } from "./shipment-lifecycle.ts";

const windowEnd = new Date("2026-10-01T22:00:00Z"); // 17:00 in Bogotá
const minutes = (count: number) => count * 60 * 1000;
const at = (offset: number) => new Date(windowEnd.getTime() + offset);

describe("shipmentFlag", () => {
  it("is not flagged earlier than 45 minutes before the latest delivery time", () => {
    expect(shipmentFlag({ status: "registered", windowEnd }, at(-minutes(46)))).toBeNull();
  });

  it("is at risk from 45 minutes before the latest delivery time", () => {
    expect(shipmentFlag({ status: "registered", windowEnd }, at(-minutes(45)))).toEqual({
      kind: "at_risk",
      minutes: 45,
    });
    expect(shipmentFlag({ status: "assigned", windowEnd }, at(-minutes(44)))).toEqual({
      kind: "at_risk",
      minutes: 44,
    });
  });

  it("rounds the remaining time up so the last seconds still show 1 minute", () => {
    expect(shipmentFlag({ status: "dispatched", windowEnd }, at(-30_000))).toEqual({
      kind: "at_risk",
      minutes: 1,
    });
  });

  it("is late at and after the latest delivery time", () => {
    expect(shipmentFlag({ status: "picked_up", windowEnd }, at(0))).toEqual({
      kind: "late",
      minutes: 0,
    });
    expect(shipmentFlag({ status: "exception", windowEnd }, at(minutes(61)))).toEqual({
      kind: "late",
      minutes: 61,
    });
  });

  it("is late when the window belongs to a past day", () => {
    const threeDaysLater = at(minutes(3 * 24 * 60 + 10));
    expect(shipmentFlag({ status: "registered", windowEnd }, threeDaysLater)).toEqual({
      kind: "late",
      minutes: 3 * 24 * 60 + 10,
    });
  });

  it("never flags a shipment without a latest delivery time", () => {
    expect(shipmentFlag({ status: "registered", windowEnd: null }, at(minutes(600)))).toBeNull();
  });

  it("flags only registered, assigned, dispatched, picked-up, and exception shipments", () => {
    const flagged: ShipmentStatus[] = [
      "registered",
      "assigned",
      "dispatched",
      "picked_up",
      "exception",
    ];
    for (const status of shipmentStatuses) {
      const flag = shipmentFlag({ status, windowEnd }, at(minutes(5)));
      expect(flag !== null, status).toBe(flagged.includes(status));
    }
  });
});

describe("flagLabel", () => {
  it("shows the minutes remaining or overdue", () => {
    expect(flagLabel({ kind: "at_risk", minutes: 44 })).toBe("En riesgo · quedan 44 min");
    expect(flagLabel({ kind: "late", minutes: 0 })).toBe("Atrasado · 0 min");
    expect(flagLabel({ kind: "late", minutes: 59 })).toBe("Atrasado · 59 min");
  });

  it("shows hours and minutes from one hour up to 24 hours", () => {
    expect(flagLabel({ kind: "late", minutes: 24 * 60 })).toBe("Atrasado · 24 h");
    expect(flagLabel({ kind: "late", minutes: 125 })).toBe("Atrasado · 2 h 5 min");
  });

  it("shows days beyond 24 hours", () => {
    expect(flagLabel({ kind: "late", minutes: 24 * 60 + 1 })).toBe("Atrasado · 1 día");
    expect(flagLabel({ kind: "late", minutes: 3 * 24 * 60 + 10 })).toBe("Atrasado · 3 días");
  });
});
