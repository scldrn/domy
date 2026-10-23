import { describe, expect, it, vi } from "vitest";
import { merchantLinkIntent, type MerchantLinkIntent } from "./merchant-link-intent";

const merchantId = "0194d9f0-0000-7000-8000-000000000011";
const actorId = "0194d9f0-0000-7000-8000-000000000012";
const actionId = "0194d9f0-0000-7000-8000-000000000013";

describe("merchant link replacement intent", () => {
  it("reuses the accepted action ID for retries and creates a new ID after success", () => {
    const generatedIds = [actionId, "0194d9f0-0000-7000-8000-000000000014"];
    const createActionId = vi.fn(() => generatedIds.shift() ?? "unexpected-id");
    const first = merchantLinkIntent(null, actorId, merchantId, createActionId);
    const retry = merchantLinkIntent(first, actorId, merchantId, createActionId);

    expect(first).toEqual({ actorId, merchantId, actionId });
    expect(retry.actionId).toBe(first.actionId);
    expect(createActionId).toHaveBeenCalledTimes(1);

    const next = merchantLinkIntent(null, actorId, merchantId, createActionId);
    expect(next.actionId).toBe("0194d9f0-0000-7000-8000-000000000014");
  });

  it("refuses to reuse an accepted ID after the actor or target changes", () => {
    const intent: MerchantLinkIntent = { actorId, merchantId, actionId };
    const createActionId = vi.fn(() => "0194d9f0-0000-7000-8000-000000000015");

    expect(() =>
      merchantLinkIntent(
        intent,
        "0194d9f0-0000-7000-8000-000000000016",
        merchantId,
        createActionId,
      ),
    ).toThrow();
    expect(() =>
      merchantLinkIntent(intent, actorId, "0194d9f0-0000-7000-8000-000000000017", createActionId),
    ).toThrow();
    expect(createActionId).not.toHaveBeenCalled();
  });
});
