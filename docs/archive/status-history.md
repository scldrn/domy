# Status history

Checkpoints moved out of [`status.md`](../status.md) on 2026-11-09, newest first as they were
written. They record how features 001–004 were verified; nothing here is pending work unless
`status.md` or `OWNER-REQUESTS.md` says so.

### Release-change review completed locally — 2026-10-23

The new runtime changes relative to `6b0256d` were reviewed and corrected before
integration: preserve conflicting photo bytes and live rate-limit buckets, retain
FR-017 delayed notification acknowledgments, and reconcile stale documentation.
Check, 1,686 tests, 155 zero-retry browser cases, build, all-dependency audit and the
new Docker fresh-runtime proof pass on frozen source `a2c9c55a` (550 files).
The [current handoff](../engineering-handoff.md) and [review receipt](release-change-review-results.md)
supersede older source/image and uncommitted-work paragraphs below. No deployment,
remote CI or new physical acceptance is claimed.

### Online release prioritized by owner — 2026-10-23

The owner explicitly removes offline operation from the immediate client release.
Stop physical offline testing/diagnostics as release prerequisites and continue the
connected delivery review. Existing code, outbox data and regression coverage remain.
The [scope decision and phone evidence](online-release-scope.md) supersede older
instructions requiring offline acceptance for this release. iPhone online deliveries,
photos and collections were verified natively; offline reopening failed and is deferred,
not passed. The original 76/81 catalog is historical scope accounting, not a remaining
implementation percentage for the online release. Deployment remains owner-operated.

### Canonical repository consolidation — 2026-10-23

The owner requested one clean local/GitHub source. Use `main` after the single
consolidation PR; older branch/source paragraphs below are historical receipts.
Source `d604a287` (540 files) passes check, 1,626 tests, 155 zero-retry browser
scenarios and build. The recovered 003/T136 literal-loopback control passes;
a native ACK fixes the merchant-photo fixture race without runtime changes.
No identical production source files, repeated complete function bodies of 80+
tokens, version-copy paths or case collisions were found in the scoped audit.
The rebuilt image matches the previously upgrade-tested runtime bytes.
[Consolidation receipt](repository-consolidation-results.md) and
[current handoff](../engineering-handoff.md) record exact identities and limits.
**76/81 catalog tasks (94%) remain closed; five physical/final tasks stay open.**
Publication/branch cleanup is authorized by the current owner request; no provider,
production or remote-CI action follows from it.


### Solo technical handoff verified — 2026-10-23

Current branch: `chore/deployment-readiness-verification`, base `f0bc5ac`, with
uncommitted corrections. Eight SHA-matching candidate files were recovered; real
RED defects in cursor validation, concurrent account lockout, UUID retries,
large exports and tied-clock history were corrected. Root inspected the final
diff and ran check, **1,626 tests**, **154 browser cases with zero retries**, and
build on unchanged 540-file source `36ef1cd6`. T139/T146 are reclosed.

The new arm64 image builds and passes its structural proof. A representative
schema-0007→0009 upgrade preserves all 29 old non-journal table hashes, finances,
accounts and session; migration replay is unchanged. Strict-CA HTTPS authenticates
the old session. The app returns to the fresh database with its snapshot unchanged.
See [regressions](../../specs/001-shipment-registration/solo-production-regression-results.md),
[upgrade](../../specs/004-tracking-merchant-link/local-image-upgrade-results.md) and
[current handoff](../engineering-handoff.md) for exact identities and limits.

**76/81 catalog tasks closed (94%); five physical/final tasks remain.** The owner
requested solo work, deferred phone scenarios and handles infrastructure/public
deployment. No independent-agent review, physical acceptance, provider proof or
production approval is claimed. Earlier execution paragraphs below are historical.

### Current narrow diagnostic work — 2026-10-19 UTC

The exhaustive current handoff is [the detailed execution backlog](integral-execution-backlog.md):
81 open canonical task entries(27/2/17/35), preserved implementation states, exact next
steps/dependencies/tests/exit criteria, CI failures, historical regressions and operational
acceptance. This is a snapshot, not81 unstarted implementations or a readiness certificate.

