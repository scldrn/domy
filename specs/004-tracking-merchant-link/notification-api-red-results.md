# Notification API RED verification — 004/T018

Date: 2026-10-22, America/Bogota. Accepted as a test-first deliverable only;
T021 is absent and remains blocked by verified T020 domain contracts.

The native PostgreSQL tests cover date/merchant-scoped notification rows and
codes/status, voided exclusion, mark fields/events, non-secret actor/operation/
sorted-ID-set receipts, sequential and concurrent replay, actor/payload/cross-
operation conflicts, whole-batch validation, first-notified preservation, new
same-day work, detail fields, export header and courier refusal. The unchanged
detail/export permission baseline passes.

Executor N1 preserved an initial invalid Amy rate fixture (13000 rather than9700),
then corrected only that fixture. Final N1 collects10 tests:1baselinePASS and9
intendedRED in5.82s, no setup failures. Root reviewed the actual file/helpers,
contract and first failure, then independently reproduced1PASS/9RED in5.93s.
Missing notification routes produce404 instead of200/204/409/403; the existing
export returns200 without the required `Notificado` header. Both levels pass
scoped format/lint/server typecheck, with zero warnings.

```bash
env -u NO_COLOR pnpm --filter @domy/server exec vitest run tests/notifications.test.ts
pnpm exec prettier --check apps/server/tests/notifications.test.ts
pnpm exec eslint apps/server/tests/notifications.test.ts --max-warnings 0
pnpm --filter @domy/server typecheck
```

Vitest intentionally exits1 for this RED deliverable; static checks exit0.
Later assertions blocked by the first failures have not executed: listing
shape/date/void filtering, marks/receipts/detail fields and privacy, replay and
conflict effects, new-work listing, invalid-batch atomicity and concurrency.
Export RED verifies the header only; T021 must add a first-failing regression
for the actual notified timestamp cell before implementing that value.

Final source SHA-256:
`79ee9154b22e5a9a4ec8c8ecc00c5aa38a4191cb0b74ae49a443302156b470a7`.
All original/final/root logs and evidence:
`.git/local-orchestration/notifications-t018/`.
Only the new test file changed; no product, database schema, build, browser or
physical acceptance is claimed.
