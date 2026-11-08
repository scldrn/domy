import { describe, expect, it } from "vitest";
import { courierScheme, readHighContrast, saveHighContrast } from "./scheme";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

const broken = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

/** High contrast for direct sunlight, one tap away (design-system.md §3.1). */
describe("courier scheme", () => {
  it("is light by default and high contrast once chosen, on this phone", () => {
    const storage = memoryStorage();
    expect(readHighContrast(storage)).toBe(false);
    saveHighContrast(true, storage);
    expect(readHighContrast(storage)).toBe(true);
    saveHighContrast(false, storage);
    expect(readHighContrast(storage)).toBe(false);
  });

  it("falls back to light when the phone's storage is blocked", () => {
    expect(readHighContrast(broken)).toBe(false);
    expect(() => {
      saveHighContrast(true, broken);
    }).not.toThrow();
  });

  it("names the scheme of the generated tokens, and follows the phone without high contrast", () => {
    expect(courierScheme(true)).toBe("high-contrast");
    // No scheme: the tokens follow the phone's light or dark preference (feature 006, FR-015a).
    expect(courierScheme(false)).toBeUndefined();
  });
});
