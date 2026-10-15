# Project status

Where Domy stands and what comes next, so any session can resume without the conversation
that produced it. Updated 2026-10-15; update it whenever a slice is merged or the next step
changes.

## Features

Work follows Trunk-Based Development (constitution 2.0.0): every slice lands on `main` through
a short-lived branch, so the specification and implementation of every feature live on `main`.

| Feature | State |
| --- | --- |
| 001 Shipment registration | Done and converged, on `main` |
| Panel identity (design) | On `main` (`c363847`); rules in [design-system.md](design-system.md) |
| 002 Routes and dispatch | Done and converged, on `main` (#4–#11); test and review results in `specs/002-routes-dispatch/quickstart-results.md` |
| 003 Courier app | Setup T001–T003 (#13), domain T004–T014 (#14), foundation T015–T025 (#15), US1 T026–T040 (#16–#17), account linking T094 (#18), idempotency corrections T095–T097 (#19, `5c8b107`), US2 T041–T047/T098 (#20, `93fdf09`), and US3 T048–T052/T099–T102 (#21, `4910f76`) are on `main`. PR #21 passed all four gates at its final head before the authorized squash merge. US4 T053–T060/T103–T110 is implemented and scoped-converged locally on `003-us4-decisions`, with all four gates passing; owner approved commit/push/PR; merge and US5 require separate approval and green CI. Effects of late records across routes remain US5 (T067) |
| 004 Tracking page and merchant link | Specified, planned, tasked, and analyzed; implementation not started |

## Next step

1. Publish the owner-approved US4 PR from `003-us4-decisions` and review its CI,
   based on `main` at `4910f76`. Decisions, attempts, held routing, office receipt,
   settings and offline returns are implemented and scoped-converged. Final gates pass:
   `pnpm check`, `pnpm test` (821), `pnpm test:e2e` (75, no retries), and `pnpm build`.
   T107 applies the owner-approved capacity isolation without reducing coverage or
   limits; T110's high-COD return regression is also green. Generic route transitions
   were not relaxed. Samuel approved commit, push and PR creation on 2026-10-15.
   Merge and continuation to US5 require separate approval and green CI; local gates
   are not a substitute for the PR's CI result.
   Post-merge CI `38686516078` passed all four gates
   (773 unit/integration tests and 70 e2e without retries). Do not repeat merged US2/US3
   work.
2. Before the end of 003: complete the scenario-by-scenario physical validation T087/T093
   on Android and iPhone (iOS 16.4 or later for notifications), building on the owner's
   successful US1–US3 smoke test below. The owner's DigitalOcean Spaces bucket
   (in the client's name) is needed only at deployment.
3. Then 004 the same way.
4. Before go-live: time SC-001, SC-004, and SC-006 of 002 with the dispatcher, and add a
   content security policy tested on the production host (002 quickstart-results; 003
   research R17 lists what the courier app needs from it).

## Idempotency correction validation

- T095's three new regression tests failed before the fix and
  all 10 account tests passed afterward. `pnpm check`, `pnpm build`,
  `pnpm test --maxWorkers=2` (201 domain, 362 server, 135 web tests), and
  `pnpm test:e2e` (60 scenarios) passed. The owner independently reran all gates, including
  the default-worker test suite: all passed and the route-invariants timeout did not recur.
- Owner review identified empty receipts appearing as edits (T096) and missing no-op
  receipts in the six master data directories (T097). Both regressions were reproduced
  before implementation. Receipts now share `auditedChange`, remain transactional and
  durable, and are excluded from Audit history before pagination. No migration is needed.
- After T096–T097, all four gates passed again: `pnpm check`, `pnpm build`, default-worker
  `pnpm test` (201 domain, 373 server, 135 web; 709 total), and `pnpm test:e2e` (60 scenarios).
  The route-invariants timeout did not recur. T095–T097 landed on `main` through PR #19
  (squash `5c8b107`) after all GitHub CI gates passed, with the owner's approval.

## US2 implementation context

- Started from `5c8b107` on `003-us2-offline`. The owner approved clarifying the offline
  scenario's dependency: US2 validates pickups and deliveries on the phone and every
  record kind technically; US3 adds the exception form and completes its offline phone
  journey. Tests first, T041–T043, before T044–T047; no US3 interface is built early.

- Checklists pass: requirements 16/16, courier rules 48/48. Feature context remains
  `specs/003-courier-app` in the local `.specify/feature.json`.
- Reuse `apps/web/src/lib/offline/` and `features/courier/courier-store.ts`: records and
  photos are saved in one IndexedDB transaction, and pending records replay over the
  snapshot using the shared domain rules. Open, reconnect, visibility, and 30-second
  synchronization triggers already exist in the store.
- Identity is checked atomically before saving or sending. Sign-in and sign-out share the
  same pending-data guard, including photo-only queues and unreadable ownership. Expired
  sessions keep the route; withdrawn access clears only the snapshot. A temporary server
  error does not withdraw access. Acknowledged records leave the outbox together with the
  refreshed snapshot, preserving the visible local result if refresh fails.
- The banner and pending page show actions and photos, warn after 2 hours and within 2 days
  of expiry, and offer retry, installation guidance, and persistent-storage request.
- The server already applied one transaction per record and clamped occurrence time to
  receipt time; T042 verifies this behavior rather than introducing another implementation.
- T043 serves the built app with Vite preview and its real active service worker. Each
  case owns an independent courier account and route. Coverage includes offline reopening
  within 3 seconds, photos, response loss after commit, reconnecting, expiry and same-user
  reauthentication, unavailable server, guarded logout, cleanup, and accessibility.
- Notice acknowledgment transport is covered by T041; the actual notices, acknowledgment
  endpoint, handovers, and push notifications remain US5 (T061–T070).

## US2 validation

- GitHub PR #20 CI run `38655986569` passed all four gates (751 unit/integration tests;
  64 e2e scenarios, with 62 passing initially and two passing on retry). The owner
  authorized squash merge and US3 continuation; `93fdf09` landed on `main`. Post-merge CI
  `38657920415` also passed. T099–T100 track the refusal-selector ambiguity and notification
  contrast race observed in the PR run; they are not hidden by its final green status.

- Tests first: the expanded sync suite initially reproduced 15 failures before T044;
  ownership on save also failed before its correction. Later consumer review reproduced
  four failures around temporary server failure, malformed successful sign-in, and `403`
  withdrawal before correcting those paths. T098 then reproduced one more failure: a
  malformed stored snapshot supplied an untrusted expiry during session refusal.
- T042's seven PostgreSQL tests passed against the existing server behavior, including
  actual Better Auth expiry under a controlled process clock. No duplicate server
  implementation or migration was necessary.
- Final gates on 2026-10-14: `pnpm check`, `pnpm build`, default-worker `pnpm test`
  (201 domain, 380 server, 170 web; **751 total**), and `pnpm test:e2e` (**64 scenarios**)
  passed. The built shell and real service worker reopen the loaded route in under 3 seconds
  in the automated Chromium phone viewport; this is not a physical-phone timing claim.
- The initial full unit run, concurrent with static checks, hit the existing 30-second
  route-invariants timeout once. Both subsequent complete default-worker runs, without
  concurrent gates, passed; no timeout or worker setting was changed. Monitor it in CI.
- The retry-target check initially measured a scaled notification hidden in Sonner's
  collapsed stack. It now opens the stack via its accessible shortcut and waits for finite
  animations before checking the visible button's minimum 48 × 48 px area. The final full
  end-to-end suite passed, with no reduced thresholds or disabled accessibility checks.
- Scoped convergence completed with no remaining findings for US2 and T098: 13
  requirements/success criteria, 10 acceptance scenarios, 8 plan decisions, all 9
  constitution principles, and the 8 completed tasks. The final convergence pass left
  `tasks.md` byte-for-byte unchanged and appended no empty phase. This does not declare
  the whole feature complete: US3–US7 and polish retain their existing tasks. Physical
  Android/iPhone validation remains T087/T093.

| Completed scope | Evidence |
| --- | --- |
| FR-001–FR-004, FR-021: authentication, identity, expiry, withdrawal, logout | Existing auth and courier-access suites; `session.test.ts` (8), `sync.test.ts` (23), offline expiry/logout e2e |
| FR-018–FR-019, SC-001: durable ordered records and exactly-once effects | IndexedDB/outbox regressions, server `courier-records-sync.test.ts` (7), lost-response-after-commit e2e |
| FR-020, FR-022, SC-003–SC-004: automatic synchronization, pending view and warnings, cached route | Shared triggers, `sync-status.test.ts` (3), offline reload/reconnect and unavailable-server e2e |
| FR-023: separate acknowledged photo upload and finished-route cleanup | Sync refusal/ordering regressions, actual stored proof and empty-store logout e2e |

## US3 implementation and validation

- Owner-approved contract refinement: every `BoardEntry` exposes `returnDecided`; one
  domain selector forms both the undecided-exception list and its count. Decided returns
  stay in ordinary date sections. Filters/counts keep the existing board semantics and
  each shipment has one row. Search/unassigned projections and US4 actions are unchanged.
- Tests first: eight domain failures and four PostgreSQL failures reproduced the missing
  selection/projection; all three phone scenarios failed for the absent actions before
  their forms were implemented. Existing record rules already handled custody, task
  completion and problem notes, so they were reused without a migration or dependency.
- Exceptions require one of three reasons, allow an optional note/photo, show a review,
  and save through the existing atomic offline store. Problems require 5–200 characters;
  a new note replaces the displayed one but both records remain. Pickup, errand completion,
  removal and voiding clear the board flag without deleting the history.
- T099 reproduced two copies of an unlinked-account refusal during synchronization. Its
  actionable reason now appears once across courier screens, including withdrawn access.
  T100 reproduced an automatically disappearing toast during a scan; the helper settles
  closing dialogs before classifying the screen, pauses toasts with Sonner's native
  shortcut and restores focus. No notification or contrast rule is excluded.
- The phone regression also exposed an action covered by the fixed navigation/snackbars.
  The layout now reserves scrolling room, and the long disbursement label wraps instead
  of overflowing. No forced clicks, sleeps, timeout increases or worker changes were used.
- Visual review then exposed notifications above modal controls, despite passing axe.
  T101 reproduced the obstruction by checking nine actual hit points on the photo and
  confirmation buttons while notices stay open. Courier notifications now sit below
  sheets and above navigation; the panel is unchanged. Phone captures confirm that the
  form is unobstructed. Online panel checks await the phone's acknowledged queue before
  reading the other browser's board, so they cannot race local replay against sync.
- Full gates passed on 2026-10-14: `pnpm check`, `pnpm test` (**209 domain, 394 server,
  170 web; 773 total**), `pnpm test:e2e` (**70 scenarios, all first pass**), and `pnpm build`.
  The route-invariants timeout did not recur. The three US3 phone scenarios include
  pickups, an 85.000 COP cash delivery and an exception with photos offline, reopening,
  a lost response after commit, and exactly-once synchronization with custody preserved.
- After making online synchronization waits explicit, all four focused US3 scenarios
  passed again. Two attempts at that additional check failed before any scenario ran:
  Testcontainers could not obtain Docker host port bindings within its existing 10-second
  limit (PostgreSQL, then Ryuk). Docker was inspected read-only; the subsequent attempt
  passed without configuration changes, increased timeouts or service restarts.
- Final scoped convergence found no remaining work in US3 and T099–T101: 15 requirements
  and buildable success criteria, five acceptance scenarios, eight plan decisions, nine
  constitution principles and eight tasks checked. `tasks.md` stayed byte-for-byte
  unchanged during that pass; no empty convergence phase was appended.
- US4–US7 and polish are not complete. The owner has now reported successful physical
  phone testing of the available slice, as recorded below; full T087/T093 validation is
  still pending.

### Owner's physical-phone feedback — 2026-10-14

- Samuel reports testing on both iOS and Android, using Chrome and Safari, with the
  expected behavior and no reported failures. This is owner-provided physical-device
  evidence for the currently available US1–US3 slice (`46b1a84`, PR #21), not merely an
  automated phone viewport check.
- The local HTTPS review environment uses a separate database and photo bucket, with
  independent iPhone and Android courier accounts and routes containing fictitious data.
- Exact device models, OS/browser versions, the browser/OS combinations, individual
  scenarios, offline/reopening steps, timings, tap counts and theme checks were not
  itemized in the report. Do not infer them or mark T087/T093 complete: those tasks cover
  all quickstart scenarios and the measured interface review after the remaining stories.
- In a subsequent explicit approval, Samuel authorized publishing this record, squash
  merging PR #21 with green CI, and continuing US4 from updated `main`.

### Post-publication CI correction — T102

- CI `38679724748` at `a0b046d` passed check and all 773 unit/integration tests, but T099
  failed initially and on retry. Once the pending page has loaded, two legitimate buttons
  are named "Reintentar sincronización": the refusal banner's and the pending page's.
  The page-wide test selector was ambiguous. The earlier green run and code review did
  not establish deterministic navigation; they did not catch this test defect.
- Awaiting the pending page's heading reproduced the same strict-selector failure locally.
  The correction scopes the retry to the unique refusal alert, clicks it, waits for the
  actual refused synchronization response and rechecks that the refusal remains unique.
  Ten focused repetitions passed. Application behavior, selectors' strictness, accessibility
  checks, workers and timeout limits are unchanged.
- After T102's test correction, `pnpm check`, `pnpm build` and the full 70-scenario
  `pnpm test:e2e` run passed (all e2e first pass, 4.2 min). The full `pnpm test` gate did
  not pass locally, as detailed next. CI `38682492089` at `8f5066e` subsequently passed
  all four gates: 209 domain, 394 server and 170 web tests (773 total), and 70 e2e without
  retries. All three invariant seeds passed in that CI run. Scoped T102 convergence on
  2026-10-15 found no remaining gap in its three requirements, refusal/retry scenario,
  session decision and nine constitution principles. T102 is now complete; this does not
  claim that the separate local full-suite timeout is fixed. Closure commit `64f9622`
  passed its own CI `38684623497`: all four gates, 773 unit/integration tests and all 70
  e2e without retries. PR #21 was then squash-merged as `4910f76` on 2026-10-15 with
  the owner's approval, and its branch was deleted.
- During local revalidation, the known `routes-invariants` timeout recurred for seed 2026
  while other heavy checks ran concurrently, then for seed 31337 in a full-suite repeat
  without concurrent gates. Each run had 393/394 server tests passing. The unchanged
  invariant file then passed all three cases alone in 8.74 s. That suggests contention
  inside the full run, but does not establish its exact cause or make either failed full
  run a pass. Workers, scenarios and timeouts remain unchanged. CI's 394 server tests
  passed; local full-suite stability still needs investigation.
- US4 analysis found a missing explicit lifecycle row for FR-041: office receipt after a
  new attempt was already rescheduled off route must change `picked_up` to `registered`.
  Samuel approved aligning spec, model, plan and tasks, with a guarded regression and no
  relaxation of route transitions. That alignment is now applied locally on the new US4
  branch as described below; its subsequent implementation is recorded in the backend
  checkpoint, separately from this historical preparation finding.

## US4 preparation and initial RED evidence — 2026-10-15

- `003-us4-decisions` starts at the US3 squash `4910f76`. Spec, lifecycle model, plan and
  tasks explicitly restrict `picked_up → registered` to office receipt of an off-route
  courier-held package after a new attempt was already decided, preserving its service
  date. Generic route removal, cancellation and undo-dispatch stay forbidden for a
  picked-up package. T054 tests both the positive case and the forbidden transition
  before T057 implements one domain guard.
- T055/T060 explicitly cover the existing return-problem requirement (FR-030) and local
  replay of office pickup followed by return (FR-018/FR-041); no collection on returns,
  no new exception on a return stop. Notices and handover confirmation remain US5.
- The initial preparation analysis claimed no remaining finding. Subsequent review
  identified two medium gaps: T053 did not explicitly require decision-retry tests, and
  the settings contract did not distinguish GET/PATCH responses. That review supersedes
  the earlier blanket claim; no implementation was validated by either analysis.
- Samuel approved both remediations on 2026-10-15. T053 now requires concurrent and late
  retries of both decisions, one event/set of effects, and preservation of a later
  change. Contract and plan specify current-state replay responses. GET/PATCH settings
  now have separate 200 responses using the existing `CompanySettings` projection,
  both fields null before configuration and a resolved neighborhood afterward. T054
  requires those response and role checks before T057. No new domain rule, dependency,
  migration or response type was introduced.
- Repeated read-only `speckit-analyze` after remediation reviewed 7 functional
  requirements (FR-018–FR-019, FR-029–FR-032, FR-041), 3 buildable criteria (SC-001,
  SC-006–SC-007), 8 acceptance scenarios, T053–T060 and all 9 constitution principles.
  Both reported gaps are resolved in the artifacts, with no additional finding in this
  scope. All 10 requirements/criteria have planned task coverage; that is not passing
  test evidence. Requirements checklist 16/16 and courier rules 48/48 remain
  reviewer-owned and unchanged. This status record was updated after analysis.
- T053's initial decision tests in `apps/server/tests/exception-decision.test.ts`
  ran against PostgreSQL 18: 17 cases, 16 failures and 1 pass. Fifteen failures were
  404s from the absent decision endpoint, one is the absent attempts projection, and
  the existing courier-access guard passes. Fixtures first verify real registration,
  dispatch, pickup and exception records. Tests cover both decisions, same/other routes,
  rescheduling, normal/reverse returns, problem notes, completion without collection,
  held-route boundaries, attempts and concurrent/late replay assertions. Assertions
  beyond the missing-endpoint blocker still needed execution during T056; this initial
  run was not exactly-once evidence. The ignored JSON report is
  `apps/server/test-results/us4-t053-red.json`.
- T054 initially had `apps/server/tests/office-receipt.test.ts`: all 12 cases failed at missing
  endpoints on PostgreSQL 18. Receipt cases seed the office directly in the real database
  to isolate them from the settings endpoint; registration/dispatch/courier records are
  verified through the real API. Settings cases cover absent and empty singleton rows,
  response projection, permissions, audit, malformed inputs, concurrent changed/unchanged
  edits and late replays. Receipt cases cover both decision/receipt orders, preserved
  service date, office pickup, custody events, route restrictions and concurrent/late retries.
- T054's initial lifecycle tests had 8 baseline passes and 2 RED cases for the missing
  `officeReceiptStatus` export, loaded from the actual module with a test-only signature
  (not a mock). T057 subsequently replaced this declaration with a direct import. The original
  generic transition table remains unchanged and its prohibitions still pass.
- T055 initially added three tests to `outbox.test.ts`, with 8 passes and 2 new failures:
  the old projection let the courier return a package before office pickup and did not
  replay that pickup. The return-problem case already passed using existing domain rules.
  The positive pickup/return test also checks IndexedDB reopening, but that assertion
  remained behind the failing pickup assertion until T060 fixed the projection.
- T055's `exception-decision.spec.ts` has three phone scenarios: another attempt and a
  return with a problem/no collection; rescheduling with an offline office pickup/return
  and reopening; tomorrow's office pickup then delivery. Both phone runs failed at
  missing "Decidir novedad" or "Dirección de la oficina", before the later assertions.
  They use the built app, actual PostgreSQL and the real service worker; no completed
  offline UI behavior is claimed. The future-date case restores the shared clock.
- Ignored reports: `apps/server/test-results/us4-t054-red.json`,
  `packages/domain/test-results/us4-t054-domain-red.json`,
  `apps/web/test-results/us4-t055-outbox-red.json`, and Playwright traces/error contexts
  under `apps/web/test-results/exception-decision-*`.
- `pnpm check` passed at this initial RED checkpoint, before application implementation.
  The backend implementation and newer evidence follow; the pending web tests above
  must not be mistaken for completed functionality.

### US4 backend implementation checkpoint — 2026-10-15

- T056 implements decisions, current-state idempotent replay, attempts and held routing.
  Five added pure-rule tests failed before implementation. Domain rules remain in
  `packages/domain`; the full domain suite passes 216/216. T057 implements transactional
  office receipt and GET/PATCH settings with the shared audit receipt, including no-op
  retries. The generic `picked_up → registered` prohibition remains unchanged.
- T103 first reproduced missing custody handover for a decided return during whole-route
  reassignment. T104 first reproduced four route-release/undo failures: office-held
  returns must preserve their decision and custody when removed or cancelled, whereas
  courier-held returns prevent undo-dispatch. Those regressions now pass.
- T105 reproduced two wrong return addresses after an office-held new attempt was edited
  (delivery and reverse pickup). Return planning now hydrates the first actual pickup
  from completed stop history, not mutable shipment addresses or a later office pickup.
  Editable shipment fields remain untouched. Both cases and all 73 tests in the latest
  seven-file decision/office/route regression run pass; the earlier expanded regression
  passed 141/141 before T105. Decision and office files now have 19 and 18 passing cases.
- `pnpm check` passes after T105. All three unchanged invariant seeds pass alone after
  T105 (8.29 seconds for the file). The earlier full server run after T057 had 422/425
  passing tests and all three invariant seeds timed out at 30 seconds. No other quality
  gate was run concurrently with that failing full run. The isolated pass does not
  establish a cause or turn that run green; workers and timeout limits are unchanged.
- The subsequent **complete server suite after T105 passed 431/431** in 118.37 seconds,
  including all three unchanged invariant seeds. It ran without other quality gates in
  parallel, using the original workers and timeout limits. This is a passing backend
  gate at this checkpoint, not proof that the earlier intermittent timeout is fixed and
  not a passing full workspace/offline/e2e gate.
- The domain suite was rerun after this full server pass: 216/216 pass. `pnpm build`
  also passes, including the production web bundle and service worker.
- Scoped backend convergence repeated after T105: FR-029–FR-032/FR-041, the server
  obligations of all eight US4 scenarios, SC-006/SC-007, six plan decisions and all nine
  constitution principles. No additional backend finding remained. The assessment
  itself left tasks byte-for-byte unchanged; completion tracking then marked
  T054/T057/T104/T105 done. T055/T058–T060 still cover the missing interface/offline work.
- Twenty-four existing route/courier e2e passed without retries at the earlier T056/T103
  checkpoint, before office implementation. They are not final US4 e2e evidence. The new
  T055 phone cases and two outbox assertions still need T058–T060, then all four gates
  and repeated convergence. No migration, dependency, commit or push was added.
- Generated reports (ignored): `packages/domain/test-results/us4-domain-green.json`,
  `apps/server/test-results/us4-t057-t104-regressions.json`,
  `apps/server/test-results/us4-t105-regressions.json`,
  `apps/server/test-results/us4-backend-invariants.json`, and the failed full-run report
  `apps/server/test-results/us4-server-full.json`. The later passing full-run report is
  `apps/server/test-results/us4-backend-full.json`.

### US4 interface/offline implementation — 2026-10-15

- T058 adds the decision dialog, guarded office-receipt confirmation, applied attempt
  list and office custody history. A new history test first reproduced office receipt
  incorrectly described as a delivery, then passed after correction. The shared domain
  guard controls receipt eligibility; the API remains authoritative for mutations.
- T059 adds owner-only settings/navigation and the held labels in unassigned rows.
  Neighborhood selection and address validation reuse existing components/domain input.
  Newly exposed history/audit fields use Spanish labels. Pickup grouping also includes
  the merchant so one group's heading cannot misidentify another merchant's shipments.
- T060 shares the snapshot-to-domain projection with the return action's eligibility.
  Pending office pickup means office custody; its replay transfers custody and permits
  the return. Both previously failing outbox cases now pass, including IndexedDB reopening.
  Returns reuse the delivery sheet with received-by name/photo and zero collection;
  problems keep the return pending, without an exception action. The existing off-route
  custody list is reused. The full web unit suite passes 174/174.
- T106 first reproduced a confirmed no-op settings save swallowing a later edit. Its
  e2e drops the first answer after PostgreSQL commits, verifies the retry keeps its
  identifier, then checks that an acknowledged save gives the next edit a fresh key
  and persists the new address. Two initial test-fixture/message assumptions were
  corrected before the actual stale-address failure was reproduced. The fix renews
  the key only after acknowledgment; the four focused US4 e2e then passed without retries.
- Focused phone journeys cover two attempts, a return problem and completion without
  collection, held labels in the panel, office history, offline pickup/return with
  reopening and exactly-once synchronization, and tomorrow's office pickup/delivery.
  They use actual PostgreSQL/private photo storage, the built app and real service
  worker. This is automated Chromium phone-viewport evidence, not physical iOS/Android
  validation. A Spanish invalid-date message is also asserted before saving a decision.
- `pnpm check` passes after lint/format corrections; production build passed before the
  final wording correction. Full workspace tests, full e2e and final build/convergence
  are in progress. No timeout/worker settings, dependencies or migrations changed.
  No US4 commit or push yet.

### US4 final-gate corrections — 2026-10-15

- Before T107's policy change, three complete server runs failed: 430/431 with an
  invariant deadline; 430/431 with route creation at 1,243 ms against its unchanged
  1,000 ms limit; and 429/431 with two invariant deadlines. The last report is
  `apps/server/test-results/us4-t107-full.json`. Bounded phase timings showed latency
  spread over actions and invariant checks, not a single 30-second wait. Isolated seeds
  completed in about two seconds; that alone did not establish the physical bottleneck.
- Samuel approved separating capacity measurements from unrelated test workloads.
  Plan, tasks and quickstart were aligned before configuring two native Vitest projects.
  The 43 ordinary files retain their usual parallelism; the three capacity/invariant
  files run afterward, one at a time. No deadline, assertion, seed, step, performance
  threshold or internal concurrency case changed. No dependency or custom runner was added.
- Before/after collection is identical: 323 declarations across 46 files. Runtime
  reports also contain the same 431 cases, including multiplicity, after normalizing
  random fixture UUIDs in parameterized permission-test names. `pnpm check` and the
  complete `pnpm test` pass (216 domain, 431 server, 174 web; 821 total). An additional
  complete server run passes 431/431 in 87.89 seconds; its timestamps verify disjoint
  execution groups and serial capacity files. All three invariant seeds complete 90
  steps, in 2.14/1.91/1.86 seconds of measured workload. Report:
  `apps/server/test-results/us4-t107-partition-green.json`.
- The earlier full e2e run passed 73/74; T108's trace showed a premature old-zero
  acknowledgment assertion before local pickup persistence. The test now awaits visible
  pickup completion and settled synchronization, preserving the zero assertion, all
  downstream checks and timeouts. T109 reproduced decision controls overflowing at
  390 px with long courier labels; constrained grid/picker sizing fixes it. All four
  focused journeys pass with accessibility checks, and actual captures were reviewed.
- A final return-review inspection found T110: a return with original COD above
  COP 2,000,000 inherited the delivery collection proposal and falsely said money was
  collected. A new e2e first failed on that exact alert. Return collection initialization
  now proposes zero without changing delivery thresholds or domain rules. All five
  focused journeys pass, including unchanged original COD and zero persisted return
  amounts; the ordinary-COD return remains covered. The preceding complete run passed
  74/74 without retries. After the correction, the expanded complete gate passes 75/75
  without retries in 4.5 minutes.
- Final gates after T110 all pass: `pnpm check` (format/lint/types), `pnpm test`
  (216 domain, 431 server, 174 web; 821 total), `pnpm test:e2e` (75), and `pnpm build`
  (including the production service worker). The final complete server phase takes
  94.47 seconds. Two root workspace runs and the additional detailed full server run
  pass under T107's approved policy; these local results do not replace US4's future CI.
- Repeated scoped US4 convergence checks 7 functional requirements (FR-018–FR-019,
  FR-029–FR-032, FR-041), 3 buildable success criteria (SC-001/SC-006/SC-007), all 8
  US4 acceptance scenarios, 7 plan decisions, T053–T060/T103–T110 (16 tasks) and all 9
  constitution principles. No remaining gap was found; assessment left `tasks.md`
  byte-for-byte unchanged. Completion tracking then closed the 9 remaining verified
  tasks. The second assessment after completion tracking also found no gap and preserved
  the file's SHA-256 (`5c355e40fd13a671006a5edb44dba5e2f160c86fcb82220f9f2e868ded435944`).
  US5–US7 and feature-wide polish/physical validation remain incomplete.
- GitHub was checked read-only: remote `main` is still `4910f76`, CI `38686516078`
  succeeded, and no US4 PR is open. No dependency, migration, commit or push was added.
  The existing LAN review API was not restarted; do not treat that US3-era server as
  US4 physical-device validation.

## Open with the client

Everything the owner must answer or provide is in [OWNER-REQUESTS.md](../OWNER-REQUESTS.md),
in Spanish, kept up to date there.

## Environment notes

- Local only, never in git: `.env` (recreate it from `.env.example`; `pnpm db:seed` prints new
  owner credentials) and `docs/discovery/raw/`, the client's spreadsheets with personal and
  banking data (keep an encrypted copy or ask the client for them again).
- Playwright's Firefox does not launch on the owner's macOS; WebKit runs with a temporary
  config. Add a permanent WebKit project when 003, the iPhone courier app, starts.
- The design proposals shown on 2026-10-01 (palettes, secondary colors, the board concept) were
  rendered outside the repository; the chosen direction is recorded in
  [design-system.md](design-system.md).
