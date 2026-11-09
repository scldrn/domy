# OP-01 trusted proxy contract alignment

**Date:** 2026-10-22
**Scope:** Documentation alignment only. No runtime behavior, environment schema,
container artifacts, build, database, or deployment was changed or exercised.

The OP-01 draft in
[the local deployment artifact plan](../../docs/archive/local-deployment-artifact-plan.md#network-and-proxy-identity-boundary)
selects one opt-in trusted proxy identity for the synthetic local lab. The feature
artifacts now state the same bounded interface and preserve direct native-peer
behavior by default:

- Optional `DOMY_TRUSTED_PROXY_IP` is one strict IPv4/IPv6 address, not a CIDR,
  port, zone ID, list, or empty-string mode. Unset preserves direct mode; invalid
  configuration fails validation.
- `index.ts` supplies optional `AppDeps.trustedProxyIp`; a pure
  `resolveClientAddress(nativePeer, trustedProxyIp, canonicalHeader)` helper in
  `apps/server/src/lib/client-address.ts` trusts `X-Domy-Client-IP` only from an
  exact normalized peer match with exactly one valid client IP. IPv4-mapped IPv6
  is normalized. Repeated, comma-separated, malformed, or non-IP values fall back
  to native peer or `unknown`; behind the trusted proxy this creates the shared
  bounded 60-per-minute availability bucket.
- `Forwarded`, `X-Forwarded-For`, and `X-Real-IP` remain ignored. Caddy must
  overwrite the canonical header. The lab topology is edge
  `172.31.253.0/29` (Caddy `.2`, clients `.3`/`.4`), proxy/app
  `172.31.254.0/29` (Caddy `.2`, app `.3`), and internal DB
  `172.31.252.0/29`; app and DB stay unpublished. These are not production
  network choices.

The artifacts preserve current direct-mode forged-header tests and require helper,
environment, exact-peer, malformed/multiple-header, and fallback coverage plus a
real Caddy test where client A's 61st request is limited and client B remains
allowed. They also require proof of header replacement, no untrusted peer identity,
unpublished backend, and privacy-marker absence in both logs. These checks remain
planned; no OP-01 code, lab, or physical-phone evidence is claimed.

## Files aligned

- [Research R22](research.md#r22-opt-in-trusted-proxy-identity-for-op-01-2026-10-22)
- [Plan OP-01 alignment](plan.md#op-01-trusted-proxy-alignment-documentation-only-2026-10-22)
- [HTTP transport contract](contracts/http-api.md#op-01-public-rate-limit-transport-identity-2026-10-22)
- [OP-01 artifact plan](../../docs/archive/local-deployment-artifact-plan.md#network-and-proxy-identity-boundary)

No feature task ID, reviewer checklist, status ledger, or verified task was changed.
