# OP-01 trusted proxy identity implementation — N1

**Date:** 2026-10-22
**Scope:** Local source implementation and pure/env verification only. This does not
claim real Caddy, Docker isolation, production readiness, external provider, or
physical-phone evidence.

Implemented the opt-in transport resolver in
[`client-address.ts`](../../apps/server/src/lib/client-address.ts). Direct mode
continues to bucket by the normalized native peer. The resolver accepts
`X-Domy-Client-IP` only when that peer exactly matches the optional configured
proxy IP; otherwise it uses the native peer or `unknown`. It canonicalizes IPv4,
IPv6, and IPv4-mapped IPv6, rejects invalid proxy configuration and malformed,
comma-folded, or multiple header values, and falls back to the native proxy peer
bucket on invalid client input. No `Forwarded`, XFF, or X-Real-IP value is read.

`DOMY_TRUSTED_PROXY_IP` is optional in `parseEnv`, canonicalized to one exact IP,
and rejects empty, hostname, CIDR, port, zone-ID, comma-list, and whitespace
values. `AppDeps.trustedProxyIp` is optional; the public limiter uses the pure
resolver. `.env.example` documents the setting commented out, preserving direct
mode by default. Tests preserve the native direct-mode forged-header case and add
native-server trusted-peer and raw duplicate-header rate-limit cases.

## Verification

Before implementation, the new environment tests failed in eight cases (14
existing cases passed), and the new helper suite could not import its not-yet-added
module. After implementation:

- `pnpm --filter @domy/server exec vitest run src/lib/client-address.test.ts src/env.test.ts` — 2 files, 35 tests passed.
- `pnpm exec eslint apps/server/src/lib/client-address.ts apps/server/src/lib/client-address.test.ts apps/server/src/env.ts apps/server/src/env.test.ts apps/server/src/app.ts apps/server/tests/public-protection.test.ts --max-warnings 0` — passed.
- `pnpm exec prettier --check` on those six source/test files — passed.
- `pnpm --filter @domy/server typecheck` — passed.
- `node --check apps/server/src/lib/client-address.ts` — passed.

## Native-server causal RED/GREEN

With the original [`app.ts`](../../apps/server/src/app.ts) saved privately at
`.git/local-orchestration/public-proxy/app.ts.pre-red` (mode `0600`), its original
SHA-256 was `92293da1ab95c48cbcea2525ff551df77544b677ec2f00c5395952e8e3e71ba8`.
For the causal RED only, the limiter identity was temporarily changed to the old
native-only expression `nativePeerAddress(c) ?? "unknown"`; no test or fixture
was altered. The targeted command was:

```sh
pnpm --filter @domy/server exec vitest run tests/public-protection.test.ts -t 'uses canonical client IPs only behind the explicitly trusted native peer'
```

It exited 1 as expected: the second canonical client received `429`, not `404`,
at `tests/public-protection.test.ts:234`, because both requests shared the native
loopback bucket. The private first-failure log is
`.git/local-orchestration/public-proxy/red.log` (mode `0600`). The exact original
`app.ts` bytes were restored from the private copy and its SHA-256 matched the
pre-RED value before GREEN.

Before the raw duplicate-header case was added, the full native integration file
then passed:

```sh
pnpm --filter @domy/server exec vitest run tests/public-protection.test.ts
```

Exit 0: one file, all 8 tests passed, including the preserved direct-mode forged
header/61st-request test and the new exact-peer canonical-client 61st-request
test. The private result log is
`.git/local-orchestration/public-proxy/green.log` (mode `0600`). The serialized
DB/native slot was released.

Startup wiring from `index.ts` remains pending its assigned owner; until it passes
the parsed env field into `createApp`, the opt-in is not enabled for the process
entrypoint. A real Caddy two-client test remains unexecuted. No deployment, task
closure, or G1 claim is made.

## Follow-up: platform normalization and browser DSN boundary

The IP normalizer now uses one private Zod IP validator backed by `node:net.isIP`
and the WHATWG URL parser for canonical IPv6; only the small IPv4-mapped conversion
remains custom. The `VITE_SENTRY_DSN` environment input is accepted only as an
HTTPS DSN with a nonempty public key and project path, without password, query, or
fragment. `Env` omits the raw DSN and exposes only optional `browserReportingOrigin`
(`URL.origin`), preserving valid HTTPS self-hosted hosts and ports. Blank/absent
values disable browser reporting.

The RED phase for DSN validation produced nine failures: one missing derived-origin
assertion and eight invalid-DSN cases. The 23 passing cases comprised 22 prior
environment tests plus the new blank-disabled case. The updated focused command
`pnpm --filter @domy/server exec vitest run src/lib/client-address.test.ts src/env.test.ts`
passes 45 tests across two files. Focused ESLint, Prettier, and
`node --check apps/server/src/lib/client-address.ts` pass. The public-protection
file now includes a raw TCP request with two repeated `X-Domy-Client-IP` fields;
it is intended to prove Hono's comma-joined duplicate value falls back to the proxy
bucket. The authorized full-file run was attempted once after the refactor:

```sh
pnpm --filter @domy/server exec vitest run tests/public-protection.test.ts
```

It exited 1: 7 of 8 tests passed. The canonical-client test reached the raw socket
response, but its status-line parser rejected Node's standard reason phrase
(`HTTP/1.1 404 Not Found`) as though no status were present. The first-failure log
is `.git/local-orchestration/public-proxy/green-refactored.log` (mode `0600`). The
test helper now accepts an optional printable reason phrase while still requiring
an HTTP/1.x status code, and writes the request without half-closing the socket.
Focused ESLint and Prettier checks pass for the changed test. After a separate
explicit serialized-slot grant, the corrected full-file invocation passed once:

```sh
pnpm --filter @domy/server exec vitest run tests/public-protection.test.ts
```

Exit 0: one file, all 8 tests passed, including the actual repeated raw header and
rate-limit bucket assertions. The private passing log is
`.git/local-orchestration/public-proxy/green-refactored-fixed.log` (mode `0600`).
The DB/native slot was released. No production code beyond these documented local
boundaries or provider contact is claimed.
