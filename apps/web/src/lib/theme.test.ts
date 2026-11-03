import { describe, expect, it } from "vitest";
import { nextTheme, readTheme, saveTheme } from "./theme";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

const broken = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

/** The panel follows the computer until the person chooses (feature 006, FR-011, research R3). */
describe("panel theme", () => {
  it("follows the computer until a choice is saved, and remembers it", () => {
    const storage = memoryStorage();
    expect(readTheme(storage)).toBeNull();
    saveTheme("dark", storage);
    expect(readTheme(storage)).toBe("dark");
    saveTheme("light", storage);
    expect(readTheme(storage)).toBe("light");
  });

  it("ignores anything but light or dark", () => {
    const storage = memoryStorage();
    storage.setItem("domy-theme", "high-contrast");
    expect(readTheme(storage)).toBeNull();
    storage.setItem("domy-theme", "");
    expect(readTheme(storage)).toBeNull();
  });

  it("follows the computer when storage is blocked", () => {
    expect(readTheme(broken)).toBeNull();
    expect(() => {
      saveTheme("dark", broken);
    }).not.toThrow();
  });

  it("switches to the opposite of what is shown", () => {
    expect(nextTheme(null, false)).toBe("dark");
    expect(nextTheme(null, true)).toBe("light");
    expect(nextTheme("dark", false)).toBe("light");
    expect(nextTheme("light", true)).toBe("dark");
  });
});
