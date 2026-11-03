import { describe, expect, it } from "vitest";
import { boardStageStatuses, boardListRank, hasAlert, stageOf } from "./board-stages.ts";
import type { BoardEntry } from "./schemas/board.ts";
import { shipmentStatuses } from "./shipment-lifecycle.ts";

const now = new Date("2026-11-02T19:47:00Z");
const minutesFromNow = (minutes: number) =>
  new Date(now.getTime() + minutes * 60_000).toISOString();
const entry = (overrides: Partial<BoardEntry> = {}): BoardEntry => ({
  id: "shipment-one",
  trackingNumber: "GUIA-1",
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
  courier: { id: "courier-one", name: "Yeison Ospina" },
  recordFlags: [],
  returnDecided: false,
  pendingHandover: null,
  ...overrides,
});

/** The board's stage counts and list (feature 006, FR-018, design-system.md §8). */
describe("board stages", () => {
  it("puts every shipment status in exactly one stage", () => {
    const placed = Object.values(boardStageStatuses).flat();
    expect([...placed].sort()).toEqual([...shipmentStatuses].sort());
    expect(stageOf("registered")).toBe("open");
    expect(stageOf("assigned")).toBe("open");
    expect(stageOf("dispatched")).toBe("street");
    expect(stageOf("picked_up")).toBe("street");
    expect(stageOf("delivered")).toBe("delivered");
    expect(stageOf("exception")).toBe("exception");
    expect(stageOf("returned")).toBe("closed");
    expect(stageOf("voided")).toBe("closed");
  });

  it("marks a shipment with an alert when the board would tag it", () => {
    expect(hasAlert(entry(), now)).toBe(false);
    expect(hasAlert(entry({ windowEnd: minutesFromNow(30) }), now)).toBe(true);
    expect(hasAlert(entry({ windowEnd: minutesFromNow(-5) }), now)).toBe(true);
    expect(hasAlert(entry({ status: "exception" }), now)).toBe(true);
    expect(hasAlert(entry({ status: "exception", returnDecided: true }), now)).toBe(false);
    expect(hasAlert(entry({ feeNeedsReview: true }), now)).toBe(true);
    expect(hasAlert(entry({ recordFlags: ["no_photo"] }), now)).toBe(true);
    expect(hasAlert(entry({ recordFlags: ["photo_pending"] }), now)).toBe(false);
    expect(
      hasAlert(
        entry({
          pendingHandover: {
            id: "handover-one",
            fromCourier: { id: "courier-one", name: "Yeison Ospina" },
            toCourier: { id: "courier-two", name: "Daniela Arango" },
            requestedAt: "2026-11-02T19:20:00Z",
          },
        }),
        now,
      ),
    ).toBe(true);
  });

  it("ranks the list by need: exceptions, late, at risk, earlier days, alerts, open, closed", () => {
    const date = "2026-11-02";
    const ranked = [
      entry({ status: "delivered" }),
      entry({ status: "registered" }),
      entry({ recordFlags: ["collection_differs"] }),
      entry({ serviceDate: "2026-10-31" }),
      entry({ windowEnd: minutesFromNow(20) }),
      entry({ windowEnd: minutesFromNow(-20) }),
      entry({ status: "exception" }),
    ].map((shipment) => boardListRank(shipment, date, now));
    expect(ranked).toEqual([6, 5, 4, 3, 2, 1, 0]);
  });
});
