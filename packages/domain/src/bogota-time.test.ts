import { describe, expect, it } from "vitest";
import { bogotaLocalTimeToInstant, bogotaToday } from "./bogota-time.ts";

describe("bogotaToday", () => {
  it("returns the Colombian day at 19:30 in Bogotá (00:30 UTC of the next day)", () => {
    expect(bogotaToday(new Date("2026-10-02T00:30:00Z"))).toBe("2026-10-01");
  });

  it("returns the same day in the morning", () => {
    expect(bogotaToday(new Date("2026-10-01T13:00:00Z"))).toBe("2026-10-01");
  });
});

describe("bogotaLocalTimeToInstant", () => {
  it("converts a local time on a service date to the right instant", () => {
    expect(bogotaLocalTimeToInstant("2026-10-01", "17:00").toISOString()).toBe(
      "2026-10-01T22:00:00.000Z",
    );
    expect(bogotaLocalTimeToInstant("2026-10-01", "08:00").toISOString()).toBe(
      "2026-10-01T13:00:00.000Z",
    );
  });

  it("rejects malformed input", () => {
    expect(() => bogotaLocalTimeToInstant("2026-13-01", "08:00")).toThrow();
    expect(() => bogotaLocalTimeToInstant("2026-10-01", "25:00")).toThrow();
  });
});
