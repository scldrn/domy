# Notification composer RED verification — 004/T017

Date: 2026-10-22, America/Bogota. Accepted as a test-first deliverable only.
The composer implementation T020 is not present or claimed passing.

Three tests specify the Spanish greeting and detailed shipment entries, tracking
number formatting and URL order, final merchant link, voided exclusion in both
modes, notified exclusion by default and explicit all-date inclusion. Threshold
coverage uses22 input rows:20 eligible detailed entries, then21 eligible compact
entries when notified rows are included. The voided row never counts.

The contract seam was aligned and independently reviewed first; see
[artifact alignment](notification-artifact-alignment-results.md). Root corrected
only fixture IDs to valid deterministic UUIDs before final verification.

Executor N1 and independent final-fixture N1 both collect3 expected failures at
the missing `composeMerchantMessage` export guard. Root N2 reproduces3/3 RED in
191ms; the final independent N1 took154ms. There are no import/setup failures.
Business assertions after the guard have not executed and must pass during T020.
Both levels pass scoped Prettier, ESLint with zero warnings and domain typecheck.

```bash
env -u NO_COLOR pnpm --filter @domy/domain exec vitest run src/merchant-message.test.ts
pnpm exec prettier --check packages/domain/src/merchant-message.test.ts
pnpm exec eslint packages/domain/src/merchant-message.test.ts --max-warnings 0
pnpm --filter @domy/domain typecheck
```

The Vitest command intentionally exits1 for this RED deliverable; static checks
exit0. Source SHA-256:
`9979659abf5f6de91162368ae04136487baf6cc8df6ec7bbfe488bc16edbd8b1`.
Original/final logs: `.git/local-orchestration/notifications-t017/`.
No product source, database or browser runtime changed for this task.
