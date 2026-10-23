import { isIP } from "node:net";
import { z } from "zod";

const ipAddressSchema = z
  .string()
  .refine((value) => !/\s/u.test(value) && !value.includes("%") && isIP(value) > 0, {
    error: "Expected one IPv4 or IPv6 address",
  });

function normalizeIpv4MappedIpv6(address: string): string | undefined {
  const match = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/iu.exec(address);
  const highText = match?.[1];
  const lowText = match?.[2];
  if (highText === undefined || lowText === undefined) return undefined;

  const high = Number.parseInt(highText, 16);
  const low = Number.parseInt(lowText, 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

/** Validates through one Zod boundary and canonicalizes IPv6 with the WHATWG URL parser. */
export function normalizeIpAddress(address: string | undefined): string | undefined {
  if (address === undefined) return undefined;
  const parsed = ipAddressSchema.safeParse(address);
  if (!parsed.success) return undefined;

  const validAddress = parsed.data;
  if (isIP(validAddress) === 4) return validAddress;

  let hostname: string;
  try {
    hostname = new URL(`http://[${validAddress}]/`).hostname;
  } catch {
    return undefined;
  }
  if (!hostname.startsWith("[") || !hostname.endsWith("]")) return undefined;

  const canonicalIpv6 = hostname.slice(1, -1).toLowerCase();
  return normalizeIpv4MappedIpv6(canonicalIpv6) ?? canonicalIpv6;
}

/**
 * Resolves the bounded public rate-limit identity. Forwarding is trusted only from the exact
 * configured proxy peer. Duplicate values must be passed as an array or comma-folded string so
 * they fail closed to the native peer.
 */
export function resolveClientAddress(
  nativePeer: string | undefined,
  trustedProxyIp: string | undefined,
  canonicalHeader: string | readonly string[] | undefined,
): string {
  const peer = normalizeIpAddress(nativePeer);
  if (peer === undefined) return "unknown";

  const trustedPeer = normalizeIpAddress(trustedProxyIp);
  if (trustedPeer === undefined || peer !== trustedPeer) return peer;

  let headerValue: string | undefined;
  if (typeof canonicalHeader === "string") {
    headerValue = canonicalHeader;
  } else if (canonicalHeader?.length === 1) {
    const [onlyValue] = canonicalHeader;
    if (typeof onlyValue === "string") headerValue = onlyValue;
  }
  if (headerValue === undefined || headerValue.includes(",")) return peer;
  return normalizeIpAddress(headerValue) ?? peer;
}
