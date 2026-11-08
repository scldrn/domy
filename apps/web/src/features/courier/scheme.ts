/**
 * The courier app's color scheme (design-system.md §3.1): the phone's light or dark, and high contrast
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

/**
 * The `data-scheme` of the generated tokens (`styles/tokens.css`): high contrast when chosen;
 * otherwise none, so the app follows the phone's light or dark preference (feature 006,
 * FR-015a).
 */
export function courierScheme(highContrast: boolean): "high-contrast" | undefined {
  return highContrast ? "high-contrast" : undefined;
}
