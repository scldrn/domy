import { describe, expect, it } from "vitest";
import { buildAttention } from "./attention.ts";
import type { BoardEntry } from "./schemas/board.ts";

const now = new Date("2026-11-02T19:47:00Z");
const minutesFromNow = (minutes: number) =>
  new Date(now.getTime() + minutes * 60_000).toISOString();
const courier = { id: "courier-one", name: "Yeison Ospina" };
let sequence = 0;
const entry = (overrides: Partial<BoardEntry> = {}): BoardEntry => ({
  id: `shipment-${String(++sequence)}`,
  trackingNumber: `GUIA-${String(sequence)}`,
  kind: "delivery",
  status: "picked_up",
  serviceDate: "2026-11-02",
  merchant: { id: "merchant-one", name: "Amy Tecnology" },
  recipientName: "Daniela Úsuga",
  recipientNeighborhood: null,
  rateZone: null,
  windowStart: null,
  windowEnd: null,
  codAmount: 0,
  feeNeedsReview: false,
  routeId: "route-one",
  routeNumber: 4,
  courier,
  recordFlags: [],
  returnDecided: false,
  pendingHandover: null,
  ...overrides,
});
const handover = {
  id: "handover-one",
  fromCourier: { id: "courier-two", name: "Daniela Arango" },
  toCourier: { id: "courier-three", name: "Camilo Restrepo" },
  requestedAt: "2026-11-02T19:20:00Z",
};

/** "Por resolver" on the board (feature 006, FR-018, research R6, contracts/board-read.md). */
describe("attention list", () => {
  it("orders exceptions to decide, late, handovers, at risk, then pickup problems", () => {
    const problem = entry({ status: "dispatched", recordFlags: ["pickup_problem"] });
    const atRisk = entry({ windowEnd: minutesFromNow(28) });
    const moved = entry({ pendingHandover: handover });
    const late = entry({ windowEnd: minutesFromNow(-17) });
    const exception = entry({ status: "exception" });
    const { items } = buildAttention({
      shipments: [problem, atRisk, moved, late, exception],
      role: "dispatcher",
      now,
    });
    expect(items.map((item) => [item.kind, item.shipmentId, item.action])).toEqual([
      ["exception_to_decide", exception.id, "decide"],
      ["late", late.id, "reassign"],
      ["pending_handover", moved.id, "confirm_handover"],
      ["at_risk", atRisk.id, "reassign"],
      ["pickup_problem", problem.id, "reassign"],
    ]);
  });

  it("lists each shipment once, under its most urgent reason", () => {
    const both = entry({ status: "exception", windowEnd: minutesFromNow(-30) });
    const { items } = buildAttention({ shipments: [both], role: "dispatcher", now });
    expect(items).toEqual([
      expect.objectContaining({ kind: "exception_to_decide", shipmentId: both.id }),
    ]);
  });

  it("breaks ties by the window's end, earliest first, with no window last", () => {
    const noWindow = entry({ status: "exception" });
    const later = entry({ status: "exception", windowEnd: minutesFromNow(90) });
    const sooner = entry({ status: "exception", windowEnd: minutesFromNow(20) });
    const { items } = buildAttention({ shipments: [noWindow, later, sooner], role: "owner", now });
    expect(items.map((item) => item.shipmentId)).toEqual([sooner.id, later.id, noWindow.id]);
  });

  it("asks to assign what is late or at risk but has no route yet", () => {
    const unassigned = entry({
      status: "registered",
      routeId: null,
      routeNumber: null,
      courier: null,
      windowEnd: minutesFromNow(43),
    });
    const { items } = buildAttention({ shipments: [unassigned], role: "dispatcher", now });
    expect(items).toEqual([expect.objectContaining({ kind: "at_risk", action: "assign" })]);
  });

  it("leaves out decided returns, closed shipments, and windows far away", () => {
    const { items } = buildAttention({
      shipments: [
        entry({ status: "exception", returnDecided: true }),
        entry({ status: "delivered", windowEnd: minutesFromNow(-60) }),
        entry({ windowEnd: minutesFromNow(120) }),
      ],
      role: "dispatcher",
      now,
    });
    expect(items).toEqual([]);
  });

  it("counts the minor flags, with fees to review only for the owner", () => {
    const shipments = [
      entry({ status: "delivered", recordFlags: ["collection_differs"] }),
      entry({ recordFlags: ["needs_review"] }),
      entry({ status: "delivered", recordFlags: ["no_photo"] }),
      entry({ status: "registered", feeNeedsReview: true }),
    ];
    expect(buildAttention({ shipments, role: "owner", now }).minor).toEqual({
      collection_differs: 1,
      needs_review: 1,
      no_photo: 1,
      fee_to_review: 1,
    });
    expect(buildAttention({ shipments, role: "dispatcher", now }).minor).toEqual({
      collection_differs: 1,
      needs_review: 1,
      no_photo: 1,
      fee_to_review: 0,
    });
  });
});
