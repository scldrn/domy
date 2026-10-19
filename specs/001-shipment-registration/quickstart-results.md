# Quickstart Results: Shipment Registration and Dispatch Board

## T153 fallback error diagnostics correction — 2026-10-19 UTC

Local branch `001-fix-error-diagnostics`, base `321ef93`.
This is a narrow correction receipt for IV-39 / T153, not whole-feature convergence.

**RED:** Real PostgreSQL trigger `22P02` failure and native `TypeError` leak arbitrary message and stack headers into logs and reporter Error. Redacted parameters omitted by Drizzle were still leaked by PostgreSQL driver message. Captured complete logs and reporter output demonstrated runtime values in diagnostics.

**Correction:** Implemented research R14's bounded diagnostic projection directly in `apps/server/src/lib/errors.ts`:
- Fixed builtin labels and messages (`DatabaseError`, `TypeError`, etc.).
- Native recognition of `DrizzleQueryError` and `postgres.PostgresError`; validates and retains only 5-character SQLSTATE (`candidate.code`), omitting driver messages, queries, parameters, and causes.
- Independently reconstructed reporter Error.
- Bounded structural `.ts` locations from trusted immutable sources (`apps/server/src`, `packages/domain/src`), verifying existence and line/column boundaries on disk.
- Rejects candidate URLs with credentials, search, hash, traversal, or symlinks, and out-of-bounds positions.
- Safe labelled fallback `reporting_site` when no original frame survives.

**Verification:** 21 focused tests in `apps/server/tests/log-redaction.test.ts` PASS.
Error-path cost benchmark (`.git/t153-native-diagnostic-check.mjs`): 1000 iterations, 32 frames across 3 files: median 0.11 ms, p95 0.15 ms, max 2.87 ms.
Full quality gates pass sequentially:
- `pnpm check`: PASS (0 errors, 0 warnings)
- `pnpm test`: PASS (967 tests: 242 domain, 531 server with real PostgreSQL, 194 web)
- `pnpm test:e2e`: PASS (91 first-attempt passes, 5.0 minutes)
- `pnpm build`: PASS

**Scoped post-implementation assessment:** FR-041, plan research R14, and all nine constitutional principles verified. No sensitive values in logs or reporter. T153 marked completed.

## T141 keyboard verification correction — 2026-10-19 UTC

Local branch `001-fix-keyboard-readiness`, base `9006db3`; no commit/publication yet.
This is a narrow correction receipt, not a replacement of the historical results below
or whole-feature convergence. The remaining 21 open 001 tasks still block its closure.

**RED:** the initial merchant-response barrier holds real requests while the dispatcher
types. After release, the sole intended merchant is visible without a highlight; the
original five-second assertion fails (1/1, 6.2 seconds). Trace/context are retained in
ignored `.git/t141-keyboard-red/`. The original 89/90 full-gate failure remains in
`.git/integral-e2e-keyboard/`; its exact scheduling is not asserted as proven.

**Correction:** per research R17 and the aligned plan, use native ArrowDown, assert
the exact highlighted merchant/neighborhood, then Enter. Keep all original delayed
variants and add the initial-response case. Actual selection, pickup, fee, success and
full fixture axe assertions remain; runtime/API/schema/CI and all deadlines, worker
and retry policies are unchanged. No sleeps, fake successful responses or forced input.

**Verification:** four keyboard variants × five repetitions PASS (20/20, 51.6 seconds).
Then sequentially `pnpm check` PASS, `pnpm test` PASS (242 domain, 512 server with real
PostgreSQL, 194 web = 948), `env -u NO_COLOR pnpm test:e2e` PASS (91 first-attempt
passes, 5.1 minutes), `pnpm build` PASS. Five expected invalid-password warnings came
from the lockout negative scenario; no unexpected warning or failed attempt observed.
The passing historical-recovery case does not establish a fix for 003 T131.

**Scoped post-implementation assessment:** five related requirement references
(FR-003/005/006/034/038), US1/AC1 and AC5, three plan decisions (native keyboard
selection, real response barrier, unchanged verification policy), T141 and its T126
historical guard were checked. All nine constitutional principles were considered:
I no added layer/dependency; II–IV no persistence/domain/history change; V typed test
and unchanged validated boundaries; VI deterministic RED and real infrastructure;
VII preserved keyboard/Spanish/axe flow; VIII one slice and retained evidence;
IX unchanged auth/privacy and private diagnostics. No new scoped missing/partial/
contradictory/unrequested finding, at any severity; no convergence tasks appended.
Existing project findings/tasks are not duplicated or declared resolved. T141 is
checked only after the passing gates; the global outcome remains not converged.

