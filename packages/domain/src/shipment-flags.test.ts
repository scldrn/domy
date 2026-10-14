import { describe, expect, it } from "vitest";
import { flagLabel, recordFlagLabels, recordFlags, shipmentFlag } from "./shipment-flags.ts";
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

/** The flags of the courier's records (feature 003, FR-033, FR-023, research R11). */
describe("recordFlags", () => {
  const recordedAt = new Date("2026-10-01T15:00:00Z");
  const hours = (count: number) => new Date(recordedAt.getTime() + count * 60 * 60 * 1000);
  const none = { proof: null, collection: null, pickupProblem: false, needsReview: false };

  it("flags a delivery recorded without a proof photo «Sin foto»", () => {
    expect(recordFlags({ ...none, proof: { recordedAt, photos: [] } }, hours(1))).toEqual([
      "no_photo",
    ]);
  });

  it("flags a proof photo that has not arrived «Foto pendiente», for 24 hours", () => {
    const proof = { recordedAt, photos: [{ uploaded: false }] };
    expect(recordFlags({ ...none, proof }, hours(23))).toEqual(["photo_pending"]);
    // After 24 hours the record counts as having no photo (FR-023).
    expect(recordFlags({ ...none, proof }, hours(24))).toEqual(["no_photo"]);
  });

  it("does not flag a proof once one of its photos arrived", () => {
    const proof = { recordedAt, photos: [{ uploaded: true }, { uploaded: false }] };
    expect(recordFlags({ ...none, proof }, hours(1))).toEqual(["photo_pending"]);
    expect(recordFlags({ ...none, proof }, hours(30))).toEqual([]);
  });

  it("flags «Foto pendiente» for any photo of the record still on its way", () => {
    const photos = [{ uploaded: true }];
    expect(
      recordFlags({ ...none, proof: { recordedAt, photos }, pendingPhotos: 1 }, hours(2)),
    ).toEqual(["photo_pending"]);
  });

  it("flags a collected total different from the COD amount «Recaudo diferente» (FR-011)", () => {
    expect(
      recordFlags({ ...none, collection: { total: 80_000, codAmount: 85_000 } }, hours(1)),
    ).toEqual(["collection_differs"]);
    expect(
      recordFlags({ ...none, collection: { total: 85_000, codAmount: 85_000 } }, hours(1)),
    ).toEqual([]);
  });

  it("flags a pickup problem and a record to review", () => {
    expect(recordFlags({ ...none, pickupProblem: true, needsReview: true }, hours(1))).toEqual([
      "pickup_problem",
      "needs_review",
    ]);
  });

  it("labels each flag with the glossary's term", () => {
    expect(recordFlagLabels).toEqual({
      no_photo: "Sin foto",
      photo_pending: "Foto pendiente",
      collection_differs: "Recaudo diferente",
      pickup_problem: "Problema de recogida",
      needs_review: "Por revisar",
    });
  });
});
