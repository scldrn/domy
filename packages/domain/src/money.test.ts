import { describe, expect, it } from "vitest";
import { formatCop, parseCop } from "./money.ts";

describe("formatCop", () => {
  it("formats whole pesos with dot thousands separators", () => {
    expect(formatCop(13000)).toBe("$ 13.000");
    expect(formatCop(1194700)).toBe("$ 1.194.700");
    expect(formatCop(0)).toBe("$ 0");
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
  ])("parses %j", (input, expected) => {
    expect(parseCop(input)).toBe(expected);
  });

  it.each(["13000,50", "13.000,5", "-13000", "", "   ", "trece mil", "12.5"])(
    "rejects %j",
    (input) => {
      expect(parseCop(input)).toBeNull();
    },
  );
});
