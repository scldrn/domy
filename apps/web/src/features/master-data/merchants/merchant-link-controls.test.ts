import { describe, expect, it } from "vitest";
import { merchantLinkIntent } from "./merchant-link-intent";
import {
  initialMerchantLinkControlsState,
  merchantLinkControlsReducer,
} from "./merchant-link-controls-state";
import { merchantLinkUrl } from "./merchant-link-controls";

describe("merchant link address", () => {
  it("uses the configured public origin and the merchant-page route", () => {
    const configuredOrigin = "https://links.cohex.example";
    const url = new URL(merchantLinkUrl(configuredOrigin, "A_b-c0123456789D3eFghij"));

    expect(url.origin).toBe(configuredOrigin);
    expect(url.pathname).toBe("/cliente/A_b-c0123456789D3eFghij");
    expect(url.search).toBe("");
  });
});

describe("merchant link replacement recovery", () => {
  it("allows closing after an uncertain error and retries with the same action ID", () => {
    const actorId = "0194d9f0-0000-7000-8000-000000000001";
    const merchantId = "0194d9f0-0000-7000-8000-000000000002";
    const actionId = "0194d9f0-0000-7000-8000-000000000003";
    const createActionId = () => actionId;
    let state = initialMerchantLinkControlsState;

    state = merchantLinkControlsReducer(state, { type: "open" });
    const intent = merchantLinkIntent(state.intent, actorId, merchantId, createActionId);
    state = merchantLinkControlsReducer(state, { type: "begin", intent });
    expect(merchantLinkControlsReducer(state, { type: "close" })).toEqual(state);
    state = merchantLinkControlsReducer(state, { type: "fail", message: "Red sin confirmar" });

    expect(state.replacing).toBe(false);
    expect(state.error).toBe("Red sin confirmar");
    expect(state.intent).toEqual(intent);

    state = merchantLinkControlsReducer(state, { type: "close" });
    expect(state.confirming).toBe(false);
    expect(state.intent).toEqual(intent);

    state = merchantLinkControlsReducer(state, { type: "open" });
    const retryIntent = merchantLinkIntent(state.intent, actorId, merchantId, () => {
      throw new Error("A retry must reuse its accepted action ID");
    });

    expect(state.confirming).toBe(true);
    expect(retryIntent).toEqual(intent);
    expect(retryIntent.actionId).toBe(actionId);
  });
});