## Original implementation receipt

**Date**: 2026-09-30 · **Branch**: `001-shipment-registration-impl` · **Task**: T120

Every manual validation scenario of [quickstart.md](quickstart.md) is automated as an
end-to-end test (Playwright, real PostgreSQL 18, the API in test mode with a controllable
clock) and was also checked by hand in the development app. All scenarios pass. Every
end-to-end test also checks its final screen against WCAG 2.2 AA (axe), and
`accessibility.spec.ts` checks every panel screen at 1280 px and 600 px wide.

| # | Story | Result | Automated by |
| --- | --- | --- | --- |
| 1 | US1 | Pass | `register-shipment.spec.ts` › registers a delivery on merchant account at the standard fee |
| 2 | US1 | Pass | `register-shipment.spec.ts` › uses the merchant rate card |
| 3 | US1 | Pass | `register-shipment.spec.ts` › derives the COD amount from the payment mode |
| 4 | US1 | Pass | `register-shipment.spec.ts` › requires a manual fee with a reason for an errand |
| 5 | US2 | Pass | `dispatch-board.spec.ts` › flags a shipment at risk, then late, without reloading |
| 6 | US2 | Pass | `dispatch-board.spec.ts` › lists yesterday's undelivered shipment under the pending section |
| 7 | US2 | Pass | `dispatch-board.spec.ts` › shows a shipment registered elsewhere within 30 seconds |
| 8 | US3 | Pass | `edit-void-shipment.spec.ts` › edits the COD amount and voids another shipment |
| 9 | US3 | Pass | `edit-void-shipment.spec.ts` › refuses the second of two concurrent saves and keeps its values |
| 10 | US4 | Pass | `bulk-registration.spec.ts` › registers a pasted list, with fixes in the preview; registers an uploaded spreadsheet |
| 11 | US5 | Pass | `history-search.spec.ts` › finds shipments by recipient phone, newest first, and exports them |
| 12 | US6 | Pass | `master-data.spec.ts` › schedules a standard rate for tomorrow |
| 13 | US7 | Pass | `access.spec.ts` › gives each role its own access |
| 14 | US7 | Pass | `access.spec.ts` › locks sign-in after five failures and says when to retry |
| 15 | US1 | Pass | `register-shipment.spec.ts` › adds the express surcharge and prices a carrier handoff by its place |
| 16 | US6 | Pass | `master-data.spec.ts` › lets the dispatcher add a neighborhood for review, not change zones |
| 17 | US7 | Pass | `access.spec.ts` › refuses to deactivate the only owner |

Success criteria measured in tests:

- **SC-004**: a shipment registered in one browser appears on another open board after one
  poll (20 seconds), under the 30-second limit (`dispatch-board.spec.ts`).
- **SC-005**: at-risk from 45 minutes before the latest delivery time and late right after it
  (`shipment-flags.test.ts`, `board.test.ts`, `dispatch-board.spec.ts`).
- **SC-006**: search by tracking number, merchant reference, and recipient phone among
  100,000 shipments answers in well under 2 seconds (`search-scale.test.ts`; measured under
  70 ms on a laptop).
- **SC-001, SC-002, SC-008** (time and learnability with real users) are measured during the
  owner's acceptance with the dispatcher, before go-live.

## Go-live checklist

- [ ] Amy Tecnology rates confirmed by the owner (the seed infers them from the ledger).
- [ ] Rates for Caldas and Girardota defined by the owner (until then those shipments need a
      manual fee and are marked "Tarifa por revisar").
- [ ] Real merchants, pickup points, couriers, and carriers loaded and reviewed with the owner.
- [ ] Production `.env` complete: `APP_URL` with the public address, `RESEND_API_KEY` with a
      verified sender domain for `EMAIL_FROM`, and a new `BETTER_AUTH_SECRET`.
- [ ] The owner changes the password printed by the seed on first sign-in.
- [ ] Optional: `SENTRY_DSN` and `VITE_SENTRY_DSN` for error reporting.
