import { describe, expect, it } from "vitest";
import { bogotaDayRange, bogotaLocalTimeToInstant, bogotaToday } from "./bogota-time.ts";

describe("bogotaToday", () => {
  it("returns the Colombian day at 19:30 in Bogotá (00:30 UTC of the next day)", () => {
    expect(bogotaToday(new Date("2026-10-02T00:30:00Z"))).toBe("2026-10-01");
  });

  it("returns the same day in the morning", () => {
    expect(bogotaToday(new Date("2026-10-01T13:00:00Z"))).toBe("2026-10-01");
  });
});

describe("bogotaDayRange", () => {
  it("returns the start and end of a Colombian day as instants", () => {
    const { start, end } = bogotaDayRange("2026-10-01");
    expect(start.toISOString()).toBe("2026-10-01T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-02T05:00:00.000Z");
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
