# Local Execution Ledger

## Canonical repository consolidation — 2026-10-23

The latest owner request authorizes one clean local/GitHub source. The final
540-file candidate `d604a287` passes check/1,626 tests/155 zero-retry E2E/build.
The held transport work is recovered, first failures remain retained, and native
runtime contents match the prior upgrade-tested image. The single PR/squash and
branch cleanup use local QA with skip annotations, without remote workflow calls.
[Consolidation evidence](repository-consolidation-results.md) supersedes older
branch/current-source statements below. Catalog progress remains 76/81 (94%);
physical/final and actual provider acceptance stay pending. Root worked solo.


## Latest solo continuation — 2026-10-23

The owner superseded earlier delegation instructions: complete local engineering
without subagents; infrastructure/public deployment remains owner-managed.
Root implemented and separately inspected the final corrections, ran all four
gates (1,626 tests, 154 zero-retry browser cases), built the new immutable image
and completed the representative upgrade/session/replay/fresh-data rehearsal.
[Regression receipt](../specs/001-shipment-registration/solo-production-regression-results.md)
and [upgrade receipt](../specs/004-tracking-merchant-link/local-image-upgrade-results.md)
record the 540-file source `36ef1cd6` and actual scope. No independent-agent review
is claimed for this continuation. Progress is 76/81 (94%); physical/final tasks
and actual provider/production obligations remain open. Earlier entries follow.

## Authority and verification

Owner instruction: 2026-10-20 (America/Bogota), execute the integral backlog using agents,
strict prerequisites and two levels of **local** QA. No remote workflow, CI, PR, push or
deployment operation is part of this run. The initial checkout is local `main` at
`94a7e2450ec2abae4192f7f864e34c4638f7c963`; execution uses
`codex/local-readiness-orchestration`. Earlier uncommitted contributor/planning documents
are preserved. The canonical queue initially contains 53 open tasks.

A task unlocks its dependents only after its executor supplies RED/GREEN and relevant
local checks, and the orchestrator inspects its files/contracts and confirms local QA.
The integrated candidate must pass `pnpm check`, `pnpm test`, `pnpm test:e2e` and
`pnpm build`. Run build/browser gates sequentially so a served bundle is never rebuilt
under an active test. Preserve test limits, seeds, accessibility assertions and failures.
Set `SENTRY_DSN='' VITE_SENTRY_DSN=''` on general test/build commands; reporting privacy
tests use only explicit loopback capture. No `.env` contents or private traces are printed.

## Dependency schedule

