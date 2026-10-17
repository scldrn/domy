import { describe, expect, it } from "vitest";
import { collectedTotal, daySummary, type SummaryRecord } from "./day-summary.ts";

const today = "2026-10-01";
const record = (extra: Partial<SummaryRecord>): SummaryRecord => ({
  kind: "delivery",
  outcome: "applied",
  reverted: false,
  occurredAt: new Date("2026-10-01T15:00:00Z"), // 10:00 in Bogotá
  cashAmount: 0,
  companyTransferAmount: 0,
  merchantTransferAmount: 0,
  disbursementAmount: 0,
  ...extra,
});

/** "Mi día" (FR-037, US7). */
describe("daySummary", () => {
  it("adds pending records to a same-day baseline without mutating it (US7 AC2)", () => {
    const baseline = daySummary([record({ cashAmount: 100_000 })], {
      date: today,
      pendingStops: 3,
    });
    expect(
      daySummary(
        [
          record({ companyTransferAmount: 50_000 }),
          record({ merchantTransferAmount: 30_000 }),
          record({ kind: "disbursement", disbursementAmount: 12_000 }),
        ],
        { date: today, pendingStops: 1 },
        baseline,
      ),
    ).toEqual({
      ...baseline,
      deliveries: 3,
      pendingStops: 1,
      companyTransfer: 50_000,
      merchantTransfer: 30_000,
      disbursements: 12_000,
      cashToHandOver: 88_000,
    });
    expect(baseline).toMatchObject({ deliveries: 1, pendingStops: 3, disbursements: 0 });
  });

  it("does not carry yesterday's baseline into today's estimate (FR-037)", () => {
    const yesterday = daySummary([record({ cashAmount: 100_000 })], {
      date: "2026-09-30",
      pendingStops: 3,
    });
    yesterday.cash = 100_000;
    yesterday.deliveries = 1;
    yesterday.cashToHandOver = 100_000;
    expect(daySummary([], { date: today, pendingStops: 2 }, yesterday)).toMatchObject({
      date: today,
      deliveries: 0,
      cash: 0,
      cashToHandOver: 0,
      pendingStops: 2,
    });
  });
  it("adds the collections by payment method and the cash to hand over (US7 scenario 1)", () => {
    const summary = daySummary(
      [
        record({ cashAmount: 100_000 }),
        record({ companyTransferAmount: 50_000 }),
        record({ merchantTransferAmount: 30_000 }),
        record({ kind: "disbursement", disbursementAmount: 12_000 }),
      ],
      { date: today, pendingStops: 2 },
    );
    expect(summary).toEqual({
      date: today,
      deliveries: 3,
      exceptions: 0,
      returns: 0,
      pendingStops: 2,
      cash: 100_000,
      companyTransfer: 50_000,
      merchantTransfer: 30_000,
      disbursements: 12_000,
      cashToHandOver: 88_000,
    });
  });

  it("counts exceptions and returns, and only the courier's applied, not reverted records", () => {
    const summary = daySummary(
      [
        record({ kind: "exception" }),
        record({ kind: "return" }),
        record({ kind: "pickup" }),
        record({ cashAmount: 40_000, reverted: true }),
        record({ cashAmount: 70_000, outcome: "not_applied" }),
        record({ cashAmount: 20_000, outcome: "duplicate" }),
      ],
      { date: today, pendingStops: 0 },
    );
    expect(summary).toMatchObject({
      deliveries: 0,
      exceptions: 1,
      returns: 1,
      cash: 0,
      cashToHandOver: 0,
    });
  });

  it("groups by the Bogotá date, not the UTC one", () => {
    const lateNight = new Date("2026-10-02T03:30:00Z"); // 22:30 on October 1 in Bogotá
    const nextMorning = new Date("2026-10-02T12:00:00Z");
    const summary = daySummary(
      [
        record({ cashAmount: 10_000, occurredAt: lateNight }),
        record({ cashAmount: 99_000, occurredAt: nextMorning }),
      ],
      { date: today, pendingStops: 0 },
    );
    expect(summary.cash).toBe(10_000);
    expect(summary.deliveries).toBe(1);
  });

  it("can owe a negative amount when disbursements exceed the cash collected", () => {
    const summary = daySummary(
      [record({ cashAmount: 5_000 }), record({ kind: "disbursement", disbursementAmount: 8_000 })],
      { date: today, pendingStops: 0 },
    );
    expect(summary.cashToHandOver).toBe(-3_000);
  });
});

describe("collectedTotal", () => {
  it("adds the three payment methods (FR-010, FR-011)", () => {
    expect(
      collectedTotal({
        cashAmount: 50_000,
        companyTransferAmount: 35_000,
        merchantTransferAmount: 0,
      }),
    ).toBe(85_000);
  });
});
