import type { MerchantLinkIntent } from "./merchant-link-intent";

export type MerchantLinkControlsState = Readonly<{
  confirming: boolean;
  replacing: boolean;
  intent: MerchantLinkIntent | null;
  error: string | null;
}>;

export type MerchantLinkControlsEvent =
  | { type: "open" }
  | { type: "close" }
  | { type: "begin"; intent: MerchantLinkIntent }
  | { type: "fail"; message: string }
  | { type: "succeed" };

export const initialMerchantLinkControlsState: MerchantLinkControlsState = {
  confirming: false,
  replacing: false,
  intent: null,
  error: null,
};

export function merchantLinkControlsReducer(
  state: MerchantLinkControlsState,
  event: MerchantLinkControlsEvent,
): MerchantLinkControlsState {
  switch (event.type) {
    case "open":
      return { ...state, confirming: true };
    case "close":
      return state.replacing ? state : { ...state, confirming: false };
    case "begin":
      return {
        confirming: true,
        replacing: true,
        intent: event.intent,
        error: null,
      };
    case "fail":
      return { ...state, confirming: true, replacing: false, error: event.message };
    case "succeed":
      return initialMerchantLinkControlsState;
  }
}
