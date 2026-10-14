import { describe, expect, it } from "vitest";
import { freshLocation } from "./location";

const at = Date.parse("2026-10-01T15:00:00Z");
const position = { latitude: 6.2442, longitude: -75.5812, accuracyM: 12.4, at };

/** The last known position, never awaited (feature 003, research R7, FR-015). */
describe("freshLocation", () => {
  it("attaches a position at most 2 minutes old, in whole meters", () => {
    expect(freshLocation(position, at + 120_000)).toEqual({
      latitude: 6.2442,
      longitude: -75.5812,
      accuracyM: 12,
    });
  });

  it("attaches none when it is older or unknown", () => {
    expect(freshLocation(position, at + 120_001)).toBeUndefined();
    expect(freshLocation(null, at)).toBeUndefined();
  });
});
