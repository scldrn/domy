import { describe, expect, it } from "vitest";
import { exceptionsToDecide, filterBoard } from "./dispatch-board.ts";
import type { BoardEntry, BoardQuery } from "./schemas/board.ts";

const date = "2026-10-01";
const now = new Date("2026-10-01T15:00:00Z");
const entry = (overrides: Partial<BoardEntry> = {}): BoardEntry => ({
  id: crypto.randomUUID(),
  trackingNumber: "260001",
  kind: "delivery",
  status: "exception",
  serviceDate: date,
  merchant: { id: "merchant-one", name: "Cliente uno" },
  recipientName: "Laura Gómez",
  recipientNeighborhood: null,
  rateZone: { id: "zone-one", name: "Zona uno" },
  windowStart: null,
  windowEnd: null,
  codAmount: 0,
  feeNeedsReview: false,
  routeId: null,
  routeNumber: null,
  courier: { id: "courier-one", name: "Ana Ruiz" },
  recordFlags: [],
  returnDecided: false,
  ...overrides,
});

/** US3 FR-033, research R11: the list and count use the same undecided-exception rule. */
describe("exceptions on the dispatch board", () => {
  it("selects only undecided exceptions, retaining their identity and order", () => {
    const older = entry({ serviceDate: "2026-09-30" });
    const today = entry();
    expect(
      exceptionsToDecide([
        older,
        entry({ returnDecided: true }),
        entry({ status: "picked_up" }),
        today,
        entry({ status: "returned" }),
      ]),
    ).toEqual([older, today]);
  });

  it("counts earlier and today's exceptions without hiding decided returns from normal lists", () => {
    const older = entry({ serviceDate: "2026-09-30" });
    const today = entry();
    const decided = entry({ returnDecided: true });
    const board = filterBoard(date, [older, today, decided], {}, now);
    expect(board.exceptionsToDecide).toBe(2);
    expect(board.counts.exception).toBe(3);
    expect(board.shipments).toEqual([today, decided]);
    expect(board.pendingFromPreviousDays).toEqual([older]);
  });

  it.each<Omit<BoardQuery, "date">>([
    { merchantId: "merchant-one" },
    { courierId: "courier-one" },
    { rateZoneId: "zone-one" },
    { flag: "fee_review" },
  ])("applies non-status filters to the exception count: %j", (filters) => {
    const wanted = entry({ feeNeedsReview: true });
    const other = entry({
      merchant: { id: "merchant-two", name: "Cliente dos" },
      courier: null,
      rateZone: null,
    });
    const board = filterBoard(date, [wanted, other], filters, now);
    expect(board.exceptionsToDecide).toBe(1);
    expect(board.shipments).toEqual([wanted]);
  });

  it("ignores the status filter for counts but honors it for the visible list", () => {
    const pending = entry({ status: "dispatched" });
    const board = filterBoard(date, [entry(), pending], { status: "dispatched" }, now);
    expect(board.exceptionsToDecide).toBe(1);
    expect(board.counts.exception).toBe(1);
    expect(exceptionsToDecide(board.shipments)).toEqual([]);
    expect(board.shipments).toEqual([pending]);
  });

  it("excludes exceptions from delivery-window risk filters", () => {
    expect(filterBoard(date, [entry()], { flag: "late" }, now).exceptionsToDecide).toBe(0);
    expect(filterBoard(date, [], {}, now).exceptionsToDecide).toBe(0);
  });
});
