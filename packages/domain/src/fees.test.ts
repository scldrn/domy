import { describe, expect, it } from "vitest";
import { calculateFee, type RateEntry } from "./fees.ts";

const merchant = "11111111-1111-4111-8111-111111111111";
const otherMerchant = "22222222-2222-4222-8222-222222222222";
const medellin = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bello = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const jan1 = new Date("2026-01-01T05:00:00Z");
const registeredAt = new Date("2026-10-01T15:00:00Z");

const entry = (overrides: Partial<RateEntry>): RateEntry => ({
  kind: "zone_rate",
  merchantId: null,
  rateZoneId: medellin,
  amount: 13000,
  effectiveFrom: jan1,
  createdAt: jan1,
  ...overrides,
});

const standard: RateEntry[] = [
  entry({}),
  entry({ rateZoneId: bello, amount: 15000 }),
  entry({ kind: "express_surcharge", rateZoneId: null, amount: 4500 }),
];

const base = {
  kind: "delivery" as const,
  merchantId: merchant,
  rateZoneId: medellin,
  serviceLevel: "standard" as const,
  registeredAt,
};

describe("calculateFee", () => {
  it("uses the standard zone rate", () => {
    expect(calculateFee({ ...base, entries: standard })).toEqual({
      calculatedFee: 13000,
      needsManualFee: false,
      needsReview: false,
    });
  });

  it("prefers the merchant's zone rate over the standard one", () => {
    const entries = [
      ...standard,
      entry({ merchantId: merchant, rateZoneId: bello, amount: 10700 }),
    ];
    expect(calculateFee({ ...base, rateZoneId: bello, entries }).calculatedFee).toBe(10700);
  });

  it("ignores another merchant's rates", () => {
    const entries = [...standard, entry({ merchantId: otherMerchant, amount: 9700 })];
    expect(calculateFee({ ...base, entries }).calculatedFee).toBe(13000);
  });

  it("adds the standard express surcharge", () => {
    expect(
      calculateFee({ ...base, serviceLevel: "express", entries: standard }).calculatedFee,
    ).toBe(17500);
  });

  it("accepts a merchant express surcharge of 0", () => {
    const entries = [
      ...standard,
      entry({ kind: "express_surcharge", merchantId: merchant, rateZoneId: null, amount: 0 }),
    ];
    expect(calculateFee({ ...base, serviceLevel: "express", entries }).calculatedFee).toBe(13000);
  });

  it("uses the latest entry not effective after the registration instant", () => {
    const entries = [
      ...standard,
      entry({ amount: 14000, effectiveFrom: new Date("2026-09-01T05:00:00Z") }),
      entry({ amount: 15000, effectiveFrom: new Date("2026-11-01T05:00:00Z") }),
    ];
    expect(calculateFee({ ...base, entries }).calculatedFee).toBe(14000);
  });

  it("breaks ties on the same effective date by the latest created entry", () => {
    const effectiveFrom = new Date("2026-09-01T05:00:00Z");
    const entries = [
      ...standard,
      entry({ amount: 14000, effectiveFrom, createdAt: new Date("2026-08-01T00:00:00Z") }),
      entry({ amount: 14500, effectiveFrom, createdAt: new Date("2026-08-02T00:00:00Z") }),
    ];
    expect(calculateFee({ ...base, entries }).calculatedFee).toBe(14500);
  });

  it("asks for a manual fee flagged for review when the zone has no rate", () => {
    expect(
      calculateFee({
        ...base,
        rateZoneId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        entries: standard,
      }),
    ).toEqual({
      calculatedFee: null,
      needsManualFee: true,
      needsReview: true,
    });
  });

  it("asks for a manual fee without review for an errand", () => {
    expect(calculateFee({ ...base, kind: "errand", rateZoneId: null, entries: standard })).toEqual({
      calculatedFee: null,
      needsManualFee: true,
      needsReview: false,
    });
  });
});
