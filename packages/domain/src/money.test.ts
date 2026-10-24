import { describe, expect, it } from "vitest";
import {
  addCop,
  formatCop,
  maxAggregateCop,
  maxCop,
  maxFieldCop,
  minCop,
  needsAmountConfirmation,
  parseCop,
  safeIntegerCop,
} from "./money.ts";

describe("monetary constants and bounds", () => {
  it("defines standard PostgreSQL int4 field bounds and safe aggregate bounds", () => {
    expect(minCop).toBe(0);
    expect(maxCop).toBe(2_147_483_647);
    expect(maxFieldCop).toBe(2_147_483_647);
    expect(maxAggregateCop).toBe(Number.MAX_SAFE_INTEGER);
    expect(maxAggregateCop).toBe(9_007_199_254_740_991);
  });
});

describe("formatCop", () => {
  it("formats whole pesos with dot thousands separators", () => {
    expect(formatCop(13000)).toBe("$ 13.000");
    expect(formatCop(1194700)).toBe("$ 1.194.700");
    expect(formatCop(0)).toBe("$ 0");
    expect(formatCop(2_400_000_000)).toBe("$ 2.400.000.000");
  });

  it("refuses non-integer amounts", () => {
    expect(() => formatCop(12.5)).toThrow();
  });
});

describe("parseCop", () => {
  it.each([
    ["$ 13.000", 13000],
    ["13000", 13000],
    ["13 000", 13000],
    ["$13.000", 13000],
    [" 0 ", 0],
    ["$ 2.147.483.647", 2_147_483_647],
  ])("parses %j", (input, expected) => {
    expect(parseCop(input)).toBe(expected);
  });

  it.each([
    "13000,50",
    "13.000,5",
    "-13000",
    "",
    "   ",
    "trece mil",
    "12.5",
    "2147483648", // Exceeds maxCop int4 bound
    "3000000000", // Exceeds maxCop int4 bound (IV-13)
  ])("rejects %j", (input) => {
    expect(parseCop(input)).toBeNull();
  });

  it("allows custom upper bound when parsing aggregates", () => {
    expect(parseCop("3.000.000.000", maxAggregateCop)).toBe(3_000_000_000);
  });
});

describe("addCop", () => {
  it("adds integer COP amounts exactly", () => {
    expect(addCop(10_000, 20_000, 30_000)).toBe(60_000);
    expect(addCop(1_200_000_000, 1_200_000_000)).toBe(2_400_000_000);
    expect(addCop(0)).toBe(0);
    expect(addCop()).toBe(0);
  });

  it("throws RangeError on non-safe-integer or float amounts", () => {
    expect(() => addCop(100.5, 200)).toThrow(RangeError);
    expect(() => addCop(100, NaN)).toThrow(RangeError);
    expect(() => addCop(100, Infinity)).toThrow(RangeError);
  });
});

describe("safeIntegerCop", () => {
  it("parses valid integer numbers and string integers safely", () => {
    expect(safeIntegerCop(0)).toBe(0);
    expect(safeIntegerCop("0")).toBe(0);
    expect(safeIntegerCop(150_000)).toBe(150_000);
    expect(safeIntegerCop("2400000000")).toBe(2_400_000_000);
    expect(safeIntegerCop(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("refuses negative, non-integer, or out-of-bound amounts", () => {
    expect(() => safeIntegerCop(-1)).toThrow(RangeError);
    expect(() => safeIntegerCop("-5000")).toThrow(RangeError);
    expect(() => safeIntegerCop(12.5)).toThrow(RangeError);
    expect(() => safeIntegerCop("abc")).toThrow(RangeError);
    expect(() => safeIntegerCop(3_000_000_000, maxCop)).toThrow(RangeError);
    expect(() => safeIntegerCop(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});

describe("needsAmountConfirmation (feature 001 FR-037, feature 003 FR-011, DESIGN-3)", () => {
  it("asks for a fee above COP 100.000, not at it", () => {
    expect(needsAmountConfirmation({ fee: 100_000, codAmount: 0 })).toBe(false);
    expect(needsAmountConfirmation({ fee: 100_001, codAmount: 0 })).toBe(true);
  });

  it("asks for a COD amount, collected total or disbursement above COP 2.000.000, not at it", () => {
    expect(needsAmountConfirmation({ fee: 0, codAmount: 2_000_000 })).toBe(false);
    expect(needsAmountConfirmation({ fee: 0, codAmount: 2_000_001 })).toBe(true);
    expect(needsAmountConfirmation({ codAmount: 2_000_000 })).toBe(false);
    expect(needsAmountConfirmation({ codAmount: 2_000_001 })).toBe(true);
  });

  it("on an edit, asks only for a large amount that changed", () => {
    const previous = { fee: 150_000, codAmount: 3_000_000 };
    expect(needsAmountConfirmation({ fee: 150_000, codAmount: 3_000_000 }, previous)).toBe(false);
    expect(needsAmountConfirmation({ fee: 150_001, codAmount: 3_000_000 }, previous)).toBe(true);
    expect(needsAmountConfirmation({ fee: 150_000, codAmount: 3_000_001 }, previous)).toBe(true);
    expect(needsAmountConfirmation({ fee: 100_000, codAmount: 2_000_000 }, previous)).toBe(false);
    expect(needsAmountConfirmation({ fee: 100_001, codAmount: 0 }, { fee: 0, codAmount: 0 })).toBe(
      true,
    );
  });
});
