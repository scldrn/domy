import { describe, expect, it } from "vitest";
import { normalizeIpAddress, resolveClientAddress } from "./client-address.ts";

describe("public client transport identity", () => {
  it("uses the native peer when proxy trust is unset, even with a canonical header", () => {
    expect(resolveClientAddress("192.0.2.10", undefined, "198.51.100.7")).toBe("192.0.2.10");
  });

  it("uses the canonical client IP only for the exact configured proxy peer", () => {
    expect(resolveClientAddress("172.31.254.2", "172.31.254.2", "198.51.100.7")).toBe(
      "198.51.100.7",
    );
    expect(resolveClientAddress("172.31.254.3", "172.31.254.2", "198.51.100.7")).toBe(
      "172.31.254.3",
    );
  });

  it("canonicalizes equivalent IPv6 peers and IPv4-mapped IPv6 identities", () => {
    expect(
      resolveClientAddress("2001:db8::1", "2001:0db8:0:0:0:0:0:1", "::ffff:198.51.100.7"),
    ).toBe("198.51.100.7");
    expect(normalizeIpAddress("::ffff:192.0.2.8")).toBe("192.0.2.8");
  });

  const invalidHeaders: [string, string, string | readonly string[]][] = [
    ["172.31.254.2", "172.31.254.2", "198.51.100.7, 203.0.113.8"],
    ["172.31.254.2", "172.31.254.2", ["198.51.100.7", "203.0.113.8"]],
    ["172.31.254.2", "172.31.254.2", "198.51.100.7:443"],
    ["172.31.254.2", "172.31.254.2", "198.51.100.0/24"],
    ["172.31.254.2", "172.31.254.2", "not-an-ip"],
  ];

  it.each(invalidHeaders)(
    "falls back to the proxy bucket for invalid or multiple headers",
    (peer, trusted, header) => {
      expect(resolveClientAddress(peer, trusted, header)).toBe("172.31.254.2");
    },
  );

  it.each(["172.31.254.2/32", "172.31.254.2:8443", "fe80::1%en0", "bad-address"])(
    "does not trust a malformed configured peer: %s",
    (trustedProxyIp) => {
      expect(resolveClientAddress("172.31.254.2", trustedProxyIp, "198.51.100.7")).toBe(
        "172.31.254.2",
      );
    },
  );

  it("uses the unknown bucket when the native peer is unavailable or malformed", () => {
    expect(resolveClientAddress(undefined, "172.31.254.2", "198.51.100.7")).toBe("unknown");
    expect(resolveClientAddress("not-an-ip", undefined, undefined)).toBe("unknown");
  });
});
