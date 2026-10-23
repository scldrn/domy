import { describe, expect, it } from "vitest";
import {
  MAX_PUBLIC_RATE_LIMIT_CLIENTS,
  PUBLIC_RATE_LIMIT_WINDOW_MS,
  allowPublicRequest,
  type PublicRateLimitState,
} from "./rate-limit.ts";

function createState(): PublicRateLimitState {
  return { buckets: new Map(), nextCleanupAt: 0 };
}

describe("public API rate limit (R6, R14)", () => {
  it("allows 60 requests and refuses the 61st in one window", () => {
    const state = createState();

    for (let request = 1; request <= 60; request++) {
      expect(allowPublicRequest(state, "127.0.0.1", 0)).toBe(true);
    }

    expect(allowPublicRequest(state, "127.0.0.1", 0)).toBe(false);
    expect(state.buckets.get("127.0.0.1")?.requests).toBe(60);
  });

  it("resets at exactly 60 seconds but not before the fixed window expires", () => {
    const state = createState();

    for (let request = 1; request <= 60; request++) {
      expect(allowPublicRequest(state, "127.0.0.1", 0)).toBe(true);
    }

    expect(allowPublicRequest(state, "127.0.0.1", PUBLIC_RATE_LIMIT_WINDOW_MS - 1)).toBe(false);
    expect(allowPublicRequest(state, "127.0.0.1", PUBLIC_RATE_LIMIT_WINDOW_MS)).toBe(true);
    expect(state.buckets.get("127.0.0.1")).toEqual({
      windowStartedAt: PUBLIC_RATE_LIMIT_WINDOW_MS,
      requests: 1,
    });
  });

  it("cleans expired buckets while retaining peers whose window is still active", () => {
    const state = createState();
    expect(allowPublicRequest(state, "expired", 0)).toBe(true);
    expect(allowPublicRequest(state, "active", 59_999)).toBe(true);

    expect(allowPublicRequest(state, "new", PUBLIC_RATE_LIMIT_WINDOW_MS)).toBe(true);
    expect(state.buckets.has("expired")).toBe(false);
    expect(state.buckets.has("active")).toBe(true);
    expect(state.buckets.has("new")).toBe(true);
  });

  it("fails closed at capacity without evicting active client buckets", () => {
    const state = createState();

    for (let client = 0; client < MAX_PUBLIC_RATE_LIMIT_CLIENTS; client++) {
      expect(allowPublicRequest(state, `client-${String(client)}`, 0)).toBe(true);
    }

    expect(allowPublicRequest(state, "overflow", 1)).toBe(false);
    expect(state.buckets.has("overflow")).toBe(false);
    expect(state.buckets.size).toBe(MAX_PUBLIC_RATE_LIMIT_CLIENTS);
    expect(allowPublicRequest(state, "client-0", 1)).toBe(true);
    expect(state.buckets.get("client-0")?.requests).toBe(2);

    expect(allowPublicRequest(state, "overflow", PUBLIC_RATE_LIMIT_WINDOW_MS)).toBe(true);
    expect(state.buckets.has("client-0")).toBe(false);
    expect(state.buckets.size).toBe(1);
  });
});
