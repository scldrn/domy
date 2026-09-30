import { useSyncExternalStore } from "react";

const query = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => {
    media.removeEventListener("change", onChange);
  };
}

/** True on windows narrower than 768 px. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
