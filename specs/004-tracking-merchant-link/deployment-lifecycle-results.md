# OP-01 application lifecycle implementation — N1 baseline and N2 correction

**Date:** 2026-10-22

**Scope:** Local source implementation, its N1 focused native HTTP/Testcontainers verification,
and the N2 lifecycle correction and focused verification below. This receipt does not close
OP-01 or claim the four local quality gates, built-browser CSP behavior, a container or Caddy
rehearsal, deployment, remote CI, or phone evidence.

## Implemented behavior

`GET /health/live` returns a constant `200 {"status":"ok"}` without database work.
`GET /health/ready` returns constant ready/unavailable responses with `Cache-Control:
no-store`. Readiness uses the existing typed Drizzle database in a read-only transaction,
sets a local PostgreSQL `statement_timeout` of 750 ms, and uses a 1,000 ms decision deadline.
Concurrent checks share one in-flight probe until its underlying query settles. Drain state is
checked before the probe and again before returning ready. The routes are mounted before the
public business API limiter.

The executable creates one runtime state, passes it through `createApp`, retains the server
handle, and registers one SIGTERM handler. The first signal marks the app draining
synchronously; the memoized handler calls `server.close()`, allows up to seven seconds for
active HTTP requests, then closes lingering HTTP connections and ends the existing PostgreSQL
client with its two-second timeout. It does not call `process.exit()`. Shutdown logs contain
safe stage/outcome fields and sanitized error summaries.

The single Hono CSP keeps framing denied and allows only same-origin scripts, workers,
manifest, stylesheets, fonts, and forms; `img-src` additionally permits local `blob:` previews.
The narrow `style-src-attr 'unsafe-inline'` allowance covers current React style attributes.
`connect-src` adds only the exact validated `browserReportingOrigin` when the existing public
Sentry DSN is configured. The raw DSN is not passed to the app. Without it, connections remain
same-origin only. No `unsafe-eval`, inline scripts, wildcard, or external scheme was added.

## Causal RED and focused GREEN

Root reviewed the causal RED before implementation. The original health test command was:

```sh
pnpm --filter @domy/server exec vitest run tests/runtime-health.test.ts
```

It exited 1 as expected: the absent liveness/readiness routes returned 404, the draining case
returned 404 instead of 503, the saturation case had no readiness probe, and the existing CSP
contained only `frame-ancestors 'none'`. The first-failure output is preserved privately at
`.git/local-orchestration/op01/runtime-health-causal-red.log` (mode `0600`, SHA-256
`00a7b0db8dc2b4c8fb5d43d6c794ad55dee5dbbbdf47f26c43d50c9067311756`).

After implementation and root's one-invocation serialized DB/native grant, the focused GREEN
command ran once:

```sh
env -u NO_COLOR pnpm --filter @domy/server exec vitest run tests/runtime-health.test.ts tests/runtime-lifecycle.test.ts
```

Exit 0: two files and all eight tests passed in 7.40 seconds. The health tests use an actual
ephemeral Node HTTP listener and Testcontainers PostgreSQL. They cover liveness without a DB
query, a successful read-only readiness query, immediate drain response, drain during an
active probe, saturated-pool timeout/coalescing, and the exact single CSP with and without a
configured browser reporting origin. The lifecycle tests compare default Node SIGTERM with
the handler in isolated child processes: without the handler, the active request is
interrupted; with it, the in-flight HTTP request and a PostgreSQL `pg_sleep(0.15)` complete,
repeated SIGTERM is tolerated, the process exits naturally with code 0 and no signal, and
stderr contains neither the database URL nor password. The passing output is preserved
privately at `.git/local-orchestration/op01/runtime-lifecycle-green.log` (mode `0600`,
SHA-256 `f9d45d6bfd7f497c72fbedaf26b37ad3be79e266d53953997ea6cc23db4eb950`). The serialized
DB/native slot was released immediately after the command completed.

The N1 focused run did not exercise a stopped/unreachable PostgreSQL server, forced HTTP drain
deadline, or built-browser service-worker/photo-preview behavior. N2 added the first two cases;
built-browser service-worker/photo-preview behavior remains outside this evidence.

## Static verification and frozen source identity

These local checks passed after the implementation was frozen:

- `pnpm exec eslint` on the changed TypeScript source, tests, and child fixtures with
  `--max-warnings 0`.
- `pnpm exec prettier --check` on the changed TypeScript source, tests, child fixtures, and
  lifecycle plan.
- `pnpm --filter @domy/server typecheck`.

The source SHA-256 values recorded for this N1 implementation are:

| File | SHA-256 |
| --- | --- |
| `apps/server/src/lib/runtime-lifecycle.ts` | `66bdeec2bfed8082e1aab5764646f5f30f7783520673ef0ec2e353916d059dbd` |
| `apps/server/src/routes/health.ts` | `cd683af92672e2df7a6eebb5c2bf7656b4f6bd30d66f4710ffecf1c7b52fe493` |
| `apps/server/src/app.ts` | `25d918844588ba228a7a1db8275bb51b5e5b9b22e03d48a0b75af6b9e77736d0` |
| `apps/server/src/index.ts` | `e27db4d0d44c87cdcaab3debf01b653bc3a046f5f82cca9e6753593164e2b6df` |
| `apps/server/tests/runtime-health.test.ts` | `f0d0d6bc6aab4cfb9358d5ba555600de1fa9832ba719a894764bb66a8eaa5a94` |
| `apps/server/tests/runtime-lifecycle.test.ts` | `e27c6a4193f00fb481f92c2e92d7096bf0524ca620cb7a5d6731d0e926ed9667` |
| `apps/server/tests/fixtures/runtime-lifecycle/child.ts` | `0e1a1bc6f0659350d7cda5677b5cc8e49f82e87b9f409c7793ab51498dd32dc4` |
| `apps/server/tests/fixtures/runtime-lifecycle/default-child.ts` | `7ba448f22e55b62cfe5ddfbdd4c1aba91b7b7b4e62c4f8678ce6946d386ce47b` |

