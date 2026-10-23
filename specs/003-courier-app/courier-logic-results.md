# 003/T092 Courier logic and rendered actions — local verification

Date: 2026-10-21. This receipt covers only the web courier logic/rendered gap in T092.
The plan addendum in `plan.md` aligns the one action correction with FR-012 before the
behavior change. No task checkbox, shared status, API contract, domain rule, or server code
changed. No database, build, browser, axe, remote CI, commit, or publication was run.

## Requirement-to-test map

| Requirement | Evidence |
| --- | --- |
| FR-008: propose who received the shipment-specific delivery | `apps/web/src/features/courier/delivery-rules.test.ts` covers delivery recipient, carrier handoff carrier, reverse-pickup merchant, and errand without a receiver. Its task fixture is parsed by `courierTask`, not asserted through an unchecked cast. |
| FR-010/FR-011: split collection and require a note only for a mismatch | `apps/web/src/features/courier/collection-fields.test.tsx` verifies the full COD starts in cash, both transfers start at zero, and the rendered Spanish payment fields/total/mismatch notice. `delivery-rules.test.ts` verifies the note label delegates to the shared `collectionProblem` rule. The existing authoritative rule test remains in `packages/domain/src/schemas/courier.test.ts` (`collectionProblem (FR-010, FR-011)`); no copy of its validation logic was added. |
| FR-027: show a Spanish notice for each notice type | `apps/web/src/features/courier/notice-list.test.tsx` renders every value of `noticeTypes` and compares each list item with shared `noticeText`. The test supplies a courier-store snapshot fixture; it does not mock notice wording or business behavior. |
| FR-020: pending count, two-hour warning, and session warning | `apps/web/src/features/courier/sync-status.test.ts` covers zero/singular/plural counts; exactly two hours versus one second over for both acknowledgment and record outbox items; session warning at the two-day boundary, expired boundary, and absent expiry. |
| FR-006–FR-014 / FR-012: actions by stop/task state | `apps/web/src/routes/courier-stop.test.tsx` renders actual parsed route snapshots and tasks. It covers pending pickup, delivery before pickup, picked-up delivery, completed delivery, pending errand, completed pickup/errand/return, a return held at the office versus ready to return, a blocked handover, voided shipment, and absence of an authenticated courier. The existing `apps/web/tests/e2e/courier-route.spec.ts` also covers call, WhatsApp, map, and pickup actions; this scoped run did not execute browser tests. |

## Test-first evidence and correction

Before changing action availability, `courier-stop.test.tsx` failed with 3 failures and 5
passes. The pending-pickup card and office-held return had no “Registrar pago por cuenta del
cliente” action because `TaskCard` gated it on delivery/errand. A task marked voided still
rendered that action even though the shared record resolver rejects a disbursement for a
voided shipment. The exact pre-fix command was:

```sh
SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/web exec vitest run src/routes/courier-stop.test.tsx
```

`TaskCard` now receives the existing courier identity and snapshot from its route parent so it
can be rendered with parsed fixtures. The disbursement action is available on every non-voided
task already present in that courier's route, including pickup and return tasks and completed
stops. Other pickup, delivery, return, problem, exception, handover, and actor guards remain in
place. Collection-note labeling now calls the shared `collectionProblem` rule, so UI wording
tracks the domain validation without duplicating it. No API or shared-domain behavior changed.

## N1 verification

Focused web tests: **5 files, 22 tests passed**.

```sh
SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/web exec vitest run src/routes/courier-stop.test.tsx src/features/courier/collection-fields.test.tsx src/features/courier/notice-list.test.tsx src/features/courier/delivery-rules.test.ts src/features/courier/sync-status.test.ts
```

The remaining scoped gates passed:

```sh
pnpm --filter @domy/web typecheck
pnpm exec eslint apps/web/src/routes/courier-stop.tsx apps/web/src/routes/courier-stop.test.tsx apps/web/src/features/courier/collection-fields.test.tsx apps/web/src/features/courier/notice-list.test.tsx apps/web/src/features/courier/delivery-rules.test.ts apps/web/src/features/courier/delivery-rules.ts apps/web/src/features/courier/delivery-form.tsx apps/web/src/features/courier/sync-status.test.ts --max-warnings 0
pnpm exec prettier --check apps/web/src/routes/courier-stop.tsx apps/web/src/routes/courier-stop.test.tsx apps/web/src/features/courier/collection-fields.test.tsx apps/web/src/features/courier/notice-list.test.tsx apps/web/src/features/courier/delivery-rules.test.ts apps/web/src/features/courier/delivery-rules.ts apps/web/src/features/courier/delivery-form.tsx apps/web/src/features/courier/sync-status.test.ts
git diff --check
```

Limits: these component checks use server-rendered HTML and do not replace T083's viewport,
axe, touch-target, or physical usability review. The wider feature test suite and full root N2
review remain outside this executor's run; T083 remains locked until root verifies T092.

## Root N2 approval — 2026-10-21 (America/Bogota)

Independent root source/contract review and all local gates pass on unchanged
456-file source SHA256 `dbb77ffd7d5b368d5a78bfa2e072e85eca3f3fc214e9779f5d454445a63c691e` (dirty tree, base94a7e24):

- `SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm check` — exit0.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm test --silent=false`
  — 1,281 tests:283 domain/677 server/321 web, no SDK warnings.
- `env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm test:e2e`
  —121/121, first attempt,6.3 minutes; includes compiled enabled/disabled reporters.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm build` — exit0.

Logs use `.git/local-orchestration/n2-courier-native-{check,test,e2e,build}.log`.
Before/after source inventories match exactly; browser interval11:24:02–11:30:20
had zero native Sleep events. Root capacity measurements:5 ms snapshot and215 ms
50-disbursement batch over 15 shipments (worst of 5), unchanged 500 ms/2 s limits.
All earlier test-side failures and the SDK-warning attempt remain preserved.
The native ignored-hook follow-up has its own real RED/4web+5server GREEN;
no warnings, assertions, retries, workloads or axe rules were suppressed.

Root approves the owning technical task locally after both QA levels. This does
not certify phone acceptance, provider delivery, deployment or release readiness.
