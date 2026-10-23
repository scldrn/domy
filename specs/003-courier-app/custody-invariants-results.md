# Custody generated invariants — 003/T082

Executor receipt, 2026-10-20 (America/Bogota). Local working tree on
`codex/local-readiness-orchestration`; no production behavior changes, publication or deployment.
Orchestrator Level 2 review and integrated gates remain required before task closure.

## Scope and preserved coverage

`apps/server/tests/routes-invariants.test.ts` retains its original three seeds (7, 2026,
31337), 90-step route lane, stale-version checks, duplicate-action checks, SQL assertions,
`applied > 20`, timing diagnostics and budgets. Its shared setup additionally retains the
owner's user id for independent author checks.

The second three-seed lane calls `tests/setup/custody-invariants.ts`. Each seed schedules
90 commands, choosing only the next eligible command of four independent workflows:

- Queue pickup offline, remove from route, submit the late identity twice in one batch,
  fresh duplicate pickup, off-route delivery, and fresh unapplied return after delivery.
- Pickup, exception, office receipt, return decision, office collection, return, revert
  and replacement return.
- Pickup by courier A, reassignment, confirmed handover to B and delivery by B.
- Pickup problem, dispatch-entered pickup/disbursement/delivery, correction, revert and
  replacement courier delivery.

Each seed stores 17 distinct identities; all seven kinds and all three outcomes are
required by counters. Replays preserve complete rows of shipments, records, record photos,
notices, shipment/route history, routes, tasks, stops and handovers. Every command checks
SQL holder exclusivity, office/courier responsibility, no final/errand holder, handover
custody and complete identity attribution/timestamps/outcomes. Independent SQL reconstructs
custody-field continuity from history and compares its terminal holder with current state;
original record events must correlate their identity, author, on-behalf flag and both clocks.
The shared domain oracle supplements these SQL/history assertions.

## Local evidence (Level 1)

The orchestrator reserved exclusive database capacity time. Tests use the real migrated
PostgreSQL Testcontainers fixture; no mocks, retries, skips or increased limits.

- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/server exec vitest run tests/routes-invariants.test.ts --project capacity`: **6/6 PASS**, 13.97 s, exit 0.
- `pnpm --filter @domy/server typecheck`: passed before the capacity run; a later shared-tree run failed in concurrent T132 files (`src/routes/auth.ts:103,155`), not in the T082 files. The latest failed output is retained; integrated typecheck is pending.
- `pnpm exec eslint apps/server/tests/routes-invariants.test.ts apps/server/tests/setup/custody-invariants.ts --max-warnings 0`: exit 0.
- `pnpm exec prettier --check apps/server/tests/routes-invariants.test.ts apps/server/tests/setup/custody-invariants.ts`: exit 0.

Logs: `.git/local-orchestration/t082-capacity-third.log`, `t082-typecheck.log`,
`t082-eslint.log`, `t082-prettier.log`, and `t082-check.log`.

A global `pnpm check` started before the orchestrator requested serialization failed on
formatting of five concurrently edited T132 files (account-actions schema, errors, account
idempotency/courier account tests, domain account-schema test). It is retained, not reported
as passing; the orchestrator owns its integrated rerun.

Earlier failing runs are retained in `t082-capacity-first.log` and
`t082-capacity-second.log`. Both retained three passing legacy tests. The first exposed
raw SQL timestamps being strings; decoding now explicitly constructs Dates. The second
exposed an incorrect fixture expectation: a fresh pickup after an applied pickup remains
a semantic duplicate even after delivery. The controlled unapplied case now uses a fresh
return after delivery. Neither failure demonstrated a product defect; no artificial
business-rule RED or product fix is claimed. This task fills coverage for existing behavior.

## Limits

Independent root checkpoint: inspected the complete helper and route-test diff, confirming
the original lane's steps/assertions/limits were preserved. A separate isolated
`SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/server exec vitest run tests/routes-invariants.test.ts --project capacity`
passed 6/6, exit 0, 16.74s (`n2-t082-capacity.log`). Integrated static/full gates remain
pending; the canonical task is not yet checked.

The generated lane validates API/transaction/history behavior, including late/offline batch
submission; it does not emulate IndexedDB, real phone connectivity, photo upload transport
or physical acceptance. Photo rows are included in replay fingerprints; actual upload
coverage remains in the existing photo suites. The task checkbox and shared backlog are
reserved for the orchestrator's independently confirmed Level 2 result.

## Integrated orchestrator acceptance — 2026-10-20

Root independently inspected the implementation, contracts and permanent regression
coverage, then ran the four complete local gates sequentially on frozen source
`7d4227587e1661a45cd8c0ea4b14ee0efabd0b0a2cfaecfe359d78b865544d1d`
(440 source/config/test files; base `94a7e2450ec2abae4192f7f864e34c4638f7c963`).
The before/after source fingerprints match.

- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm check`: exit 0.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm test`: exit 0; 1,215 tests
  (283 domain, 655 server, 277 web), including isolated capacity projects.
- `env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm test:e2e`: exit 0;
  106/106 first-attempt Chromium scenarios, 5.7 minutes, including full axe coverage.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm build`: exit 0.

Actual logs: `.git/local-orchestration/n2-batch2-actor-{check,test,e2e,build}.log`;
source inventories: `batch2-actor-candidate-{before,after}.json`. No gate warning or retry
was observed. Earlier failed/interrupted attempts remain historical evidence. Root
approved this task's local closure after both QA levels; this does not certify physical
Android/iPhone acceptance, provider configuration or production readiness.