`app.ts` also contains the separately reviewed trusted-proxy and private-peer integration;
its identity is recorded as a whole file. Root's independent review and all four local gates
remain. No app/container restart, migration, Docker/Caddy operation, provider contact, remote
CI, production operation, or physical-phone test was performed for this source slice.

## N2 lifecycle correction and final focused convergence

Root's independent review found that the first lifecycle test harness used an unapproved
two-second post-response process-exit bound for a normal keep-alive connection. The first
correction checkpoint therefore exited 1 with 9/10 passing: the sole failure was the normal
drain child not exiting within that test-only bound. The forced-close/new-connection-refused
case and stopped-PostgreSQL generic-503 privacy case passed at that checkpoint. Root's isolated
native Node reproduction returned the response at 233 ms and the `server.close()` callback at
3,239 ms. The harness now measures total shutdown against 9,500 ms, preserving the approved
seven-second HTTP drain and two-second PostgreSQL close budgets plus 500 ms margin. This was a
test-bound correction; the runtime budgets did not change. The first checkpoint is preserved
privately at `.git/local-orchestration/op01/n2-lifecycle-regression-checkpoint.log` (mode
`0600`, SHA-256
`2ef996231ce68fd2e3996d7730212dc87104fd07baeee51907ef11a4d74780ef`).

After the reviewed source correction, the exact focused command ran once more:

```sh
env -u NO_COLOR pnpm --filter @domy/server exec vitest run tests/runtime-health.test.ts tests/runtime-lifecycle.test.ts
```

It exited 0: 2 files, all 10 tests, in 13.72 seconds. The lifecycle tests now use the exact
native Node HTTP server; verify a new connection is refused during drain, an in-flight request
finishes within the normal grace, a request beyond seven seconds is force-closed, and the
child exits naturally with exactly `{ code: 0, signal: null }`. Child cleanup waits for the
`close` event and is bounded in `finally`. The real stopped-PostgreSQL readiness case returns
the same generic unavailable response without exposing connection or driver details. The
final focused output is preserved privately at
`.git/local-orchestration/op01/n2-lifecycle-final.log` (mode `0600`, SHA-256
`071d3230412560b3a6f7f5348e4ead6ffa028a15f17ad094462deebf69ecc0f7`). Root's serialized
combined health/lifecycle/public-protection checkpoint passed 18/18 in 4.17 seconds; its
private log is `.git/local-orchestration/op01/root-runtime-combined.log` (mode `0600`, SHA-256
`8980d881133ef1877df1ef85859c4039747775829a362156f5ea45e234552aa6`). Root's final
independent focused run passed 7 files and 91 tests in 14.68 seconds across health, lifecycle,
public protection, log redaction, public paths, client address, and environment parsing. Its
private log is `.git/local-orchestration/op01/root-op01-focused-final.log` (mode `0600`,
SHA-256 `dd2e9fed2d73fdba446b51dcd70d7e9ea89cc8a41700e3e019163cdcdacdf8d8`). Root also
reports current lint and server type-check pass. The four local quality gates remain pending.

Current N2 source and regression-test identities are:

| File | SHA-256 |
| --- | --- |
| `apps/server/src/lib/runtime-lifecycle.ts` | `43022a809cacc9f62d4a85b4b7cd3b8ee3e385b398782059fe449712255835d0` |
| `apps/server/src/routes/health.ts` | `db04a7fc1190e5a23a579a0b649438d6127db4c08e0ea5ffc4a8d8c63c60fa83` |
| `apps/server/src/app.ts` | `b3ea60efb2e622408e8d520e0450fe3fc0424088b52a23ff6ccfcb51fb4ab240` |
| `apps/server/src/index.ts` | `f496f18b3b260f830b93be3cd991aaea84b6d3577a2fda7240072fe82274c307` |
| `apps/server/tests/runtime-health.test.ts` | `a851ad62856663e281220bed5cbcee7533af70293fe85dac0956276a0f16360c` |
| `apps/server/tests/runtime-lifecycle.test.ts` | `946c15b653808d5d671a6d54d0eaa675d05b597fccc52633938b56e3ce44a1d2` |
| `apps/server/tests/fixtures/runtime-lifecycle/child.ts` | `32b59cdfa7cf985237934ac476c07bffa29da25f0ecc49e9a881acf2cda16c1b` |
| `apps/server/tests/fixtures/runtime-lifecycle/default-child.ts` | `c7f577aea2243e092416d8f2164ccb97ba3908c6b9b694ccf90f1853e1f20b5c` |

These checks do not claim the full four-gate suite, built-browser CSP behavior, Caddy or
container validation, deployment, remote CI, phone scenarios, task closure, or release
readiness. The frozen N2 CSP keeps `style-src-elem 'self'`; any exact style-element hash
allowances under consideration belong to a separate CSP slice and remain pending causal
evidence and root approval. No second restart of the operational target was performed for
this lifecycle slice.