T141 is merged (`321ef93`, PR #29). The current branch is `001-fix-error-diagnostics`:
T153 has real application/PostgreSQL RED, aligned design, and 21 focused green cases.
All four local gates pass: check,967 tests(242/531/194),91 first-attempt e2e(5.1minutes)
and build. Final review/convergence/publication remain; no T153 task closure or global
sign-off is claimed. The accessibility correction is separately published in PR #32
(`f4feb8c`); CI39285191879 failed with95 passed/one failed/one flaky and build skipped.
The retained traces show a fixed lockout-time expectation versus a progressing clock and
expanded notifications intercepting a disbursement button. The second causal sequence
still needs investigation; no unchanged rerun or merge is authorized by a later local pass.
PR #31/#30 remain held for reconciliation and fresh gates;
the account-integrity commit `0504631` remains preserved locally.

A further native development recovery probe confirms secret-bearing email URL logging
without provider configuration. IV-41 is appended as 001 T155, not hidden inside T153.
No actual customer data/external delivery was used, and no fix is claimed yet.
The paragraphs below are historical execution receipts, not the current branch/status.

### Authorized remediation — execution checkpoint

Publication authorization (2026-10-19 UTC): Samuel answered “autorizo” to the explicit
per-slice commit/push/PR/squash request, conditional on review and clean local/latest-head
CI gates. This resolves the temporary authority blocker below. Resume T141 publication,
then the next short-lived auth slice. No deployment/production infrastructure authority
or CSV/photo contract decision is implied. No publication/merge is claimed before it occurs.

Historical pre-authorization continuation: Samuel requested a persistent goal to complete the 75
remaining tasks under the same strict method. Publication-cycle authorization was
asked explicitly (per-slice commit/push/PR/squash only after review and clean local/CI
gates; no production deployment). No external write has been performed meanwhile.
Initial D4 real-PG research demonstrates outer-Tx rollback of ban/session deletion
and user/credential creation on audit FK failure, plus explicit rollback for an error
Response. Private program/limitations are retained in `.git/d4-auth-transaction-*`.
This is partial design evidence only: no auth code change, D4 sign-off, task completion
or global readiness claim. Keep the 75-task queue and unresolved owner choices intact.
Follow-up research now passes six real-PG capability cases: the original three plus
credential-write rollback, session-deletion rollback and successful commit followed by
real password sign-in. Expected SQL fault codes are asserted specifically, not any
exception. Permanent app/guard/replay/concurrency tests still precede implementation.
GitHub read-only recheck shows no open PR. Publication authority remains unanswered;
do not turn an automatic goal continuation into owner approval or merge permission.
Blocked audit: the same publication-authority prerequisite remained unanswered across
the initial goal turn and two automatic continuations. Safe preparatory D4 research
has produced six bounded capability results; the next implementation slice requires
closing the verified T141 branch through the mandated approved PR cycle. Do not bundle
the next implementation into this branch or fabricate approval. Goal execution is
blocked pending owner authorization; the 75-task objective and all evidence are retained.

Samuel authorized starting all recommended local remediation (2026-10-18 UTC).
[integral-remediation-plan.md](integral-remediation-plan.md) maps all 76 open tasks
at planning time to ordered slices, with explicit design/owner and operational gates.
Publication is now authorized conditionally above; infrastructure still needs separate approval. The current
local branch is `001-fix-keyboard-readiness`, based on `9006db3`; the pre-existing
uncommitted audit documents were preserved when creating it.

The first slice is 001 T141 only. A real initial-response barrier deterministically
reproduced the missing option highlight (RED trace/context in ignored
`.git/t141-keyboard-red/`). The test now uses native ArrowDown before asserting the
intended option and Enter, for both merchant and neighborhood. All original selection,
fee, success, accessibility and delay assertions remain. Twenty focused executions
pass (four variants repeated five times, 51.6 seconds). Fresh full gates PASS: check,
948 unit/integration tests (242/512/194), 91 first-attempt e2e in 5.1 minutes and build.
T141 is complete locally; 75 program tasks remain open. No application runtime, dependency,
schema, timeout, retry, worker or CI behavior was changed. The older failure below is
retained evidence, not overwritten by the focused passes. T131 remains unresolved.

The two pending CSV/photo scope choices below remain unanswered; authorization to
start was not silently treated as choosing an alternative. Independent slices proceed.
The T141 review receipt is in 001 `quickstart-results.md`; no whole-feature/global
convergence is claimed. Next, execute the authorized publication/clean-CI/squash cycle
for this first slice before starting another implementation branch; auth surface/invariants
are the next priority.

### Integral verification and completion — current owner request

Deep-review checkpoint (2026-10-18 UTC): consolidated evidence and coverage are in
[integral-verification.md](integral-verification.md), IV-01–IV-34. Reproductions use
disposable migrated PostgreSQL, real authentication/storage and controlled browser or
database barriers, not operational data. Findings include administrative invariant
bypasses, non-atomic account audit, delayed replay defects, concurrent master-data
creation/history/alias failures, bulk creation-event corruption, monetary overflow,
fee snapshot drift, silent neighborhood/account-link changes and replaceable photos.
Boundary/response-type, Spanish/error-state and traceability debt is also recorded.

Fresh check, all 948 unit/integration tests and build pass. The fresh full browser
gate FAILS: 89 passed / 1 failed (5.2 minutes), ordinary keyboard-only registration at
`register-shipment.spec.ts:185` waiting for the desired option's highlight. Both
controlled-delay variants pass. Original trace/context are retained in ignored
`.git/integral-e2e-keyboard/`; no repeat full run replaces this failure. It is a
distinct investigation from T131; no causal fix is claimed.

After presenting the findings and metrics, append-only convergence adds 24 unchecked
tasks: 001 Phase 13 T130–T149, 002 Phase 10 T063/T064, 003 Phase 43 T134/T135.
No old task/checklist was rewritten and 004's existing 35 tasks were not duplicated.
No app/test/dependency/schema/CI behavior, commit or remote state was changed.
Proceed with the ordered test-first remediation queue, not a global-ready assertion;
CSV/photo scope choices and actual device/deployment acceptance remain open.

Samuel requested a single project-wide closure stage covering planned behavior,
historical defects/difficulties, approved additions, integration quality and technical
debt. He explicitly included completing 004 after the initial review identified it as
unimplemented. The audit working branch was `chore/integral-verification`, based on clean
main `9006db3`; [integral-verification.md](integral-verification.md) is the unified
inventory, evidence log and exit criteria. It is NOT a global readiness certificate.

PR #28 is already merged; [the final receipt](https://github.com/scldrn/domy/pull/28#issuecomment-6243721439)
records source/tree and clean post-merge CI 39081231438. Do not repeat the merge. The
older checkpoints below are historical and their no-polish scope restrictions do not
override the owner's new integral-verification request. Publication/merge still need
separate approval. Review findings alone do not authorize an arbitrary production fix;
004 local completion is explicitly in scope, while CSV/photo contract choices are
being clarified before remediation.

The initial review below predates the deep-review checkpoint above. It confirms missing operational exports and a delivery flow above the
three-tap budget; existing 003 closure tasks remain open. New follow-ups are 001
T128 (CSV formula safety), T129 (development advisory review), and 003 T133 (photo
lifecycle spec/contract alignment, not a demonstrated cache leak). Do not duplicate
T131 or the existing polish tasks. No app/test/dependency change has been made by the
review. Real devices, production infrastructure and business approvals remain explicit
evidence requirements, not assumptions. See the report for current gate results and
the distinction between inventory and verified coverage.

### Previous diagnostic-retention checkpoint

Current checkpoint (2026-10-17): PR #27 is merged as `f4f124d`, tree identical to
approved final head `6ce5933`; CI 39059903192 passed check/build, 948 tests and 90
first-attempt e2e (11.2 minutes). Post-merge main CI 39071328672 passes overall but
has 89 first-attempt e2e passes and one flaky temporary-server-unavailability case,
`courier-offline.spec.ts:191`, caller line 222 / `courier.ts:86`. Its log only waits
for the delivery-stop link; it does not prove notification interception or a browser
crash. No trace artifact was uploaded. The [final merge receipt](https://github.com/scldrn/domy/pull/27#issuecomment-6241871750)
preserves this distinction. Do not repeat the completed merge or rerun until green.

Samuel authorized local investigation/correction with “Si”, branch
`003-fix-offline-recovery`, T131. Reproduce the ordering with controlled transport and
real app/storage before correction, align the plan, retain RED, then repeat focused
cases, all gates and convergence. Do not infer T130's cause or change the shared helper
without evidence. The initial authorization covered local work only; the later T132
approval below permits diagnostic publication, not merge or polish. T087/T093 remain pending.

Local T131 investigation has not reproduced the remote timeout: ten original repetitions
pass (39.8 seconds), ten with temporary 4× Chromium CPU throttling pass (48.8 seconds),
and three controlled session/navigation/late-503 interleavings pass. Two diagnostic
harness mistakes are preserved as harness failures, not application RED. All experimental
source changes were removed: at that checkpoint app, original tests, shared helper and
workflow equaled main. T132 below subsequently changes only CI and documentation.
Fresh build and one complete original diagnostic e2e run pass (90/90, 5.8 minutes, first
attempt). Trace/source inventories are in ignored `.git/t131-local-investigation.md` and
`.git/t131-*`. These passes do not demonstrate a correction; T131 remains unchecked.

Samuel subsequently authorized preparing/publishing the diagnostic CI PR with “Si”
(2026-10-17), T132: retain failure traces even when a retry makes CI green, without
changing limits. Use a trace-only allowlist, seven-day retention and the official pinned
action. Local T132 implementation and scoped convergence are complete: check/build,
948 tests (242/512/194) and 90 first-attempt e2e (5.1 minutes), with unchanged app/tests
and policies. The structural check covers baseline absence, YAML, preserved steps,
ten condition combinations and eight path examples; it is not a remote upload.
Publish, then audit actual latest-head CI and artifact handling in the PR timeline,
which records delivery without a self-referential status-only commit. A clean/no-artifact
run is not verification of a real failed-trace upload or a T131 correction. Do not
invent a causal patch or close T131. The initial diagnostic publication approval did not
include merge or polish; the later merge authorization below supersedes only that restriction.

T132 delivery/merge checkpoint (2026-10-17): [PR #28](https://github.com/scldrn/domy/pull/28)
source `393e5c7`, tree `f3bf659e6266b2d54ab6003f5d5b8e23ae0135a8`, passed
CI `39077701647`: check/build, 948 tests and 90 first-attempt e2e (13.7 minutes),
setup and post-actions. Its [delivery receipt](https://github.com/scldrn/domy/pull/28#issuecomment-6243133009)
preserves the earlier flaky run and expected negative-auth/infrastructure notices.
The upload step ran successfully with zero artifacts: actual no-files behavior verified,
not a real failed-trace upload. Samuel subsequently authorized squash merge and
post-merge main CI verification with “Si”. This approval checkpoint changes documentation
only and requires fresh clean final-head CI before squash. The PR timeline records
the actual final head, merge hash/tree and post-merge result, without a self-referential
status-only commit. If merged on resume, do not repeat it. A green run does not resolve
T131; no polish or physical-validation completion is authorized. The following T130
checkpoint is historical and superseded by this result.

### Previous T130 delivery checkpoint

Current authoritative checkpoint (2026-10-17): PR #26 merged as `e43ea1e`, whose tree
matches approved head `08ebd9e`. Final-head CI `39040911443` passed cleanly (948 tests,
90 first-attempt e2e, check/build/setup/post-actions). Post-merge main CI `39043360351`
passed overall but has 89 first-attempt e2e passes and one flaky T101 exception-controls
test: expanded notifications intercept the delivery-stop link before opening the form.
No historical trace artifact was uploaded. The [merge receipt](https://github.com/scldrn/domy/pull/26#issuecomment-6235793746)
retains this distinction. US1–US7 are on main; feature 003 is not globally complete.
Samuel authorized local investigation/correction with “Si”, branch
`003-fix-exception-navigation`, T130. The local correction is complete and converged;
Samuel subsequently authorized commit/push/PR and latest-head CI review with “Si”.
PR #27 source `bf26d7b` passed CI `39057471380`: check/build, 948 tests and 90
first-attempt e2e (10.8 minutes), setup and post-actions. Its [receipt](https://github.com/scldrn/domy/pull/27#issuecomment-6238901913)
records exact source/tree/base and keeps the earlier failed/flaky evidence.
Samuel subsequently authorized squash merge and post-merge main CI verification with
“Si” (2026-10-17). This approval/continuation checkpoint changes documentation only;
require clean latest-head CI before squash and inspect CI for the actual resulting main
commit. The PR timeline records the actual hashes and results, without a self-referential
status-only commit. If already merged on resume, do not repeat the merge. Feature-wide
polish is not authorized; physical T087/T093 remain pending. Do not classify the earlier
flaky main CI as clean.
PR #25's [timeline receipt](https://github.com/scldrn/domy/pull/25#issuecomment-6230668996)
is authoritative for its merge/post-merge verification; do not repeat that merge.

### T130 local correction context

Waiting for both actual offline pickup/sync toasts and completed finite animations
reproduces the 30-second blocked delivery-link click. Initial diagnostics pass during
the entrance animation; centering the whole card also fails because Sonner's expanded
interaction area extends 15 px above the painted toast. RED traces/context are retained
in ignored `.git/t130-red` and `.git/t130-card-center-red`. This proves the mechanism,
not the historical CI's exact scheduling; no historical trace was uploaded.

Only this test changes: native centered scrolling and a normal pointer click on the
visible address inside the link, not its covered card center. The actual application,
shared helper, timeout/retry/worker policies and nine-point photo/save hit checks stay
unchanged. Both real notifications must remain visible and expanded at those checks;
the full axe scan remains. Ten focused repetitions pass (36.8 seconds), then all four
gates pass: check, 948 tests (242/512/194; server 126.45 seconds), build, 90 first-attempt
e2e (5.2 minutes). Expected negative-auth logs are preserved, not suppressed.

Final scoped convergence checks FR-038, three plan decisions, T100/T101/T112/T130 and
all nine principles with zero findings; tasks stay byte-identical at SHA-256
`1bb156f019bc4000dab33fca820039d5c3d75872c06cd102148e099bbe14c34c` during assessment.
The checked marker and closure note follow under implementation tracking. Checklists
remain unchanged (16/16 and 48/48); no converge hooks exist and optional commit hooks
are not executed. No new commit, publication or remote CI is claimed by that local
checkpoint. Publication was subsequently authorized as recorded above; merge and
feature-wide polish still require approval, and physical T087/T093 stay pending.

## US7 local implementation context

Scoped analysis found no unresolved HIGH/CRITICAL artifact conflict. T077 adds four
real-PostgreSQL tests for all payment methods, disbursements after the route finishes,
corrections/reverts, Bogotá midnight, duplicate/not-applied exclusion, other-courier
isolation and pending stops grouped across tasks. They pass against the existing server
aggregation; no production code was removed to fabricate RED. The new baseline domain
test and four outbox cases fail before implementation; both phone cases fail at the
empty page before T080. The baseline and operational calculations stay in domain.

The snapshot plus outbox now supplies dated estimated totals, cash to hand over, the
four activity counts and all payment methods, including pending records across reopening.
Only locally applied outcomes contribute; pending timestamps use the stored clock offset,
and yesterday's baseline cannot inflate today's totals. T128 removes the duplicated
pending-stop predicate from server and phone by reusing existing domain `routeProgress`.
There is no new dependency, migration, response field, persisted store or cash-up action.

The stronger scrolled-row check initially fails at 360 px/high contrast: the helper's
minimum viewport scroll leaves the amount under fixed navigation (89 passed/1 failed,
5.0 minutes). T129 centers it with native scrolling and preserves the exact above-bar
bound, all assertions and the unchanged application layout. Its RED trace/context stay
under ignored `.git/us7-scroll-red`. Five repetitions of each case pass (10/10,
31.1 seconds); real scrolled 360/390 px captures were inspected. A subsequent lint error
in that helper's void-arrow style was corrected with explicit braces. Neither failed
gate is reclassified as clean, and no limit/retry/worker policy was relaxed.

Final sequential gates pass: `pnpm check`; `pnpm test` (242 domain, 512 server,
194 web = 948; server 97.08 seconds); `pnpm build`; `env -u NO_COLOR pnpm test:e2e`
(90/90, 5.1 minutes, first attempt). Expected invalid-password logs come only from the
negative lockout scenario and are not suppressed. The real built service worker and
PostgreSQL back the offline/reopen/once-only/correction journey; the zero summary works
without a route, with high contrast at 360 px. These are not physical phone results.

Final read-only scoped convergence checks six requirements, all three US7 scenarios,
six plan decisions, eight tasks (T006/T011/T077–T080/T128/T129) and all nine principles:
zero remaining findings. Assessment preserves tasks SHA-256
`1f806815456959a5f29640ee58c3c243c998861c8ea06a4bd29f4f2b0de11008`;
checked markers and the closure note are subsequent tracking. Checklists remain unchanged
at 16/16 and 48/48; no converge hooks exist and optional commit hooks are not executed.
Publication was subsequently approved as recorded above; no US7 remote result is claimed
by this local checkpoint. Do not add a status-only commit just to copy its own CI receipt.

### T127 pnpm installer warning

The exact action source and the existing CI reproduce the known false-positive
[upstream report #281](https://github.com/pnpm/action-setup/issues/281): an npm-installed
bootstrap lives directly in the action's `PNPM_HOME`, so self-update mistakes its shim
for a legacy installation. Changing the action's destination or standalone mode on
Linux does not remove that internal layout. A later `pnpm setup` would be too late.
The action's own [migration guidance](https://github.com/pnpm/action-setup#migrating-to-pnpmsetup)
recommends `pnpm/setup` for modern pnpm.

T127 changes only the installer to `pnpm/setup@v3` with `install: false` and
`node-version-file: false`. Node installation/cache stay with unchanged setup-node;
pnpm 12.8.1, Node 24, frozen install, runner, lockfile and all gate/test policies remain
unchanged. Read-only scoped analysis checks installer/version provenance, unchanged
quality gates and supply-chain verification (three obligations, one task, all nine
principles): no unresolved HIGH/CRITICAL artifact conflicts. Checklists remain unchanged
(16/16 and 48/48); optional commit hooks are not executed.

Disposable Linux containers run the exact old/new official bundles against copies of
the public project manifests, without host secrets/configuration. The old installer
reproduces the warning despite successful 12.8.1 activation; the new one installs the
same version without warnings and explicitly skips runtime installation, with no
project `node_modules`. Initial simulation mistakes in hyphenated environment inputs
and the expected skip-log wording were corrected; they are not application failures.
Evidence is local/ignored under `.git/t127.8Jbh0u`. An executable static comparison
verifies every other workflow byte and both version pins are unchanged. The containers
use Linux/arm64 and the exact action commits, not the full GitHub Ubuntu runner.

The four full local gates pass sequentially: check; 938 tests (240/508/190, server
98.50 seconds); 88 e2e first attempt (5.0 minutes); build with the real service worker.
The five expected invalid-password warnings come from the negative lockout scenario,
not the installer. Local scoped convergence checks the three maintenance obligations,
two plan decisions and all nine principles with no implementation gaps. The read-only
assessment preserves tasks SHA-256
`3eb8ee9b6f2098bc998dbfdced2f8ba752b0b71ec31305b9f695c8d139e4924e`;
its subsequent checkpoint records results without closing T127. Reviewer checklists
stay unchanged; no converge hooks exist and optional commit hooks were not executed.
That local checkpoint is superseded by the successful remote verification on `12185b6`
described above. The actual runner uses Linux/x64 and the same verified action commit
`a0881977cd8ea73b1ed212236c99ca10dcc80cf4`. The setup-node pnpm store cache and the
successor's lockfile-verification cache both save successfully; no layout warning or
action-runtime deprecation is emitted. Negative-auth test messages, Git's default-branch
hint and GitHub's informational future Ubuntu migration notice remain unsuppressed.

Final scoped convergence checks all three maintenance obligations, both plan decisions,
T127 and all nine principles with zero findings, preserving tasks SHA-256
`e8cbb2804c5519e37b5eb84fcde3b8384b1bc66c76de312896d9aadd2b4c5498`
before subsequent completion tracking. T127 is now checked and its verification closure
requires fresh final-head CI too. Checklists remain unchanged; no converge hooks exist
and optional commit hooks were not executed. The verification closure changes no code,
workflow, dependency, lockfile or test.

### T126 keyboard-registration investigation

Read-only scoped analysis maps feature 001 FR-003/FR-005/FR-006/FR-038 and keyboard access
to T126 and its readiness/real-response plan decisions (4/4 requirements, one task,
all nine constitution principles; no unmapped task or unresolved HIGH/CRITICAL
artifact inconsistency). Reviewer-owned checklists remain 16/16 and 48/48 unchanged.
The convergence finding was partial/HIGH validation, not an approved business change.

The unchanged keyboard case failed once in 20 local repetitions (19 passed), at the
same missing-success assertion as CI. Those first-run artifacts were replaced by the
next diagnostic before inspection, so they do not establish the exact local cause.
Controlled fee withholding reproduced the same assertion with a positive-fee validation
error. That retained trace also shows Amy selected despite awaiting a visible Bullish
option. A separate controlled unfiltered-results/search gate then reproduces the
selected-value failure deterministically: expected Bullish, actual Amy. Both RED
traces are retained locally under ignored `.git/t126-red-fee` and `.git/t126-red-search`.
The historical CI's precise interleaving remains unknown because no trace was uploaded.

The correction is test-only: await the uniquely named native highlighted merchant and
neighborhood, verify selected values/default pickup, and await the actual COP 13,000
quote before the original keyboard submit and success assertion. The ordinary case and
two controlled-response variants retain real PostgreSQL/server data and the built app;
no response is mocked, sleep added, or deadline/retry/worker/assertion relaxed. Focused
repetitions pass 60/60 (20 per variant, 2.3 minutes). Sequential full gates pass:
check, 938 tests (240/508/190), 88 e2e first attempt (5.1 minutes), and build with the
real service worker. The five expected invalid-password warnings come from the negative
lockout scenario; none were suppressed. Publication was subsequently authorized with
“Si”; the PR timeline carries its receipt and latest-head CI, not this local checkpoint.

Final scoped convergence checks those four requirements, feature 001 US1/AC1 and AC5,
the keyboard critical flow, two plan decisions, T126 and all nine constitution
principles with zero findings. The read-only assessment preserved `tasks.md` SHA-256
`bd3e5db967caca42281e13684c6b5a80dc050780673ee843c08a10d4b951b771`;
the checked marker/closure note were updated afterward. Checklists remain unchanged,
no converge hooks exist and optional commit hooks were not executed. This local
validation does not replace latest-head CI after the subsequently approved publication.

## US6 implementation context (historical local checkpoint)

US6 analysis A1 is resolved: the owner chose option A on 2026-10-16. A reverted errand
returns to `dispatched` with its errand task pending when its original route remains
in progress with the same courier; otherwise `registered`, off route/unassigned.
Neither creates custody. Spec, both lifecycle data models, contract, plan, research,
quickstart 19 and T072/T073/T075 are aligned.

A2 is also resolved by owner option A: reject package reversions after a subsequent
dispatch decision or custody change, preserving all later operations. Both answers
are integrated into the spec, contract, model, plan/research and test tasks. The technical
plan uses an internal nullable event-to-record FK for exact provenance and safe legacy
resolution, without exposing identifiers as changed user fields. T071–T073 were exercised
RED before their corresponding implementation: nine missing-endpoint cases, six missing
lifecycle-rule cases, two missing correction-rule cases, and four missing-control e2e.
The legacy-linkage cases initially also expose the absent schema field. US6 is authorized locally
from clean, up-to-date `main` `18c832c` on
`003-us6-dispatch-records`. Samuel subsequently authorized commit/push/PR; merge and US7
remain separate decisions.

Initial read-only scoped analysis maps both core requirements FR-034/FR-035 and all
four US6 acceptance scenarios to T071–T076 (six tasks); A1's HIGH contradiction is now
resolved by owner option A; A2's HIGH underspecification is now resolved by the second A.
All nine constitution principles were reviewed; no architectural conflict was found.
Clarify answered two questions; the spec-quality checklist returns from 15/16 to 16/16
(only the unambiguous-requirements marker changed); the reviewer-owned courier-rules
checklist remains unchanged at 48/48. Both core requirements and four scenarios map to
six US6 tasks, with contextual errand and package safety guards now explicit.
Local implementation now covers the on-behalf endpoint, kind-specific corrections,
idempotent empty/changed receipts, guarded reversions and dispatch forms. The original
task becomes pending again without creating a duplicate stop; completed routes stay
finished and errands never gain custody. Test fixtures use real PostgreSQL.

Scoped convergence added and closed T123/T124 (route reversion history and truthful
custody changes) and T125 (Spanish correction schemas and preserving blank required
inputs for validation). Whole-route reassignment after a package record is guarded too:
completed stops have a route event but no per-shipment event, so both histories are
inspected. An accepted replay still precedes all guards. The errand exception is kept.

Final sequential gates pass on the completed code: `pnpm test` (240 domain, 508 server,
190 web; 938 total), `pnpm check`, `pnpm build`, `env -u NO_COLOR pnpm test:e2e` (86/86,
5.1 minutes, first attempt). The expected invalid-password warnings come only from the
negative lockout test; no warning is suppressed. A prior stale-build e2e was intentionally
interrupted at 23 passed/1 interrupted/62 not run and is not counted as a gate.
Mobile screenshots were inspected; e2e covers blank-name validation, corrections,
truthful shipment/route history, actual courier notices, errand re-completion and the
no-custody off-route fallback. Generated migrations 0006 (nullable indexed event-to-record
FK) and 0007 (route-event enum value) are additive and reviewed; no historical rows are
rewritten and no dependency added.

Final read-only scoped convergence reviewed both core requirements, four acceptance
scenarios, three transverse requirements, nine implementation decisions, nine tasks and
all nine constitution principles: zero remaining findings. tasks.md remained byte-identical
before/after that assessment at SHA-256
`1f88d84686b0be2391f5fe7e01684160dc7547380ceeae5b84263cd5549d319a`;
T071–T076/T123–T125 were marked complete afterward. Reviewer checklists remain unchanged
(16/16 and 48/48). No convergence hooks exist and optional commit hooks remain unexecuted.
US7 and physical T087/T093 are not claimed complete; no remote CI result is claimed for US6.

## T122 publication and merge checkpoint (completed)

PR #24 was subsequently authorized and squash-merged as `18c832c`. Its source and merge
trees match (`42416ff1248bf2d5e98331365546380e2dd698a7`). Post-merge CI `38945702324`
passes 883 tests, 82 first-attempt e2e (13.0 minutes), check and build. The temporary
branch was deleted and local main synchronized. PR #24's timeline holds the authoritative
merge/CI receipts. The following publication checkpoint is historical, not a pending
request to publish or merge again.

Owner authorized commit, push and a new PR for the locally verified T122 fix with “Si”
on 2026-10-16. Publish `003-fix-push-validation`, based on `63c5070`, then inspect fresh
latest-head CI, including first-attempt e2e results rather than the workflow conclusion
alone. Merge and US6 still need separate approval. Use this branch's PR timeline as the
authoritative publication/CI receipt; no remote result is claimed at this checkpoint.
Historical US5/T121 gates and the completed squash are retained below.

T122 reproduces the original five-second empty-notification failure locally even though
the real worker receives the correct push with granted permission and Chromium fulfills
native display. CDP acknowledges dispatch before completion; querying notifications
during that interval can prune records not yet reported visible by the platform. The
test now observes successful native push completion for the exact origin/registration
before querying, sharing the original five-second assertion. Every title/body/privacy
assertion and the actual built worker/full Chromium/app-closed scenario remain. Only
test code changes; temporary worker logs/probes are removed. Official source evidence
and the historical CI-trace limitation are in the plan; do not claim to reconstruct
that unobserved CI interleaving.

Local gates pass: `pnpm check`; `pnpm test` (226/472/185 = 883);
`env -u NO_COLOR pnpm test:e2e` (82/82 first-pass, 4.8 minutes); `pnpm build`.
The focused native case passes 30/30 repetitions (1.0 minute). Diagnostic/interrupted
runs are not counted as gates; details are recorded under T122 in tasks.md. Scoped
convergence reviewed FR-040, US5/AC1, native validation/privacy decisions, T122 and all
nine principles: zero findings. Before/after assessment tasks.md SHA-256 remained
`36ac15a5ef88d27a2e15dde0d673c74c823ff6b578c94be3550a17be8bce44db`;
the marker/closure note changed afterward. Reviewer checklists remain unchanged.
Optional commit hooks were not executed; there are no converge hooks. This is local
closure only, not a clean CI result for a published correction.

Before the end of 003, complete US6–US7 when authorized and scenario-by-scenario physical
validation T087/T093 on Android and iPhone (iOS 16.4 or later for notifications), building
on the owner's successful US1–US3 smoke test below. The client's DigitalOcean Spaces
bucket is needed only at deployment. Then implement 004 with the same methodology.
Before go-live, time SC-001/SC-004/SC-006 of 002 with the dispatcher and add the content
security policy tested on the production host (002 quickstart-results; 003 research R17).

## US5 publication and merge history

PR #23 is already squash-merged as `63c5070`. Final-head CI `38922944921` was clean;
post-merge CI `38926371410` retried the native-push case, which led to T122. The following
pre-merge checkpoints retain their original context, not instructions to merge PR #23 again.

1. Pre-merge gate review of [US5 PR #23](https://github.com/scldrn/domy/pull/23):
   T121 correction `5bd2b5d` had clean CI
   [38919233855](https://github.com/scldrn/domy/actions/runs/38919233855): check,
   883 tests, 82 e2e without retries (12.8 minutes), build. Remote logs and final scoped
   convergence are clean; T121 is checked only after this verification. The tracking-only
   closure must also pass latest-head CI, then perform the owner-authorized squash if
   PR #23 is still open. If already merged, verify its merge commit against `main` and
   inspect post-merge CI there; use the PR as the authoritative receipt. Samuel authorized
   T121 and subsequent squash with “Si”; stop before US6 until separately authorized.

   Historical blocker: closure CI [38860188300](https://github.com/scldrn/domy/actions/runs/38860188300)
   at `8ec27b5` reports SUCCESS but contains one flaky e2e: handover confirmation and
   delivery offline, `courier-changes.spec.ts:194`, status remains `picked_up` during the
   5-second poll instead of `delivered`. Retry passes; 81 other scenarios pass initially.
   No CI artifacts were retained. A network reset interrupted `gh run watch`, but direct
   API/log inspection confirmed the actual result; this was not a failed workflow.
   Do not use a new green rerun to erase this evidence. Samuel subsequently authorized
   reproducing/correcting T121. The correction below is tested locally, not a rerun of
   unchanged code or a relaxed assertion. Node 20,
   `url.parse()` and `punycode` warnings are absent, and 877 tests/build/check still pass.

   Publication/maintenance history below is retained, not a claim that this later flaky
   head satisfies the final merge gate:
   (`003-us5-changes`, based on `34875ba`). Implementation published as `4d2563e`;
   this documentation follow-up records the actual PR instead of leaving publication
   as the next action. Samuel approved commit, push and PR with “Si” after final local
   verification. CI [38851532581](https://github.com/scldrn/domy/actions/runs/38851532581)
   passed at `ce55c7e`: check, 877 tests, 82 e2e without retries and build. On 2026-10-16
   Samuel authorized investigating/correcting CI warnings and then squash merging with
   fresh green latest-head CI. T120 upgrades only the two setup actions after official
   manifest/release review. T120 is now complete: CI
   [38857856129](https://github.com/scldrn/domy/actions/runs/38857856129) at `4392341`
   passed all gates (877 tests, 82 e2e without retries); all three deprecation warnings
   disappeared and scoped convergence found no gap. This documentation closure must
   receive green latest-head CI too, then squash merge and verify the resulting `main`
   state. Starting US6 still requires separate approval. After the authorized merge,
   use PR #23's merge commit and its post-merge CI as the source of current state; do not
   create a documentation-only CI/merge loop just to copy that new commit into itself.
   Samuel authorized continuing with “ok, continuemos” after the separate US4 merge.
   Both reviewer checklists pass (16/16 requirements, 48/48 courier rules). Initial
   artifact review found the eight US5 scenarios mapped to T061–T070, but the deeper
   code/contract analysis identified a HIGH underspecification: no public-key transport
   for the browser's Web Push subscription. Only the server receives `VAPID_PUBLIC_KEY`;
   neither the original contract nor the web defined how the phone obtains it. Samuel
   approved the remediation with “autorizo”: authenticated courier
   `GET /api/courier/push-config` returning `{ publicKey: string | null }`, with null when
   disabled and no private key. Contract, plan and T061/T066/T068 are aligned before
   implementation. Scoped analysis mapped all eight scenarios and ten direct requirements/
   buildable criteria to tasks, with all nine principles checked. Production implementation
   now closes the recorded initial RED failures below; convergence added T113–T119 and
   each corrective regression was reproduced before its fix. Final check, all 877 unit/
   integration tests, all 82 e2e without retries, build and scoped convergence now pass.
   The first whole e2e run was 81/82, not green; native push
   validation now uses a fresh persistent full-Chromium profile and passed ten repetitions.
   One generated additive migration adds the correctly named handover confirmation notice.
   Do not confuse the earlier initial RED checkpoint or partial passes with final closure.
   Correction/revert
   notices depend on US6's endpoints; do not implement those endpoints ahead of US6.
   Publication and conditional squash merge are authorized; continuing US6 is not.
   US4 final-head CI [38822901902](https://github.com/scldrn/domy/actions/runs/38822901902)
   at `d3e3830` passed check, 821 unit/integration tests, all 76 e2e without retries,
   and build. Authorized squash merge: `34875ba`; post-merge CI
   [38825582661](https://github.com/scldrn/domy/actions/runs/38825582661) also passed.
   Earlier CI retries remain historical evidence below, not unresolved latest-head failures.

## T121 synchronization correction — 2026-10-16

- The original single-flight guard discarded every trigger while `running` was set.
  Deterministic tests against the real courier store and IndexedDB reproduced a dropped
  reconnect and a saved record missed after the pass had read its outbox: the first
  five-test run had three failures and two passing guards. Six final tests also cover
  trigger coalescing, serial transport, pause/resume, failure without a trigger and a
  failed coalesced pass that must stop rather than loop.
- The browser journey now holds an actual offline record request, observes the native
  online event, then releases the failed send. Before the fix it reproduces the exact
  5-second `picked_up` versus `delivered` assertion, with real PostgreSQL/auth/storage
  and the built worker. Initial instrumentation first missed its own online listener
  registration and hit 30 seconds; that harness race was fixed before the meaningful RED.
  No historical CI trace exists, so this establishes the matching failure mechanism,
  not proof of that unobserved run's precise interleaving.
- Production retains one coalesced follow-up request in the existing store. Only one
  sync runs at a time; every new trigger can request another pass, pause cancels queued
  work before an account change, and a failure without a new trigger stops. No timer,
  dependency, queue service, schema, endpoint or business rule was added.
- Final focused browser revision passes 10/10 repetitions in 44.9 seconds, without
  retries. The whole local gate passes: `pnpm check`; `pnpm test` (226 domain + 472 server
  + 185 web = **883**); `env -u NO_COLOR pnpm test:e2e` (**82/82**, 4.7 minutes, no retries);
  `pnpm build`. Preserve the 5-second final assertion, all offline reload/custody checks,
  original worker/retry/deadline settings, and add exactly-one applied delivery alongside
  exactly-one handover confirmation. New test typing/lint issues were fixed without
  rule exceptions; generated files and dependencies are unchanged.
- Scoped local convergence reviewed T121, FR-018–FR-022/FR-028, US5/AC4, the coalescing/
  pause decisions and all nine principles: zero remaining implementation findings.
  Before/after assessment, tasks.md SHA-256 stayed
  `2b24ae139cba92589a5d671ee8fd882a591925bd23e35a031305b723cc768ee7`.
  Optional commit hooks are not executed; no converge hooks are registered. Reviewer
  checklists remain unchanged at 16/16 and 48/48. T121 remains unchecked until fresh
  remote CI is inspected; no new remote result or merge is claimed at this checkpoint.

Remote closure: CI `38919233855` at `5bd2b5d` passes every gate, with 883 tests and all
82 e2e on their first attempt (12.8 minutes). No original action deprecation reappeared.
Final scoped convergence is clean; before/after tasks.md SHA-256 stayed
`ce4b83ac5b7ceab4ac7256d23db12c70dac68278bde4c120c6c1c449b9ea9b44`.
The marker/closure note were updated afterward. No correction goes directly to `main`:
require fresh clean CI for the tracking head, then the approved squash and deletion of
the short-lived branch. PR #23 records the exact merge commit/post-merge CI, avoiding a
new release branch solely to copy its own hash into this document. US6 is not authorized.

## US5 initial test checkpoint — 2026-10-15

- Branch: `003-us5-changes`, based on merged US4 `34875ba`; local changes only.
- Added `apps/server/tests/courier-notices.test.ts` and
  `apps/server/tests/courier-late-records.test.ts`; extended `handovers.test.ts` and
  `custody-history.test.ts`. The test app accepts a VAPID test configuration via its
  normal dependency wiring; production does not consume it yet. Only web-push's external
  `sendNotification` is spied; authentication, transactions and PostgreSQL remain real.
- Reproduce RED: `pnpm --filter @domy/server exec vitest run tests/courier-notices.test.ts tests/courier-late-records.test.ts tests/handovers.test.ts tests/custody-history.test.ts`.
  Ignored machine-local report: `apps/server/test-results/us5-initial-red.json`.
  The expanded run has 40 cases: notices 0/17, late records 3/14, handovers 7/7,
  custody history 2/2. The three newly added T063 cases pass by reuse, not new code.
  A final deferred-constraint regression additionally rejects commit after notice insertion
  and forbids push on that rolled-back action: final report
  `apps/server/test-results/us5-final-red.json` has 29 failures/12 passes in 41 cases
  (notices 0/18, other files unchanged). This catches premature push even after a
  successful INSERT, not only failure before inserting the notice.
  Missing cross-route effects still return 500; no-origin handover cancellation returns
  409; absent configuration/subscription/review endpoints return 404.
- Added `apps/web/tests/e2e/courier-changes.spec.ts` (quickstart 14–18 plus worker push).
  `env -u NO_COLOR pnpm --filter @domy/web exec playwright test tests/e2e/courier-changes.spec.ts`
  reproduces five failures and one passing second-phone duplicate-delivery journey,
  using real PostgreSQL, storage and the built worker. Failures stop at absent notices,
  giver-handover text, review UI, late delivery application and notification handling.
  Assertions after those blockers still need green verification. Local traces live under
  ignored `apps/web/test-results/`. The first run also printed the inherited
  NO_COLOR/FORCE_COLOR conflict; unsetting NO_COLOR for the second run removes that
  environment warning without changing any runner policy.
- Static/production gates pass (`pnpm check`, `pnpm build`); the full test gates are
  deliberately not claimed green. No retries, limits, workers, dependencies or migrations
  changed. No full-US5 convergence, commit, push or PR is claimed at this RED checkpoint.

## US5 implementation and corrective review — 2026-10-15

- T065/T066: notice creation shares route/shipment/handover transactions. Explicit
  request-local notice ids pass through existing authors/event orchestration. After the
  handler finishes, push reads committed rows only, without awaiting transport; rollback
  creates no push, while earlier committed records in an erroneous batch still notify.
  Subscription and acknowledgment mutations reuse the empty audit-receipt mechanism,
  including no-ops, concurrent retries and late replays. Empty receipts stay out of audit UI.
- T067: execute the shared domain's late-record effects on tasks, custody, handovers,
  route state, review flags and histories. Records remain exactly-once; no state conflict
  silently drops them. Review clearing records the note and retains custody/status.
- T068–T070: offline notice acknowledgments, receiving/giving handover UI, route sync/
  unseen counts, review dialog, native push and runtime public configuration. Existing
  "No aplicado" record/board presentations are reused, not reimplemented. The permission
  prompt is user-initiated and recorded on the phone; sign-out unregisters notifications.
- T113–T115 regressions first reproduced arbitrary destination acceptance, missing push
  on a partially failed batch, stale-410 deletion of renewed keys, and duplicate void
  notices. Shared boundary validation now restricts HTTPS to browser push services; logs
  contain no subscription keys/endpoints. A void retains its route-removal event but
  produces one correctly named notice. The first full unit run had 464/466 server passes:
  two old strict board expectations needed the approved sync/count fields. Strictness
  and all previous fields were retained. A subsequent full gate passed 225 domain,
  470 server and 177 web cases (872), before T116–T119; it is not the final revised total.
- T116/T117 first reproduced a return restored as a delivery and a handover confirmation
  mislabeled as an address edit. Cancellation now uses the shared held-stop planner and
  original pickup place. `0005_powerful_eternals.sql` was generated, not hand-written:
  one `ALTER TYPE notice_type ADD VALUE 'handover_confirmed'`. Snapshot review found only
  that enum addition and normal snapshot ids; no rows, other enums/tables or constraints
  change. The ordinary migration runner applies it; no new dependency is needed.
- T118/T119 first reproduced false unchanged-order notices and the inability to confirm
  401 notices. Unchanged ordering preserves the route version; stale requests are still
  rejected after a real reorder. All shown acknowledgment chunks (200/200/1) persist in
  one IndexedDB transaction with distinct action ids and survive reopening. An injected
  second-write quota error rolls every chunk back, without weakening the API limit.
- Native push diagnostics found headless-shell's real permission denied; full Chromium
  supports it. A first full run with an ephemeral profile had 81/82 passes, with the
  native push assertion failing. Normal persistent profiles then passed ten repetitions
  (32.3 s), with real notification permission, trusted CDP push, the built worker, an
  actual notification and exact title/body/privacy assertions after leaving the app.
  Profiles stay under ignored test-results; no notification API or handler is replaced.
  No timeouts, workers, retries, accessibility rules or existing cases were relaxed.
  Build-overlap during early diagnostics is not evidence of the exact failure cause;
  final gates must run without concurrently rebuilding the served app.
- Interim checks caught normal formatting/lint issues and an optional CDP id, all fixed
  without changing lint configuration or asserting away undefined. A new push unit test
  caught incorrectly parsing a 204 as JSON; `unwrapEmpty` preserves error handling for
  these bodyless mutations. The note-validation regression now asserts the repository's
  actual `400 invalid_request`/field error contract rather than an invented 422.

### Final local verification

Publication follow-up: `ce55c7e` CI passed all four gates. Owner-authorized T120 then
updated only the two setup actions; `4392341` CI also passes all four gates and removes
all original deprecations. GitHub's informational notice about a future Ubuntu image
rollout is left visible; it does not require an application change. Full evidence and
scoped-convergence hash are in T120's closure in tasks.md. Squash merge is authorized
only with clean CI on the latest PR head; post-merge status is available on PR #23/main.

- `pnpm check` passes: formatting, lint with zero warnings and all package type checks.
- `pnpm test` passes: domain 226, server 472, web 179 — **877 total**. Server fixtures use
  real PostgreSQL, including the generated migration and unchanged capacity/invariant gates.
- `env -u NO_COLOR pnpm test:e2e` passes **82/82 in 4.7 minutes**, without retries or skips.
  All six US5 journeys pass within this complete run, including the real native notification.
- `pnpm build` passes after the full e2e run, with no concurrent rebuild of its served app.
- Visually inspected `route-notices-phone.png`, `pending-handover-phone.png` and
  `clear-review-dialog.png` from the final run under ignored `apps/web/test-results/`.
  The notice list, blocked handover action and review dialog are legible and unclipped;
  their explicit WCAG scans also pass. Fixture courier names deliberately include UUIDs.
- Final scoped convergence checked eight US5 acceptance scenarios, seven direct functional
  requirements and three buildable success criteria, eight relevant plan decisions,
  T061–T070/T113–T119 (17 tasks), and all nine constitution principles. No remaining
  missing/partial/contradicting/unrequested finding in this slice. Before/after assessment,
  `tasks.md` SHA-256 stayed `3a99788fe01943d1f5cc781ee2bc1c32d3158a0b567cc01e1c30f474809e4a45`;
  no empty convergence phase was appended. Completion checkboxes were updated only afterward.
  No before/after-converge hooks are registered; optional commit hooks were not executed.
- T061–T070 and T113–T119 are complete locally; Samuel approved commit/push/PR with “Si”.
  Published in PR #23 as `4d2563e`, followed by its publication-state documentation.
  Its latest head must receive fresh CI; no remote green result or merge is claimed.
  US6 correction/revert notices remain with their already-planned endpoints,
  not as an unimplemented promise in this slice. US6–US7/polish are not claimed converged.
- Physical Android/iPhone validation remains T087/T093, not replaced by browser automation.
  Apply the generated enum migration before running the updated server in any environment.

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

## US4 CI retry investigation — T111/T112 (2026-10-15)

- Latest published head `a169cbb` has green CI `38814337383`, but not a clean e2e run:
  check, 216 domain/431 server/174 web tests and build pass; 74 e2e pass first time,
  while the US4 new-attempt/return journey exceeds its 30-second limit waiting for
  "Registrar entrega" and passes on retry. All invariant seeds reach step 89, with
  measured workload 5.61/5.37/5.19 seconds under T107's unchanged limits.
- Implementation-head CI `38814284341` is separately green with 74 first-pass e2e and
  one retry in account recovery: `accessibilityViolations` requires a notification that
  has already disappeared to expand. These are different failures, not proof of one
  machine-load cause. The workflow uploads no trace artifacts, so the exact original
  browser frames cannot be reconstructed from GitHub. Both paths have controlled local
  reproductions; do not claim a CI trace established their exact interleaving.
- T111 withholds the real courier-route request, leaving the actual IndexedDB snapshot
  visible. The old last-address selector deterministically matches the completed visit
  instead of a pending delivery. It now matches the delivery label and pending state
  uniquely, waits for that refreshed stop, and preserves every subsequent attempt,
  problem, return, collection and server-history assertion. The regression first fails
  on the incorrectly matched cached visit. An initial selector refinement also failed
  because adjacent label text has no word boundary; matching the exact delivery label
  corrects that test selector. No application synchronization behavior changes.
- T112 advances Sonner's native clock through expiry between notification discovery and
  the pause shortcut. The old helper then times out waiting for the vanished toaster
  (teardown closes the page); after correction, atomic checks require every notification
  still present to expand or accept their completed disappearance. The full axe rules,
  animation settling and focus restoration remain; no toast or contrast rule is excluded.
  A new pre-pause test hook complements the existing pre-scan hook.
- The controlled US4 journey passes, as do the visible-toast, expired-toast and recovery
  cases. Ten repetitions of all four pass (40/40, one worker, no retries, 2.2 minutes).
  Final full gates pass after the generic promise type was aligned with the existing
  lint rule: `pnpm check`, `pnpm test` (216 domain, 431 server, 174 web; 821 total),
  `pnpm test:e2e` (76/76, all first pass, 4.4 minutes), and `pnpm build`. The complete
  server phase passes in 83.51 seconds. No lint configuration changed.
- Scoped convergence checks FR-022/FR-029/FR-038/SC-006, US4/AC1/AC6, two plan decisions,
  T055/T100/T111/T112 and all nine constitution principles. No remaining gap was found;
  the assessment preserved tasks byte-for-byte, then implementation tracking marked the
  two corrections complete. The second read-only assessment also found no gap and
  preserved tasks SHA-256 `13f903e868b1240cdef18c4a7daa0f9816e09c112b96bf5ec894ebe2387213db`.
  T112's original FR-034 citation is explicitly clarified as FR-038 without rewriting
  the convergence task or introducing US6 work. Samuel subsequently authorized commit/push
  to publish these corrections in PR #22 and obtain new CI evidence. That head's CI must
  still be checked; the prior retry is not a clean result. Merge and US5 require
  separate approval.

## Open with the client

Everything the owner must answer or provide is in [OWNER-REQUESTS.md](../../OWNER-REQUESTS.md),
in Spanish, kept up to date there.

## Environment notes

- Local only, never in git: `.env` (recreate it from `.env.example`; `pnpm db:seed` prints new
  owner credentials) and `docs/discovery/raw/`, the client's spreadsheets with personal and
  banking data (keep an encrypted copy or ask the client for them again).
- Playwright's Firefox does not launch on the owner's macOS; WebKit runs with a temporary
  config. Add a permanent WebKit project when 003, the iPhone courier app, starts.
- The design proposals shown on 2026-10-01 (palettes, secondary colors, the board concept) were
  rendered outside the repository; the chosen direction is recorded in
  [design-system.md](../design-system.md).
