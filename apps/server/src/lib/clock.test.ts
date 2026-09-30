import { describe, expect, it } from "vitest";
import { createClock } from "./clock.ts";

describe("createClock", () => {
  it("returns the system time", () => {
    const now = createClock({ nodeEnv: "production" })();
    expect(Math.abs(now.getTime() - Date.now())).toBeLessThan(1000);
  });

  it("starts from DOMY_FAKE_NOW in development and test, and keeps running", () => {
    for (const nodeEnv of ["development", "test"]) {
      const now = createClock({ nodeEnv, fakeNow: "2026-10-01T22:00:00Z" })();
      expect(now.getTime() - Date.parse("2026-10-01T22:00:00Z")).toBeGreaterThanOrEqual(0);
      expect(now.getTime() - Date.parse("2026-10-01T22:00:00Z")).toBeLessThan(1000);
    }
  });

  it("ignores DOMY_FAKE_NOW in production", () => {
    const now = createClock({ nodeEnv: "production", fakeNow: "2026-10-01T22:00:00Z" })();
    expect(Math.abs(now.getTime() - Date.now())).toBeLessThan(1000);
  });

  it("rejects an unparseable fake time", () => {
    expect(() => createClock({ nodeEnv: "test", fakeNow: "mañana" })).toThrow();
  });
});
