import { describe, expect, it } from "vitest";
import {
  presetFromWindow,
  windowFromPreset,
  windowWarnings,
  type WindowPreset,
} from "./delivery-windows.ts";

const date = "2026-10-01";

describe("windowFromPreset", () => {
  it("maps 'En la mañana' to 08:00–12:00 in Bogotá", () => {
    const window = windowFromPreset(date, { preset: "morning" });
    expect(window.windowStart?.toISOString()).toBe("2026-10-01T13:00:00.000Z");
    expect(window.windowEnd?.toISOString()).toBe("2026-10-01T17:00:00.000Z");
  });

  it("maps 'En la tarde' to 12:00–20:00", () => {
    const window = windowFromPreset(date, { preset: "afternoon" });
    expect(window.windowStart?.toISOString()).toBe("2026-10-01T17:00:00.000Z");
    expect(window.windowEnd?.toISOString()).toBe("2026-10-02T01:00:00.000Z");
  });

  it("maps 'Antes de las 17:00' to a latest time only", () => {
    const window = windowFromPreset(date, { preset: "before", end: "17:00" });
    expect(window.windowStart).toBeNull();
    expect(window.windowEnd?.toISOString()).toBe("2026-10-01T22:00:00.000Z");
  });

  it("maps 'Después de las 14:00' to an earliest time only", () => {
    const window = windowFromPreset(date, { preset: "after", start: "14:00" });
    expect(window.windowStart?.toISOString()).toBe("2026-10-01T19:00:00.000Z");
    expect(window.windowEnd).toBeNull();
  });

  it("maps 'Entre 13:00 y 17:00'", () => {
    const window = windowFromPreset(date, { preset: "between", start: "13:00", end: "17:00" });
    expect(window.windowStart?.toISOString()).toBe("2026-10-01T18:00:00.000Z");
    expect(window.windowEnd?.toISOString()).toBe("2026-10-01T22:00:00.000Z");
  });

  it("rejects a start that is not before the end", () => {
    expect(() =>
      windowFromPreset(date, { preset: "between", start: "17:00", end: "13:00" }),
    ).toThrow("La hora inicial debe ser anterior a la final.");
  });

  it("rejects times outside operating hours 08:00–20:00", () => {
    expect(() => windowFromPreset(date, { preset: "before", end: "21:00" })).toThrow(
      "Las franjas van de 8:00 a. m. a 8:00 p. m.",
    );
    expect(() => windowFromPreset(date, { preset: "after", start: "07:30" })).toThrow();
  });
});

describe("windowWarnings", () => {
  const now = new Date("2026-10-01T19:00:00Z"); // 14:00 in Bogotá

  it("warns about a Sunday service date", () => {
    expect(windowWarnings("2026-10-04", null, now).sunday).toBe(true);
    expect(windowWarnings("2026-10-05", null, now).sunday).toBe(false);
  });

  it("warns about a window that has already passed", () => {
    expect(windowWarnings(date, windowFromPreset(date, { preset: "morning" }), now).past).toBe(
      true,
    );
    expect(windowWarnings(date, windowFromPreset(date, { preset: "afternoon" }), now).past).toBe(
      false,
    );
  });
});

describe("presetFromWindow", () => {
  it("returns the preset of every stored window", () => {
    const presets: WindowPreset[] = [
      { preset: "morning" },
      { preset: "afternoon" },
      { preset: "before", end: "17:00" },
      { preset: "after", start: "14:30" },
      { preset: "between", start: "09:00", end: "11:00" },
    ];
    for (const preset of presets) {
      expect(presetFromWindow(windowFromPreset(date, preset))).toEqual(preset);
    }
    expect(presetFromWindow({ windowStart: null, windowEnd: null })).toBeNull();
  });
});
