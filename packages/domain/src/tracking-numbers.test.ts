import { describe, expect, it } from "vitest";
import {
  formatTrackingNumber,
  generateTrackingNumber,
  normalizeTrackingNumber,
} from "./tracking-numbers.ts";

describe("generateTrackingNumber", () => {
  it("returns 8 Crockford Base32 characters without I, L, O, or U", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateTrackingNumber()).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
    }
  });

  it("is random", () => {
    const numbers = new Set(Array.from({ length: 1000 }, () => generateTrackingNumber()));
    expect(numbers.size).toBe(1000);
  });
});

describe("formatTrackingNumber", () => {
  it("displays two groups of four", () => {
    expect(formatTrackingNumber("7K3F9Q2M")).toBe("7K3F-9Q2M");
  });
});

describe("normalizeTrackingNumber", () => {
  it.each([
    ["7k3f-9q2m", "7K3F9Q2M"],
    ["7K3F 9Q2M", "7K3F9Q2M"],
    ["O1IL-ABCD", "0111ABCD"],
  ])("normalizes %j", (input, expected) => {
    expect(normalizeTrackingNumber(input)).toBe(expected);
  });

  it.each(["7K3F9Q2", "7K3F9Q2MX", "7K3F-9Q2U", ""])("rejects %j", (input) => {
    expect(normalizeTrackingNumber(input)).toBeNull();
  });
});
