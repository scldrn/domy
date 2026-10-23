# Public boundary verification — 004/T006

Date: 2026-10-22, America/Bogota. Local dirty branch
`codex/local-readiness-orchestration`, base `94a7e2450ec2abae4192f7f864e34c4638f7c963`.
Prerequisite: root-verified T003 RED; schema T004 independently verified.

## Behavior and review

Anonymous public API misses share Spanish JSON 404. All public API/photo/document
responses retain no-store/noindex, including 429, oversized 413 and injected 500.
The fixed 60-request/minute limiter uses the native Node transport peer, ignores
all forwarded identity headers, uses monotonic time, resets exactly at 60000ms,
cleans expired buckets and fails closed at 10000 retained peers. Non-network
app.request uses a shared conservative unknown peer. Proxy topology evidence
remains an operational prerequisite before any deployment.

Request log templates redact raw/encoded/malformed API and document bearer paths,
including unknown endpoint segments; existing error/reporting sanitizers remain.
Public handlers are not preempted by a wildcard route. Both native static handlers
skip public API paths; conditional notFound supplies uniform JSON. Native typed
MiddlewareHandler callbacks preserve strict types without casts or rule suppression.

## Double local QA

Executor: seven pure limiter/path tests and focused integrations (35/35, 3.59s),
then final-source scoped format/ESLint/server types pass. Final change after that
integration run only types the same static-exclusion handlers.

Root independently reviewed code and exercised the final implementation:

`pnpm --filter @domy/server exec vitest run src/lib/rate-limit.test.ts src/lib/public-path.test.ts tests/public-protection.test.ts tests/reporting-privacy.test.ts tests/log-redaction.test.ts`

**42/42 pass, five files, 6.10s, exit 0**. Independent final ESLint and server
typecheck pass; scoped formatting pass. Final app SHA-256:
`fd30aa449b010f84ae1c8298d6d3b249bc7462cfb54bd4a1318b57c25eb8f39d`.
Exact reviewed-file hashes and logs: `.git/local-orchestration/public-t006/`.

## Failures retained and limits

Root's added webDist test exposed HTML200 from SPA fallback. Replacing an already
streamed HTML response caused a socket error; the fix excludes public API before
static serving. A temporary invalid-path sentinel was rejected and removed before
final approval. Wildcard-inferred context triggered ESLint unsafe-argument errors;
explicit native middleware typing fixed them without suppressions. Original logs
remain (`n1-coverage.log`, `n1-coverage-rerun.log`, root initial ESLint log).

T006 accepted locally; full-foundation check/test/e2e/build remains open. No public
tracking/merchant projection, phone physical acceptance, proxy trust, production
migration or deployment is implied. Catalog: 48/81 verified (59%), 33 open.
