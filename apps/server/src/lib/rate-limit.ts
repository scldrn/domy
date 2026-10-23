/** Maximum requests allowed from one native transport peer in a fixed window. */
export const PUBLIC_RATE_LIMIT_MAX_REQUESTS = 60;
export const PUBLIC_RATE_LIMIT_WINDOW_MS = 60_000;
/** Hard memory bound; new peers fail closed while every retained bucket is live. */
export const MAX_PUBLIC_RATE_LIMIT_CLIENTS = 10_000;

export type PublicRateLimitBucket = { windowStartedAt: number; requests: number };

export type PublicRateLimitState = {
  buckets: Map<string, PublicRateLimitBucket>;
  nextCleanupAt: number;
};

/**
 * Returns whether a public request is allowed. Expired entries are swept once per fixed
 * window; the hard cap rejects new peers rather than evicting live buckets (research R14).
 */
export function allowPublicRequest(
  state: PublicRateLimitState,
  clientAddress: string,
  now: number,
): boolean {
  if (!clientAddress || !Number.isFinite(now)) return false;

  if (now >= state.nextCleanupAt) {
    for (const [address, bucket] of state.buckets) {
      if (now >= bucket.windowStartedAt + PUBLIC_RATE_LIMIT_WINDOW_MS) {
        state.buckets.delete(address);
      }
    }
    state.nextCleanupAt = now + PUBLIC_RATE_LIMIT_WINDOW_MS;
  }

  const bucket = state.buckets.get(clientAddress);
  if (bucket) {
    if (now >= bucket.windowStartedAt + PUBLIC_RATE_LIMIT_WINDOW_MS) {
      state.buckets.set(clientAddress, { windowStartedAt: now, requests: 1 });
      return true;
    }
    if (bucket.requests >= PUBLIC_RATE_LIMIT_MAX_REQUESTS) return false;
    bucket.requests++;
    return true;
  }

  if (state.buckets.size >= MAX_PUBLIC_RATE_LIMIT_CLIENTS) return false;
  state.buckets.set(clientAddress, { windowStartedAt: now, requests: 1 });
  return true;
}
