/**
 * The courier app's color scheme (design-system.md §3.1): light by default, and high contrast
 * for direct sunlight as a one-tap setting kept on the phone. A blocked storage means light.
 */

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

const key = "domy.mensajero.alto-contraste";

export function readHighContrast(storage: PreferenceStorage = localStorage): boolean {
  try {
    return storage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function saveHighContrast(on: boolean, storage: PreferenceStorage = localStorage): void {
  try {
    storage.setItem(key, on ? "1" : "0");
  } catch {
    // The setting lasts until the app closes.
  }
}

/** The `data-scheme` of the generated tokens (`styles/tokens.css`). */
export function courierScheme(highContrast: boolean): "high-contrast" | "light" {
  return highContrast ? "high-contrast" : "light";
}
