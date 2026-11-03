import { useLayoutEffect, useSyncExternalStore } from "react";
import { z } from "zod";

/**
 * The panel's light or dark theme (design-system.md §3.1; feature 006, FR-011, research R3):
 * it follows the computer until the person chooses, and the choice stays on that computer.
 * The choice becomes the `data-scheme` of the generated tokens; its absence follows the device.
 */

export type Theme = "light" | "dark";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

const key = "domy-theme";
const theme = z.enum(["light", "dark"]);
const darkQuery = "(prefers-color-scheme: dark)";

export function readTheme(storage: PreferenceStorage = localStorage): Theme | null {
  try {
    const parsed = theme.safeParse(storage.getItem(key));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveTheme(choice: Theme, storage: PreferenceStorage = localStorage): void {
  try {
    storage.setItem(key, choice);
  } catch {
    // The choice lasts until the page closes.
  }
}

/** The theme the switch moves to: the opposite of the one on screen. */
export function nextTheme(choice: Theme | null, deviceIsDark: boolean): Theme {
  const shown = choice ?? (deviceIsDark ? "dark" : "light");
  return shown === "dark" ? "light" : "dark";
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const media = window.matchMedia(darkQuery);
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

/**
 * The panel's theme, applied to the document while the panel is open and removed when it
 * closes, so the courier app and the public pages keep following their own rules.
 */
export function usePanelTheme(): { shown: Theme; toggle: () => void } {
  const choice = useSyncExternalStore(subscribe, () => readTheme());
  const deviceIsDark = useSyncExternalStore(subscribe, () => window.matchMedia(darkQuery).matches);
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (choice) root.dataset["scheme"] = choice;
    else delete root.dataset["scheme"];
    return () => {
      delete root.dataset["scheme"];
    };
  }, [choice]);
  return {
    shown: choice ?? (deviceIsDark ? "dark" : "light"),
    toggle: () => {
      saveTheme(nextTheme(choice, deviceIsDark));
      for (const listener of listeners) listener();
    },
  };
}
