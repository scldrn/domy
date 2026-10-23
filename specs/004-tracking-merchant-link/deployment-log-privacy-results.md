# OP-01 request-log privacy correction — focused N1 QA

**Date:** 2026-10-23
**Scope:** Independent source review and focused server tests for request-path, request-ID, and
provider-error log privacy. This receipt does not close OP-01 or claim browser/Caddy behavior,
deployment, external-provider behavior, or the four local quality gates.

## Correction reviewed

Request logs use Hono's matched route template, with a fixed `:unmatched` fallback, while the
existing public bearer and password-recovery paths retain their fixed redacted diagnostics.
Hono request IDs are regenerated with `requestId({ limitLength: 0 })`, preserving the response
header without accepting a client-supplied ID. Mail and storage failure logs now record only a
fixed outcome field; provider exception objects and their messages are omitted.

## Causal RED and focused GREEN

Root preserved the initial native marker regression and the pure unmatched-path regression as
private first-failure logs:

| Evidence | Private path | SHA-256 | Mode |
| --- | --- | --- | --- |
| Native request-log RED | `.git/local-orchestration/op01/root-log-privacy-red.log` | `3f769568811fce4d0b7126b79af379df29c28e006a2671c0f99c4c50e46815e8` | `0600` |
| Pure route-path RED | `.git/local-orchestration/op01/root-log-path-red.log` | `af710678cd3f1a6585b27aeb47444a966abdf3632e6c8d4e12a9e0627e458076` | `0600` |

The corrected focused command was run independently once and passed both files and all 28 tests
in 3.44 seconds:

```sh
env -u NO_COLOR pnpm --filter @domy/server exec vitest run tests/log-redaction.test.ts src/lib/public-path.test.ts
```

Root independently ran the same command; it passed 2 files and 28 tests in 3.11 seconds. The
private root GREEN log is `.git/local-orchestration/op01/root-privacy-green.log` (mode `0600`,
SHA-256 `d00090a5d044b857d4dc85cc10e203f444f5ccdeb0de25790e71754bd910e793`). Private log
contents were not copied into this receipt.

Root later reports a focused current-source convergence run passed 7 files and 91 tests in
14.68 seconds; the privacy subset was unchanged after the independent 28-test run. Its private
log is `.git/local-orchestration/op01/root-op01-focused-final.log` (mode `0600`, SHA-256
`dd2e9fed2d73fdba446b51dcd70d7e9ea89cc8a41700e3e019163cdcdacdf8d8`). This broader result
is recorded as root-reported convergence evidence, not attributed solely to the privacy slice.

Root also reports focused ESLint passing for the 12 owned TypeScript files and
`pnpm --filter @domy/server typecheck` passing. An earlier combined lint attempt exposed a
mutable-drain-state narrowing issue after `await`; that first failure was retained, the code
was corrected to re-read shared state, and the final focused lint/type checks passed.

## Frozen source identity

SHA-256 values captured after the focused review:

| File | SHA-256 |
| --- | --- |
| `apps/server/src/app.ts` | `b3ea60efb2e622408e8d520e0450fe3fc0424088b52a23ff6ccfcb51fb4ab240` |
| `apps/server/src/lib/public-path.ts` | `615a36e87a769380fe82ea76d2d513686bbdce0f92f02a7e16fdedaf7bacb9c1` |
| `apps/server/src/lib/public-path.test.ts` | `64fa4bdf94607208cfc437b4a80ff4f345aa1d9aac886dffa30c7e9a5d64bc0a` |
| `apps/server/src/lib/email.ts` | `03db62f471443199573debcc017aab671def8c846b3cb81d47a644b736a9b280` |
| `apps/server/src/routes/photos.ts` | `6a6ebad0b938c1ff2e6733529f6800b4280d9bb9f64ec89b919f43d454d634cd` |
| `apps/server/src/index.ts` | `f496f18b3b260f830b93be3cd991aaea84b6d3577a2fda7240072fe82274c307` |
| `apps/server/tests/log-redaction.test.ts` | `73bc3d4b47102d4483458127f5665a0d886c2efbf6c474f6a1a888a0e3fd2fcc` |

The native test confirms a client-provided request ID is not reflected in the response or
captured request logs, and path, query, authorization, cookie, and body markers are absent while
safe route diagnostics remain. This focused test does not exercise live provider error branches
or real Caddy 502/malformed-marker behavior; those remain separate evidence gaps. No task
closure or deployment claim is made.
