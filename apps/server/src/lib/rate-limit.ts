import { isIP } from "node:net";

/** Maximum requests allowed from one native transport peer in a fixed window. */
export const PUBLIC_RATE_LIMIT_MAX_REQUESTS = 60;
export const PUBLIC_RATE_LIMIT_WINDOW_MS = 60_000;
/** Hard memory bound; unknown clients fail closed while retained buckets are live (R14). */
export const MAX_PUBLIC_RATE_LIMIT_CLIENTS = 10_000;

export type RateLimitPolicy = { maxRequests: number; windowMs: number; maxClients: number };

const publicPolicy: RateLimitPolicy = {
  maxRequests: PUBLIC_RATE_LIMIT_MAX_REQUESTS,
  windowMs: PUBLIC_RATE_LIMIT_WINDOW_MS,
  maxClients: MAX_PUBLIC_RATE_LIMIT_CLIENTS,
};

export type PublicRateLimitBucket = { windowStartedAt: number; requests: number };

export type PublicRateLimitState = {
  buckets: Map<string, PublicRateLimitBucket>;
  nextCleanupAt: number;
};

/**
 * The bucket of a canonical client address. One IPv6 subscriber usually holds a whole /64, so
 * IPv6 shares one budget per /64 prefix; IPv4 and the "unknown" peer stay as they are (F004-2).
 */
export function rateLimitKey(clientAddress: string): string {
  if (isIP(clientAddress) !== 6) return clientAddress;
  const [head = "", tail = ""] = clientAddress.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = clientAddress.includes("::")
    ? [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right]
    : left;
  const prefix = groups
    .slice(0, 4)
    .map((group) => Number.parseInt(group || "0", 16).toString(16))
    .join(":");
  return `${prefix}::/64`;
}

/**
 * Returns whether a request is allowed under a fixed-window policy. Expired entries are swept
 * once per window. At capacity, refuse new clients rather than resetting another client's
 * live budget. IPv6 /64 grouping prevents one subscriber from filling the map with addresses.
 */
export function allowRequest(
  state: PublicRateLimitState,
  clientAddress: string,
  now: number,
  policy: RateLimitPolicy,
): boolean {
  if (!clientAddress || !Number.isFinite(now)) return false;
  const key = rateLimitKey(clientAddress);

  if (now >= state.nextCleanupAt) {
    for (const [bucketKey, bucket] of state.buckets) {
      if (now >= bucket.windowStartedAt + policy.windowMs) state.buckets.delete(bucketKey);
    }
    state.nextCleanupAt = now + policy.windowMs;
  }

  const bucket = state.buckets.get(key);
  if (bucket && now < bucket.windowStartedAt + policy.windowMs) {
    if (bucket.requests >= policy.maxRequests) return false;
    bucket.requests++;
    return true;
  }

  if (!bucket && state.buckets.size >= policy.maxClients) return false;
  state.buckets.set(key, { windowStartedAt: now, requests: 1 });
  return true;
}

/** The anonymous public API's budget per client (FR-011, research R6/R14). */
export function allowPublicRequest(
  state: PublicRateLimitState,
  clientAddress: string,
  now: number,
): boolean {
  return allowRequest(state, clientAddress, now, publicPolicy);
}
