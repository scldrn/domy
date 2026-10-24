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

  it("refuses new clients at capacity without resetting an exhausted live budget", () => {
    const state = createState();
    for (let request = 0; request < 60; request++) {
      expect(allowPublicRequest(state, "client-0", 0)).toBe(true);
    }
    for (let client = 1; client < MAX_PUBLIC_RATE_LIMIT_CLIENTS; client++) {
      expect(allowPublicRequest(state, `client-${String(client)}`, client)).toBe(true);
    }
    expect(allowPublicRequest(state, "overflow", MAX_PUBLIC_RATE_LIMIT_CLIENTS)).toBe(false);
    expect(state.buckets.has("overflow")).toBe(false);
    expect(allowPublicRequest(state, "client-0", MAX_PUBLIC_RATE_LIMIT_CLIENTS)).toBe(false);
    expect(state.buckets.size).toBe(MAX_PUBLIC_RATE_LIMIT_CLIENTS);
  });

  it("shares one budget across the addresses of one IPv6 /64", () => {
    const state = createState();

    for (let request = 0; request < 60; request++) {
      expect(allowPublicRequest(state, `2001:db8:1:2::${request.toString(16)}`, 0)).toBe(true);
    }

    expect(allowPublicRequest(state, "2001:db8:1:2:ffff:ffff:ffff:ffff", 0)).toBe(false);
    expect(state.buckets.size).toBe(1);
    expect(allowPublicRequest(state, "2001:db8:1:3::1", 0)).toBe(true);
  });

  it("lets a new /64 in after 10,000 addresses of another /64", () => {
    const state = createState();

    for (let client = 0; client < MAX_PUBLIC_RATE_LIMIT_CLIENTS; client++) {
      allowPublicRequest(state, `2001:db8:aaaa:1:${client.toString(16)}::1`, 0);
    }

    expect(state.buckets.size).toBe(1);
    expect(allowPublicRequest(state, "2001:db8:bbbb:1::1", 0)).toBe(true);
  });
});