The full 53-task graph and operational gates remain in
[backlog §5](integral-execution-backlog.md#5-execution-waves-and-dependency-order).
This ledger does not replace task ownership or change any prerequisite.

The [machine-readable DAG](local-execution-dag.json) records all 53 task nodes, 11 gates
and 138 directed edges. Its topological order is checked against the canonical open IDs;
unmet physical, provider and authorization gates stay explicit. Evidence fields must be
updated by the orchestrator before a verified node unlocks its dependents.

| Batch | Tasks / graph | Concurrency and entry gate |
| --- | --- | --- |
| 1 | 001/T136; 001/T152; 001/T129 | Independent API contracts, reporting privacy and toolchain paths; initial source/prerequisites reviewed. Shared files and global QA are coordinated. |
| 2 | 001/T132; independent 001/T129 and 003/T082; then {003/T135, 001/T137} | T136 verified first; T082 uses personally verified existing custody runtime; link intent/drafts wait for T132. |
| 3 | {003/T092 → 003/T083, 003/T081/T082/T089/T090/T091}; 002/T064; 003/T084 | Relevant runtime/contracts verified first; independent matrices can run together. |
| 4 | G0 → 003/T093 → 003/T087 → 003/T088 | Technical local gates and authorized safe test target first; real phones required; closes 001–003. |
| 5 | 004 foundations → tracking → merchant portal → notifications → public hardening/docs | All 001–003 prerequisites verified; tests precede implementations; links must work before notification delivery. |
| 6 | G1 → 004/T034 → 004/T035 → G2 review; OP-01–OP-05 | Final rehearsal/restore, actual acceptance, training and owner inputs; no invented physical/provider/post-pilot evidence. |

An unresolved task blocks only its actual dependents. Independent work can continue;
neither an unchecked advisory nor missing device evidence is silently waived to advance.

Owner clarification during execution: Samuel will perform the manual Android/iPhone
verification. Provide the compiled candidate on the local network after its technical
prerequisites pass, with the URL and scenario checklist. Installation/offline acceptance
requires HTTPS trusted by those devices; an HTTP visual check is preliminary evidence.
No external hosting or production deployment is authorized by this local-network instruction.

## Initial orchestrator prerequisite audit

- Node 24.21.0, pnpm 12.8.1 and Docker 29.8.2 are available locally.
- Inspected Hono `AppType`, native Better Auth passthrough, current RPC client and both
  Sentry entry points before delegation.
- `pnpm --filter @domy/server exec vitest run tests/log-redaction.test.ts tests/account-integrity.test.ts tests/auth-lockout-recovery.test.ts`:
  exit 0, 3 files / 74 tests passed, 12.98 seconds. This verifies the existing
  T150/T151/T153/T155 privacy/auth prerequisites used by T152; not the whole release.
- Private raw command receipts live under `.git/local-orchestration/`; summaries belong
  in each task's tracked results. No task is completed by a historical checked marker alone.

## Batch 1 status

| Task | Executor and scope | Executor QA | Orchestrator decision |
| --- | --- | --- | --- |
| 001/T136 | `rpc_contracts`: inferred RPC/native-auth boundaries and compile-time tests | Complete N1 PASS | Verified by root N2: check, 1,150 tests, 100 E2E and build; dependents unlocked |
| 001/T152 | `reporting_privacy`: native error-envelope policy, actual-app/PG and compiled-browser capture | Complete N1 PASS, including compiled enabled/disabled browser | Verified by root N2 complete local gates; task closed locally |
| 001/T129 | Dependency executors: compatible source-map leaf correction and scoped esbuild resolution | Comparative loader and actual fresh/upgrade PostgreSQL tests passed | Repeated audit found a new Vite advisory; same-minor correction and integrated gates pending; keep task open |

The orchestrator checked only T136/T152 after both QA levels, leaving 51 open tasks.
The frozen source fingerprint remained unchanged across N2 verification. Evidence:
`.git/local-orchestration/n2-{check,test,e2e,build}.log`; the 100 E2E cases passed on
first attempts in 6.3 minutes, and 1,150 tests passed (282 domain/631 server/237 web).
No remote workflow, publication or deployment was performed.

## Batch 2

- `account_replay_v2`: T132 native transactional account idempotency. Root reviewed
  research R19, plan, model and contract before implementation. Generated migration 0008
  and safe atomic receipts are under review; original A→B→A RED is retained. Native
  Origin validation must also run on replay. Browser lifecycle remains part of this task.
- `custody_invariants_v2`: T082 generated custody/record invariants retain all three
  legacy seeds and 90 steps, adding an independent generated lane and SQL/history oracle.
  Executor capacity 6/6 PASS (13.97s); independent root repeat 6/6 PASS (16.74s), log
  `n2-t082-capacity.log`. Root inspected both test files; integrated static/full gates
  remain pending before closure. Earlier fixture failures are retained in the receipt.
- T129 source-map/esbuild resolution passed scoped compatibility and fresh/upgrade
  migration tests. Root approved native Vite 8.3.3 patch resolution for the newly reported
  advisory, including transitive Vitest paths, with no new direct dependency. Retain
  native peer-graph normalization without a Vitest version bump; verify frozen install,
  audits and complete integration. No blind override or publisher compatibility claim.

Current source may contain RED tests from an active independent slice. Report their
owner rather than deleting or weakening them; root revalidates each resulting candidate.

### Batch 2 integration attempt and actor refinement

Root froze 439 source/config/test files at
`c140aec1bd918f81aa508eeb34218d598f3f18c723e63eb07f9d5c7fee8a0840` and independently
passed `pnpm check` (`n2-batch2-check.log`). The full test attempt passed 283 domain
tests but exposed three legacy `users.test.ts` fixtures missing required intent UUIDs.
Preserve those failures and original assertions. Root then interrupted the still-active
suite after a separate read-only review identified cross-tab actor drift: a stale owner-A
screen could send an intent with owner-B's newer shared cookie. No task was closed and
no full test/E2E/build pass is claimed for that attempt.

T132 must now carry the expected actor across all six native account mutations and its
courier-link phase, rejecting a session/intent actor mismatch before effects or receipt
replay. Reproduce before correcting, align R19/contracts, preserve uncertain actor-scoped
work and rerun both QA levels. The interrupted attempt and its source identity remain
in `.git/local-orchestration/n2-batch2-test-interruption.md` and the original log.

Owner requested GPT-6 Luna with maximum reasoning for resumed delegation. The new
`account_actor_server_luna` and `account_actor_web_luna` executors own this bounded
server/client correction; the orchestrator retains independent review and task closure.

### Actor refinement: executor handoff and independent candidate

The Luna/max executors reproduced cookie-B/intent-A acceptance before the guard and
then passed 199 server tests plus 62 client tests. The compiled browser passed all
19 account/access scenarios with axe, without retries; the actor case preserves A's
metadata, rejects B with `409 actor_changed`, and recovers the same UUID after returning
to A. Earlier fixture/selector failures remain documented in the task receipts.

Root independently reviewed the native Origin/active-owner/actor/receipt ordering,
courier-link guard, inferred Hono headers, unchanged request bodies and recovery test.
The new frozen candidate contains 440 source/config/test files, SHA-256
`7d4227587e1661a45cd8c0ea4b14ee0efabd0b0a2cfaecfe359d78b865544d1d`.
`pnpm check` passed independently (`n2-batch2-actor-check.log`). Full tests, E2E and
build are being rerun sequentially; no additional task is closed by this checkpoint.

### Batch 2 independent acceptance

All four N2 gates passed on the unchanged 440-file candidate above: check; 1,215
tests (283 domain/655 server/277 web); 106 first-attempt E2E in 5.7 minutes; build.
No warnings or retries were observed. Source inventories and the actual
`n2-batch2-actor-{check,test,e2e,build}.log` outputs remain private local evidence.
Root approved 001/T129, 001/T132 and 003/T082 after inspecting contracts, native
transaction/Origin/actor ordering, client recovery, generated migration and invariant
coverage. Scoped convergence found no additional gap for these three tasks; other
feature tasks remain open, so no whole-feature convergence is claimed.

The catalog now has 33 checked and 48 open tasks (001: 1; 002: 1; 003: 11; 004: 35).
001/T137 and 003/T135 are unblocked and may execute in parallel with coordinated
shared files and exclusive DB/build/browser windows. Physical acceptance remains pending.

### Next parallel slice ownership

- `account_actor_server_luna` (GPT-6 Luna/max): 001/T137 shipment/edit/bulk draft
  storage validation, recoverable data/identity and Spanish recovery controls; owns
  shipment sources and 001 artifacts. Presents recovery design and RED before behavior.
- `account_actor_web_luna` (GPT-6 Luna/max): 003/T135 authoritative courier-link
  initialization, inactive link representation and failed-load recovery; owns account
  dialog sources and 003 artifacts. Retains T132's workflow/actor/receipt contracts.

Both packets require Spec Kit alignment, permanent RED/GREEN, scoped unit/types/lint/
format checks and compiled browser coverage with axe. Neither executor may close tasks
or run DB/build/browser concurrently; root grants exclusive windows and repeats N2.

Root reviewed the new permanent RED evidence before behavioral changes:

- T135: `account-web-held-get-red.log` reaches an actual unchanged save after a held
  real courier GET; the final server read shows the original relationship lost. Unit
  coverage also exposes unknown-list/null collapse and the active-only query.
- T137: `draft-red-browser-shape-detail.log` shows a valid-JSON invalid-shape draft
  rendering the generic page error. `draft-red-browser-final.log` confirms a real
  bulk commit before response loss, then reload/review/explicit duplicate confirmation
  sends different batch/row UUIDs: two `201` responses and two matching server rows.
  Malformed JSON stayed intact in this attempt but lacked recovery controls; no
  overwrite claim is made. Earlier fixture/selector and missing-function failures
  remain retained, distinguished from the demonstrated product defects.

Both fixes are still in progress. Preserve existing valid, incomplete and legacy draft
shapes; merchant/neighborhood options may have richer actual runtime fields than their
static projections. Unknown storage input must never silently discard pending work.

`draft_storage_audit_luna` (GPT-6 Luna/max) provides a read-only legacy-shape and
identity/ACK review of active T137. It cannot edit files, run DB/build/browser processes,
close tasks or unlock dependencies; this supplemental review does not replace the
executor's N1 or root's N2.

T135 executor handoff now includes 32 focused unit tests and 22 first-attempt compiled
browser cases (3 readiness, 6 account-idempotency, 13 access, with axe), all passing.
Root inspected the dialog guard and receipt; integrated types/four gates remain pending
concurrent T137, so T135 is still open.

The supplemental T137 review found identity gaps beyond the initial malformed-shape
case: an individual form can overwrite a pending payload under the same UUID; failed
post-ACK rotation leaves an acknowledged identity in storage; bulk reload needs the
remaining source rows persisted with its pending payload. Root independently confirmed
the individual RED (`draft-red-single-repeat.log`): a committed `201` followed by a
changed-body retry returns `200` for the same ID while only the original data exists.
These are requirements of the active draft-recovery task, not waived limitations.
Pre-upgrade drafts cannot recover batch IDs never persisted by an older build; preserve
their values and communicate uncertainty before an explicit new attempt instead of
silently treating them as definitely unsent. The executor is aligning artifacts and
closing these gaps before its N1 handoff. No further task closure is claimed.

The first combined T137 browser N1 attempt (`form-draft-n1.log`) passed 22/26 cases.
Retain all four failures: an ambiguous alert locator in the new rotation scenario;
a partial-bulk remaining-row assertion requiring fixture investigation; and two
existing COD/manual-fee cases whose field-level errors no longer appeared. Root
inspected the actual error contexts: the latter show a pending, disabled form with
generic validation text. Restore field feedback and validate known shared rules before
persisting/sending, without releasing an uncertain mutation on a generic `400`.
The executor is correcting these findings and the visible-form/pending-payload binding;
the source must be frozen again and N1 repeated before any integrated N2 claim.

### Resumed execution — 2026-10-21 (America/Bogota)

Samuel requested continuation. The Luna/max executors and read-only auditor resumed
after their previous turns ended at the usage limit; no unfinished task was closed.
The repeated T137 N1 passed 26 focused units and package types/lint/format, then 25/27
browser cases (`form-draft-n1-final.log`). The remaining failures concern initial
required-field feedback and synchronization with the third create ACK in the rotation
test. Preserve the earlier attempts and repair causes without weakening assertions.

The supplemental audit confirms the original identity/rotation/remaining-row risks are
addressed in source. It also identifies a grouped recovery gap after catalog validation
rejects a pending single/bulk request. A generic `400` cannot automatically release an
uncertain identity: validation can precede receipt lookup and another same-ID request
may still commit. Provide an explicit review preserving a downloadable pending snapshot
and requiring informed history review before a new corrected intent. This is pending
implementation/verification, not a claim of an effect-free server rejection.

The verified catalog count remains 33/81; T137 and T135 await integrated root N2.

### Draft and account-link root N2 — in progress, 2026-10-21

T137 N1 completed with 26 focused units, static checks, 28/29 integrated browser
cases and the corrected remaining case passing 1/1 in a fresh setup. The earlier
failed attempts remain recorded in `form-draft-results.md`. Explicit rejection
recovery now preserves pending values and identity until download/history review
and an informed new intent. T135 N1 passed 32 focused units and 22 first-attempt
browser cases; its shared-tree web typecheck subsequently passed.

Root's first full static check found an unnecessary merchant assertion made obsolete
by the validated draft type. Root removed only that assertion; the executor independently
confirmed the changed-file ESLint/Prettier and web typecheck. Preserve
`n2-drafts-links-check-attempt1.log` and `n2-drafts-links-candidate-attempt1.json`.
The revised frozen candidate contains 450 source/config/test files, SHA256
`515869a0580da7cee5ca25474f800a12da94b6d6a76edcb90cb7ca950a8b43ff`.
Root full `pnpm check` and `pnpm test` pass: 283 domain + 655 server + 303 web =
1,241 tests. The 121-case complete browser suite is running; build and final source
equivalence remain pending. No task is closed or dependent implementation started.

Root browser N2 completed with **120/121**, exit 1 (6.8 minutes). The source stayed
identical to the frozen SHA256 above (`n2-drafts-links-candidate-after-failed-e2e.json`).
The ACK-rotation case cannot click the neighborhood after a successful create and
failed durable rotation: the sticky footer contains a duplicate warning listing 51
tracking numbers plus recovery alerts, and it/header intercept the pointer. Preserve
the full log and trace/error context under `n2-drafts-links-attempt1-browser/`. This
is an unresolved reachable layout/recovery failure; do not claim a flaky nominal green
or suppress the duplicate warning, force clicks, isolate it away, or increase budgets.
T137 executor investigates with the browser-test owner; only that executor owns the
exclusive DB/build/browser slot for a causal regression and repair. Build N2 was not
started. Both task checkboxes and downstream implementations remain blocked.

The 50+ duplicate fixture reproduces the original pointer obstruction on unchanged
UI (`t137-sticky-footer-red.log`). The minimal repair moves the complete warning,
error and storage-retry block into normal document flow, leaving only the compact
primary submit sticky. No code, message or recovery action was removed. R20 was
aligned before the behavior change. Executor N1 passes 26 focused units, web types,
scoped lint/format/diff and the corrected focal browser case 1/1, including real
50+ duplicates, exact 201/200/201 identity/payload sequence, row effects and axe.
Supplemental read-only audit and root inspection find no remaining blocker in
this relocation/binding; that is scoped review, not full-feature convergence.

Repaired root N2 is running on frozen 450-file source SHA256
`1e348e85e314145433fedeb4d027245bcac36c386cd10f67fa80dff273389dbd`.
`n2-drafts-links-repaired-check.log` passes. Full tests, browser and build follow
sequentially; no downstream task is unlocked until all pass and source equivalence
is confirmed. The original failed N2 remains evidence, never rewritten as green.

Repaired-source full check and 1,241 tests passed. The ensuing E2E attempt exited 1
with 109/121 cases over 2.7 hours: twelve unrelated cases ran for 3–15 minutes despite
30–90-second limits. Source remained identical. Preserve the log and all failure
traces in `n2-drafts-links-repaired-failed-browser/`. Native `pmset -g log` confirms
15 Sleep entries between 03:20:47 and 06:02:17 America/Bogota, with repeated
~901-second maintenance sleeps; sanitized timestamps/types only are recorded in
`n2-drafts-links-sleep-events.json`. This is concrete environment-interruption
evidence, not a waiver or a claim the failed cases passed.

Root repeats the complete browser suite on unchanged repaired source under temporary
`caffeinate -i -s` scoped to the test command (`n2-drafts-links-awake-e2e.log`).
No timeout, retry, axe rule or assertion changed; successful fresh results and
post-run sleep/source checks are still required before closing either task.

## Root acceptance — 2026-10-21 (America/Bogota)

Executor N1 and independent root source review/local N2 approve this task. The
repaired 450-file source stayed identical before and after all gates: SHA256
`1e348e85e314145433fedeb4d027245bcac36c386cd10f67fa80dff273389dbd` (dirty tree, base `94a7e24`). Full `pnpm check`,
`pnpm test` (283 domain + 655 server + 303 web = 1,241),
`env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm test:e2e`
(121/121, first attempt, 6.2 minutes), and `pnpm build` all exit 0.
Logs: `.git/local-orchestration/n2-drafts-links-repaired-{check,test,build}.log`
and `n2-drafts-links-awake-e2e.log`. The awake browser interval was
06:05:35–06:11:49, with zero native Sleep events. Failed attempts remain recorded
above and in the local ledger; no retries, budget changes or axe suppressions.
The deterministic 50+ duplicate RED/repair/GREEN retained all warning contents,
recovery controls and identity assertions. This closes the owning technical task
locally; physical Android/iPhone acceptance and release remain separate obligations.

Root now closes **001/T137 and 003/T135**. Recount: 35/81 catalog entries
checked, 46 open (001:0; 002:1; 003:10; 004:35), approximately 43% by task count,
not effort or release readiness. Prerequisites now unlock independent T092,
T081/T089, T090/T091 and 002/T064. T083 waits for root-verified T092; T084 waits
for its explicit DAG prerequisites. Physical G0 and all feature 004 remain blocked.

### Courier assurance and documentation batch — 2026-10-21

All six tasks' DAG prerequisites are root-verified. The user continued the run
after an interruption; all three existing GPT-6 Luna/max agents resumed their
self-contained assignments without changing model or ownership:

- `account_actor_web_luna`: 003/T092 pure/rendered courier coverage, then freeze
  for root QA. T083 remains blocked until T092 is independently verified.
- `account_actor_server_luna`: 003/T081 role matrix and T089 native API contract
  matrix, with the first exclusive focused PostgreSQL runner slot.
- `draft_storage_audit_luna`: 003/T090 security and T091 capacity tests; source
  preparation can run in parallel, DB/capacity runners await explicit root release.
- Root: 002/T064 documentation. Four original duplicate-ID task rows and the
  original dated results body remain byte-for-byte unchanged. N1 validates four
  phase mappings, 26 relative links, PR #28 local ancestry and diff whitespace;
  independent agent review is requested. Checkbox remains open.

Pure web units/static checks may run alongside preparation; database/capacity,
production builds and browser suites remain exclusive. Runtime corrections require
artifact alignment and real RED evidence; no task closes before both QA levels.
Current checked catalog remains 35/81, with 46 open. No remote CI or publication.

### 002/T064 documentation closure — 2026-10-21

Root N1 checks preserve the four original T057/T058 rows and historical report body
exactly, verify four phase mappings, 26 local links, PR #28 ancestry and diff hygiene.
Independent Luna/max review confirmed scope and found one stale status-header date;
root corrected it and the reviewer rechecked both that date and current-batch wording.
No remaining documentary blocker. Root final inspection approves the documentation
change and checks T064, without claiming new runtime/device/CI evidence.
Catalog now 36/81 checked, 45 open (001:0;002:0;003:10;004:35), about44%bycount.
T092 N1 and root focused22/22 pass; T0908/8 and T0912/2 N1 pass (5 ms/236ms).
Their N1 tool outputs were not redirected to persistent logs; receipts report them
honestly. Full root N2 is pending. DB runner returned exclusively to T081/T089 agent.

### Courier assurance root N2 — in progress, 2026-10-21

All five executors' tasks are frozen. T081/T089 final focused N1 passes 91/91
after corrected fixture-only failed attempts retained in logs. Root tightened
allowed-role checks against 5xx and required valid-body unlinked refusal checks
for all seven courier endpoints; 17 documented endpoint rows plus account-link
bullet are checked against native Hono registration, including four shipment
actions. T090/T091 N1 passes 8/8 and 2/2; T092 N1 and root focal pass 22/22.
Root reviewed the source, strict contract schemas, security refusal effects,
busy-day fixture/budgets and courier action/record binding. No task closes yet.

Frozen candidate: 456 source/config/test files, SHA256
`2e1566b28732b57992f77a50ac5c6f2aa2f271bbab0c4c282a0ce453f1b25136`,
base94a7e24. Full root check passes; `pnpm test --silent=false` runs next under
process-scoped caffeinate, retaining real capacity console timings without
changing any workload, budget, retry or test selection. E2E and build follow
sequentially; final source-equivalence check is required. Logs use prefix
`.git/local-orchestration/n2-courier-assurance-`.

Root N2 check and all 1,279 tests pass (283 domain/676 server/320 web). Real
isolated capacity measurements: 5 ms snapshot and213ms disbursement batch. However,
`--silent=false` exposes two SDK warnings in browser privacy tests: Sentry11.1.0
default streamed tracing ignores beforeSendTransaction. Preserve this successful
test-but-warning attempt; it does not satisfy the zero-warning gate. No E2E/build
started for this candidate. Root reopens001/T152 (previous QA receipts preserved
in DAG), count35/81checked46open, and authorizes the Luna/max web agent to inspect
installed native options, align artifacts, reproduce startup warning/drop behavior,
then minimally correct native privacy config with focused N1. Its exclusive DB
slot is limited to privacy tests; courier sources remain frozen. Root will inspect
and repeat all integrated gates on a new source identity. No warning suppression.

T152 focused follow-up N1 completed: both configs remove only the ignored deprecated
transaction hook, retaining explicit zero sampling, no logs/metrics/breadcrumbs,
session integration filters and the fresh safe error allowlist. Installed SDK types
show beforeSendSpan cannot discard by returning null; no extra tracing mode/callback
is introduced. Native browser/server span attempts deliver only sanitized errors.
A call-through warning spy (not a console suppression) fails when the original hook
is temporarily restored, with visible warnings retained in
`t152-span-policy-red-spy-{web,server}.log`. Final native GREEN passes4web/5server
with real PG and no warnings. Both package types, scoped ESLint/Prettier/diff pass.
Root inspected these changes and the real RED/GREEN evidence; all sources are frozen
again for the full local gates. This is not yet permission to re-closeT152 or the
other courier-assurance tasks. Fresh N2 logs use prefix`n2-courier-native-`.

Renewed frozen source has456 files SHA256
`dbb77ffd7d5b368d5a78bfa2e072e85eca3f3fc214e9779f5d454445a63c691e`.
Root complete check and`pnpm test --silent=false`pass1281 tests
(283 domain+677 server+321 web), with no native SDK warnings. Isolated courier
capacity prints5 ms snapshot/215 ms 50-disbursement batch. The full built browser
suite is running next under caffeinate; final build and source equality follow.
No additional checkboxes or downstream tasks are unlocked yet.

## Root N2 approval — 2026-10-21 (America/Bogota)

Independent root source/contract review and all local gates pass on unchanged
456-file source SHA256 `dbb77ffd7d5b368d5a78bfa2e072e85eca3f3fc214e9779f5d454445a63c691e` (dirty tree, base94a7e24):

- `SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm check` — exit 0.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm test --silent=false`
  — 1,281 tests:283 domain/677 server/321 web, no SDK warnings.
- `env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm test:e2e`
  —121/121, first attempt,6.3 minutes; includes compiled enabled/disabled reporters.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm build` — exit 0.

Logs use `.git/local-orchestration/n2-courier-native-{check,test,e2e,build}.log`.
Before/after source inventories match exactly; browser interval11:24:02–11:30:20
had zero native Sleep events. Root capacity measurements:5 ms snapshot and215 ms
50-disbursement batch over 15 shipments (worst of 5), unchanged 500 ms/2 s limits.
All earlier test-side failures and the SDK-warning attempt remain preserved.
The native ignored-hook follow-up has its own real RED/4web+5server GREEN;
no warnings, assertions, retries, workloads or axe rules were suppressed.

Root approves the owning technical task locally after both QA levels. This does
not certify phone acceptance, provider delivery, deployment or release readiness.

Root closes003/T081,T089,T090,T091,T092 and re-closes001/T152. Catalog now
41/81 checked,40 open (001:0;002:0;003:5;004:35), approximately51% by task count.
T083 is now unlocked by root-verified T092. T084 remains blocked until T083
passes both QA levels. G0/phone acceptance and feature 004 remain unstarted.

### Active T083 and independent LAN launcher preparation — 2026-10-21

T083 prerequisites are root-verified. Web executor's separate built-browser RED
confirmed pickup2/delivery4/exception5 taps in standard/high contrast with real
backend effects, independent of the new target scanner. Root approved the scoped
interaction design preserving full readable pre-save review, editable proposed
receiver and optional proof, explicit reason selection and final confirmation.
Plan, research and design-system were aligned before product edits.

The initial48px scanner attempts are retained as mixed harness diagnostics, not
invented product REDs: focus-only skip link, native wheel/compositor timing,
scroll viewport/nav and toast/ordinal identity need discrimination. Root split
work: web executor owns flows/product/tap specs; auditor owns only the new
fixtures scanner blocks. Only one owns DB/build/browser at a time, with source
freeze during global-setup builds. Source-only launcher author has no runner slot.

OP-test-target is independently eligible for source preparation under its empty
DAG prerequisite list; its design refinement explicitly prohibits provisioning,
credentials/certificates, target build/listeners or offering LAN access before
T083/T084 and all G0 technical inputs are verified. Launcher draft is private at
`.git/local-orchestration/phone-target-source/`; publish only when compilable and
coordinated, so unrelated WIP cannot break T083 gates. Root and design auditor
flagged process PID reuse, exact Docker labels, native IP SAN checking, unsupported
parameter properties and persisted database URL redirection. Author is correcting
these before publication/execution. No phone target or physical pass is claimed.

Catalog remains41/81checked,40open. T084 stays locked until T083 passes both QA
levels; G0/phone acceptance and feature 004 stay locked.


### T083 runner diagnostics and launcher source review — 2026-10-21

The first stable-element scanner focal failed in both schemes after pickup. It
reported a 48 px button at y796–844 in an 800 px viewport while the document still
had scroll space. Root inspected the retained Playwright trace: wheel events
alternated +120, +120, −120, +120, −120. This demonstrates a scanner direction
oscillation; it does not establish a product obstruction. Logs remain at
`.git/local-orchestration/t083-accessibility-helper-final.log`; both browser traces
and error contexts are retained under `t083-helper-oscillation-browser/`. No
assertion, notification, timeout or click safety was relaxed to accept this run.

The product executor's updated flow passed 17 focused unit tests and scoped
format/lint/types. The delivery review now exposes the expected collection and
total received, including zero. Built-browser action/regression validation remains
pending, separately from scanner repair and subsequent root QA.

Root's independent source-only launcher CLI smoke accepted one valid command and
rejected ten invalid inputs under Node 24.21.0. Direct import of the private draft
first failed workspace package resolution; a process-local resolver supplied the
existing server dependencies without changing packages or filesystem links.
Partial review caught unsupported LibreSSL `verify_ip` documentation and flagged
generated healthcheck quoting for pure verification. Full source/static review
and actual isolated-target lifecycle verification remain pending. No target
resources, credentials, certificates or listeners were created.

The verified catalog remains 41/81 checked and 40 open. T083 is not closed by
focused unit success; T084 and physical acceptance retain their dependency gates.


### Continued root work after executor usage limit — 2026-10-21

Samuel requests the verified percentage in every progress update. The denominator
remains the fixed 81-task catalog; current verified completion is 41/81 (51% rounded),
not an estimate of effort. Partial implementation does not increase it.

The three Luna/max executors stopped at their usage limit. Root continues local
work without changing the requested subagent model or claiming their missing N1
reports. The launcher was published at `apps/server/scripts/local-phone-target.ts`
and included in the server TypeScript project. Root server/web type checks passed;
launcher ESLint passed before the final local-Docker dispatch guard. Root pure
healthcheck verification passed the JS literal, YAML JSON-flow list and Compose
dollar-escaping stages, preserving quoted shell variables. No Docker command was
invoked for that pure check.

The first 27-case courier N1 run yielded 23 passes and four failures: two new
backend-effect assertions raced optimistic UI synchronization; the existing errand
case awaited the removed intermediate review button; T154 lost note focus during
the notification scan after its initial fill/focus assertions passed. The log and
four traces remain under `t083-action-taps-n1.log` and `t083-action-taps-attempt1/`.
Root adjusted only asynchronous effect readiness and the obsolete errand navigation,
preserving exact record/status and final behavior assertions. T154 is instrumented
for focus metadata only while its original focus/draft/expiry assertions remain.
The scanner repair and additional courier-screen coverage are still unverified.
No task is closed on these partial results; executor and independent root QA gates
remain outstanding for the final candidate.


### T083 focus resolution, scoped GREEN and ongoing integrated QA — 2026-10-21

Root reproduced T154 with temporary focus metadata (no field contents). The note
was focused, then Base UI's queued `restoreFocus: "popup"` frame moved focus back
to the sheet. Installed `FloatingFocusManager` source confirms it unconditionally
refocuses the popup after the focused review button is removed. The plan was
aligned before moving focus to the stable, focusable sheet before switching to
correction in delivery/exception forms. Original focus, draft and expiry assertions
remain. Temporary instrumentation was removed after retained RED/causal GREEN.

The root six-case focal passed without retries: standard/high-contrast 360 px
48 px hit testing and axe, pickup/delivery/exception taps 2/3/3 with real effects,
T154 and errand completion. Screenshots/artifacts are retained under
`.git/local-orchestration/t083-root-active-surface-browser/`; log
`t083-root-active-surface.log`. Root visually reviewed readable reviews and courier
navigation, summary and pending surfaces. Independent Luna/max source audit found
no blocking helper/focus issue; the original axe and role fixtures remain intact.

Root `pnpm check` and 1,281 tests passed (283 domain, 677 server, 321 web), logs
`n2-t083-{check,test}.log`, source 459 files,
`0ea23353b38b49ba10a0cfce1f7f7fd0e3d00015946f647ede1bfeb5fc2e4223`.
These gates precede the executor's additional E2E-only cases for populated offline
Pending/My Day and editable controls. The final integrated browser/build gates
and complete executor N1 are still pending. No new task closure is implied.

The launcher executor independently reran scoped format/lint/server typecheck,
CLI/state negative smoke and native dry-run, all exit 0; logs under
`.git/local-orchestration/phone-target-source/n1-*.log` and the
[receipt](../specs/003-courier-app/local-target-source-results.md). Root reviewed
these separately from its own results. Real isolated-target lifecycle remains
unexecuted and OP-test-target remains in progress. Catalog: 41/81 verified (51%),
40 open; T084, G0, physical acceptance and 004 retain their prerequisite gates.


### T083 verified and next dependency unlocked — 2026-10-21

Executor N1: 36/36 full courier/exception browser cases, 22 focused web tests and
scoped statics PASS. Root independently inspected the final source and screenshots;
a second Luna/max audit found no blocking helper/focus issue. Root check, 1,281
tests (283/677/321), 129 first-attempt E2E (7.6 minutes) and build passed with no
SDK warnings. Logs `n2-t083-final-check.log`, `n2-t083-test.log`,
`n2-t083-e2e.log`, `n2-t083-build.log`. Final 459-file SHA-256
`3b51b24f3a7781b21c8e7fdeaf77a6843b9fd156a131204eba3f3d31674823fe` matched before/after.
Unit-run provenance proves only later E2E additions differed; all application,
unit-test and toolchain files were identical. Browser interval 15:23:27–15:31:04
had no Sleep events (`n2-t083-awake.json`).

Root closes 003/T083 and unlocks 003/T084. Catalog now 42/81 verified (52%),
39 open (001:0; 002:0; 003:4; 004:35). G0, physical acceptance and 004 remain
unverified. All causal RED/harness failures and scoped GREEN artifacts remain.


### T084 rehearsal dependency correction — 2026-10-21

Independent Luna/max review confirmed a planning cycle: the backlog requires T084
configuration rehearsal in an isolated environment, while our earlier policy barred any
target run until T084 closure. This was a root scheduling restriction, not a new owner
constraint. Before any resources, split verified source QA into OP-target-source-reviewed
and reset OP-test-target to pending resource QA with all G0 code prerequisites plus that
source review as explicit verified dependencies. A concrete T084 draft must also be
reviewed before root reserves resource execution. Synthetic rehearsal may then finish
T084; G0 and offering the phone URL still require BOTH target QA and T084 verified.

Inventory and source receipt now state this sequence; no acceptance condition is waived,
no provider/production/OS trust operation is added, and no resources have been created.
Source approval includes the executor's own six passing local checks and root review/
full statics/build of launcher SHA c10d43b8be3ce8270c0ad1d1a85beaba4520ba5b2cb87b9e6f224d4a374dd347.
Catalog remains 42/81 (52%), 39 open; planning nodes do not alter task counts.


### T084 draft reviewed; isolated rehearsal eligible — 2026-10-21

Root reviewed the concrete README/receipt draft against native env, storage, push and
Vite sources. The draft distinguishes required settings/defaults, pre-created private
provider bucket and 12-month lifecycle, stable VAPID and deliberate re-subscription,
and courier CSP allowances versus the current frame-ancestors-only middleware.
Root required replacing an unpinned download-based key command with the installed
web-push API; the executor corrected and rechecked it without generating keys.
The example-env comment now points to the single pinned README instruction.

Root also fixed the inventory command sequence to seal the private build before
serve. T084 remains open until isolated rehearsal, with actual provider policy and
phone delivery expressly outside this local evidence. All code/launcher prerequisites
are verified. Root approves the draft for synthetic resource QA under the corrected
acyclic policy; this is not G0, phone acceptance or production approval.


### Isolated launcher runtime RED — 2026-10-21

Preflight found current en0 LAN IP 192.168.58.219, local Docker unix endpoint, cached
images and free reviewed ports. Existing domy-postgres/adminer/s3 identities remained.
N1 prepare for phone-20261021-a exited 1 after creating only its labeled isolated
PG/S3 containers, network, volumes and private config/TLS files. The command's guard
message incorrectly implied no prior writes; allowlisted inspection establishes phase
failed, no build, listener, registered PID, credentials file or VAPID pair. Logs are in
`.git/local-orchestration/phone-target-rehearsal/prepare*.log` and safe summaries.

Cause: `docker network ls -q` returns IDs, while the ownership guard compares names.
The newly created owned network was rejected as unexpected. Source correction must
return names explicitly and preserve every exact-label/name/port/image guard. Runtime
source approval is reopened; target resource QA is pending until source N1/root approval.
No retry, cleanup or service mutation is authorized during that source review. The partial
run is preserved, including the misleading-message evidence. T083 application acceptance
remains valid; no courier application source changed. Catalog remains 42/81 (52%).


### Launcher network-output correction approved — 2026-10-21

Executor N1 passed scoped statics, CLI/state smoke and native read-only formatted
name queries against the retained failed resources. Root independently confirmed
the actual Docker output and labels. Exact reverse reconstruction matches c10d
source; the retained diff proves only three list formats and truthful guard
messages changed. Root ESLint and server typecheck passed. Corrected launcher
SHA f4d70f52c288a494d84a4f83c8ab3ee528105992cd9e9c036139f30b381ad1be is approved.
The courier application/unit/browser sources are unchanged; earlier T083 acceptance
remains valid. Resource QA may now stop only run a's owned containers/network,
preserving volumes and failed evidence, then create fresh run b. No target runtime
acceptance, G0 or phone result is claimed. Catalog remains 42/81 (52%).


### Second launcher runtime RED: health-readiness precondition — 2026-10-21

After approved name-format correction, N1 stopped only run a successfully, preserving
its volumes and all developer IDs/ports, then created fresh run b. Prepare b exited
in the complete-health guard. Root's independent read-only Docker event timeline
(`root-b-health-red-timeline.json`) shows prepare output ended at epoch
1792616273.648285; PostgreSQL first healthy event was 1792616274.420365292,
S3Proxy 1792616277.334271835; both subsequently healthy with zero restarts.
This proves a readiness precondition error, not an established unhealthy database.

Source review reopened before any mutation: native Compose health waiting within
the existing 90-second startup bound must precede the complete guard. The guard,
budgets and ownership checks stay unchanged. No build/listener or phone target
was accepted. Run b and failure evidence remain intact. Catalog stays 42/81 (52%).


### Native Compose health-wait correction approved — 2026-10-21

Root independently reviewed the exact one-line change against reconstructed approved
f4d source. Native `--wait --wait-timeout 90` precedes the complete health guard;
no budgets or ownership checks changed. Own scoped ESLint and server typecheck
passed. Launcher SHA 8c095316ace74d1e9e25a0f98f342e238c6197a76359f89b4eb333788b551d1d
is approved. Earlier application QA is unchanged. Resource QA may stop only run b
containers/network, preserve all data volumes and developer services, then create
fresh run c, build privately, seal, serve, verify and gracefully restart the app.
Any new runtime failure must be retained before further changes. No target runtime,
T084, G0 or phone acceptance is claimed. Catalog remains 42/81 (52%).


### Third launcher runtime RED: native authentication rate limit — 2026-10-21

Run c prepare/private build/seal passed; HTTPS HTML/assets/worker and two Origin
refusals responded correctly. First operational verify failed at the fourth rapid
password sign-in: c-serve.log records three 200 sign-ins then 429. Installed native
BetterAuth1.7.6 enables production limiting and caps sign-in at 3/10 seconds, returning
X-Retry-After. The verifier unnecessarily signs owner in for each Origin probe.
Root independently confirmed the request timeline and native implementation.
Source review reopens: reuse one owner session; explicitly report and respect only
a validated bounded native 429 X-Retry-After, with at most one retry. Keep all auth
assertions and production protection; never retry bad credentials or silent failures.
Stop only the retained own listener before edits; preserve run c evidence/data.
Root source approval remains required before fresh resource rehearsal.42/81 (52%).


### Graceful terminal shutdown RED retained — 2026-10-21

After root-authorized Ctrl-C of run c own PTY, N1 found HTTPS port free and
root independently confirmed recorded PID91110 absent. Private state still says
running/processPid91110, rather than prepared/process:null. All containers and
volumes retain identities. This is failed shutdown evidence, not a successful
restart. No state was forged or cleanup attempted. Review the lifetime of signal
handlers during asynchronous server/DB closure and state persistence; guards and
resource ownership must remain intact.42/81 verified (52%).


### Shutdown source decision before implementation — 2026-10-21

Independent Luna audit reproduced native Node termination on a second SIGINT
during asynchronous cleanup with once/off handlers. A minimal pnpm PTY trial
delivered one signal and completed, so duplicate pnpm forwarding is NOT proved
as the cause of run c. Preserve that uncertainty and actual failed state.
Approved narrow correction: keep process.on SIGINT/TERM handlers installed
through server/DB closure and prepared-state persistence, with existing closing
guard ignoring duplicates; remove only after completion. No sleeps, forced kills,
state forgery, ownership weakening or runtime acceptance. Fresh real shutdown
must pass executor and root review before readiness.42/81 verified (52%).


### Authentication/shutdown source correction approved — 2026-10-21

Root reconstructed exact approved8c09 from retained c10d plus approved diffs,
then inspected combined diff af2a39fba8115d544c5b705eb952bdf9d84a373a2b5f9bd6c291a2b31ffc60d7.
Current launcher6dbb6d44511f035f5cddec0638ed52122032e15d41dde6158336a7997322d322
passes executor N1 and independent root ESLint/types/format. Root directly executed
the extracted actual signIn function against14 boundary cases: immediate failures,
strict retry-header validation, one bounded native 429 wait/retry, final failure.
Two extracted actual shutdown callback cases prove repeated/mixed signals retain
handlers through exactly one cleanup/persistence. These are source-only checks,
not network or real shutdown acceptance; Node's stripping API emitted its standard
experimental warning in this disposable audit harness. An initial harness extraction
syntax error is retained separately, corrected without product edits.

Root also independently reviewed quickstart prerequisite corrections and verified
all 21 scenario rows byte-identical toHEAD, linked files present, unpinned command
removed. No new acceptance claim. Resource executor may stop only retained c
resources with all volumes preserved, prepare freshd, build/seal/serve/verify,
then test graceful native shutdown/restart. Preserve any failure before further
changes. Catalog42/81 (52%); T084/G0 remain open.


### T084 / local target double QA complete — 2026-10-21

Executor N1 and independent root N2 approve isolated run phone-20261021-d. Prepare,
private envDir:false build/seal, native TLS/auth/role/catalog/route/private-photo
checks, graceful fingerprint-checked SIGTERM and stable restart all passed. Root
ran its own live verifier, Docker/PID/TLS/CSP audit, and exact source provenance.
The sole changed source since T083's accepted 1,281 tests/129 E2E is the launcher;
scoped static/boundary QA plus actual rehearsal cover it. Every earlier failure
and its correction remain retained. Source 459 SHA
0f075fa48ab8c2b3a202a711ccb2a14f16d84881fbb202478df35c730b3d70f5; private build
9ccfb13a7c54dd27d48cc4c1fdfe75f17c8913d98e06eaf8fe7359ef1b523020.

Root closes T084 and OP-test-target; G0 permits owner-operated trusted-LAN
acceptance. Catalog is now 43/81 (53%), 38 open. Next is owner access/trust check,
then prepared T093/T087 physical scenarios and final T088. Feature 004 stays
blocked. No phone, provider or production acceptance is inferred. The current
listener remains available; only the public CA and private synthetic access-file
path are handed to Samuel. TLS expires 2026-10-28 16:15:05 Bogotá; IP changes
invalidate readiness until reviewed. No OS trust/firewall changes were made.


### LAN availability incident — 2026-10-21 22:11 Bogotá

Samuel reported that the offered URL did not work. Root confirmed unchanged en0
IP192.168.58.219, no listener on8443, and recorded PID98556 absent. The two d
containers remained healthy with unchanged IDs/loopback ports; private state still
reported running. The last retained request was successful earlier in the day;
termination cause is not established. Earlier rehearsal evidence is historical,
not proof of current availability.

Current OP-test-target/G0 access readiness is reopened. T084 remains a verified
documentation/rehearsal task; catalog 43/81 (53%) is unchanged. Executor recovery
is restricted to stopping owned d resources with volumes preserved, then fresh e
prepare/private build/seal with a detached nohup/caffeinate direct Node process,
without a parent pnpm/PTY lifecycle. Independent root liveQA must pass before
claiming restored access. No source, OS trust/firewall or provider change.


### LAN availability restored on detached run e — 2026-10-21

Executor stopped only owned d resources, preserving volumes and developer services,
then prepared/built/sealed phone-20261021-e with unchanged source. An initial shell
nohup/disown attempt did not create a listener (prepared/null state); its diagnostic
was retained and never counted as success. Native child_process.spawn with detached
true and unref then started caffeinate/direct Node with ignored stdin/private logs.
Root independently confirmed PID 12004, PPID 1, PGID 12004, no TTY and unique 8443 listener
after the launcher helper exited. No OS service/trust/firewall or product source change.

N1's verifier log reports full completion and bounded native 429 handling; the wrapper
failed to capture its exit because zsh variable status is readonly. That wrapper failure
is retained, not relabeled exit 0. Root independently ran the full verifier with exit 0
captured directly, GET 200 with normal trusted TLS, and Docker/PID/TLS/permissions audit.
Evidence: root-e-verify.log, root-e-https.json and root-e-resource-audit.json in
.git/local-orchestration/phone-target-rehearsal/. All developer identities/ports remain
unchanged; PG/S3 are loopback-only. Exact source 459 SHA remains
0f075fa48ab8c2b3a202a711ccb2a14f16d84881fbb202478df35c730b3d70f5.

Root restores OP-test-target/G0 availability approval. Catalog remains 43/81 (53%),
38 open; no physical scenario is completed. The URL is unchanged, but the new e public
CA and synthetic access file replace the earlier d handoff. Leaf expires
2026-10-28 22:12:32 Bogotá. Owner access/trust and T093/T087 remain pending.


### Owner confirms access; T093 preparation begins — 2026-10-21

Samuel reports the app opens and works on Android and iOS. Access is recorded
as owner-reported only, without inferring sign-in/install/TLS trust method or
full scenario outcomes. Current e listener is still present. All G0/T083
prerequisites are verified, so T093 preparation starts; two Luna/max agents
independently inspect per-phone fixture contracts and the human protocol.
No fixture mutation is delegated before root approves the concrete plan; no
T087 execution or feature 004 implementation begins. The21 physical scenario
rows remain unexecuted; catalog 43/81 (53%), 38 open. Device metadata requested
asynchronously while independent preparation continues.


### T093 fixture plan review before mutation — 2026-10-21

Owner reported device text is provisionally four models: iPhone15, iPhone17ProMax,
Pixel10 and Pixel10Pro. Versions/login/PWA state remain unreported. Root reviewed
the proposed four isolated courier accounts/routes and native UUID/action/version
contracts. Original e account/route and pending work must remain untouched.

A material proposal error was caught before API execution: recipient_pays_fee
derives COD from fee, so it cannot prepare the no-COD timing case. Native domain
execution confirms merchant_account yields0 while fee remains positive. Corrected
per-device COD values must be0/50000/25000/0 with payment modes
merchant_account/cash_on_delivery/cash_on_delivery/merchant_account. No product
bug or new task is inferred. Draft source and native input/snapshot assertions
require root approval before any login or fixture mutation. Catalog43/81 (53%).


### T093 fixture helper approved before setup — 2026-10-21

Root authored the operational private helper after the initial pure draft and
plan review. Independent Luna N1 confirmed native HTTP contracts and no courier
record/photo/custody writes. Its source review found a pre-read symlink/ownership
guard gap; root corrected it before any state read or API execution. Both own
syntax/dry-run checks now pass on helper SHA
ed329fa671f15a1ced47ca96a3ce5e18353d880b0f09e4d7d62051ee5771d276.

Root approves exactly one fresh --prepare run: four isolated accounts/couriers,
sixteen shipments, four routes; persist UUID/inputs/checkpoints privately before
mutations, stop on partial failure, retain original completed e route/history.
No application changes, rebuild, provider or physical acceptance. Setup remains
preparation; T093 stays open and catalog 43/81 (53%) unchanged.


### T093 preparation and agent browser checks verified — 2026-10-21

Executor N1 setup exited 0; root N2 independently verified 4 accounts/couriers,
16 shipments and 4 routes, COD 0/50000/25000/0, exact native status history, zero
courier records/custody and isolated snapshots. Original completed e route
was preserved. Root audit corrected an event-type assumption against native
source before passing; no setup retry or product change. Evidence in 003
quickstart-results and .git/local-orchestration/t093-root-audit.log.

After the owner personally resolved the browser security interstitial, root
performed visible login and Mi ruta/Pendientes/Mi día navigation, actual 360/390
CSS standard/high-contrast financial scrolling, and new pixel-10 fixture
route/pickup inspection without recording actions. Browser bypass is not
trusted-TLS/PWA physical acceptance. Screenshots retained; viewport/contrast
restored and tab kept available. No camera/notification permission accepted.

T093 remains in progress; all 21 physical scenario rows remain unexecuted.
T087/T088 and feature 004 stay blocked. Catalog43/81 (53%), 38 open.


### Isolated agent browser journey planned before setup — 2026-10-21

Owner asks to continue. Preserve all four phone fixtures; create a fifth,
separate agent-browser courier/route with four shipments using the previously
reviewed helper. Only private QA directory/device list and truthful summary
counts change. N1 source review must pass before one fresh prepare execution.
Root will independently inspect the resulting native route/records before UI
actions, then exercise pickup/delivery/exception through visible browser controls.
No physical acceptance, fake clocks, provider sends or new product behavior.
Catalog43/81 (53%) unchanged; T093 remains in progress.

### Agent browser journey and independent root data audit — 2026-10-21

Luna N1 reviewed helper SHA
229ab8ba14b2386198176fc43b6910070342dcc66f59016e161c3b2fd5b7ee8c,
ran syntax/dry-run and one fresh setup with exit 0; root initial native audit
passed before courier actions. Root then used only visible controls on the fifth
agent-browser Ruta 6: four pickups, three deliveries (cash 50000/0/25000), one
absent-recipient exception, and one public synthetic icon attached through the
native file chooser. All actions synchronized and the route finished automatically.
Mi día showed 3 deliveries, 1 exception, 75000 cash and 0 pending stops;
Pendientes explicitly confirmed all records/photos synchronized.

Independent root HTTPS audit passed: eight unique records, exact five native
shipment events each, correct courier/author, no on-behalf/reverts, correct
per-record cash/custody and uploaded proof metadata. Exception custody remains
with this courier; three delivered shipments have none. All four phone routes
remain in progress with their 16 shipments dispatched and zero records. Evidence:
.git/local-orchestration/t093-browser-root-post-audit.mjs (SHA
c3fac59a3616420ac3e928a8eb189bfe9084be5749530cbc3b40acb0d34ea601),
matching .log/.json; node --check and native execution exit 0. Exact event
assertions were added after the first successful inspection, then passed again.

Root separately recomputed source/schema/lock/build using the launcher's native
file ordering and paths; all match the sealed e target. Source
8d58f5e7ca62ac1dedcf2d37628e471ed4f5dd27b66e714da347284bd1aecabd;
build 9ccfb13a7c54dd27d48cc4c1fdfe75f17c8913d98e06eaf8fe7359ef1b523020.
Evidence: t093-browser-root-identities.mjs/.json; syntax/execution exit 0.
PID 12004 remains the sole HTTPS listener. No product source/build changes,
global-gate rerun, production deployment or remote CI action occurred.

Photo byte/access double QA passed: Luna N1 helper SHA
0efff2a0460cbf669e06c9ce47cf1eaa05063d3d7f64216fbedac28dd86dfeb3
and root-reviewed copy SHA
2ede15f4cf935bae9d4a5d2ed2617164b65944c7a0ff72464e77f4413cf148de
both passed node --check and native execution with exit 0. Only the fresh report
filename differs; sanitized reports are equal. Evidence in
t093-postjourney-photo-audit.json and t093-postjourney-photo-audit-root-n2.json
under .git/local-orchestration/. Eight unique applied records have matching event
timestamps/authors; route finished event and summary agree. Photo: uploaded proof,
3195 bytes, JPEG start/end markers, owner 200/private no-store, anonymous 401,
finished-route author courier 403 and other courier 403. Native login creates
sessions and snapshot GET may update lastSyncedAt; no audit courier-record or
route/custody mutation. Root accepts this browser-journey checkpoint only.
Screenshots and
limits are recorded in 003 quickstart-results.md. Synthetic file upload is not
camera proof; the final parcel was delivered online despite its fixture label.
No offline simulation, physical restart, push, dark-mode or SC-002 timing claim.
Viewport/contrast restored, summary tab retained. Physical rows remain Not run;
T093/T087/T088 remain open, 004 blocked, catalog 43/81 (53%), 38 open.

### Owner defers physical run and unlocks local 004 development — 2026-10-21

Owner explicitly says “omite y continuemos” after the physical-test handoff.
Root records a development sequencing exception: continue W12–W18 from the
verified 001–003 technical baseline without waiting for physical T093/T087/T088.
Those tasks remain unchecked, all 21 physical rows remain Not run, and 003/T088
is retained as an explicit prerequisite of final 004/T035 delivery. No constitution
amendment, physical pass, remote publication or production authorization inferred.
The four physical fixtures and sealed 003 LAN build remain preserved.

Updated DAG adds an owner-approved scheduling node, not a new catalog task or
runtime QA claim. Root validated all prerequisites/order and absence of cycles.
W12 parallel read-only Luna/max reviews cover domain/privacy/contracts and
infrastructure/proxy/worker/migrations. Root owns artifact reconciliation; no
behavioral implementation starts until CRITICAL/HIGH findings are resolved and
independent review passes. Next sequence: T001 configuration; T002/T003 RED in
parallel; schema/code and public boundary/layout/settings only after each prior
gate. Merchant page must precede WhatsApp-message delivery as already planned.
Optional git hooks are not executed: this orchestration remains local-only.
Catalog unchanged: 43/81 verified (53%), 38 open; next reports count verified
tasks only. Source-changing 004 work will need a new candidate rehearsal before
any claim that the running sealed 003 LAN build contains it.

### W12 design and D6 local inventory verified; T001 RED — 2026-10-21

Two independent Luna/max read-only analyses found and root reconciled public bearer
logging/audit exposure, existing-row backfill, notification actor/payload receipts,
merchant-before-notification delivery, direct-photo date scope, carrier destination,
merchant deactivation wording, native transport identity, worker/cache headers,
public-origin parity and partial settings. Both rereviews found no remaining design
CRITICAL/HIGH. Coverage is 24 FR / 5 buildable SC; reviewer checklists unchanged,
52/52 satisfied requirements gates. Receipt: 004/artifact-alignment-results.md.

D6 N1 and root N2 native read-only inventory agree: developer PostgreSQL 18.0.6,
0 shipments / 1 merchant / 0 courier records / 0 photos, neither code column;
applied migration 0004, repository through 0008. No row contents, credentials,
DDL, data repair or target changes. Scope allows disposable nonempty prior-schema
upgrade tests only; it does not certify production inventory or permit dev/LAN
migration. D6 and 004-design nodes are verified independently of catalog tasks.

T001 implementation is delegated with exclusive source/build ownership. Meaningful
env boundary RED captured: 10 failed / 2 passed, exit 1, before implementation,
.git/local-orchestration/public-t001/env-red.log. Root and an independent reviewer
checked preservation of prior assertions and requested parser-normalization,
nondefault-origin, isolated HTTPS, error secrecy and private envDir:false coverage.
No T001 closure until executor checks and root source/local QA pass. T002/T003
must wait for T001 verification. Catalog remains 43/81 (53%), 38 open.

### 004/T001 verified; T002/T003 parallel RED begins — 2026-10-21

Executor N1 completed canonical public-origin validation, explicit production HTTPS
and APP_URL agreement, selected Vite scalar, dynamic E2E/runtime bindings, and future
phone build/runtime instructions. Meaningful env RED and the corrected lint/report-path
diagnostics are retained; final focused tests 20/20 domain and 14/14 env, check pass.
No lint rule/threshold/assertion was removed. Root additionally corrected the example's
stale recovery-email comment to match existing no-provider/no-token-logging behavior.

Root N2 inspected source and caller boundaries, then ran on frozen source adb2e974
(461 files): all 1311 tests (303 domain/687 server/321 web), check, two first-attempt
courier-route E2E with retries0 and final build; all exit0. Durations:186.72/61.21/
16.67/4.79 seconds. Root separately resolved native envDir:false config, built a fresh
private bundle with synthetic sentinels, scanned352 artifacts and confirmed only
selected origin defined/no secret. Source fingerprints before/after remain identical.
Evidence: 004/public-origin-results.md and .git/local-orchestration/public-t001/.
No full129-case E2E rerun, deployed004 reachability or physical result is claimed.
Running phonee remains its earlier sealed003 build and resources are untouched.

Root approves T001, marks only its canonical checkbox and DAG node, and independently
recounts81 catalog entries:44 checked/37 open (54%). This unlocks two Luna/max agents
in parallel: T002 secret-code/upgrade RED and T003 native public boundary/header/log RED.
They author separate tests; native DB executions are explicitly serialized by root.
Both must report intended assertion failures and clean types/lint before root N2.
T004/T005/T006 implementation remains locked until its required RED/QA completes.

### 004/T002–T003 RED verified; parallel foundation implementation — 2026-10-22

Root inspected and independently reran both permanent regressions on source
ceefb587a8e40f1ce8f316093ca0a9e3743ef8b6a326c9217597809d53fb8a3d
(464 files). T002: four intended assertion failures, 3.80 seconds; T003:
five intended assertion failures, 4.01 seconds. No setup, collection or native
HTTP errors; scoped format, lint and types pass. Original and strengthened RED
logs remain under .git/local-orchestration/public-t002/ and public-t003/.
Receipt: specs/004-tracking-merchant-link/foundational-red-results.md. Assertions
blocked by earlier failures are not treated as verified protections. These tasks
require RED evidence; implementation remains open.

Canonical catalog: 46/81 verified (57%), 35 open. Three GPT-6 Luna/max agents
now implement T004 generated additive migration/backfill, T006 native HTTP
privacy/rate limiting, and T007 anonymous layout/service-worker isolation in
parallel. DB-backed runs and build/E2E remain serialized through root grants.
T005 waits for root approval of T004. No physical checklist was closed, no
running LAN build changed and no production action was authorized.

### 004/T004 verified — 2026-10-22

Root approves generated additive DDL and schema/audit/domain consistency after
executor QA and independent six-test PostgreSQL run (6.01s), format/lint/types PASS.
Historical helper mismatch and shell-wrapper diagnostic retained; full new-row
replay snapshot added. Receipt: 004/schema-migration-results.md. T005/T008 now
unlocked. Catalog47/81 (58%),34 open; no whole-foundation green or deployed004
claim. DB slot passed to T007 RED, then T006 N1.

### 004/T006 verified — 2026-10-22

Root final42/42tests6.10s, ESLint/types PASS; focused format PASS. Public native
peer/limiter, uniform errors, headers and redaction reviewed. Added webDist RED
exposed static fallback200 and streamed-response socket fault; root rejected
invalid-path workaround. Final typed native handlers skip API before static;
original failures retained. Receipt004/public-protection-results.md; appfd30aa44.
Catalog48/81(59%),33open. RootT007N2 now runs on final stable source; its N1
3/3pass overlapped typing investigation and is not claimed as exact-source proof.

### 004/T007 verified — 2026-10-22

Root3/3built-worker E2E13.3s (retries0),13unit,webtypes/lint/format/diffPASS;
frozen479filesfca79157 identicalbefore/after. Independent root stable-source
run supersedes N1 overlappingservertyping boundary. Both prefixes network,
controller/outbox/cache preserved, anonymous320pxaxePASS. Receipt004/public-layout-results.md.
Catalog49/81(60%),32open. T005N1now52/52PASS; rootN2runs. T008authoring
unlocked after prior source freeze; tests first, DBslot requests serialized.

### 004/T005 verified — 2026-10-22

Root approves native transactional API generation after own53/53tests9.98s,
scoped format/lint/servertypesPASS and audit/replay review. SQL-default-free
disposable database demonstrates Node generation for single/bulk/merchant.
Receipt004/secret-code-results.md; reviewedfiles hashes preserved. Catalog50/81
(62%),31open. T008 REDschema29pass/7fail and PG1pass/4fail reported; root
independent RED runs before implementation approval. Full foundations still open.

### T007 reopened: public URL aliases — 2026-10-22

Independent Luna/max read-only audit confirmed router decoding/case-insensitive
matching versus raw literal worker guard; uppercase and encoded public aliases
can register the worker or use cached shell. No data leak demonstrated; current
pages are shells and APIcache remains excluded. Root reopens canonicalT007 and
DAG node, retains prior QA, delegates bounded normalization/permanent regressions.
Catalog now49/81(60%),32open. T008N1domain36/PG114/staticPASS; rootN2 underway.

### W15 read-only design precision — 2026-10-22

While frozen foundation QA runs, root aligned R17/model/contracts/test tasks on
approved FR008-specific wording, effective received-by source (never intended
recipient), and explicit ShipmentKind queue helper input/null missing anchor.
Independent Luna/max rereview found reverse-pickup eligibility ambiguity; root
applied the explicit FR006/FR008 kind rule: queue only dispatched before pickup,
never after pickup even if a delivery task remains. No owner scope change or
source implementation occurred. All next-wave tasks remain blocked by foundations.

### 004 foundations accepted; T007/T008 closure — 2026-10-22

Root fullcheck/1376tests/133firstattemptE2E7.7min/buildPASS; frozen481files
c13b486c19aa4f472b400b3caf235bb1568c8136b04eca261c5455d6d115b80e
before/mid/after identical. T007 corrected alias guard,32unitcases and actual
controlled/fresh browser variants; T008 partialsettings/officepreservation audited
with nativeDB and realUI. Both accepted, all8foundationsverified. Catalog51/81
(63%),30open. R17 independent rereviewnoCRITICAL/HIGH. Root unlocks4parallelRED
T009/T010/T011/T012; implementations stillwait verifiedindividualRED. No source
publication, remoteCI, physicalacceptance or LANbuildchange. Receipts:
004/foundation-integration-results.md and owning public-layout/company-settings.

### T010 RED verified; T014 unlocked — 2026-10-22

Bothlevels routes41collected/33existingPASS/8intendedassertionRED, root112ms;
scopedformat/lint/typesPASS. No productexport/stub created. Receipt004/queue-red-results.md.
Catalog52/81(64%),29open. T014 assignedafterrootapproval; T011nativeREDhasDBslot;
T009projectionREDauthoring, rootT012browserfixtureauthoring proceedparallel.

### T014 helper verified — 2026-10-22

Rootdiffandown41/41tests81ms plus scopedformat/lint/domaintypesPASS; N1all
workspace types+41/41PASS. Onlyroutes.ts newhelper; sourcea7a7665c. Catalog53/81
(65%),28open. T009matrixkindprecedence/officecontexts and T011cast/expiredhelper
issues caughtinN2 beforeacceptance, testsbeingcorrected. RootT012draft uses
privatedisposablePGfixturefile toread actualgeneratedcodes beforelaterpanel
linkprojectionexists; no testendpoint/productcontractchange.

### T009/T011 RED accepted — 2026-10-22

Corrected tests independently reproduced:domain72intendedmissingexportfail305ms,
server7intended404fail1unknownpass5.79s; staticPASS. Root caught kind-wording
misexpectations, weakdate/officecontexts, uncheckedresponsecast and expiredhelper
forcingfullvariant; correctedbeforeclosure. Laterblockedassertions explicitlynot
claimedpassed. Receipt004/tracking-red-results.md. Catalog55/81(68%),26open.
T013 unlocked; rootrequests temporaryno-source-edit while T012realbuildRED slot
runs, then domainimplementation mayproceed. T015 remains blocked byT013.

### T012 browser RED accepted — 2026-10-22

Both levels independently reproduced five intended missing-UI failures on the
corrected browser tests; clean setup/build and scoped format/lint/web types.
Root corrected support WhatsApp preservation before acceptance. Exact hashes and
limitations are in 004/tracking-browser-red-results.md; original logs retained.
Catalog56/81(69%),25open. Root releases source freeze for T013 implementation;
T015 waits for its independent approval. T016 may be planned read-only.

### T013 projection accepted; T015 unlocked — 2026-10-22

Both levels118/118 focused tests+scopedformat/lint/allworkspacetypesPASS;
root295ms. Explicitstrictallowlist/minimalinputs and currentcustody/provenance
reviewed; erranddestination/offroutekind/fallbackexpiry findings corrected.
R18 defensiveguard aligned. Receipt004/tracking-projection-results.md.
Catalog57/81(70%),24open. T015 gets exclusive nativeDBslot; T016 remains gated.

### T015 API accepted; T016 unlocked — 2026-10-22

Rootsource/query/provenanceaudit+independent18nativePG9.05s/118domain/staticalltypesPASS.
Read-onlyrepeatableread/minimalinputs/canonicalprojectionandqueue verified.
Receivercorrection/redeliveryearliertime/returnrevert/assignedretry exercisedthroughrealAPI.
Reversepickupfixture reorderedthroughrealstoporder; originalassertionpreserved.
Receipt004/tracking-api-results.md. Catalog58/81(72%),23open. T016 getsexclusive
DB/build/E2Eslot. FullstorygateswaitUI. NoLANcandidate/physical/deploychanges.

### Merchant contract preparation and pending note policy — 2026-10-22

R19 aligns separate list/detail projections, exact schemas, non-voided cohort
aggregates, confirmed fees, FR014 COD and effective collections, and photo metadata
versus actual object absence. Independent read-only review found one HIGH content
privacy ambiguity: explicitly allowed notes may contain forbidden contacts or
addresses. Owner clarification was requested asynchronously; no note sanitization
or merchant implementation is authorized before resolution. The operational
004-merchant-contracts gate now blocks merchant RED alongside T016. Catalog remains
58/81(72%); no new task ID was added. T016 and its local QA continue independently.

### Note-policy disposition — 2026-10-22

The asynchronous question requests an optional preference, not new permission.
Root selects redaction while retaining benign notes under the already-authorized
FR020/privacy scope; no owner response is inferred from elapsed time. Concrete
bounded sanitization policy still requires artifact review before merchant RED,
so the operational gate stays in progress. T016 full QA remains independent.

### Merchant R19 analysis gate accepted — 2026-10-22

Separate exact list/detail contracts, cohort aggregates and photo semantics
aligned. Note redaction policy resolves HIGH; executor/root docs checks and
independent rereview noCRITICAL/HIGH, including URL/cross-attempt known phones.
Receipt004/merchant-artifact-alignment-results.md. Operational gate verified,
no catalog task closed. T023/T024/T025 remain blocked on T016 full QA.

### T016 full story accepted; merchant RED unlocked — 2026-10-22

Root finaldiff/query/UI/measurementreview +fullcheck/1472tests/138firstattempt
E2E8.9min/buildPASS. Cold2803.4ms. Frozen492file source49e15ee7425b719e4d76ed4a5f46edaf0b4c15dd68a0ca47e64e805c2e6dbac7
identicalbefore/mid/after. Executor8/8E2E passes; postrunnerzshwrappererror
explicitlyretained, finalrootrunnerexit0. Receipt004/tracking-browser-results.md.
Catalog59/81(73%),22open. R19contractgateverified; authoringT023/T024/T025
inparallel authorized; nativeDB/build/E2Eslotserialized. All implementations
stillwaitindividualREDrootapproval. NoLAN/physical/deploy/remoteCIchanges.

### T024 integration RED accepted — 2026-10-22

Bothlevels9collected6intendedabsentroutefails3baselinepasses; root10.34s.
Owneddiff/harnessreview+scopedstatic/server/allworkspacetypesPASS. Initial
fixturefailurekeptseparate; laterrevert/rotationassertionsblockedbyfirst404,
notclaimedexecuted. Receipt004/merchant-api-red-results.md. Catalog60/81(74%),
21open. T023UUID/codefixturecorrection+T025browserharnesscorrectionscontinue.
T027waitsT026; no productimplementationacceptedbythisREDreceipt.

### Explicit merchant note decision — 2026-10-22

Owner answered: “Mostrar un aviso de contacto con soporte en lugar de la nota”.
Supersedes provisional selective redaction: literal support notice for nonblank
current/attempt notes; null/empty/whitespace => null; stored originals unchanged.
No phone/address lookup or sanitizer. Root aligned research/model/contract/tasks
and domain RED; c7 aligning browser RED. Contract gate temporarily in_progress
for independent rereview. Catalog remains60/81(74%),21open; no product work
unlocked until revised analysis and RED pass both levels. Root predecision T025
run reproduced3 intended RED plus scoped format/lint/alltypesPASS; traces preserved
as historical source evidence, not claimed revised-source acceptance.

### T023 revised RED accepted — 2026-10-22

Owner note decision aligned through spec/model/research/contract/tasks; independent
review noHIGH/CRITICAL +30linksPASS. T023 final4a5bb3b5 source N1/reviewer132=14RED
118PASS232ms and rootN2132=14RED118PASS343ms. Root own strict lint/alltypesPASS.
Receipt004/merchant-projection-red-results.md. Catalog61/81(75%),20open. T026
eligible but source mutation waits T025 browser N2. Deferred physical tasks remain.

### T025 final browser RED accepted; T026 started — 2026-10-22

Executor revisedownerN1=3intendedRED; root final82d7d26c own3intendedRED
7.2/6.2/5.4s. Strictstatic/alltypesPASSbothlevels. Root archived finaltraces
root-owner-red-artifacts; priorfailures retained. Laterassertions explicitly
unexecuted. Receipt004/merchant-browser-red-results.md. Catalog62/81(77%),
19open. T026 implementation delegated Luna/max with complete R19/context/DoD
packet after verifiedT023 and final browserfreeze release. No physical closure.

### Notification dependency correction — 2026-10-22

Planning review adds T020 -> T021: T020 owns schemas/notifications.ts consumed
by the T021 API boundary; T018 RED alone cannot unlock that implementation.
Canonical task text/DAG agree and existing topological order already places
T020 before T021. No notification task started or catalog count changed.

Independent Luna/max planning audit confirms T020->T021 ordering and62/81 count;
root also corrected the detailed T021 ledger dependency. Read-only helper review
confirms unchanged `<24h` semantics in domain/server with no query/photo selection
change. Runtime N1/N2 for T026 still pending.

### T026 projection accepted — 2026-10-22

N1/root final410domainPASS +scopedstatic/alltypesPASS; root30realPGboard/
couriercontract/exceptionsPASS12.83s. Finalsourcee994c22f/9eeae36f, helper/server
unchangedafter nativeQA. Root review int4boundarydefect now permanentRED->GREEN,
sharedsupport/window/reason schemas and explicit support copy. Receipt004/
merchant-projection-results.md. Catalog63/81(78%),18open. T027 eligible.

### T027 execution started — 2026-10-22

Luna/max executor received exact endpoint/provenance/photo/replay contracts and
local DoD after T024/T026 root verification. Dedicated nativeDB slot reserved;
independent Luna/max read-only audit identified HTTP coverage gaps for current
statusAt, old/inactive detail/photo capabilities, postprojection privacy and
authenticated GET-only linkCode. Executor instructed to retain RED evidence before
implementation. Current catalog63/81(78%),18open.

T027 statusAt eligibility clarification reviewed independently and approved:
all real transition event types, latest append ID, occurredAt display; ignore
same-state admin; initial registration vs restoration distinction. Artifacts
aligned before status-time implementation; executor instructed to retain native
regressions. No task closure or percentage change.

### T027 accepted; UI and independent scan unlocked — 2026-10-22

N159server/412domain+staticPASS; root738fullserver144.51s/412domain904ms
+formatlinttypes/diffPASS.12sourcesfrozenbefore/after. Root/independentquery/
photo/UUIDreplay/statusreviewapprove. Receipt004/merchant-api-results.md
explicitly records one overwritten calendar-expectation log (not retained) and
retained58PASS1wrongrevert-expectationFAIL with actual17:00restorationcorrection.
Runneronlysourcewiring reversehashmatchesT016manifest; no targetoperation.
Catalog64/81(79%),17open. T028/T029 parallel UI and independentT031 eligible.

T028 publicmerchantUI and T029 panelcopy/rotate controls delegated in parallel to
existing Luna/max executors after verifiedT025/T027. Separate Luna/max executor
starts independentT0311000codes/endpoint scan after verifiedT016/T027. Each has
complete scope/architecture/quality/DoD packet. T031 owns the nativeDB slot first;
UI agents may edit/rununit/static only until root grants combinedE2E. No dependent
notification task starts before portal/rotation approval. Count64/81(79%)unchanged.

T029 actor-intent transport precision: a client route check alone has a cookie
switch race. Root authorizes optional expected-actor header assertion on replacement
only, reusing existing assertAccountActor; new web control always sends captured
actor+stableUUID. Existing headerless callers preserved. Contract aligned before
behavior; native failing regression must run before guard after T031 releases slot.
No reopened T027 source claim: the new bounded delta belongs to T029 verification.

### T031 native scan accepted — 2026-10-22

Luna/maxN12PASS5.12s; rootN22PASS6.47s; scopedformatlintservertypesPASSboth.
1000distinctunknowncodes/2000negativeGETs;160legitpositives across40windows
54requests/window, production60limit andexact60000reset retained; realpeer/PG.
Rootsourcee2ae01ccunchanged. Receipt004/public-codes-scan-results.md.
Catalog65/81(80%),16open. SlotreleasedtoT029actor-guardREDbeforeimplementation.
T028typedqueryHono wiring requested insteadfetchoverride; preserve activecode
lookupbeforecalendarerror. UI/buildE2Enotyetapproved.


## Merchant portal full local verification — 2026-10-22

T028/T029 accepted after executor portal3/3PASS23.8s and recovery1/1PASS14.0s,
independent source review and root check/1511tests/142first-attemptE2E9.3min/buildPASS.
506-file source55c5813422779537459303dd1ffa11c8d30fa76a2b0abe88ace04f6b855c3c74
is unchanged before/mid/after gates; cold tracking2852.2ms. All historical harness
failures and the genuine lost-ACK Escape-focus RED are retained. The bounded fix
keeps the recovery opener mounted; final tests prove focus, same-UUID replay,
no second rotation, and old404/new200. Notes use the owner-selected support notice.
See004 merchant-browser-results.md and .git/local-orchestration/merchant-us3-full/.
67/81verified (83%),14open; notifications REDT017–T019 may proceed in parallel.
DB/build/E2E runs remain serialized; no publication/deployment or physical pass.


## Notification composer RED verified — 2026-10-22

T017 accepted only as RED: final fixture source9979659a, N1/root3 intended
missing-export failures154/191ms, scopedformat/lint/domaintypesPASS. Later
business assertions remain unexecuted until T020. Contract status/all-date seam
aligned and independently reviewed first; notification-composer-red-results.md.
68/81verified(84%),13open. T020 eligible; T018/T019 remain RED work.


## Notification API RED verified — 2026-10-22

T018 accepted only as RED: source79ee9154, N1/root1baselinePASS9intendedRED
5.82/5.93s, scopedformat/lint/servertypesPASS. Initial Amy rate fixture failure
retained; no setup defects in final source. Downstream assertions remain blocked
until implementation. Header RED covers Notificado; T021 must add timestamp-cell
RED before implementing value. notification-api-red-results.md.69/81(85%),12open.
T020 and T019 continue; T021 waits for verified T020. Root released native slot.


## Notification domain verified — 2026-10-22

T020 accepted after N1/root full422domain/24files, scopedformat/lint and
recursive workspace typesPASS. Root480ms;5owned source hashes unchanged.
Meaningful UUID-case, false-hoy and actionable-date REDs retained; prior date
error was Spanish ISO jargon, not English. notification-domain-results.md.
70/81(86%),11open. T019 browser RED precedes next product edits under source
freeze; T021 prerequisites T018/T020 verified, implementation not started.


## Notification browser RED verified — 2026-10-22

T019 accepted only as RED: sourceec73e8f7, N1/root3intendedmissingpagefailures
5.9/5.6/5.3s and5.7/5.6/5.3s; scopedformat/lint/webtypesPASS. Real fixture
setup succeeds; every later acceptance assertion remains unexecuted. All traces
archived. notification-browser-red-results.md.71/81(88%),10open. T021 read/plan
in progress; runtime freeze released after N2. T022 waits for verified T021.


## Notification API verified — 2026-10-22

T021 accepted: N1/root43affectedserverPASS10.05/14.80s,423domain/static/typesPASS.
Root full first755collected753PASS2obsoletecontractfail retained; only2testfiles
aligned, strict base/courier schemas preserved, reversehash proves bounded delta.
513fileba13222e885cc9bc051b88c7e44a085301f894759779698c396ac1eb76d6308b
unchanged before/after final QA. No single full755green claim; fullstory gates
afterT022. R21 operational design independently verified inclphase/crash/actor
constraints, no infra/dependency added.72/81(89%),9open. T022 now eligible.

### 2026-10-22 — T022 slices and reopened T021 projection

T022 presentation/core verified independently (424domain/382web, scoped static,
recursive types), including retained partial-batch invalidation RED and actor-key
cross-tab invalidation. Receipt notification-ui-results.md. Assembly paused when
root found receipt metadata interpreted as shipment before/after changes. T021
reopened to71/81(88%); native causal RED showed operation [n,o]. Minimal notified
event detail changes:null fix preserves stored receipt/actor/time; N1/root N2
sixserverfiles65tests12.04/14.22s, scopedformatlint/servertypesPASS. Recursive
types are explicitly pending ungenerated concurrent T022 routes (failure retained).
T021 reclosed72/81(89%),9open; T022 assembly released. No remote CI/deployment.
New recovery browser RED4intendedmissingheading cases/traces retained; a fifth
case now covers real second-tab ACK refresh. Eight focused cases precede full
check/test/E2E/build. Source identities and exact logs in API/UI receipts.

### 2026-10-22 — T022 notification story verified

Final check/1561tests(424domain755server382web)/150native9.4min retries0/build
PASS;522-file source edc9e6f1852eedc908f9f2fa4374f49e3bd96c50b327e4a41fb1a06b6bcaff47
unchanged through all final gates. Cold tracking2860.6ms<=3000. Executor8native
20.9s/root8native21.9s plus source review accepted. Two distinct substring
selector failures and full-run interruption are causally documented/preserved,
never replaced by a retry-green claim. Stored receipt projection and partial-
batch/cross-tab refresh regressions retained. T022 checked73/81(90%),8open;
T030/T032 eligible parallel. Receipt notification-ui-results.md; logs integration
directory. No remote CI/publication/deployment or physical acceptance claim.

### 2026-10-22 — T030 public permission matrix verified

Executor140native/5files13.81s and root140/5files18.03s plus scopedformatlint/
recursive typesPASS. Root source/contract audit verifies four anonymous public
GETs incl realS3 proof, refused public mutations with unchanged DB/event/photo,
office mark/rotation positives and courier/anonymous negative effects. Existing
001–003 role coverage retained. Tests-only source985ab683 unchanged duringN2;
settings contract wording aligned to already-approved GEToffice/PATCHowner.
Receipt public-permissions-results.md;74/81(91%),7open. T032 native slot released.
Owner reports courier authorization record exists, location/evidence pending; no
individual consent/provider/physical acceptance or release claimed.

Owner privacy clarification2026-10-22: after initially reporting an authorization
record, Samuel answered the location question with “yo lo autorice”. This records
owner feature authorization, not verified courier-specific consent. No reference
or individual record was supplied; that operational production prerequisite stays
pending. Local synthetic validation continues, with no repeated approval request.

## T032 closed — 2026-10-22

**Public accessibility verified — 2026-10-22:** T032 passes both-level focused checks, executor35 repeated native cases and root final check/1566tests/153E2E9.7min/retries0/build. Frozen523-file source2a885083; cold tracking2847.5ms. Original defects, harness failures and interruption retained. **75/81 verified (93%),6 open**. T033 documentation is eligible. [Accessibility results](../specs/004-tracking-merchant-link/public-accessibility-results.md).

No physical or production acceptance is inferred. Owner feature authorization remains recorded; individual courier evidence is still pending before real disclosure.

## T033 documentation closed — 2026-10-22

**Public go-live documentation verified — 2026-10-22:** T033 README origin/support/individual-consent instructions pass executor/root contract review, diff check and32relative links. **76/81 verified (94%),5 open**. Documentation closure does not certify actual courier consent or G1; OP-release-evidence remains pending. [Documentation results](../specs/004-tracking-merchant-link/public-go-live-documentation-results.md).

Strict DAG next: OP-release-evidence → G1 → 004/T034; deferred003 physical/final gates also remain. No dependent task may start before the operational prerequisites are verified. Read-only OP-01/OP-04 preparation remains authorized.

## Operational preparation — owner confirms LAN only, 2026-10-22

Owner: “No hemos comprado dominio aun. solo red local”. Existing safe synthetic LAN authorization persists; no repeat permission request or domain purchase is required by this preparation. N1/root read-only inventory and9relative links/diff checks pass; [readiness receipt](../specs/004-tracking-merchant-link/release-readiness-results.md). OP-release-evidence stays in progress, G1 pending; no physical/final task or production readiness is inferred.

## New004 LAN preparation verified — 2026-10-22

Both-level prepare/build/seal/detached-serve/nativeHTTPS QA passes for
phone-20261022-public-a at10.12.117.118:8444. Root publicAPI/schema/cache/role
probes pass;523-file source2a885083 unchanged, build e5ada0e7. Both native
verifiers explicitly record one permitted BetterAuth429/10s retry each; failed
preflight/detached-wrapper attempts are retained. Old003 target/data untouched.
[Receipt](../specs/004-tracking-merchant-link/local-target-preparation-results.md).
Catalog76/81(94%); OP evidence in progress/G1 pending; no physical/production
acceptance. Safe synthetic LAN review is already authorized.

## Owner-delegated browser review — 2026-10-22

Owner:“hazlo tu, como la otra vez”. The agent completed the local UI walkthrough
and independently confirmed persisted synthetic notification/actor and unchanged
shipment status. Courier route/pending/day screens verified; left on Mi ruta.
[Detailed evidence](../specs/004-tracking-merchant-link/local-target-preparation-results.md#direct-browser-review--owner-requested-2026-10-22).
76/81(94%)unchanged; no physical/provider/G1 closure.

### Current-network 004 candidate verified — 2026-10-22

**76/81 verified (94%),5 open.** The current LAN candidate is
`phone-20261022-public-b` at https://192.168.58.219:8445. Executor and root
native checks pass, with one explicitly recorded bounded 10-second auth retry
per invocation; root strict public API/header/privacy probes pass on first attempt.
Root rechecked healthy loopback-only PostgreSQL/S3 bindings, the detached listener,
and the unchanged 523-file source identity `2a885083`. Prior003 and public-a
resources remain intact; public-a is the separate read-only source for the
OP-02 rehearsal, not the current network candidate. [Current-network evidence](../specs/004-tracking-merchant-link/local-target-current-network-results.md).
G1, operational/provider/consent requirements and physical/final acceptance remain open.


### Local database recovery double-verified — 2026-10-22

**76/81 verified (94%),5 open.** OP-02 synthetic rehearsal now passes executor
and root verification: exact recovery of31 tables/66 FKs, schema, migration
sequence and COP totals; migrations are a no-op; restored accounts authenticate;
one shipment UUID returns201 then200 with one dispatcher-attributed effect.
Root independently restored the same archive into a second empty database and
compared every table hash, including complete auth/user rows. Prior history and
source business fingerprints remain unchanged. First harness failures and the
root result-writer failure/read-only completion are retained in the
[restore receipt](../specs/004-tracking-merchant-link/local-database-restore-results.md).
No application source changed. Agreed recovery objectives, scheduled client-owned
backups, retention/alerts, provider/object recovery, consent and physical/final
requirements remain outstanding; OP-release-evidence stays in progress and G1 pending.


### Current 004 app restart double-verified — 2026-10-22

**76/81 verified (94%),5 open.** Public-b gracefully restarted from PID65900
to75085 without restarting containers. N1 and root's independent UTC snapshots
match all31 complete tables, including auth/session rows, and the migration
sequence. Root subsequent native verification passes with one bounded10s429 retry;
strict public probes pass on the first attempt. Source523/SHA2a885083 unchanged.
[Restart receipt](../specs/004-tracking-merchant-link/local-restart-results.md).
The [recovery handoff](local-recovery-runbook.md) and [deployment-artifact design](local-deployment-artifact-plan.md)
identify the remaining production packaging/proxy/lifecycle work. Artifact implementation
is a separate local batch after design alignment; G1 and physical/final gates remain pending.
