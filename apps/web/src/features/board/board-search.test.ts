import type { BoardEntry, DispatchBoard } from "@domy/domain";
import { describe, expect, it } from "vitest";
import { searchBoard } from "./board-search";

function entry(trackingNumber: string, overrides: Partial<BoardEntry> = {}): BoardEntry {
  return {
    id: trackingNumber,
    trackingNumber,
    kind: "delivery",
    status: "registered",
    serviceDate: "2026-11-09",
    merchant: { id: "m", name: "Natural Glow Cosmética" },
    recipientName: "Laura Gómez",
    recipientNeighborhood: { id: "n", name: "Laureles" },
    rateZone: null,
    windowStart: null,
    windowEnd: null,
    codAmount: 0,
    feeNeedsReview: false,
    routeId: null,
    routeNumber: null,
    courier: null,
    recordFlags: [],
    returnDecided: false,
    pendingHandover: null,
    ...overrides,
  };
}

function board(shipments: BoardEntry[], pending: BoardEntry[] = []): DispatchBoard {
  return {
    date: "2026-11-09",
    serverTime: "2026-11-09T15:00:00Z",
    counts: {
      registered: 0,
      assigned: 0,
      dispatched: 0,
      picked_up: 0,
      delivered: 0,
      exception: 0,
      returned: 0,
      voided: 0,
    },
    exceptionsToDecide: 0,
    shipments,
    pendingFromPreviousDays: pending,
  };
}

describe("searchBoard (feature 006, T019)", () => {
  const day = board(
    [
      entry("KM4P-7QXD"),
      entry("R2VN-8TWA", {
        recipientName: "Mateo Cardona",
        merchant: { id: "a", name: "Amy Tecnology" },
        recipientNeighborhood: { id: "b", name: "Belén" },
      }),
    ],
    [entry("JD8F-4QWS", { recipientName: "Juan Esteban Ríos" })],
  );

  it("needs two characters", () => {
    expect(searchBoard(day, "")).toEqual([]);
    expect(searchBoard(day, " k ")).toEqual([]);
  });

  it("matches the tracking number with or without its dash, in any case", () => {
    expect(searchBoard(day, "km4p7q").map((s) => s.trackingNumber)).toEqual(["KM4P-7QXD"]);
    expect(searchBoard(day, "R2VN-8T").map((s) => s.trackingNumber)).toEqual(["R2VN-8TWA"]);
  });

  it("matches merchant, recipient and neighborhood without accents", () => {
    expect(searchBoard(day, "amy").map((s) => s.trackingNumber)).toEqual(["R2VN-8TWA"]);
    expect(searchBoard(day, "belen").map((s) => s.trackingNumber)).toEqual(["R2VN-8TWA"]);
    expect(searchBoard(day, "rios").map((s) => s.trackingNumber)).toEqual(["JD8F-4QWS"]);
  });

  it("includes the pending shipments of earlier days, and stops at the limit", () => {
    expect(searchBoard(day, "glow").map((s) => s.trackingNumber)).toEqual([
      "KM4P-7QXD",
      "JD8F-4QWS",
    ]);
    expect(searchBoard(day, "glow", 1)).toHaveLength(1);
  });
});
