# Anonymous tracking API — 004/T015

Date: 2026-10-22, America/Bogota. Dirty local base 94a7e24.

The chained Hono endpoint preserves inferred RPC types and delegates serialization
to the shared publicTrackingView. It validates code shape with uniform invalid-link
404, inherits the native-peer rate limit/no-store/noindex boundary, and does not
require a session or active merchant. Queries select only public projection inputs;
there is no private shipment/history/photo/storage loader. A read-only repeatable-read
transaction keeps status, custody, provenance and queue on one committed snapshot.

Effective records require applied/non-reverted state and exact matching effect
provenance; legacy fallback is unique in both directions. Current receiver corrections
preserve the effect timestamp. The latest appended matching exception effect wins,
not the greatest device time. Current route task count uses the canonical helper;
all queue visibility rules remain in the domain. Its input type alone was narrowed
to stop kind/tasks, avoiding address loading without changing runtime behavior.

Tests use real PostgreSQL and actual operational endpoints, preserving the original
eight T011 cases and adding receiver correction, earlier-time redelivery after
revert and assigned retry wording. Return-revert expiry and malformed-code assertions
also extend existing cases. Receiver correction advances the clock two days, so
expiry-reset bugs are distinguishable. Root caught a route-order fixture mismatch:
the reverse pickup now follows two actual deliveries via the authenticated stop-order
operation before dispatch; the original count assertion remains unchanged.

Both levels independently pass:

```bash
pnpm --filter @domy/server exec vitest run tests/public-tracking.test.ts tests/public-protection.test.ts
pnpm --filter @domy/domain exec vitest run src/public-tracking.test.ts src/routes.test.ts
pnpm exec prettier --check apps/server/src/routes/public.ts apps/server/tests/public-tracking.test.ts packages/domain/src/routes.ts
pnpm exec eslint apps/server/src/routes/public.ts apps/server/tests/public-tracking.test.ts packages/domain/src/routes.ts --max-warnings 0
pnpm --recursive typecheck
```

18 server tests (11 tracking/7 protection), 118 domain tests; executor native8.76s,
root9.05s. Zero static errors/warnings. Root inspected final source, narrow queries,
provenance and unchanged helper runtime. Logs: `.git/local-orchestration/public-t015/`.
Original pre-route RED remains; the initial route-order failure is documented in the
execution transcript (its reused focused log was overwritten by the corrected run).

Final SHA-256:

- public.ts: 2b6c49688fe0f6c2707e078e9e7da6a925a9d9c875f45d3705c4573c62aee58e
- public-tracking.test.ts: 5918d0332804402706de5778eab5fd0e4fb0d5d93980e692a64f6a42bf6192c7
- domain routes.ts: ac071cdcca3ccacab7fa3fd35e439cd0097b7515e13f46af98a64c701a90db67

T015 accepted; T016 implementation is unlocked. Catalog58/81 verified (72%),23open.
Full-story gates still await the UI; no deployment, remote CI or physical acceptance.
