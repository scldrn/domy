# Integral Execution Backlog and Delivery Contract

**Canonical repository consolidation — 2026-10-23:** owner-requested cleanup
consolidates the candidate for `main` through one squash PR. Source `d604a287`
passes all four local gates: 1,626 tests, 155 zero-retry browser scenarios, check
and build. Existing 003/T136 transport work is recovered; a native pickup ACK
corrects the merchant-photo fixture race. The new image has identical runtime
contents to the earlier upgrade-tested image. [Receipt](repository-consolidation-results.md).
**76/81 catalog tasks closed (94%), five physical/final tasks open.** Older
source/branch/publication statements below retain their historical scope; remote
CI and production deployment are not part of this consolidation.


**Latest solo engineering handoff — 2026-10-23:** unchanged 540-file source
`36ef1cd6` passes check, 1,626 tests, 154 zero-retry browser cases and build.
Real regression fixes reclose 001/T139/T146. The new immutable arm64 image passes
its structural inspection and historical-schema upgrade rehearsal: 29 existing
tables, COP totals, accounts/session preserved; replay and the original fresh DB
remain unchanged. Root worked alone and performed a separate final inspection,
as requested; no independent-agent approval is claimed. See
[regression results](../specs/001-shipment-registration/solo-production-regression-results.md),
[upgrade results](../specs/004-tracking-merchant-link/local-image-upgrade-results.md)
and [handoff](engineering-handoff.md).
**76/81 closed (94%), five open** for physical acceptance and dependent closures.
The owner handles infrastructure/public deployment. This is not production
approval. Earlier checkpoints below retain their own source identities and scope.

**Current integrated candidate verified — 2026-10-23:** root passes all four local
gates on unchanged 537-file source9604ca96: check,1610 tests,154 first-attempt
browser cases (10.9minutes/retries0/cold2837.3ms),build. First failures remain
preserved. The local image build and root's independent structural probe pass;
fresh isolated runtime/upgrade rehearsal follows. **76/81 verified (94%),5 open**;
physical, provider and final gates remain pending. [Preload results](../specs/004-tracking-merchant-link/deployment-preload-results.md).

**Local database recovery double-verified — 2026-10-22:** executor and root independently recover the selected synthetic snapshot:31 exact table hashes,66 FK definitions, sequence and COP totals; migration no-op and restored account access pass; UUID registration replay has one effect. First harness failures retained. **76/81 verified (94%),5 open**. This supplies scoped OP-02 evidence; scheduled backups/object-provider recovery and G1/physical/final gates remain pending. [Restore results](../specs/004-tracking-merchant-link/local-database-restore-results.md).

**Current-network candidate verified — 2026-10-22:** phone-20261022-public-b at https://192.168.58.219:8445 passes executor/root native checks and root public probes. Source523files2a885083 remains unchanged. Prior003 and public-a resources are retained; public-a is the separate OP-02 backup source. **76/81 verified (94%),5 open**; G1/OP/physical/final acceptance remain pending. [Current-network results](../specs/004-tracking-merchant-link/local-target-current-network-results.md).

**Updated local 004 rehearsal verified — 2026-10-22:** new synthetic candidate phone-20261022-public-a at current LAN IP10.12.117.118:8444 passes executor/root native HTTPS/auth/worker/private-photo checks and root public API probes. Source523files2a885083 unchanged; old003 target retained. **76/81 verified (94%),5 open**. G1/operational and physical/final acceptance remain pending; owner confirms LAN only/no purchased domain. [Rehearsal results](../specs/004-tracking-merchant-link/local-target-preparation-results.md).

**Public go-live documentation verified — 2026-10-22:** T033 README origin/support/individual-consent instructions pass executor/root contract review, diff check and32relative links. **76/81 verified (94%),5 open**. Documentation closure does not certify actual courier consent or G1; OP-release-evidence remains pending. [Documentation results](../specs/004-tracking-merchant-link/public-go-live-documentation-results.md).

**Public accessibility verified — 2026-10-22:** T032 passes both-level focused checks, executor35 repeated native cases and root final check/1566tests/153E2E9.7min/retries0/build. Frozen523-file source2a885083; cold tracking2847.5ms. Original defects, harness failures and interruption retained. **75/81 verified (93%),6 open**. T033 documentation is eligible. [Accessibility results](../specs/004-tracking-merchant-link/public-accessibility-results.md).

**Public permission matrix verified — 2026-10-22:** T030 both-level140native/5files/static/types PASS; four public anonymous reads, mutation refusal with unchanged data/photo, office notification/rotation and role denials verified. **74/81 verified (91%),7 open**. T032 accessibility continues. [Permission results](../specs/004-tracking-merchant-link/public-permissions-results.md).

**Notification story verified — 2026-10-22:** T022 passes executor/root review and focused8 native cases; root final check/1561tests/150native9.4min/retries0/build PASS on identical522-file source edc9e6f1. Cold tracking2860.6ms. Original selector failures and interruption retained. **73/81 verified (90%),8 open**. T030 permissions and T032 accessibility may start in parallel. [UI results](../specs/004-tracking-merchant-link/notification-ui-results.md).

**Notification API history fix verified — 2026-10-22:** T021 reclosed after causal RED and both-level65native affected tests/static/server types. Receipt remains intact; detail no longer invents field changes. **72/81 verified (89%),9 open**. T022 resumes; ungenerated concurrent route-type failures remain explicitly pending its integration gates. [API results](../specs/004-tracking-merchant-link/notification-api-results.md).

**Notification API reopened — 2026-10-22:** root found notification receipt metadata rendered as fabricated detail field changes. T021 reopened; T022 assembly held pending causal regression and N1/N2. **71/81 verified (88%),10 open**. Earlier API/core passes remain historical evidence, not closure of this finding.

**Notification UI checkpoint — 2026-10-22:** T022 remains in progress; presentation/core N1/N2 pass424domain/382web/static/types, including root-discovered partial-batch refresh regression. Page/navigation and8focused browser cases precede full gates. **72/81 verified (89%),9 open**. [UI results](../specs/004-tracking-merchant-link/notification-ui-results.md).

**Notification API checkpoint — 2026-10-22:** T021 both-level43affectedserverPASS/423domain/staticPASS; first full753PASS/2obsolete-contract failures preserved, then strict tests aligned. **72/81 verified (89%),9 open**. [API results](../specs/004-tracking-merchant-link/notification-api-results.md). R21 design gate verified; T022 UI may start. Full story gates remain pending.

**Notification browser RED checkpoint — 2026-10-22:** T019 both-level3 intended missing-page RED/static PASS, native fixtures and preserved traces. **71/81 verified (88%),10 open**. [Browser RED](../specs/004-tracking-merchant-link/notification-browser-red-results.md). T021 API is the next implementation; T022 waits for its verified completion.

**Notification domain checkpoint — 2026-10-22:** T020 both-level422domainPASS/static PASS with preserved UUID/date regressions. **70/81 verified (86%),11 open**. [Domain results](../specs/004-tracking-merchant-link/notification-domain-results.md). T019 browser RED next; T021 eligible after its runtime freeze.

**Notification API RED checkpoint — 2026-10-22:** T018 both-level1baselinePASS/9intendedRED/staticPASS on real PostgreSQL. **69/81 verified (85%),12 open**. [API RED](../specs/004-tracking-merchant-link/notification-api-red-results.md). T020 domain implementation and T019 browser RED continue; T021 waits for T020 verification.

**Notification composer RED checkpoint — 2026-10-22:** T017 both-level3 intended missing-export RED/static PASS; contract seam aligned first. **68/81 verified (84%),13 open**. [Composer RED](../specs/004-tracking-merchant-link/notification-composer-red-results.md). T020 eligible; API/browser RED continues.

**Merchant portal checkpoint — 2026-10-22:** T028/T029 pass both QA levels: check,1511tests,142first-attemptE2E9.3min,build;506-file source55c58134 unchanged. **67/81 verified (83%),14 open**. [Portal results](../specs/004-tracking-merchant-link/merchant-browser-results.md). Next: notifications RED T017–T019 in parallel, with local DB/build/E2E execution serialized.


**Public code scan checkpoint — 2026-10-22:** T031 bothlevels2firstattemptnativePASS/1000codes×2endpoints; rate-limit/real positives retained. **65/81 verified (80%),16 open**. [Scan results](../specs/004-tracking-merchant-link/public-codes-scan-results.md). UI T028/T029 in progress.

**Merchant API checkpoint — 2026-10-22:** T027 root738server/412domain/staticPASS on identical12-file source. **64/81 verified (79%),17 open**. [API results](../specs/004-tracking-merchant-link/merchant-api-results.md). UI T028/T029 and independent T031 now eligible.

**Merchant projection checkpoint — 2026-10-22:** T026 bothlevels410domain/staticPASS; root30nativePGPASS, int4regressionfixed/retained. **63/81 verified (78%),18 open**. [Projection results](../specs/004-tracking-merchant-link/merchant-projection-results.md). T027 endpoints eligible.

**Merchant browser RED checkpoint — 2026-10-22:** T025 final-source82d7d26c bothlevels3intendedRED plus strictstaticPASS. **62/81 verified (77%),19 open**. [Browser RED](../specs/004-tracking-merchant-link/merchant-browser-red-results.md). Source freeze released; T026 implementation starts.

**Merchant projection RED checkpoint — 2026-10-22:** T023 owner-note decision aligned; independent analysis and both RED runs132total/14intendedfail/118PASS. **61/81 verified (75%),20 open**. [Projection RED](../specs/004-tracking-merchant-link/merchant-projection-red-results.md). T025 final browser audit precedes source-freeze release for T026.

**Planning revision:** 2026-10-22 (America/Bogota). **Owner:** Samuel Calderón.
**Local base:** `94a7e2450ec2abae4192f7f864e34c4638f7c963`; active branch `codex/local-readiness-orchestration`.
**State:** NOT READY FOR RELEASE; 5 canonical tasks remain open, plus operational obligations.

**Merchant API RED checkpoint — 2026-10-22:** T024 independently reproduced9cases/6intended404failures/3baselinepasses; strict static checks PASS. **60/81 verified (74%),21 open**. [Merchant API RED](../specs/004-tracking-merchant-link/merchant-api-red-results.md). T023/T025 authoring corrections continue; implementations remain gated.

**Tracking story checkpoint — 2026-10-22:** T016 root fullcheck/1472tests/138firstattemptE2E8.9min/build PASS; cold2803.4ms; identical492-file source49e15ee7. **59/81 verified (73%),22 open**. [Tracking results](../specs/004-tracking-merchant-link/tracking-browser-results.md). R19 gate verified; merchant RED T023/T024/T025 authorized in parallel with serialized native execution.

**Tracking API checkpoint — 2026-10-22:** T015 passes both-level18 native server/118 domain tests and strict static checks. **58/81 verified (72%),23 open**. [API results](../specs/004-tracking-merchant-link/tracking-api-results.md). T016 UI authorized.

**Projection checkpoint — 2026-10-22:** T013 passes both-level118 tests and strict static checks. **57/81 verified (70%),24 open**. [Projection results](../specs/004-tracking-merchant-link/tracking-projection-results.md). T015 API authorized; T016 remains gated.

**Browser RED checkpoint — 2026-10-22:** T012 corrected five intended UI failures independently reproduced; scoped static checks pass. **56/81 verified (69%),25 open**. [Browser RED](../specs/004-tracking-merchant-link/tracking-browser-red-results.md). T013 proceeds; T015/T016 remain gated.

**Tracking RED checkpoint — 2026-10-22:** T009/T011 independently verified intendedRED and scopedstaticchecks; T013 unlocked. **55/81 verified (68%),26 open**. [Tracking RED](../specs/004-tracking-merchant-link/tracking-red-results.md).

**Queue implementation checkpoint — 2026-10-22:** T014 passes both-level41/41 and scoped static checks. **53/81 verified (65%),28 open**. [Queue helper](../specs/004-tracking-merchant-link/queue-helper-results.md).

**Queue RED checkpoint — 2026-10-22:** T010 verified by both levels (33 existing pass/8 intended failures), unlocksT014. **52/81 verified (64%),29 open**. [Queue RED](../specs/004-tracking-merchant-link/queue-red-results.md).

**Foundation checkpoint — 2026-10-22:** T001–T008 verified, including corrected URL aliases. Root full check/1376tests/133 first-attempt E2E7.7min/build PASS on identical481-file sourcec13b486c. **51/81 verified (63%),30 open**. [Foundation results](../specs/004-tracking-merchant-link/foundation-integration-results.md). T009–T012 RED begins in parallel.

**Historical reopened checkpoint — 2026-10-22:** independent audit found public case/encoded aliases bypass T007 worker guards; T007 reopened for correction and regressions. **49/81 verified (60%),32 open**. Earlier lowercase-path QA remains historical.

**Code checkpoint — 2026-10-22:** T005 verified independently53/53 tests including API creation without SQL code defaults. **50/81 verified (62%),31 open**. [Code results](../specs/004-tracking-merchant-link/secret-code-results.md).

**Layout checkpoint — 2026-10-22:** T007 independently verified3/3 first-attempt built-worker E2E and static checks on unchanged sourcefca79157. **49/81 verified (60%),32 open**. [Layout results](../specs/004-tracking-merchant-link/public-layout-results.md).

**HTTP checkpoint — 2026-10-22:** T006 verified: independent final42 tests, static checks and privacy/static-fallback review. **48/81 verified (59%),33 open**. See [boundary results](../specs/004-tracking-merchant-link/public-protection-results.md).

**Schema checkpoint — 2026-10-22:** T004 passed executor and root native migration/code tests (6/6), scoped static checks and generated-DDL review. **47/81 verified (58%), 34 open**. T005/T008 unlocked; T006/T007 continue. See [schema results](../specs/004-tracking-merchant-link/schema-migration-results.md).

**Historical RED checkpoint — 2026-10-21:** T002/T003 RED-only deliverables passed independent
N1/N2 verification: four and five intended failures on real PostgreSQL/native HTTP,
with clean types/lint. **46/81 verified by task deliverable (57%), 35 open**.
These are failing tests awaiting T004/T005/T006, not implemented protections.
See [foundational RED results](../specs/004-tracking-merchant-link/foundational-red-results.md).

**Previous configuration checkpoint:** 004/T001 passed local N1/N2 on source
`adb2e974c14025cb3c23a5108ed32f9e51bf1b6beb43def82f5f9f619a313e2d`:
1,311 tests, check, 2 first-attempt courier E2E, build and private-origin isolation.
Catalog: **44/81 verified (54%), 37 open**. Next: T002/T003 RED in parallel.
See [public-origin results](../specs/004-tracking-merchant-link/public-origin-results.md).
Earlier counts below describe their dated checkpoints.

**Owner sequencing decision — 2026-10-21:** “omite y continuemos” defers physical
003 acceptance and allows local 004 development from the verified technical baseline.
003/T093, T087 and T088 remain open and required for final acceptance; no scenario
is marked passed. For development only, W12 follows the approved deferral and the
verified W01–W09 technical exits instead of waiting for physical W10/W11 closure.
W13–W21 retain their technical dependencies and double QA. This supersedes earlier
statements that all 004 work must wait; it does not authorize production or waive
physical evidence at final delivery. Catalog remains 43/81 (53%).

**2026-10-21 verified checkpoint:** T083 passed executor N1 and root N2: 36 focused
browser cases; integrated check, 1,281 tests, 129 first-attempt E2E and build. Root
reviewed the source and screenshots; all prior failures remain in the local ledger.
T084 subsequently passed the isolated rehearsal and independent root review; G0 now permits owner-operated phone acceptance. There are 43/81 verified catalog tasks (53% by count), 38 open. See the local ledger for preserved failures and exact evidence.

**T093 preparation checkpoint:** agent browser login/navigation and actual 360/390 CSS
standard/high-contrast checks passed. Four isolated device fixtures (16 shipments, four
routes) passed executor/root QA. Physical outcomes remain pending; no new task is closed.
An additional isolated browser route completed four pickups, three deliveries,
one exception and a synthetic proof upload; N1/N2 audits verified eight unique
records, COP 75,000 cash, route closure and private JPEG access. The four phone
routes remain untouched. Physical camera/offline/restart/timing evidence is pending.

**Active execution instruction — 2026-10-20:** the owner explicitly requires local-only
orchestration with executor QA followed by independent orchestrator inspection and
verification. Do not configure, invoke, query or wait for GitHub Actions/remote pipelines.
For this run, historical PR/head/trunk-CI requirements below map to recorded local source
identity, local integration review and the complete local quality gates; do not fabricate
remote evidence. Physical acceptance, provider proof and production authorization remain
separate prerequisites. Current batches and evidence: [local execution ledger](local-orchestration.md).

**Start here:** [§5](#5-execution-waves-and-dependency-order) orders the remaining work
by prerequisite and defines separate test-environment and production gates. Completed
catalog entries are regression prerequisites, not work to implement again. This revision
uses local Git history and task markers; it does not certify current remote CI or a deployment.

This is the detailed execution companion to [the remediation plan](integral-remediation-plan.md)
and [the verification report](integral-verification.md). It explains every currently open
task, the preserved implementation work, unresolved verification failures, dependencies,
required evidence and operational acceptance. It is not a new feature, a replacement for
Spec Kit, a declaration that all designs are settled, or permission to deploy production.

## Contents

1. [Authoritative scope and exact count](#1-authoritative-scope-and-exact-count)
2. [Mandatory execution and closure protocol](#2-mandatory-execution-and-closure-protocol)
3. [Integration baseline and historical receipts](#3-integration-baseline-and-historical-receipts)
4. [Decisions already made and remaining design gates](#4-decisions-already-made-and-remaining-design-gates)
5. [Execution waves and dependency order](#5-execution-waves-and-dependency-order)
6. [Feature 001: 27 cataloged tasks, 0 open](#6-feature-001-27-cataloged-tasks-0-open)
7. [Feature 002: 2 cataloged tasks, 0 open](#7-feature-002-2-cataloged-tasks-0-open)
8. [Feature 003: 17 cataloged tasks, 3 open](#8-feature-003-17-cataloged-tasks-3-open)
9. [Feature 004: 35 cataloged tasks, 2 open](#9-feature-004-35-cataloged-tasks-2-open)
10. [Historical regressions and approved ideas to retain](#10-historical-regressions-and-approved-ideas-to-retain)
11. [Operational work and owner acceptance](#11-operational-work-and-owner-acceptance)
12. [Evidence ledger, final acceptance and maintenance](#12-evidence-ledger-final-acceptance-and-maintenance)

## 1. Authoritative scope and exact count

### 1.1 Sources of intent

Order of authority:

1. [Constitution 2.0.0](../.specify/memory/constitution.md), all nine principles.
2. Approved owner decisions, including the explicit CSV/photo replies in the conversation.
3. Each feature's `spec.md`, clarified decisions, plan, research, data model and contracts.
4. The canonical task files linked below; task identity is feature-qualified.
5. This execution document and dated evidence receipts.

A contradictory old status paragraph does not reopen a settled owner decision or
override a newer verified receipt. Correct present-tense summaries while preserving
dated history. This document describes work; only the owning artifacts authorize its
behavior. New product decisions require clarification, not assumptions disguised as fixes.

| Feature | Canonical task source | Open checkboxes | Checked catalog entries in the working tree | What remains |
| --- | --- | ---: | ---: | --- |
| 001 | [Shipment registration tasks](../specs/001-shipment-registration/tasks.md) | 0 | 27 | All cataloged tasks verified locally; human/operational obligations remain |
| 002 | [Routes tasks](../specs/002-routes-dispatch/tasks.md) | 0 | 2 | Cataloged tasks verified locally; human/operational obligations remain |
| 003 | [Courier tasks](../specs/003-courier-app/tasks.md) | 3 | 14 | T087-T088/T093 (physical acceptance and final gates); T084 locally verified |
| 004 | [Tracking/merchant tasks](../specs/004-tracking-merchant-link/tasks.md) | 2 | 33 | T001–T033 verified by deliverable; T034–T035 remain |
| **Total** | Four canonical task files | **5** | **76** | **5 open tasks across features 001, 002, 003, and 004** |

Counts were recomputed from the four working-tree task files after the local double-QA
closure of 001/T129/T132/T136/T137/T152, 002/T064 and 003/T081/T082/T083/T084/T089/T090/T091/T092/T135. The 81 catalog entries comprise 5 open and 76 checked tasks; they are not the entire historical
task inventory. Checked markers do not certify current CI, physical acceptance or release.
The earlier 75-task objective remains the same completion program; newly discovered
obligations expanded its tracked queue. Some unchecked tasks already have preserved
code, but cannot be treated as integrated, verified delivery.

### 1.2 What the count does and does not establish

- The schedule in §5 assigns each task once; 001/T129/T132/T136/T137/T152, 002/T064 and 003/T081/T082/T083/T084/T089/T090/T091/T092/T135 are verified prerequisites and
  the other 38 remain open. Operational
  rows and design/deployment gates are not additional Spec Kit tasks or completed work.
- 001/T130, T131, T150, T151, T153, T154, T155 and 003/T131 are checked in the current
  local tree. Their earlier unmerged/held states in §3 are historical, not the next queue.
- 003/T136 is already checked outside this 81-entry remediation catalog. Do not add it
  to the open queue or subtract it again. Preserve its transport regression and evidence.
- CI-LOCK/CI-POINTER are historical investigation labels, not canonical task IDs. Preserve
  those failures; inspect applicability and current receipts before alleging a new failure.
- Operational OP-01–OP-05, evidence reconciliation and future pilot measurements are
  required deliverables, not five fictitiously completed runtime tasks. They can require
  explicit additional approved tasks before operational implementation/provisioning.
- Historical checked tasks remain regression obligations. A checkbox is not proof that
  its behavior still works after later changes.

### 1.3 Current local planning baseline

- Local `main`: `94a7e2450ec2abae4192f7f864e34c4638f7c963`; remote state was not queried
  for this documentation change. Do not equate local history with current remote CI.
- Account integrity, master-data concurrency, bulk identity, money/aggregates, historical
  pricing, CSV/operational exports, photo corrections and directory/Spanish fixes now have
  checked task markers and local history. Retain their regressions rather than rebuilding them.
- Features 001 and 002 and 003 US1–US7 exist in this tree, with the remaining gaps below.
- Feature 004 has specifications/design/tasks but no delivered implementation.
- Preserve unrelated working-tree changes and historical branches/evidence. This document
  is not permission to reset, overwrite, cherry-pick or merge old work.
- Existing iOS/Android owner feedback is valid historical evidence for its tested scope,
  not full later-US/device/installed-notification or public-page acceptance.

## 2. Mandatory execution and closure protocol

### 2.1 Per-slice workflow

Every behavioral slice follows the same sequence, even if its implementation looks small:

1. Resolve the exact owning requirement, task and reproduced failure. Inspect current
   source and prior receipts before writing replacement code.
2. Clarify actual product ambiguity. Do not ask again for already approved CSV/photo scope.
3. Update the owning plan/research/contracts/data model/quickstart where the design changes.
   Recheck all nine constitutional principles; document justified complexity before code.
4. Read reviewer-owned checklists as gates; never check their boxes on the reviewer's behalf.
5. Keep ordered, test-first tasks. Run read-only Spec Kit analysis and resolve every
   CRITICAL/HIGH design inconsistency before implementation.
6. Write and run a permanent failing regression on the current behavior. Distinguish a
   fixture/setup failure from the product failure; retain both without mislabelling them.
7. Implement the smallest native correction; rerun the focused regression and relevant
   adjacent cases. Use controlled ordering/barriers, not arbitrary sleeps or mocked DBs.
8. Run the four complete local gates on the final behavioral source. A later source/test
   change invalidates affected evidence; explain exactly which gates must run again.
9. Run scoped convergence. Unmet existing tasks stay open; new actionable gaps get new
   traceable tasks. Do not declare feature/global convergence from a narrow fix.
10. Review the diff, boundary cases, resource cleanup, migration compatibility and docs.
    Record source/tree identity and honest evidence limitations.
11. Commit/push/open a small PR under the owner's existing conditional authorization.
    Reconcile with actual updated trunk and rerun the required gates when its content changes.
12. Inspect latest-head CI, first attempts, warnings, traces and post-actions. Squash only
    the reviewed matching head with clean required gates. Verify the resulting trunk tree
    and its actual post-merge CI. Delete the merged remote branch under the approved workflow.

Branches are small, coherent and short-lived, at most two days under the constitution.
Preserve held work rather than deleting it to satisfy branch age. If blocked dependencies
prevent timely integration, explicitly split/reconcile the work and record the reason;
do not turn a held branch into an undeclared permanent integration branch.

### 2.2 Non-negotiable verification

Run from the repository root with the repository-pinned Node/pnpm/toolchain:

```bash
pnpm check
pnpm test
pnpm test:e2e
pnpm build
```

- `check`: formatting, lint and strict types, zero errors/warnings.
- Tests touching storage use actual migrated PostgreSQL and private S3 test storage.
- Browser critical flows use the built app and actual service worker, not only Vite dev.
- Preserve all seeds, steps, assertions, timeouts, performance limits, retries and workers.
- Keep capacity/invariants in the owner-approved isolated native Vitest phase; retain the
  normal parallelism of unrelated integration tests.
- A retry-green CI is **not clean**. Preserve its first failure and investigate; never
  rerun unchanged CI until green, hide a toast, force a click or raise a budget to close it.
- Keep full axe coverage; no new exclusions to hide application notifications or dialogs.
- Expected negative-auth warnings must be identified separately from unexpected warnings.
  A process-level color-environment warning is not a diagnosed application defect or a
  reason to suppress logging; record/disposition it honestly.
- Use explicit empty or loopback-only Sentry configuration for privacy tests/build children;
  no synthetic secrets, real credentials or recipient data are sent to external reporting.

### 2.3 Implementation constraints

- One deployable monolith, database and private bucket; no extra queue/cache/service.
- Use Hono, Drizzle/PostgreSQL, Better Auth, Zod, native platform APIs and installed tools
  directly. No single-implementation wrappers, new auth system or unneeded dependency.
- Domain rules exist once in `packages/domain`; integer COP, UTC storage, Bogotá display.
- A state change and its audit/event/receipt share a transaction. S3/email/browser actions
  are not part of a PostgreSQL transaction; specify their recoverable failure boundaries.
- Preserve client identities across uncertainty and rotate only after acknowledgment.
- Never erase pending device work, hard-delete operational history, fabricate an old audit
  event, silently coerce money or broaden access to make a test pass.
- Generate reviewed Drizzle migrations; do not hand-edit generated snapshots or router output.
- Development docs/code/commits are English; user-facing strings and owner requests are Spanish.
- Do not read `.env`, raw customer workbooks or unrelated paths; never print captured secrets.

### 2.4 Task completion versus release completion

For every task, record: requirement → design → permanent regression → RED → correction →
focused result → full local gates → convergence/review → PR/head CI → squash/trunk CI.
An implementation checkbox can record a properly verified local task; the delivery ledger
must still identify publication/integration/CI pending. Do not call a task delivered merely
because its checkbox is checked on an unmerged branch. Do not check any task based on this
document alone.

## 3. Integration baseline and historical receipts

**Historical record — 2026-10-19 UTC:** the ledger, CI failures and sequence below describe
earlier heads. They remain evidence for regression retention, not assertions that those
PRs are still open or instructions to repeat their integration. The current local baseline
is in §1.3; the next development queue is §5. Reconcile exact source/CI receipts at execution
time and append any newly reproduced gap to its owning task through the established workflow.

### 3.1 Historical branch and PR ledger

| Work | Preserved head | State and required next step |
| --- | --- | --- |
| T153 fallback diagnostics | Current dirty `001-fix-error-diagnostics`, base `321ef93` | 21 focused tests; final local check, 967 unit/integration tests (242/531/194), 91 first-attempt e2e (5.1 min), build pass. Finish final review, bounded-cost evidence and convergence; no commit/PR yet |
| Account integrity | `001-fix-account-integrity`, `05046314828f0278c9714c448270ac4e09c2331b` | Local T130/T131/T150/T151 code preserved, not published/merged. Local 1,027 tests/check/build passed; full e2e failed 90/91 with retained DNS delay. Reconcile transport/session/accessibility prerequisites and obtain new full evidence |
| Session recovery | [PR #31](https://github.com/scldrn/domy/pull/31), `b4c83f33a1219395b7afda5f60b5af5962bdf812` | 955 local tests and 92 local first-attempt e2e passed; CI `39273068925` had 91 direct/one flaky modal notification axe failure. HOLD; reconcile accessibility correction and run fresh final-head gates |
| Loopback transport | [PR #30](https://github.com/scldrn/domy/pull/30), `682bc975f835678cb646e6153d212be3f5668f12` | Literal loopback transport correction is preserved. Earlier source CI clean; final head CI `39197282004` had recovery flake. HOLD; reconcile actual merged prerequisites and independently verify its new head |
| Modal notification scans | [PR #32](https://github.com/scldrn/domy/pull/32), `f4feb8c059e4927395c3ff0bcd56f78484dba962` | Six new cases, 30 focused repetitions, local 948 tests/97 first-attempt e2e/check/build passed. Latest CI `39285191879`, attempt1, FAILED: 95 passed/one failed/one flaky; build skipped. HOLD, no merge or unchanged rerun |

All heads are snapshot evidence, not commands to force-push or overwrite a branch. Preserve
their tests, owner decisions, task IDs and failure receipts during reconciliation.
Never cherry-pick whole old status documents over newer decisions.

### 3.2 Historical PR #32 CI: two retained failures

**CI-LOCK — lockout browser test assumes a non-progressing business clock.**

- Location on that head: `access.spec.ts:407`, assertion at line424.
- Both the first attempt and retry fail looking for a fixed `10:15 a. m.` message.
- Retained native response is `account_locked` with `retryAt=2026-10-01T15:16:14.709Z`
  and a Spanish `10:16 a. m.` message. The actual `createClock` intentionally progresses
  from its configured start; the test's comment assumes it is still exactly10:00.
- Preserve the response/trace and prove the boundary under controlled elapsed time before
  correction. Validate both the 15-minute lock duration and the rendered retry time, not
  merely the presence of any lock string. Do not freeze production time, change the
  lock duration, weaken the assertion or blame GitHub's infrastructure without evidence.
- Align the test design/task ownership before code. An explicit test clock baseline or
  response-timestamp-based expectation must be justified and tested across minute rollover;
  do not silently choose a less precise check.

**CI-POINTER — expanded notifications intercept the courier disbursement action.**

- Location: `courier-day.spec.ts:31`, after two offline deliveries, before recording the
  COP12,000 disbursement. The native click targets “Registrar pago por cuenta del cliente”.
- First attempt exceeds the unchanged30-second test limit; retained call log explicitly
  identifies expanded success/error Sonner items intercepting pointer events. Retry passes.
- Inspect the retained trace's focus, pointer, expansion and timing history. Determine
  whether the stack belongs to user interaction, scanner cleanup or ordinary app behavior;
  the interception is proven, but the exact causal sequence/fix is not yet established.
- Add a deterministic built-app regression retaining offline actions and genuine pointer
  hit-testing. Keep all financial totals, reload/sync/correction assertions and axe scans.
  Never force the click, remove notifications, or collapse a user-owned stack merely to pass.
- Map to the correct existing task or append new work through convergence, with no duplicate
  identity. Do not assume this is the same root cause as session-recovery T131.

Artifact metadata: retained failure artifact `12203349049`, 9,169,230 bytes, reported
archive SHA256 `e7768ab4581c21218a3d55f1ab12412f542746dd65a932deebc4695cd356dc8a`.
Three trace ZIPs were downloaded privately: lockout first attempt/retry and courier-day
first attempt. CI log inspection included the full 217,820-character log and post-actions.
The archive digest is GitHub-reported metadata, not a separately recomputed local archive
digest. Traces can contain synthetic credentials; do not commit or expose their contents.

Remote evidence links: [PR #32 failed CI](https://github.com/scldrn/domy/actions/runs/39285191879),
[PR #31 retry-green CI](https://github.com/scldrn/domy/actions/runs/39273068925), and
[PR #30 retry-green CI](https://github.com/scldrn/domy/actions/runs/39197282004).
None of these three runs is a clean merge gate. The downloaded private failure traces
are under `.git/t154-ci-39285191879/`; original T153 RED notes are retained in
`.git/t153-red-receipt.md`. These local ignored paths are investigation handoff aids,
not a durable shared evidence store. Before their external artifact retention expires,
retain approved access-controlled evidence according to project policy, never in public git.

### 3.3 Historical integration sequence

1. Preserve the clean T153 behavioral source and its actual local results; complete its
   remaining review/convergence/publication work without bundling unrelated browser fixes.
2. Retain and classify both PR #32 CI failures; align their tasks/design and add causal RED.
3. Correct the demonstrated layers on coherent branches; keep existing T154 regressions.
4. Obtain a clean latest-head accessibility PR, then merge conditionally and inspect trunk CI.
5. Reconcile PR #31 with actual updated trunk, preserving both the original 503 scenario and
   controlled held-session regression; run all its new local/remote gates before merge.
6. Reconcile PR #30 independently, preserving DNS-refusal control and literal-loopback
   consistency; run its own full local/remote gates before merge.
7. Reconcile the preserved account-integrity commit and all overlapping privacy tests/docs.
   Its former local successes are not evidence for the integrated source.
8. Continue the remaining security/integrity work and feature004 in the dependency waves below.

Independent preparation is allowed while CI runs; a running post-merge gate is not
permission to merge the next PR. Integration order can be refined with an explicit safe
dependency rationale; never pretend an unmerged prerequisite is already on trunk.

## 4. Decisions already made and remaining design gates

### 4.1 Settled owner decisions — do not reopen

- **CSV:** safe opening in Excel; neutralize executable text and document the transformation.
  Keep numeric COP/date semantics. This resolves D1; exact arbitrary-text round trips are
  not silently promised by a spreadsheet-safe file.
- **Courier photos:** only the courier's own photos of work still available in their app,
  as 003 FR-036 specifies. This resolves D2's product choice, not the technical boundary.
- **Closure scope:** include implementation of004, not just review of001–003.
- **Publishing:** per-slice commit/push/PR/conditional squash is authorized with strict
  review and clean gates; production deployment/infrastructure changes are not.
- **Capacity tests:** native isolated phase, unchanged coverage/seeds/steps/limits.
- **Returns/reverts:** retain the approved later-custody conflict rule and conditional
  original-route errand restoration. No implicit undo of later operational decisions.
- **Notifications:** manual WhatsApp composition/open/copy only; no automatic WhatsApp API.
- **Public disclosures:** only the approved tracking allowlist and bounded courier/receiver
  exception; actual courier consent remains a go-live requirement.

Record the CSV/photo replies in the resolved owner ledger and align stale present-tense
summaries. Their currently stale “unanswered” paragraphs must not drive new implementation.

### 4.2 Design and environment gates at the current baseline

| Gate | Current prerequisite and remaining work | Forbidden shortcut |
| --- | --- | --- |
| D3 Money | 001/T138 and 002/T063 are checked; preserve the checked integer contract and aggregates in 004 projections/migrations | Reopening the settled representation without evidence, float money or narrowing SUM |
| D4 Accounts | 001/T130/T131 transaction work is checked; 001/T132 must finish replay binding and creation/session-ending semantics | Ordinary after-hook audit, duplicated auth config, password fingerprints as receipts |
| D5 Photos | 003/T133/T134 are checked; verify actual provider behavior, interruption and retention under OP-03 before release | Treating S3Proxy or SDK options as provider proof or claiming PG/S3 atomicity |
| D6 Existing data | Establish whether operational rows/objects exist before 004/T004 migration/backfill or any repair; read-only inventory first | Fabricated history, guessed photo digests or unauthorized repair |
| D7 Public004 | After the verified 001–003 technical baseline and owner-approved physical deferral, align current custody/reverts/photos/money/settings/replay, trusted proxy and worker behavior; build merchant links before notification UI | Dead merchant links or treating bearer pages as authenticated offline content |
| SDK privacy | 001/T152 remains open: native server/browser envelope allowlists with useful structural diagnostics and actual local capture | `sendDefaultPii:false` alone, pino-only sanitization or global telemetry shutdown |
| Development mail | 001/T155 is checked; preserve static no-provider diagnostics and test-only outbox in OP-03 delivery checks | Token-in-log fallback or a public debug mailbox |

Earlier upload candidates and cache probes remain historical research. Current checked
implementation entries are not a certification of the selected production provider or
of every same-browser scenario; collect the outstanding evidence in courier verification
and OP-03 without claiming an unproven historical cache leak.

## 5. Execution waves and dependency order

### 5.1 How to execute this order

The schedule initially covered 53 open tasks. **38 remain open** after 001/T129/T132/T136/T137/T152, 002/T064 and 003/T081/T082/T083/T084/T089/T090/T091/T092/T135 passed
executor and orchestrator QA; their rows remain as explicitly verified prerequisites.
Wave labels and G0/G1/G2 are planning gates, not new tasks. Within a test/implementation
pair, retain actual RED before the correction; a range is not permission to write all code
before tests. Every behavioral slice still follows §2 and merges through its own clean PR.

The table is a recommended topological schedule, not a claim that every preceding row
is a technical dependency. The prerequisite column controls entry: independent privacy,
toolchain and operational preparation can progress without waiting for unrelated work.
Do not infer authorization for infrastructure changes from a row becoming executable.

### 5.2 Remaining queue by prerequisite

| Order | Open tasks / operational work | Prerequisite to start | Required exit / what it unlocks |
| --- | --- | --- | --- |
| W00 Baseline and environment preparation | No new task; prepare OP-01 and OP-04 | Inspect actual local/source/CI receipts, preserve unrelated work; use §1 and historical §3 | Identify candidate, operator, isolated test target, ownership/cost and existing-data inventory plan. Read-only design can begin now; external mutations require authorization. |
| W01 Actual API contracts — VERIFIED LOCALLY | 001/T136 | Existing Hono/auth routes and endpoint inventory | Inferred response boundaries and compile-time mismatch regression. Schedule first to avoid rebuilding account/form/public consumers around unchecked projections. |
| W02 Exactly-once account actions — VERIFIED LOCALLY | 001/T132 | Checked 001/T130/T131 transaction/invariant work; settle native response contract with W01 | Durable creation/action identity, bound receipts, lost-response/session-ending replay; unlock account-link and draft retry verification. |
| W03 Authoritative links and recoverable drafts — VERIFIED LOCALLY | 003/T135; 001/T137 | W02 identity lifecycle and W01 boundary contract; checked neighborhood identity corrections retained | No silent unlink or malformed-draft loop; user intent and pending identities survive recovery. These two tasks need not wait on each other. |
| W04 Reporting privacy — VERIFIED LOCALLY | 001/T152 | Checked diagnostic/auth/log privacy prerequisites; align native SDK policy | Enabled/disabled real server/browser reporting remains useful and contains no sensitive data. Independent of W02/W03; required before enabling reporting on a reachable candidate. |
| W05 Maintained toolchain — VERIFIED LOCALLY | 001/T129 | Current advisory/path investigation and compatible upstream resolution | Verified frozen install, migrations and four gates; explicit advisory disposition. Independent of account/UI changes; include final pins in subsequent candidate evidence. |
| W06 Courier logic and interactions | 003/T092, then 003/T083 | W03, existing courier runtime and approved interaction design | Fill pure/rendered gaps first; preserve required confirmations while meeting ≤3 taps, 48px and full accessibility coverage. Unlock physical usability review. |
| W07 Courier contracts, safety and capacity | 003/T081, 003/T082, 003/T089, 003/T090, 003/T091 | W01–W03 contracts/runtime; checked auth/photo/money corrections | Complete role/shape/security/invariant matrix and unchanged capacity budgets. These independent matrices may be prepared alongside W06; rerun affected checks after runtime changes. |
| W08 Current documentation and courier configuration | 002/T064 and003/T084 (VERIFIED LOCALLY) | Actual integrated source, task identities and selected test topology | Unambiguous references/status and rehearsable private storage/VAPID/CSP instructions. Prepare OP-01/OP-03 alongside this work; no secrets in docs. |
| W09 First controlled test deployment — G0 | OP-01/OP-03 test-environment rehearsal; OP-04 applicable inputs | W01–W08 exits; exact authorized test target, safe data, secrets/ports/CSP/worker and recovery procedure | Reachable HTTPS build for 001–003, identified by source/schema/build. Verify provider/email/push behavior needed by the phone scenarios. Does not open production to operations. |
| W10 Courier physical acceptance | 003/T093, then 003/T087 | W06/W07 and G0; Android/iPhone and operator available | One-handed 360/390px review, then full quickstart 1–21 on both OSs, installed push/offline/restart/session/timings. Reuse traceable scenario evidence, not duplicate or inferred acceptance. |
| W11 Close 001–003 | 003/T088 | W01–W10; all remaining 001/002/003 tasks satisfied | Full exact-source gates, feature convergence and integration receipts; refresh after any later shared change. This is the canonical prerequisite for starting 004. |
| W12 Public design alignment | No new task; resolve D6/D7 and align 004 artifacts | Verified W01–W09 technical exits plus owner-approved W10/W11 physical deferral for development; current custody/photo/money/replay contracts and native transport/worker boundaries | Read-only analyze has no CRITICAL/HIGH inconsistency; safe existing-data backfill design. Retain task IDs; schedule US3 before US2 delivery because messages contain merchant links. |
| W13 Public setup and foundational RED | 004/T001; 004/T002, 004/T003 | W12; real prior-schema migration fixtures and proxy identity design | Validated public origin; failing secret-code/backfill and boundary/proxy/header regressions before corresponding implementation. |
| W14 Public foundations | 004/T004 → 004/T005; 004/T006; 004/T007; 004/T008 | W13; T004 schema before T005/T008; T003 RED before T006; D6 inventory before backfill | Safe migration/codes, public router/limits, lazy layout/worker isolation and owner support settings. All foundations pass before any public story starts. |
| W15 Recipient tracking | 004/T009–T012 → 004/T013–T014 → 004/T015 → 004/T016 | W14; each test is RED before its implementation | Anonymous tracking works for every status/kind, privacy/expiry/revert and weak-network timing. |
| W16 Merchant portal | 004/T023–T025 → 004/T026 → 004/T027 → 004/T028–T029 | W14 and W15; shared test file follows T009; checked money/photo contracts retained | Merchant-only list/detail/photos/totals, 30-day boundaries and immediate audited link rotation. Both kinds of links now work. |
| W17 Manual merchant notifications | 004/T017–T019 → 004/T020–T021 → 004/T022 | W15 AND W16; working tracking/merchant links before browser RED/UI delivery | Same-tap WhatsApp open/copy, ≤2 taps, durable notified marking/retry and export/detail consistency. Opening WhatsApp is not delivery confirmation. |
| W18 Public permission/security/accessibility verification | 004/T030, 004/T031, 004/T032 | W14–W17 endpoints/screens complete | Read-only/role matrix, uniform random-code responses and full 320px/WCAG checks. Test preparation may begin earlier; closure requires complete runtime coverage. |
| W19 Release rehearsal and updated test deployment — G1 | 004/T033; finish applicable OP-01–OP-04 evidence | W18, consent before real courier disclosure, authorized environment/provider and reviewed migration/backfill | Update the isolated candidate with 004; rehearse fresh install/upgrade, backup restore, provider/email/push/monitoring, proxy/cache/CSP and runbooks. Record hashes and actual limitations. |
| W20 Public physical acceptance and operator rehearsal | 004/T034; OP-05 pre-launch activities | G1; actual mobile data/WhatsApp/devices, dispatcher and training materials | Public quickstart 1–14, notification/time/tap checks and operator walkthrough pass; preserve 001–003 regressions. Assign pilot support and future measurement owner/schedule. |
| W21 Final integrated delivery | 004/T035; final OP-05 acceptance/handoff | W20, all earlier tasks and required OP-01–OP-04 evidence | Four exact-source gates, feature/global convergence, reviewed matching-head CI and resulting trunk CI; §12.2 evidence complete. Unlock G2 review, not an automatic deployment. |

**Task reconciliation:** W01–W11 contain 3 open tasks in 001–003; W13–W21
contain 2 open tasks in 004, with T001–T033 verified locally. Total remaining:
**5 catalog tasks**, with **76 of81 verified**. Operational work remains additional assurance.
001/T129/T132/T136/T137/T152, 002/T064 and 003/T081/T082/T083/T084/T089/T090/T091/T092/T135 were checked after documented double QA; no IDs were renumbered.
OP-01–OP-05 span preparation, rehearsal and acceptance; mentioning them in multiple rows
means completing successive parts of the same obligation, not counting them repeatedly.

### 5.3 Deployment gates and the physical-test dependency

- **G0 — controlled test deployment of 001–003:** after automated technical prerequisites
  and safe-environment preparation, before 003/T093/T087. Those tasks require a reachable
  installed app on real phones. Waiting for physical acceptance before providing that
  environment would create a circular dependency. External provisioning/deployment still
  needs an approved target, scope/cost and operator; this plan alone grants none.
- **G1 — updated test deployment including 004:** after technical public implementation
  and hardening, before 004/T034. Rehearse the changed migration/public origin/proxy/worker,
  restore and real provider behavior on the exact candidate. Use safe test data; obtain
  consent before disclosing any real courier's first name/phone.
- **G2 — ready to request/start the production deployment:** only after W21 and §12.2,
  with OP-01–OP-05 pre-launch obligations evidenced, no unexplained failing/flaky gate,
  agreed recovery objectives and demonstrated restore, reviewed migration/recovery steps,
  required consent and owner acceptance. Request explicit approval for the concrete
  production environment/release and external changes. Existing code-publication approval
  is not production deployment approval.

Actual post-launch outcomes (004 SC-006/SC-007) occur after launch; record their owner and
schedule before G2 and their measurements when due. Do not require invented future results
to start deployment or confuse them with the mandatory pre-launch physical checks.

### 5.4 Active batch and verified unlocking

T136/T152 passed executor QA and independent orchestrator inspection plus complete local
check, 1,150 tests, 100 first-attempt E2E cases and build on source fingerprint
`0c356fec6fd3de1daf6df72b359664eff202ad7d88e752b5905f017046f92a6f`.
See the [local ledger](local-orchestration.md) and owning results for exact evidence.

T129/T132 and 003/T082 subsequently passed both QA levels on unchanged source
`7d4227587e1661a45cd8c0ea4b14ee0efabd0b0a2cfaecfe359d78b865544d1d`:
check, 1,215 tests, 106 first-attempt E2E and build. T082's runtime prerequisites
were independently verified; administrative replay and form drafts are unrelated.

T137/T135 subsequently passed executor and root QA on source `1e348e85e314145433fedeb4d027245bcac36c386cd10f67fa80dff273389dbd`:
check, 1,241 tests, 121 first-attempt awake E2E (6.2 minutes) and build. Preserve
the causal sticky-footer failure and the separate system-sleep-interrupted attempt
in the ledger; the successful run had no Sleep events and no relaxed checks.

The courier assurance batch and native SDK follow-up then passed all four gates on
unchanged source`dbb77ffd7d5b368d5a78bfa2e072e85eca3f3fc214e9779f5d454445a63c691e`:1,281 tests,121 first-attempt E2E,
check and build. Both QA levels approve T081/T089/T090/T091/T092 and re-closeT152.

T083 subsequently passed local N1/N2: 36 focused browser cases, check, 1,281 tests,
129 first-attempt E2E (7.6 minutes) and build; see its receipt and source provenance.
T084 and the isolated HTTPS target subsequently passed both QA levels. G0 is
verified for owner-operated LAN acceptance. Next: **003/T093**, then T087 and T088;
no physical result is inferred. The later owner instruction “omite y continuemos”
defers that physical run and unlocks local 004 development only. T093/T087/T088
still gate final delivery; the earlier wait-for-003 rule is superseded for development.

## 6. Feature 001: 27 cataloged tasks, 0 open

Canonical source: [001 tasks](../specs/001-shipment-registration/tasks.md). Existing
spec/contract obligations remain authoritative where a description below is abbreviated.

### 001/T128 — Spreadsheet-safe CSV serialization [COMPLETED]

- **Why/state:** Resolved per Owner Decision D1. In `apps/server/src/lib/export.ts`, formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) on string cells are neutralized by prefixing `'`, while numeric integer COP amounts and negative numbers remain pure numbers. Escaping complies with RFC 4180 and UTF-8 BOM.
- **Touchpoints:** `apps/server/src/lib/export.ts`, `apps/server/tests/shipments-export.test.ts`, `apps/server/tests/operations-export.test.ts`.
- **Exit:** Validated: formula injection payloads neutralized safely; numeric integer amounts and negative numbers never corrupted.

### 001/T129 — Development dependency advisory resolution [COMPLETED]

- **Local closure (2026-10-20):** both QA levels approved; check, 1,215 tests, 106 first-attempt E2E and build passed on unchanged source `7d4227587e1661a45cd8c0ea4b14ee0efabd0b0a2cfaecfe359d78b865544d1d`. See the task receipt and [local ledger](local-orchestration.md). Original execution criteria follow for traceability.

- **Why/state:** IV-02; MEDIUM task priority, separate from advisory severity. Investigated,
  not closed. `source-map-js1.2.1` and Drizzle-tooling `esbuild0.18.20` remain in scope.
- **Touchpoints:** lockfile, actual transitive paths and upstream pinned toolchain.
- **Before change:** refresh production/development audits and primary advisory/upstream
  evidence; identify reachable development-server exposure and compatible resolution.
- **Work:** prefer compatible upstream/lock resolution. An isolated lock-only source-map
  candidate is not root-repo verification. No blind esbuild override, suppression or extra
  direct package solely to manipulate the dependency graph.
- **Exit:** frozen install, migrations/tooling behavior and all gates pass; remaining
  advisory disposition is explicit. Production audit zero is not a global security
  certificate. Do not change GitHub settings/token scopes to obtain unavailable alerts.

### 001/T130 — Administrative invariant enforcement on every auth path [COMPLETED]

- **Why/state:** Resolved (Finding IV-10/11 / CRITICAL). In `apps/server/src/routes/auth.ts`, administrative endpoints (`/users`, `/users/:id/role`, `/users/:id/ban`, `/users/:id/sessions`, `/users/:id/link-courier`) execute inside real PostgreSQL transactions with row-level locks on target accounts (`for('update')`). Invariant checks guarantee the system can never reach zero active owners, preventing sole-owner demotions or concurrent deactivations. Courier-account links are validated against linked courier state.
- **Touchpoints:** `apps/server/src/routes/auth.ts`, `apps/server/src/auth.ts`, `packages/domain/src/account-rules.ts`, `apps/server/tests/account-integrity.test.ts`.
- **Exit:** Validated: 43/43 tests pass in `account-integrity.test.ts`. Concurrent owner demotions and bans serialize safely, keeping at least one active owner; linked courier role checks verified under contention.

### 001/T131 — Atomic account mutation and audit [COMPLETED]

- **Why/state:** Resolved (Finding IV-20 / CRITICAL). All account mutations, credential updates, session invalidations, and audit log entries are wrapped within a single atomic PostgreSQL transaction. If any secondary write (e.g. audit insertion or courier unlink) fails, the entire transaction rolls back cleanly without partial side effects.
- **Touchpoints:** `apps/server/src/routes/auth.ts`, `apps/server/tests/account-integrity.test.ts`.
- **Exit:** Validated: transactional atomicity verified with rollback tests under simulated audit or DB failures; accounts, roles, credentials, and sessions either commit completely or remain unchanged.

### 001/T132 — Exactly-once account administration lifecycle [COMPLETED]

- **Local closure (2026-10-20):** both QA levels approved; check, 1,215 tests, 106 first-attempt E2E and build passed on unchanged source `7d4227587e1661a45cd8c0ea4b14ee0efabd0b0a2cfaecfe359d78b865544d1d`. See the task receipt and [local ledger](local-orchestration.md). Original execution criteria follow for traceability.

- **Why/state:** IV-19; CRITICAL; research exists, permanent implementation remains.
- **Touchpoints:** auth account routes, audit receipts, `features/users/api.ts`, account
  dialogs and session-ending controls; depends on T130/T131 and coordinates003/T135.
- **RED:** banA → unbanB → delayed banA; profile/role/no-op/session-ending retries;
  concurrent duplicate actions, lost acknowledgments and changed-body/foreign-actor reuse.
- **Work:** client creation UUID and per-operation actionId persist across uncertainty;
  bind receipts to actor/operation/target without storing passwords or their fingerprints.
  Resolve native user response/projection and any required receipt discriminator in design.
- **Exit:** one effect/audit per action; acknowledged actions rotate identity; partial
  create+link failure resumes safely; relogin/replay of self-end-sessions cannot kill the
  new session. No secret-bearing receipt or arbitrary auth `data` passthrough.

### 001/T133 — Atomic bulk creation identity and event correctness [COMPLETED]

- **Why/state:** Resolved. In `packages/domain/src/schemas/bulk.ts`, added duplicate row ID check in `bulkConfirmInput.superRefine`, rejecting repeated UUIDs with 400 validation error. In `apps/server/src/lib/registration.ts` (`insertShipments`), filtered `shipmentEvents` insertion strictly to newly inserted rows (`insertedIds.has(row.id)`), eliminating duplicate creation events for pre-existing shipments. In `apps/server/src/routes/bulk.ts`, replaying confirmed batches or existing shipments returns 200 without duplicate events, and atomic all-or-none rejection is maintained.
- **Touchpoints:** `packages/domain/src/schemas/bulk.ts`, `apps/server/src/routes/bulk.ts`, `apps/server/src/lib/registration.ts`, `apps/server/tests/bulk.test.ts`.
- **Exit:** Validated: 19/19 tests pass in `bulk.test.ts`, exactly one creation event per inserted shipment, atomic batch integrity verified under concurrent and mixed submissions.

### 001/T134 — Concurrent master-data creation replay [COMPLETED]

- **Why/state:** Resolved. In `apps/server/src/lib/master-data.ts` (`auditedCreate`), handled primary key constraint conflicts natively and returned 200 replay with the existing entity rather than raising HTTP 500 unique violations.
- **Touchpoints:** `apps/server/src/lib/master-data.ts`, `apps/server/src/routes/merchants.ts`, `apps/server/src/routes/couriers.ts`, `apps/server/src/routes/carriers.ts`, `apps/server/src/routes/neighborhoods.ts`.
- **Exit:** Validated: concurrent same-ID creations return 201 and 200 replay across all entities; distinct duplicate names or FK errors remain correctly refused.

### 001/T135 — Truthful serialized master-data audit chains [COMPLETED]

- **Why/state:** Resolved. Added `lockEntity(tx, entity.type, entity.id)` (`SELECT ... FOR UPDATE`) in `auditedChange`, serializing concurrent writes so reads in `apply(tx)` read authoritative committed state and form a truthful A -> B -> C audit history.
- **Touchpoints:** `apps/server/src/lib/master-data.ts`, `apps/server/tests/master-data-idempotency.test.ts`.
- **Exit:** Validated: concurrent edits record true serialized history with exactly one action receipt per request without duplicate fictitious changes.

### 001/T136 — Real inferred RPC response boundaries

- **Why/state:** IV-33; CRITICAL architectural boundary debt, not evidence every response fails.
- **Touchpoints:** `lib/api-client.ts`, every feature `api.ts`, Hono route inference,
  handwritten account/recipient/neighborhood projections and relevant agent guidance.
- **RED:** compile-time cases reject an actual response/consumer mismatch; inventory
  endpoints before refactoring, including native auth passthrough.
- **Work:** derive actual endpoint responses rather than caller-selected `unwrap<T>`;
  preserve approved domain schemas and validate independently persisted/unknown values.
- **Exit:** no unchecked generic assertion simply moved elsewhere; request/response types
  remain end-to-end checked, legitimate library contracts used directly, all consumers work.

### 001/T137 — Validated recoverable persisted form drafts [COMPLETED]

- **Local closure (2026-10-21):** executor N1 and root N2 approved; check, 1,241 tests, 121 first-attempt awake E2E and build passed on unchanged repaired source. See owning results and [local ledger](local-orchestration.md). Original criteria below are retained for traceability.

- **Why/state:** IV-24; CRITICAL. Valid JSON with invalid shape can cause a retry render loop.
- **Touchpoints:** `features/shipments/use-form-draft.ts`, registration/edit/bulk draft
  schemas and recovery UI; coordinate typed-boundary T136 and action identity T132/T143.
- **RED:** `{id:<uuid>,values:{}}`, malformed JSON, older valid versions, storage refusal,
  unexpected fields/types and normal lost-response recovery.
- **Work:** validate at the storage boundary with Zod; present Spanish recovery without
  repeatedly reading the same invalid shape or silently deleting recoverable user work.
- **Exit:** valid drafts restore, invalid drafts do not crash/loop, storage denial is
  actionable and uncertain mutation identity/data survive the appropriate retry path.

### 001/T138 — Consistent monetary storage/validation/arithmetic [COMPLETED]

- **Why/state:** Resolved. Bounded single-field amounts to PostgreSQL int4 bound (`maxCop = 2_147_483_647`), added `maxAggregateCop` (`Number.MAX_SAFE_INTEGER`), checked integer arithmetic `addCop` and safe parser `safeIntegerCop`. Verified with RED/GREEN tests in `packages/domain/src/money.test.ts` and `schemas/shipment.test.ts`.
- **Touchpoints:** `packages/domain/src/money.ts`, `packages/domain/src/schemas/shipment.ts`, `packages/domain/src/schemas/courier.ts`, `packages/domain/src/day-summary.ts`, `apps/web/src/features/board/day-sentence.ts`.
- **Exit:** Validated: 253/253 domain tests pass; amounts > 2,147,483,647 rejected with Spanish error; aggregates up to 9 quadrillion COP computed safely.

### 001/T139 — Validate auth JSON and decoded cursors [COMPLETED]

- **Why/state:** Reopened by a real-PG audit, corrected and reclosed on 2026-10-23.
  Decoded cursor JSON passes a Zod ISO-date/UUID tuple before SQL; existing auth-body
  schemas remain authoritative. Invalid input returns safe Spanish 400 errors.
- **Touchpoints:** `apps/server/src/routes/shipments.ts`, `apps/server/tests/shipments-search.test.ts`, and existing account boundary tests.
- **Exit:** Six malformed cursor cases and all four local gates pass on source
  `36ef1cd6`: 1,626 tests, 154 zero-retry E2E, check/build. See
  [solo regression receipt](../specs/001-shipment-registration/solo-production-regression-results.md).

### 001/T140 — Spanish audit and accessible sidebar text [COMPLETED]

- **Why/state:** Resolved (Finding IV-25 / CRITICAL). In `apps/web/src/features/master-data/audit-formatting.ts` and `apps/web/src/routes/audit-log.tsx`, all master data entities, actions, and before/after fields are formatted into glossary-consistent Spanish (e.g. `Configuración`, `Punto de recogida`, `Tarifa estándar`, `Recargo exprés`, `NIT / Documento`, `Sueldo fijo`). No raw camelCase or English field names appear in reachable UI. Mobile sidebar and panel navigation controls carry fully translated accessibility labels.
- **Touchpoints:** `apps/web/src/features/master-data/audit-formatting.ts`, `apps/web/src/routes/audit-log.tsx`, `apps/web/src/components/ui/sidebar.tsx`, `apps/web/src/features/master-data/audit-formatting.test.ts`, `apps/web/src/routes/audit-log.test.tsx`.
- **Exit:** Validated: 5 unit tests pass confirming full Spanish translation of entities, actions, and fields; screen reader labels and visual text verified.

### 001/T142 — Accepted creation replay before later guards [COMPLETED]

- **Why/state:** Resolved. In `apps/server/src/routes/rate-card.ts` and `apps/server/src/routes/neighborhoods.ts`, checked existing records by client `id` before evaluating date validity (`effectiveFrom < bogotaToday(now)`) or active zone guards, returning 200 replay with accepted state without creating duplicate events.
- **Touchpoints:** `apps/server/src/routes/rate-card.ts`, `apps/server/src/routes/neighborhoods.ts`, `apps/server/tests/master-data-idempotency.test.ts`.
- **Exit:** Validated: replaying accepted entries across day rollover or zone deactivation returns 200; genuinely new invalid entries are still refused with 400.

### 001/T143 — Inline neighborhood creation identity lifecycle [COMPLETED]

- **Why/state:** Resolved (Finding IV-22 / CRITICAL). In `apps/web/src/features/shipments/neighborhood-combobox.tsx`, inline neighborhood creation generates a fresh `crypto.randomUUID()` upon dialog opening and resets its mutation key on acknowledged success or cancellation. Successive inline neighborhood additions without remounting the parent shipment form receive distinct authoritative UUIDs.
- **Touchpoints:** `apps/web/src/features/shipments/neighborhood-combobox.tsx`, `apps/web/src/features/shipments/neighborhood-combobox.test.tsx`.
- **Exit:** Validated: 3 tests in `neighborhood-combobox.test.tsx` confirm distinct UUIDs across consecutive creations, identity retention during pending mutations, and reset on close.

### 001/T144 — Honest loading/failure/empty states [COMPLETED]

- **Why/state:** Resolved (Finding IV-34 / CRITICAL). In `apps/web/src/components/query-state.tsx` and across directory pages (`users.tsx`, `merchants.tsx`, `neighborhoods.tsx`, `directory-page.tsx`), distinct UI states are enforced: pending queries render skeletons/spinners (`TableSkeleton`), query errors render actionable error alerts (`QueryErrorAlert`) with Spanish "Reintentar" retry button, and empty states (`DirectoryEmptyState`) appear strictly when data has resolved with 0 items.
- **Touchpoints:** `apps/web/src/components/query-state.tsx`, `apps/web/src/features/master-data/directory-page.tsx`, `apps/web/src/routes/users.tsx`, `apps/web/src/routes/merchants.tsx`, `apps/web/src/routes/neighborhoods.tsx`, `apps/web/src/features/master-data/directory-states.test.tsx`.
- **Exit:** Validated: 2 tests in `directory-states.test.tsx` verify loading skeleton, error with retry callback, and truthful empty states.

### 001/T145 — Neighborhood edit waits for authoritative detail [COMPLETED]

- **Why/state:** Resolved (Finding IV-21 / HIGH). In `apps/web/src/features/master-data/neighborhoods/neighborhood-dialogs.tsx`, the edit neighborhood dialog disables saving and shows an explicit loading/error state while the neighborhood detail query resolves. Existing variants are preserved and can never be wiped out by an premature save.
- **Touchpoints:** `apps/web/src/features/master-data/neighborhoods/neighborhood-dialogs.tsx`, `apps/web/src/features/master-data/neighborhoods/neighborhood-dialogs.test.tsx`.
- **Exit:** Validated: 4 tests in `neighborhood-dialogs.test.tsx` verify save button disabled while loading, error state with retry, and variant preservation upon submission.

### 001/T146 — Concurrent five-failure per-account lock [COMPLETED]

- **Why/state:** Reopened, corrected and reclosed on 2026-10-23. A normalized-email
  advisory transaction lock serializes native Better Auth checks and counters.
  The fifth failure commits `lockedUntil` for 15 minutes before returning 423;
  existing sessions survive. This is separate from native IP limiting.
- **Touchpoints:** `apps/server/src/routes/auth.ts`, `apps/server/tests/auth-lockout-recovery.test.ts`.
- **Exit:** Twelve simultaneous failures yield four 401 and eight 423 responses;
  correct credentials stay locked until expiry, then succeed. All four exact-source
  local gates pass; [receipt](../specs/001-shipment-registration/solo-production-regression-results.md).

### 001/T147 — Preserve historical fee and rate-zone snapshots [COMPLETED]

- **Why/state:** Resolved (Finding IV-15 / HIGH). In `apps/server/src/routes/shipments.ts`, shipment edits (`PATCH /api/shipments/:id`) preserve the historical `rateZoneId`, `fee`, and `calculatedFee` snapshots unless pricing inputs (`recipientNeighborhoodId` or `serviceLevel`) explicitly change. Non-pricing edits (e.g. instructions, phone, address, notes) never reprice shipments against new catalog rate zones or rate entries. When pricing inputs do change, recalculation uses the rate card effective at the shipment's original `registeredAt` timestamp, preserving historical rate consistency. In `apps/web/src/features/shipments/shipment-form.tsx`, non-pricing edits preserve existing overrides and do not overwrite the fee with live quote updates.
- **Touchpoints:** `apps/server/src/routes/shipments.ts`, `apps/web/src/features/shipments/shipment-form.tsx`, `apps/server/tests/shipments-update.test.ts`.
- **Exit:** Validated: 23/23 tests pass in `shipments-update.test.ts`. Editing instructions preserves manual fee overrides, fee amounts, and rate zone snapshots even after catalog reassignments and rate card changes; audit log faithfully captures only instructions edits.

### 001/T148 — Concurrent name/alias uniqueness [COMPLETED]

- **Why/state:** Resolved. In `apps/server/src/lib/master-data.ts` (`checkNames`), acquired transaction-scoped advisory locks on candidate names and aliases in deterministic alphabetical order, preventing cross-table name-to-alias clashes under concurrent creations or updates.
- **Touchpoints:** `apps/server/src/lib/master-data.ts`, `apps/server/tests/master-data-idempotency.test.ts`.
- **Exit:** Validated: concurrent attempts to claim the same name as alias or alias as name are safely serialized; the second request fails with 409 duplicate_alias without deadlocks.

### 001/T149 — Complete authoritative previous-recipient autofill [COMPLETED]

- **Why/state:** Resolved (Finding IV-23 / MEDIUM). In `apps/web/src/features/shipments/recipient-autocomplete.tsx` and `apps/server/src/routes/merchants.ts`, choosing a past recipient accurately autofills name, phone, address, and the authoritative active neighborhood with its municipality and rate zone. If the past neighborhood is inactive or missing, the field is cleared to require valid user selection without guessing replacements.
- **Touchpoints:** `apps/web/src/features/shipments/recipient-autocomplete.tsx`, `apps/server/src/routes/merchants.ts`, `apps/web/src/features/shipments/recipient-autofill.test.tsx`.
- **Exit:** Validated: 3 unit tests in `recipient-autofill.test.tsx` verify synchronous population of name, phone, address, and active neighborhood, with honest null-fallback when inactive.

### 001/T150 — Native Better Auth failure log privacy [COMPLETED]

- **Why/state:** Resolved (Finding IV-35 / CRITICAL). In `apps/server/src/auth.ts`, configured Better Auth `onAPIError` handler to catch unexpected internal faults (>= 500) and route them to Hono's sanitized error handler rather than emitting raw SQL parameters or credential hashes to the console logger.
- **Touchpoints:** `apps/server/src/auth.ts`, `apps/server/tests/account-integrity.test.ts`.
- **Exit:** Validated: tests in `account-integrity.test.ts` verify that injected credential faults roll back completely and native/application logs emit zero sensitive SQL or credential parameters.

### 001/T151 — Recovery bearer removal from request-path logs [COMPLETED]

- **Why/state:** Resolved. Decoded segments in `apps/server/src/app.ts` request logging middleware and templated matching `/^\/api\/auth\/reset-password\//i` paths as `/api/auth/reset-password/:token`, preventing raw/encoded bearer tokens from entering request logs.
- **Touchpoints:** `apps/server/src/app.ts`, `apps/server/tests/log-redaction.test.ts`.
- **Exit:** Validated: permanent boolean assertion in `log-redaction.test.ts` passes; no bearer token appears in stdout/pino captures across standard, lowercase, encoded, and malformed path requests.

### 001/T152 — Native Sentry server/browser envelope privacy [COMPLETED]

- **Current state (2026-10-21):** native sampling remains zero; ignored deprecated
  hook removed after real warning RED, native error-only GREEN and fresh root N2.
  Re-closed with1,281 tests/121 E2E/check/build on unchanged source; earlier receipt
  and warning attempt remain historical. Original investigation criteria follow.
- **Why/state:** IV-38; CRITICAL. Native research reproduces URL/query/transaction leakage
  despite a safe application Error; no permanent actual-app implementation yet.
- **Touchpoints:** `apps/server/src/index.ts`, `apps/web/src/main.tsx`, native SDK options.
- **RED:** actual application HTTP/PG failure and compiled lazy browser reporter into local
  transport; capture the whole envelope, including causes, breadcrumbs, stack URLs,
  request/body/headers/query/transaction and reset/public-token paths.
- **Work:** align a native allowed-context/error policy, not a telemetry wrapper. Explicitly
  test enabled/disabled reporting and pass empty/fake loopback DSNs to every child build/server.
- **Exit:** no sensitive marker anywhere in delivered envelopes; useful class/code and
  structural locations remain and real error reports still arrive. Session envelopes alone
  are not error-delivery proof; `sendDefaultPii:false` or removing request alone is insufficient.

### 001/T153 — Safe fallback diagnostic projection [COMPLETED]

- **Why/state:** Resolved (Finding IV-39 / CRITICAL). In `apps/server/src/lib/errors.ts`, fallback error redaction sanitizes unhandled exceptions and PostgreSQL driver errors before logging or reporting. Built-in Error instances preserve types and safe static messages while stripping driver parameters, raw SQL texts, and user-provided strings. Stack traces are bounded to valid repository sources, preventing sensitive values from leaking through stack frames.
- **Touchpoints:** `apps/server/src/lib/errors.ts`, `apps/server/tests/log-redaction.test.ts`.
- **Exit:** Validated: 31 tests pass in `log-redaction.test.ts`. Real PG 22P02/23505 errors retain numeric SQLSTATE codes while driver messages and parameters are completely redacted; unhandled exceptions project safe Spanish messages with clean reporting.

### 001/T154 — Modal notification accessibility scan stabilization [COMPLETED]

- **Why/state:** Resolved (Finding IV-40 / CRITICAL). In `apps/web/tests/e2e/fixtures.ts` and `apps/web/tests/e2e/access.spec.ts`, stabilized axe accessibility scans when modal dialogs and toast notifications are concurrently mounted. Scanner-owned synthetic mouseout cleanly resets toast timers without masking timing bugs, collapsing pre-expanded user stacks, or forcing UI interactions.
- **Touchpoints:** `apps/web/tests/e2e/fixtures.ts`, `apps/web/tests/e2e/access.spec.ts`.
- **Exit:** Validated: axe scans run reliably with open modals and notifications across repeated test runs with 100% pass rate.

### 001/T155 — Development recovery mail must not log bearer URLs [COMPLETED]

- **Why/state:** Resolved. In `apps/server/src/lib/email.ts`, replaced logging `{ url: message.url }` when `RESEND_API_KEY` is not configured in development with an actionable static diagnostic message without sensitive tokens. Preserved test-only outbox and production key requirement.
- **Touchpoints:** `apps/server/src/lib/email.ts`, `apps/server/tests/auth-lockout-recovery.test.ts`, `apps/server/tests/log-redaction.test.ts`.
- **Exit:** Validated: 31/31 tests pass in `log-redaction.test.ts` and `auth-lockout-recovery.test.ts`; development mail fallback never prints secret bearer tokens, recovery URLs, or recipient emails to stdout/pino logs.

## 7. Feature 002: 2 cataloged tasks, 0 open

Canonical source: [002 tasks](../specs/002-routes-dispatch/tasks.md).

### 002/T063 — Exact financial aggregates on every route projection [COMPLETED]

- **Why/state:** Resolved. Cast SQL sum to `coalesce(sum(${shipments.codAmount}), 0)::bigint` in `apps/server/src/lib/route-store.ts`, parsed safely to JavaScript Number via `safeIntegerCop`. Added permanent RED/GREEN integration test suite `apps/server/tests/routes-aggregates.test.ts` verifying COP 2,400,000,000 aggregates on route creation, detail, board, replay, and dispatch.
- **Depends/touchpoints:** `apps/server/src/lib/route-store.ts`, `apps/server/tests/routes-aggregates.test.ts`, `packages/domain/src/schemas/routes.ts`.
- **Exit:** Validated: 52/52 server test files pass (532 tests); no integer out of range 22003 error; exact 2,400,000,000 aggregate preserved across all route read/write projections.

### 002/T064 — Unambiguous task references and current documentation [COMPLETED]

- **Local closure (2026-10-21):** documentation-only checks and independent Luna/max review approved preserved historical IDs/results, current record helpers and PR #28 local ancestry. The stale header date was corrected and re-reviewed. See [documentation results](../specs/002-routes-dispatch/documentation-results.md).

- **Why/state:** IV-32; MEDIUM. T057/T058 each occur twice historically; current prose also
  contains outdated stand-in-record and PR status descriptions.
- **Work:** preserve IDs/history, explicitly qualify all ambiguous references by feature
  and phase: Phase3/T057 threshold, Phase3/T058 routeUI, Phase8/T057 contract,
  Phase8/T058 performance. Do not renumber successful historical tasks.
- **Touchpoints:**002 tasks/quickstart/results, `docs/status.md`, related receipt references,
  and any comments/plan links whose meaning is ambiguous.
- **Exit:** current summaries reflect real courier records and actual merged/open PRs;
  dated historical failures/results remain clearly historical. Reconcile settled owner
  answers and the newly created execution-document links without stale “unpublished” claims.

## 8. Feature 003: 17 cataloged tasks, 3 open

Canonical source: [003 tasks](../specs/003-courier-app/tasks.md). These are completion and
gap-filling obligations; do not rebuild working US1–US7 or duplicate existing test cases.

### 003/T081 — Complete endpoint-to-role permission matrix [COMPLETED]

- **Local closure (2026-10-21):** executor N1 and independent root N2 approved; check, 1,281 tests,121 first-attempt E2E and build pass on unchanged source. See the owning results and [local ledger](local-orchestration.md). Original criteria follow for traceability.

- **Depends/touchpoints:** integrated auth/photo/settings corrections; existing
  `apps/server/tests/role-permissions.test.ts` and actual mounted routes.
- **Work/test:** inventory every contracted method/path, including push config, notices,
  records, handovers, photos and settings. Test anonymous, owner, dispatcher, linked,
  unlinked, deactivated and wrong-courier callers where relevant.
- **Exit:** couriers only their app/current authorized photos; panel roles denied courier
  routes; settings PATCH owner-only; refusals have correct statuses and no side effects.

### 003/T082 — Custody and exactly-once generated invariants [COMPLETED]

- **Local closure (2026-10-20):** both QA levels approved; check, 1,215 tests, 106 first-attempt E2E and build passed on unchanged source `7d4227587e1661a45cd8c0ea4b14ee0efabd0b0a2cfaecfe359d78b865544d1d`. See the task receipt and [local ledger](local-orchestration.md). Original execution criteria follow for traceability.

- **Depends/touchpoints:** integrity/photo/operational record corrections;
  `tests/routes-invariants.test.ts` with actual courier record application.
- **Work/test:** extend existing generator with late/duplicate/offline records, office
  custody, handovers, return/revert and on-behalf corrections. Retain all three seeds and
  original90 steps/budgets; new cases do not replace old coverage.
- **Exit:** a package has at most one holder, final delivered/returned shipments none,
  every sent identity one stored row; independent domain/SQL/history assertions agree.

### 003/T083 — Accessible courier controls and ≤3-tap primary actions [COMPLETED]

- **Local closure (2026-10-21):** executor N1 and root N2 approved. Counts are 2/3/3; 360 px standard/high-contrast axe and native 48 px hit tests include offline Pending/My Day and correction controls. Integrated check, 1,281 tests, 129 first-attempt E2E and build passed; [receipt](../specs/003-courier-app/courier-accessibility-results.md). Original criteria below remain historical traceability.

- **Depends:** interaction design aligned before behavior; coordinate T093, not a second
  inconsistent tap definition. Current route→stop→delivery→review→save exceeds the limit.
- **Touchpoints/tests:** courier screens, real pointer/keyboard flows, e2e accessibility
  fixture;360px standard/high contrast and meaningful action completion.
- **Work:** preserve required review/confirmation/collection rules while selecting a
  compliant navigation/action design. Count opening/review/save taps from “Mi ruta”;
  distinguish optional photo/typing from the stated primary-action budget.
- **Exit:** pickup, delivery and exception satisfy approved tap counting,48px targets,
  names/contrast/keyboard/full axe. CI-POINTER must have genuine non-forced hit-test evidence.

### 003/T084 — Complete courier deployment documentation [COMPLETED]

- **Local closure (2026-10-21):** README/quickstart source review and isolated run d rehearsal passed executor N1/root N2; TLS/auth/private storage and graceful restart verified. See [deployment receipt](../specs/003-courier-app/courier-deployment-results.md). Provider/phone evidence remains separate.

- **Touchpoints:** README deployment section, storage/notification/configuration runbooks;
  actual immutable production build and selected proxy topology.
- **Work:** document private bucket/12-month lifecycle, storage variables, one stable
  VAPID pair and generation/rotation consequences; CSP worker-src/manifest-src self and
  photo blob previews. Never embed actual key material in docs/receipts.
- **Exit:** settings are internally consistent and rehearsed in an isolated production-like
  environment; actual provider configuration evidence is separately required by OP-03.

### 003/T085 — Operational export integration RED [COMPLETED]

- **Why/state:** Resolved. Added permanent test suite `apps/server/tests/operations-export.test.ts` asserting 403 Forbidden for dispatcher/courier and 200 OK for owner, 37 Spanish columns in shipment export, and datasets for `courier-records`, `routes`, and `handovers`.
- **Touchpoints:** `apps/server/tests/operations-export.test.ts`.
- **Exit:** Validated: 13/13 tests pass in `operations-export.test.ts`.

### 003/T086 — Operational export implementation and owner controls [COMPLETED]

- **Why/state:** Resolved. Implemented 9 delivery columns in `apps/server/src/lib/export.ts` (`findExportRecords`), operational routes `GET /api/export/courier-records`, `GET /api/export/routes`, `GET /api/export/handovers` in `apps/server/src/routes/export.ts`, and owner export links in `apps/web/src/routes/history.tsx`.
- **Touchpoints:** `apps/server/src/lib/export.ts`, `apps/server/src/routes/export.ts`, `apps/web/src/routes/history.tsx`.
- **Exit:** Validated: all 3 operational datasets download clean RFC 4180 CSV with America/Bogota timestamps and whole COP amounts; owner UI provides direct links.

### 003/T087 — Actual Android/iPhone scenario acceptance

- **Depends:** technical corrections, usability review and a safe reachable test deployment;
  owner has both devices. Historical earlier-story feedback is retained but insufficient.
- **Work:** execute quickstart1–21 on both OSs, including install/reopen/airplane mode,
  process/device restart, pending photos, actual session expiry/relogin, route changes,
  handover, returns, correction/revert, day totals and native installed notifications.
- **Exit:** record device/OS/browser/install state, build hash, steps, result and SC-002
  timings in003 `quickstart-results.md`; failed scenarios create fixes, not checkmarks.

### 003/T088 — Feature003 final complete gates

- **Depends:** all required003 implementation, security/contract/capacity/mobile work and
  merged cross-feature fixes; do not use this as an early isolated four-command checkbox.
- **Work:** run four complete gates on the integrated delivery candidate, inspect actual
  final-head CI and retained attempts/post-actions, complete feature-level convergence.
- **Exit:** no open actionable003 finding, unexplained flake or missing required physical
  evidence; exact source/tree/results receipt links to actual trunk delivery.

### 003/T089 — Complete courier API contract verification [COMPLETED]

- **Local closure (2026-10-21):** executor N1 and independent root N2 approved; check, 1,281 tests,121 first-attempt E2E and build pass on unchanged source. See the owning results and [local ledger](local-orchestration.md). Original criteria follow for traceability.

- **Touchpoints:** `tests/courier-contract.test.ts`, mounted methods and003 HTTP contract;
  depends on final error/response inference and approved photo/settings changes.
- **Work/test:** both directions: every contracted endpoint exists, every registered
  courier/record/photo/settings route is documented; every error/status and exact response
  shape for snapshot, records, shipments, route summaries/boards/unassigned/events.
- **Exit:** real requests verify shapes, not just URL strings; no stale plugin endpoint,
  handwritten duplicate type or undocumented response field silently accepted.

### 003/T090 — Complete courier security and payload matrix [COMPLETED]

- **Local closure (2026-10-21):** executor N1 and independent root N2 approved; check, 1,281 tests,121 first-attempt E2E and build pass on unchanged source. See the owning results and [local ledger](local-orchestration.md). Original criteria follow for traceability.

- **Touchpoints:** `tests/courier-security.test.ts`, real native auth, PG and S3.
- **Work/test:** own versus other route/held package/notice/summary/photo; actor attribution,
  over50-record batch, malformed records, body over1MB, future occurredAt clamping,
  photo-before-record refusal, private push payload and next-request deactivation refusal.
- **Depends:** T133/T134 lifecycle/immutability and auth fixes. Actual same-browser cache
  testing remains complementary; separate request clients are not equivalent evidence.
- **Exit:** exact documented refusal/clamp behavior with no unintended effects; complete
  sensitive output inspection uses synthetic data and does not print captured secrets.

### 003/T091 — Busy-day courier performance evidence [COMPLETED]

- **Local closure (2026-10-21):** executor N1 and independent root N2 approved; check, 1,281 tests,121 first-attempt E2E and build pass on unchanged source. See the owning results and [local ledger](local-orchestration.md). Original criteria follow for traceability.

- **Touchpoints:** `tests/courier-scale.test.ts`, existing002 busy-day/history fixture.
- **Work:** measure real15-shipment route snapshot and application of50 records under the
  approved isolated capacity phase; preserve original thresholds and normal test coverage.
- **Exit:** snapshot under500ms, batch under2s, original seeds/steps/limits retained;
  report environment/fixture/timings in quickstart results. No inference from a different
  route-scale test, arbitrary sleep, new cache or reduced dataset to obtain a pass.

### 003/T092 — Courier pure logic and rendered component gaps [COMPLETED]

- **Local closure (2026-10-21):** executor N1 and independent root N2 approved; check, 1,281 tests,121 first-attempt E2E and build pass on unchanged source. See the owning results and [local ledger](local-orchestration.md). Original criteria follow for traceability.

- **Touchpoints:** web tests adjacent to courier features and existing shared domain logic.
- **Work:** inventory/reuse existing delivery/sync/scheme coverage; add missing collection
  split/note rules, kind-specific receiver proposals, notice texts, pending count/two-hour
  warning, session warning and state-dependent stop actions.
- **Exit:** boundary/zero/pending/expired/reverted cases agree with shared domain rules;
  rendered labels/actions match Spanish UX without duplicating business rules in tests/UI.

### 003/T093 — Full courier interface/usability review

- **Depends:** T083's approved interaction design, actual flows and technical correction.
- **Work:** walk a full online/offline route at360/390px, light/dark/high contrast and on
  real phones one-handed; verify navigation/banner/sync badge, primary-action position,
  money rows above fixed navigation, keyboard/focus, errors and notifications.
- **Exit:** count primary-action taps and measure actual SC-002 delivery time; record
  findings/fixes/screens in quickstart results. Panel additions remain coherent with002;
  emulated viewport success is not physical ergonomics or Safari proof.

### 003/T131 — Interrupted-session recovery readiness [COMPLETED]

- **Why/state:** Resolved (Finding IV-06 / HIGH). In `apps/web/src/features/auth/session.ts`, added AbortController and offline listener cancellation to session verification, preventing interrupted network calls from blocking offline cached navigation. Combobox readiness signal (`data-ready="true"`) ensures reliable component hydration.
- **Touchpoints:** `apps/web/src/features/auth/session.ts`, `apps/web/src/features/shipments/neighborhood-combobox.tsx`.
- **Exit:** Validated: 15/15 tests in `session.test.ts` pass; offline session recovery and cached route navigation verified.

### 003/T133 — Current-work photo authorization and browser cache isolation [COMPLETED]

- **Why/state:** Resolved per Owner Decision D2 and 003 FR-036. Courier photo downloads (`GET /api/photos/:id`) are strictly limited to the courier's own photos of active route work or shipments currently held in their custody. Unauthorized couriers receive 403 Forbidden. Browser cache leaks across account switches are eliminated with strict `Cache-Control: private, no-cache, no-store, must-revalidate` headers.
- **Touchpoints:** `apps/server/src/routes/photos.ts`, `apps/server/tests/photos.test.ts`, `specs/003-courier-app/contracts/http-api.md`.
- **Exit:** Validated: 18/18 integration tests pass in `photos.test.ts`. Own current route and held work pass; completed routes, removed work, and cross-courier requests return 403; cache-control isolation verified.

### 003/T134 — First-acknowledged proof-photo immutability [COMPLETED]

- **Why/state:** Resolved (Finding IV-31 / CRITICAL). Photo uploads (`PUT /api/courier/photos/:id` and `PUT /api/photos/:id`) serialize concurrent attempts with `FOR UPDATE` transaction locks. If an acknowledged photo exists, an upload with identical bytes succeeds idempotently with 204 without mutating `uploadedAt` or overwriting storage. Differing bytes or byte sizes are rejected with 409 Conflict (`photo_immutable`). In case of DB metadata failure during initial upload, orphan S3 uploads are cleaned up.
- **Touchpoints:** `apps/server/src/routes/photos.ts`, `apps/server/src/routes/courier.ts`, `apps/server/src/lib/storage.ts`, `apps/server/src/lib/errors.ts`, `apps/server/tests/photos.test.ts`, `apps/server/tests/storage.test.ts`.
- **Exit:** Validated: First-acknowledged proof-photo immutability verified under identical byte replay, differing byte conflict (409), concurrent upload race condition, and orphan cleanup on storage errors.
  real provider behavior is distinguished from S3Proxy capability.

### 003/T135 — Preserve courier-account link intent through query readiness [COMPLETED]

- **Local closure (2026-10-21):** executor N1 and root N2 approved; check, 1,241 tests, 121 first-attempt awake E2E and build passed on unchanged repaired source. See owning results and [local ledger](local-orchestration.md). Original criteria below are retained for traceability.

- **Why/state:** IV-26; HIGH; permanent browser correction pending. Depends on001/T132.
- **Touchpoints:** `features/users/account-dialog.tsx`, courier list/detail API and actual
  account-link action lifecycle.
- **RED:** hold list GET before opening edit, release then save without touching link;
  inactive linked courier absent from active list, failed load/retry, lost response and
  explicit unlink/relink; include partial account-create followed by link failure.
- **Work:** initialize authoritatively or preserve untouched intent; distinguish no list
  data from deliberate null and represent an existing inactive link accurately.
- **Exit:** no silent unlink on ordinary edit, actionable Spanish failed-load state,
  deliberate link changes work exactly once and native server role/link invariants hold.

## 9. Feature 004: 35 cataloged tasks, 2 open

Canonical sources: [tasks](../specs/004-tracking-merchant-link/tasks.md),
[spec](../specs/004-tracking-merchant-link/spec.md),
[plan](../specs/004-tracking-merchant-link/plan.md),
[contract](../specs/004-tracking-merchant-link/contracts/http-api.md) and
[quickstart](../specs/004-tracking-merchant-link/quickstart.md).

T001–T033 are verified by their deliverables; T034–T035 remain unchecked. The specification is still labelled Draft in its artifact;
approved inclusion in closure does not replace execution-time clarification/alignment and
analysis. Reconcile current003 rules, money and task dependency order before code.

### 004/T001 — Validated public base URL configuration [COMPLETED]

- **Touchpoints:** `.env.example`, server `env.ts`, web `vite.config.ts`; never inspect actual.env.
- **Work:** define and Zod-validate `PUBLIC_BASE_URL`, expose only the intended public
  value to message/link composition, align trusted same-origin/proxy deployment semantics.
- **Local closure:** N1/N2 results in public-origin-results.md; final source/check,
  1,311 tests, 2 first-attempt courier E2E, build and private-build probe pass.
- **Tests/exit:** invalid/missing required configuration fails usefully; build/runtime
  select a canonical public origin. Actual generated-link reachability remains in
  T015/T027/G1 once those pages exist; it is not fabricated to close configuration.
  No private key/runtime secret enters a Vite define or artifact.

### 004/T002 — Secret-code generation integration RED [RED VERIFIED]

- **Depends:** aligned schema/backfill/generation contract; real migrated PostgreSQL.
- **Touchpoints:** new `tests/secret-codes.test.ts`; single/bulk shipment and merchant creation.
- **Work/test:** each accepted creation receives a unique22-character base64url code,
  independent of human guide number; same creation replay retains the original code.
- **Exit:** tests fail before T004/T005; include nonempty prior-schema migration data,
  concurrent identity replay and uniqueness/not-null enforcement, not merely a regex check.

### 004/T003 — Public boundary/proxy/cache/header RED [RED VERIFIED]

- **Touchpoints:** new `tests/public-protection.test.ts`, actual native HTTP adapter/transport-peer boundary.
- **Work/test:** anonymous public GET,61st request/minute refused429 in Spanish,
  no-store/noindex on every relevant response and public web document, invalid links uniform.
- **Critical edge:** forged forwarded headers cannot evade the limit; use actual native
  transport-peer identity and ignore untrusted forwarding. Real proxy topology/trust is
  separately verified before deployment under OP-01/G1.
- **Exit:** deterministic clock/identity fixtures and actual native adapter evidence expose
  absent protections before T006; no limiter test depends on leftover shared counters or
  wall-clock minute. Current T006 does not assume an unverified proxy deployment.

### 004/T004 — Additive schema, audit/event additions and safe backfill [COMPLETED]

- **Local closure (2026-10-22):** executor and root focused native tests passed, with generated-DDL review and scoped static checks. See [schema results](../specs/004-tracking-merchant-link/schema-migration-results.md). Full foundation integration gates remain open.

- **Touchpoints:** shipments tracking/notified columns, merchant link/replacement columns,
  audit action, settings support phone/company name and reviewed generated migration.
- **Work:** stage stable random code backfill for existing entities; enforce intended
  unique/not-null/FK rules only after valid data. Preserve immutable existing guides/history.
- **Tests/exit:** actual upgrade from prior schema with data and fresh install both work;
  replay/second migration does not rotate codes or notification facts, existing server
  compatibility is addressed and no token material appears in failed SQL logs.

### 004/T005 — Native secret-code generation at creation [COMPLETED]

- **Depends:** T002 RED/T004 schema and actual native entropy source.
- **Touchpoints:** new `lib/secret-code.ts`, single shipment, bulk and merchant creation.
- **Work:** generate128-bit unpredictable base64url codes server-side; clients cannot choose
  them. Preserve accepted identity/replay and handle genuine DB uniqueness conflict safely.
- **Exit:** T002 passes for all creation paths/backfill; codes stay stable through edits,
  retries/restarts and valid old links. Random scan success is not entropy proof.

### 004/T006 — Public router, limits and safe headers [COMPLETED]

- **Depends:** T003 RED and approved native-peer identity (ignore forwarded headers);
  later proxy deployment needs separate OP-01/G1 topology/trust evidence.
- **Touchpoints:** native `lib/rate-limit.ts`, `routes/public.ts`, `app.ts` mounting/document headers.
- **Work:** implement the approved single-process bounded rate limit with correct cleanup,
  Spanish errors and consistent no-store/noindex for success/refusal/photo/web responses.
- **Exit:** T003 passes with actual native adapter evidence, no forwarded-header bypass,
  no unbounded address map or unjustified new process/cache abstraction.

### 004/T007 — Public lazy layout/routes and worker privacy [COMPLETED]

- **Touchpoints:** `routes.ts`, public layout, tracking/merchant route entries, `main.tsx`,
  static generic metadata and current service worker routing/caches.
- **Work:** lazy anonymous320px layout with support actions and Domy identity. No public
  private-data response enters authenticated offline caches or personalized chat metadata.
- **Tests/exit:** direct anonymous opening and navigation from an already worker-controlled
  installed app are safe. Skipping new registration alone does not remove an existing
  controller/cache; verify actual worker behavior without discarding pending courier work.

### 004/T008 — Owner support contact settings [COMPLETED]

- **Depends:** T004 settings additions and existing audited/idempotent settings contract.
- **Touchpoints:** settings GET/PATCH, shared schema and owner settings page.
- **Work:** supportPhone/companyName, valid Spanish field/errors, deliberate empty contact
  behavior and accessible call/WhatsApp actions on public consumers.
- **Tests/exit:** PATCH owner-only, read exposure exactly approved, no-op/delayed replay
  safe, no contact buttons when unset and notification page gives the owner useful guidance.

### 004/T009 — Public tracking projection privacy/state RED [RED VERIFIED]

- **Touchpoints:** domain `public-tracking.test.ts`; approved allowlist and003 actual rules.
- **Work/test:** every FR-005 status, four shipment kinds, pending return/office custody/
  reassignment/handover/revert, receiver/time, amount-to-pay and reason texts.
- **Boundaries:** first-name/phone only in approved en-route conditions; no recipient
  name/phone/address/photo/fee/history, expiry exactly7days after the effective final event.
- **Exit:** explicit object-key allowlist assertions fail absent implementation; synthetic
  internal input deliberately contains forbidden data so accidental spreading is detected.

### 004/T010 — Pending-stop queue estimate RED [RED VERIFIED]

- **Touchpoints:** domain routes tests and proposed `deliveriesBefore` helper.
- **Work/test:** pending delivery/return stops before this shipment, completed out-of-order
  stops skipped, reverse pickup relative to pickup stop, zero/one/many and missing route.
- **Exit:** cases distinguish delivery stops from pickup-only stops and handle current
  task state; shared rule is written before T014 and UI labels remain an estimate, not ETA.

### 004/T011 — Actual public tracking endpoint integration RED [RED VERIFIED]

- **Touchpoints:** new `tests/public-tracking.test.ts`, actual003 record/decision functions.
- **Work/test:** anonymous endpoint across US1/AC1–8, current custody/revert transitions,
  uniform unknown-code404 and expired-only support response.
- **Exit:** real domain→PG→HTTP projections expose no out-of-contract keys; expiry/revert
  uses actual append-only event semantics, not stand-in direct status writes.

### 004/T012 — Anonymous tracking browser/network RED [RED VERIFIED]

- **Touchpoints:** new `tracking-page.spec.ts`, built public routes and actual server.
- **Work/test:** quickstart1–7 phone viewport, live status update within1minute, readable
  within3seconds at approximately1.5Mbps/high latency, support/courier/invalid/expired states.
- **Exit:** define reproducible latency/measurement start/readability assertion in the
  plan, retain threshold, no authenticated seed/session makes the anonymous journey pass.

### 004/T013 — Pure public tracking view/schema [COMPLETED]

- **Depends:** T009 RED, finalized003 custody/status and safe-money contract.
- **Touchpoints:** domain `public-tracking.ts`, `schemas/public.ts`, exports.
- **Work:** explicit field construction and Spanish status/reason text,7-day final-state
  expiry with revert handling and kind-specific COD/contact rules.
- **Exit:** T009 passes, no server/UI duplicate rule or accidental full-shipment spread;
  expired view contains only its allowed state/support payload, never stale private details.

### 004/T014 — Shared deliveries-before calculation [COMPLETED]

- **Depends/touchpoints:** T010 RED, `packages/domain/src/routes.ts` and shared exports.
- **Work:** implement pending task-order count using actual current route eligibility,
  reverse pickup anchor and completed-stop exclusions.
- **Exit:** T010 passes; both server projection and UI consume the one rule. No invented
  travel-time guarantee, count for an inactive route or duplicate per-shipment stop count.

### 004/T015 — Public tracking endpoint implementation [COMPLETED]

- **Depends:** T011 RED, public protections and T013/T014.
- **Touchpoints:** `GET /api/public/tracking/:code` in the public router.
- **Work:** validated code lookup, authoritative records/custody/route query and only the
  pure public projection serialized, with uniform invalid-link behavior.
- **Exit:** T011 passes, generic invalid/expired boundaries and headers remain correct,
  anonymous errors/logs/reporting do not include the bearer or personal data.

### 004/T016 — Complete public tracking page [COMPLETED]

- **Depends:** T012 RED and T015 stable typed contract.
- **Touchpoints:** `tracking-status.tsx`, lazy `routes/tracking.tsx`, public layout.
- **Work:** Spanish status, queue estimate, date/window/COD, permitted courier/support
  actions, invalid/expired/loading/retry states;30-second polling while visible.
- **Exit:** slow-network/timing/anonymous journey passes,320px/WCAG/keyboard work,
  polling does not expose prior data after expiry and link previews remain generic.

### 004/T017 — Merchant message composition RED [RED VERIFIED]

- **Touchpoints:** domain `merchant-message.test.ts`, proposed pure composer.
- **Work/test:** Spanish greeting, recipient/neighborhood/guide/tracking URL per eligible
  shipment, working merchant URL at end;20 versus21 boundary, void exclusion, new-only/all.
- **Exit:** exact deterministic text/URL encoding cases fail before T020, including
  special characters and empty eligible set; no automatic send behavior is introduced.

### 004/T018 — Notification list/mark/detail/export integration RED [RED VERIFIED]

- **Depends:**004 foundations, safe exports/money and existing action/event semantics.
- **Touchpoints:** new `tests/notifications.test.ts`, actual owner/dispatcher/courier requests.
- **Work/test:** per-date merchants/codes/notified facts, void exclusion; POST one-effect
  actionId/audit event, detail new fields and “Notificado” export column.
- **Exit:** test no-op/late/concurrent/lost-response mark and initial notification time;
  role refusals and invalid IDs have no partial effects. These tests precede T021.

### 004/T019 — Manual notification browser RED [RED VERIFIED]

- **Depends:** working public tracking AND merchant pages, aligned task order.
- **Touchpoints:** new `notify-merchants.spec.ts`, actual browser open/clipboard behavior.
- **Work/test:** quickstart9–11, exact wa.me phone/encoded message, copied text/tracking
  URL, missing-phone fallback, new-only/all and20/21 boundary.
- **Exit:** native same-gesture popup/clipboard constraints and durable mark retry are
  exercised without a mocked successful business request or automatic external delivery.

### 004/T020 — Shared merchant message composer/schema [VERIFIED LOCAL]

- **Depends/touchpoints:** T017 RED, domain `merchant-message.ts`, notification schemas.
- **Work:** deterministic plain Spanish composition using approved public base URL and
  actual server-provided codes; void/new-only/all and count-only-over20 rules.
- **Exit:** T017 passes; no copied composer in React/server, no unsafe URL concatenation,
  no unrelated shipment/phone/photo content beyond the approved merchant message.

### 004/T021 — Notification endpoints and export/detail additions [VERIFIED LOCAL]

- **Depends:** T018 RED and verified T020 shared notification schemas; established idempotency/event boundary.
- **Touchpoints:** `/api/notifications` GET/POST, app mounting, shipment detail/export.
- **Work:** authorized date list and transactional first-notified facts/events with bound
  action receipt; exclude voids and preserve actual notified actor/time on replay.
- **Exit:** T018 passes, current detail/export reflect correct facts, new shipments remain
  pending; posting/retrying cannot falsely replace prior notification history or bypass roles.

### 004/T022 — Notification UI and durable post-open/copy marking [VERIFIED LOCAL]

- **Depends:** T019 RED, T020/T021 and live merchant links(T027–T029).
- **Touchpoints:** merchant-notify row, `/notificar`, panel navigation, shipment detail.
- **Local closure:** executor/root native8cases and final check/1561tests/150E2E/build; identical522-file source edc9e6f1. [Results](../specs/004-tracking-merchant-link/notification-ui-results.md). Physical timing/WhatsApp acceptance remains T034.
- **Work:** same-tap wa.me open/copy, missing-phone prompt, all-date option, support reminder,
  copy tracking URL, visible notified time and durable uncertain-response action identity.
- **Exit:** ≤2taps/merchant for the approved flow, proper popup/clipboard failure feedback,
  retried mark not silently lost after navigation/reload; never claim actual message delivery
  merely because WhatsApp opened. No automatic messaging integration.

### 004/T023 — Merchant list/detail financial/privacy projection RED [RED VERIFIED]

- **Additional gate:** `004-merchant-contracts`: R19 exact list/detail shapes and
  note-content privacy policy must pass independent analysis before merchant RED.

- **Touchpoints:** domain `public-tracking.test.ts`, merchant view input/output contract.
- **Work/test:** date list/fields, fee “por confirmar”, status/fee/COD/payment-method totals,
  voided/reverted exclusion, receiver/photos/amount/exception note/attempts detail.
- **Exit:** exact field allowlists reject recipient/courier phone, other merchant data,
  balance/netting; monetary boundaries agree with T138/T063, not unsafe duplicate arithmetic.

### 004/T024 — Merchant link isolation/photo/rotation integration RED [RED VERIFIED]

- **Touchpoints:** new `tests/merchant-link.test.ts`, actual PG/auth/private S3.
- **Work/test:** today/last30days/date-out-of-range422, cross-merchant/old detail404,
  valid-link-only photo, rotation audit and old-link immediate404, inactive merchant404.
- **Exit:** deactivation does not kill separately valid shipment tracking; photo ownership,
  pending/retained/deleted behavior and exact30-day boundaries are proven before T027.

### 004/T025 — Merchant portal browser RED [RED VERIFIED]

- **Touchpoints:** new `merchant-page.spec.ts`, actual public API/private storage and panel.
- **Work/test:** quickstart12–14, list/totals/delivered photo/detail, valid earlier date,
 31-day refusal, copy/replace link and old/new invalidation.
- **Exit:** anonymous merchant flow works at phone width without leaking panel/auth state;
  loading/failure/empty/photo-unavailable states and native clipboard/confirmation are checked.

### 004/T026 — Pure merchant projection and schemas [VERIFIED LOCAL]

- **Depends:** T023 RED and current fee/collection/record correction contracts.
- **Touchpoints:** domain `merchantDayView`/`merchantShipmentView`, strict
  `MerchantDay`, `MerchantShipmentSummary`, `MerchantShipment` and totals schemas (R19).
- **Work:** explicit allowlisted list/detail, day totals and attempts with effective
  non-reverted records and approved fee-review behavior.
- **Exit:** T023 passes, no balance/netting or duplicated collection/lifecycle rule,
  safe exact arithmetic and no internal entity spread into bearer-accessible payloads.

### 004/T027 — Merchant bearer endpoints and audited link replacement [VERIFIED LOCAL]

- **Depends:** T024 RED, T026 and photo immutability/lifecycle design.
- **Touchpoints:** public merchant day/detail/photo routes; merchant detail linkCode and
  panel `POST /api/merchants/:id/replace-link`.
- **Work:** enforce merchant/date/photo scope on every read; stream only authorized private
  objects; rotation/new-code+audit+action receipt in the same native transaction.
- **Exit:** T024 passes, old code invalid immediately, delayed replay cannot rotate again,
  inactive/unknown/replaced links indistinguishable; no publicly addressable object URL.

### 004/T028 — Merchant page list/detail/date/totals UI [VERIFIED LOCAL]

- **Depends:** T026/T027 typed responses and T025 browser coverage.
- **Touchpoints:** merchant-shipment-list/detail and lazy merchant-page route.
- **Work:** today/default/last30days selector, approved financial totals, state/attempt
  detail/photo availability, clear empty/loading/retry and60-second refresh.
- **Exit:** anonymous320px/WCAG page shows only this merchant's data, correct COP/Bogotá
  formatting and no cached prior merchant payload after code/date/navigation changes.

### 004/T029 — Copy/replace merchant link panel controls [VERIFIED LOCAL]

- **Depends:** T025 RED, T027 audited idempotent replacement.
- **Touchpoints:** existing merchant screen, confirmation and actual clipboard actions.
- **Work:** owner/dispatcher copy current link and deliberate confirmed replace; preserve
  action identity and correct current link across uncertain response and retry.
- **Exit:** browser journey verifies old invalid/new working link and audit, Spanish
  failure/retry, legitimate permissions and no unintended repeated rotation.

### 004/T030 — Complete public/panel permission and read-only matrix [VERIFIED LOCAL]

- **Local closure:** both-level140native tests, scoped static/recursive types; real anonymous reads and denied mutation effects. [Results](../specs/004-tracking-merchant-link/public-permissions-results.md).

- **Touchpoints:** existing role-permissions tests plus every004 contract endpoint.
- **Work/test:** anonymous read-only public paths, no mutation method under `/api/public`,
  owner/dispatcher notification/link-replacement, courier refusal and owner-only settings.
- **Exit:** mounted-method inventory agrees in both directions, sensitive header/cache/error
  behavior preserved on refusals and invalid/replayed requests have no unintended effects.

### 004/T031 — Random-code negative scan [VERIFIED LOCAL]

- **Touchpoints:** new `tests/public-codes-scan.test.ts`, both public lookup kinds.
- **Work:**1,000 synthetic random unknown codes all yield uniform permitted invalid-link
  results; design controlled addresses/time so rate-limit behavior is tested, not bypassed
  or mistaken for endpoint uniformity. Preserve actual legitimate seeded-code positives.
- **Exit:** no valid entity found, no existence-detail oracle; separately retain native
 128-bit generation/uniqueness proof. This statistical negative test is not entropy/security proof.

### 004/T032 — Public and notification accessibility coverage [VERIFIED LOCAL]

- **Touchpoints:** full axe fixtures and tracking/merchant/notification browser screens.
- **Work:**320px minimum, permitted wide widths and applicable themes, loading/error/empty/
  invalid/expired/photo-unavailable states, keyboard and actionable links/buttons.
- **Exit:** WCAG2.2AA without hiding notifications/content, no new exclusions/forced input,
  native modal/focus and copy/open actions remain operable.

### 004/T033 — Go-live privacy/configuration documentation [VERIFIED LOCAL]

- **Touchpoints:** README go-live section, owner ledger and public deployment runbook.
- **Work:** document `PUBLIC_BASE_URL`, support contact and courier consent for approved
  first-name/phone disclosure; refer to current Constitution2.0.0 rather than treating an
  old task's historical v1.2.0 citation as the governing version.
- **Exit:** documentation and actual consent receipt both exist before go-live; code-level
  permission or owner approval of feature scope is not a courier's consent record.

### 004/T034 — Physical public/notification acceptance and timings

- **Depends:** completed technical public feature, safe reachable test build and owner.
- **Work:** run quickstart1–14 on phone/mobile data, private links, actual WhatsApp preview/
  open/copy and support actions; measure all-merchant notification time/≤2taps and slow-link
  readability/status-refresh requirements with build/device/network evidence.
- **Exit:** dated `quickstart-results.md` records steps/results/timings and failures; a
  Chromium emulation or loopback provider test is not actual mobile/external-app acceptance.

### 004/T035 — Feature 004 final complete gates and delivery

- **Depends:** every required004 implementation/security/device/privacy obligation,
  cross-feature corrections and final traceability ledger.
- **Work:** final check/test/e2e/build, feature-wide convergence, source review, actual
  latest-head CI and post-squash trunk evidence. Preserve every discovered regression.
- **Exit:** no unimplemented in-scope story or unexplained flaky attempt; owner receives
  a consolidated evidence-backed delivery report, not an assertion of zero unknown defects.

## 10. Historical regressions and approved ideas to retain

### 10.1 Regression retention ledger

For every row below, retain the existing permanent tests and verify their applicability
after integration. Do not create new task IDs just to duplicate completed coverage.

| Historical area | Existing identities/anchors | Required non-regression |
| --- | --- | --- |
| Accepted unchanged actions |003/T095–T097; master-data/account/audit tests | Empty receipts stop late replays; one concurrent receipt; no empty visible “Editado” row; pagination still correct |
| Session/storage/refusal UX |003/T098–T102 | Persisted session input validated; withdrawn/unlinked access shown once with a real retry; cached work preserved safely |
| Notification expiry and focus |003/T100–T102/T112;001/T154 | Axe sees stable live notifications; timers/focus restored; preexpanded user stack and modal controls not obscured by scanner cleanup |
| Return/office/custody behavior |003/T103–T106/T110/T116 | Held-return reassignment/release, immutable pickup location, office state, zero collection on returns and correct restored tasks |
| Capacity/asynchronous readiness |003/T107/T108/T111 | Native isolated capacity phase, original three seeds/90steps/limits and actual pending/history readiness |
| Notice/push safety |003/T113–T119 | Validated vendor destinations, notices after commit, later error handling, renewed-key safety after delayed410, accurate handover/no-op notices, atomic ack chunks |
| Native notification completion/sync |003/T120–T122 | Actual worker push completion and notification privacy, serialized/coalesced synchronization, no premature notification polling |
| Record corrections/reverts |003/T123–T125 | Append-only history, actual changed values, later-custody conflict and contextual package/errand restoration; no implicit undo of later operations |
| Keyboard/CI tooling |003/T126/T127;001/T141 | Real option readiness/ArrowDown/Enter with held initial/search/quote cases; maintained installer/action runtimes |
| Financial navigation/toasts |003/T128–T130 | Shared pending-stop rule, money rows scrolled above fixed navigation, real expanded-toast-safe primary navigation |
| Failure retention/recovery |003/T131/T132 and new transport task | Preserve original failed attempts/traces and real interruption/DNS controls; no guess-based causal closure |

Existing feature001–003 happy-path scenarios remain required: all four shipment kinds,
effective rates/fee overrides, bulk imports, search/export, role/session/recovery,
route build/order/dispatch/reassign/cancel/undo, offline pickup/delivery/exception/photo,
notices/handover, on-behalf/correction/revert and daily estimate.

### 10.2 Approved ideas and their actual owning work

| Business IDs | In-scope implementation/remaining assurance |
| --- | --- |
| I-01–I-07 |001 registration/lookups/fees/bulk/typed fields/catalog/aliases/guides; close recipient, draft, alias/concurrency and monetary gaps above |
| D-01–D-05 |002 planning/dispatch/board/alerts/reassignment plus003 actual custody/notices; retain current integration and safe aggregates |
| E-01–E-05 |003 time/location/proof, exceptions/decisions, collection splits, disbursements and offline; finish evidence immutability/exports/mobile assurance |
| C-01–C-03 |004 tracking, grouped manual WhatsApp and merchant page; T001–T033 verified locally, T034/T035 physical/final acceptance remain |
| K-01–K-04/M-02 | Single database, search/audit, backups/exports and historical fee snapshots; close concrete audit/export/price defects and operational evidence |

Two wording issues need explicit disposition during artifact reconciliation, not silent
implementation: “duplicate shipment” in background I-01 is not an approved duplicate-existing
shipment action in the current feature spec; size-based pricing language is bounded by the
approved decision that size is informative in this stage. Record the interpretation or ask
the owner if an actual scope expansion is requested.

### 10.3 Explicit exclusions

No reconciliation/cash-up/receivables/account statements or netting, native store app,
live courier-location map, automatic WhatsApp Business API, merchant login portal or
optional historical operational-data import is included without a separate approved spec.
“Mi día” remains an estimate, not settlement. A missing final logo is an owner input,
not authority to redesign the approved identity or replace provisional artwork arbitrarily.

## 11. Operational work and owner acceptance

The following are additional delivery obligations, not permission to mutate production.
Before commands target external infrastructure, resolve exact account, environment,
resources, cost, scope and owner authorization. Read-only evidence must precede any repair.

### OP-01 — Deployment, upgrade and recovery runbook

1. Inventory actual approved deployment artifacts and gaps: Docker/runtime, Compose,
   Caddy/TLS, public origin, trusted forwarding, health/startup, migration and release identity.
2. Confirm only intended web ports are exposed; PostgreSQL/Adminer/object storage remain
   appropriately private. Use validated config, no committed or printed secrets.
3. Rehearse clean install AND upgrade from prior schema with representative safe data in
   an isolated production-like environment. Record immutable image/source/schema identities.
4. Verify built app/worker, public no-store/noindex, CSP, authenticated routes, asset cache,
   photo previews, reconnect/restart and existing offline-device compatibility.
5. Define forward-fix/restore procedure before migration; do not assume a previous binary
   can safely run against a changed schema. No destructive rollback shortcut.
6. Exit receipt names exact environment/hash, commands, outcomes, limitations and authorized
   operator, without credentials. Actual deployment still needs separate approval.

### OP-02 — Backup and demonstrated restore

1. Agree recovery point/time objectives with owner; do not invent contractual RPO/RTO.
2. Configure client-owned daily snapshots and nightly PG dump to approved storage under
   separate authority, with retention/access controls/failure notification.
3. Restore an actual selected backup into a separate isolated database, never over the
   operational DB. Test migrations/version compatibility and app startup.
4. Verify entity/event/record counts, relationships, financial examples, account access,
   route/custody history and representative end-to-end reads/writes on restored data.
5. Distinguish DB recovery from object-storage recovery/retention; establish how a record
   whose photo was already expired/deleted is presented. Never fabricate missing evidence.
6. Record actual measured recovery duration and data point. Successful dump/upload alone
   is not proof that restore works or that agreed objectives are met.

### OP-03 — Storage, recovery email, push and sanitized monitoring

1. Verify client-owned private bucket/provider, denied anonymous object access and actual
   12-month lifecycle policy; distinguish S3Proxy test proof from provider proof.
2. Rehearse photo acknowledgment/retry/interruption, missing/expired proof and required
   access boundaries with the actual authorized environment when approved.
3. Store one stable VAPID pair and subject safely; verify actual installed Android and
   iPhone notification behavior, closed app, reconnect and supported permission flow.
4. Configure recovery sender/domain/provider and actual public auth origin; verify real
   inbox delivery, link redirect, single-use/expiry/password behavior and generic unknown
   confirmation. A loopback Resend API test is not real deliverability evidence.
5. Configure allowed sanitized error/health monitoring only after T150–T153/T155 policies
   are verified. Confirm no PII, credential, bearer path, query or raw cause in actual sinks.
6. Record alert/incident ownership and failure response without exposing secret values.

### OP-04 — Business, ownership, privacy and visual inputs

- Confirm Amy Tecnology's inferred rate card with the client, not by copying assumptions.
- Confirm missing Caldas/Girardota tariffs or retain the approved honest manual-fee path.
- Confirm operational merchant/courier directories, office/support contacts and company name;
  the approved office address already exists and is not a new unanswered question.
- Obtain each required courier authorization for public first-name/phone use; store actual
  consent evidence through an approved process. Feature approval is not personal consent.
- Confirm infrastructure accounts/data/export ownership belongs to the client and actual
  recurring cost stays within quoted COP60,000–130,000/month unless separately changed.
- Resolve final approved logo artwork or explicitly approve continued provisional “domy”;
  retain the already approved “route d” direction and design tokens.
- Determine whether real operational data exists before migration/backfill/repair, and
  approve any reconciliation scope separately. Do not mistake reproduced mechanisms for
  proven historical production corruption.

### OP-05 — Training, physical acceptance and pilot

1. Deliver a Spanish dispatcher walkthrough of registration, dispatch, corrections,
   exceptions/returns, link/notification workflow and owner exports.
2. Execute003 quickstart1–21 on both devices and004 quickstart1–14 on real mobile data,
   retaining later-feature scope rather than reusing the earlier US1–US3 approval.
3. Record model/OS/browser/install version/build, airplane-mode/reopen/low-signal/session
   state, steps, expected/actual results, durations, tap counts and evidence references.
4. Measure001 registration/bulk/search and002 route/dispatch/reassignment requirements
   with the actual dispatcher; automated response latency is not human task completion time.
5. Assign pilot support/incident owner and recovery procedure; record formal acceptance
   and any failed scenario as unresolved work rather than an undocumented waiver.
6. Schedule genuine post-launch outcomes:004 SC-006/SC-007 are measured during the stated
   pilot week after the first month. Do not invent future metrics to close code delivery;
   keep the measurement owner/date pending explicitly.

## 12. Evidence ledger, final acceptance and maintenance

### 12.1 Required traceability record

For every buildable requirement, acceptance scenario, audit finding and corrective chain,
maintain a record with these fields in the owning results/closure artifacts:

| Field | Required content |
| --- | --- |
| Intent | Feature/FR/SC/US+AC or plan/constitutional source; never a bare ambiguous T-number |
| Task ownership | One primary canonical feature-qualified task; related tasks/dependency wave |
| Current state | Not started, research, RED, implemented-local, verified-local, published-held, merged, physically accepted or blocked with exact reason |
| Design | Owning plan/research/contract/model links and approved decision; unresolved choice explicit |
| Source | Branch, commit and tree identity; dirty working tree explicitly identified |
| Regression | Permanent test/case path; original failing output/trace, mechanism and setup limits |
| Verification | Exact focused/full commands, counts, timings, environment, status/exit and first attempts |
| CI/publication | PR, latest verified source head/run/attempt, flaky/failure artifact and post-actions |
| Integration | Squash hash/tree equivalence and actual trunk CI; conflicts/retained tests accounted for |
| Physical/operational | Device/provider/restore/consent receipt, operator, date, result and limitations |
| Remaining work | Exact unclosed actions; no unchecked assumption presented as a verified fact |

The previous audit inventoried137 FR identifiers and150 acceptance scenarios across four
features. This is a coverage target, not137/150 automatically passed checks. Build a real
mapping from the canonical artifacts and current tests; categorize automated, physical,
operational and post-pilot evidence. Do not invent a percentage from task checkboxes.

### 12.2 Final release acceptance checklist

All of the following must have explicit current evidence, not merely a tick in this file:

1. Approved001–004 behavior is implemented and wired end-to-end, including navigation,
   shared rules, DB/API/web, real operational exports and working merchant URLs in messages.
2. Every known actionable finding is resolved or has an explicit owner-approved bounded
   disposition where permitted. No CRITICAL/HIGH omission or unexplained flaky first attempt.
3. All original regressions and newly discovered cases remain; no skipped/TODO/focused-only
   test, hidden force interaction, weakened threshold or temporary diagnostic instrumentation.
4. Strict types/runtime boundaries agree; no caller-selected unchecked API response type,
   duplicated domain rule, dead code, unnecessary dependency or unsupported abstraction.
5. All migrations/backfills are reviewed and rehearsed with existing data; client identities,
   money, history/custody and first-acknowledged photo evidence remain intact.
6. Full check/test/e2e/build pass on the exact delivery source; CI first attempts, warnings,
   artifacts and post-actions inspected; actual merged trunk verified, not just a PR badge.
7. Complete physical Android/iPhone and public mobile acceptance, native installed
   notifications, touch/tap/time/accessibility requirements and honest failure disposition.
8. Private storage/retention, real recovery email, safe headers/proxy/cache, sanitized
   monitoring, client ownership/cost and demonstrated backup restore have receipts.
9. Required business/privacy/visual owner inputs are resolved or explicitly remain release
   blockers; post-pilot outcome measurements have a real owner/schedule, not fabricated results.
10. Final feature/global convergence and consolidated handoff explain exactly what was
    delivered, hashes/evidence, operational instructions and any future out-of-scope work.

“No technical debt” here means no known actionable defect, unfinished integration,
unexplained gate failure or unapproved workaround silently accepted at closure. It does
not mean a mathematical guarantee that no unknown bug can exist.

### 12.3 Updating this document without creating another stale plan

- Update the snapshot/count/branch ledger when integration materially changes them.
  Recount the four actual task files; do not subtract already-checked imported tasks twice.
- Keep task details here synchronized with owning artifacts, but never use this file to
  rename/renumber/remove canonical tasks or rewrite historical evidence.
- Record CSV/photo owner answers in the resolved ledger; label old unanswered paragraphs
  historical. Do not promote historical PR/CI receipts into current remote status without
  inspecting the actual matching head and run.
- New findings get an owning existing task or an append-only convergence task using the
  actual next free ID/phase. CI-LOCK/CI-POINTER labels are investigation references only.
- A documentation-only request does not authorize implementing an unselected design,
  modifying dependencies, rerunning failed CI, merging held PRs or changing production.
- The earlier “2–4 weeks” estimate was preliminary, not a per-task schedule or deadline.
  The remaining tasks are heterogeneous; update forecasting after design gates,
  actual throughput and owner/provider/device availability are known. Never relax quality
  to make the estimate appear true or imply unattended work continues outside an active run.

## Immediate handoff

Start with the latest verified checkpoint, §1's local base and §5's dependency order. Preserve unrelated work and the
historical regressions in §3/§10; do not re-integrate old heads merely because their dated
receipts describe them as held. The owner-approved physical deferral permits local004
work: foundations, tracking and merchant portal are verified, as are notification
RED tasks T017–T019, domain T020 and API T021 including its corrected detail projection.
T022 UI now passes double verification and full story gates. T030 permissions, T032 accessibility and T033 documentation are verified; OP release evidence and G1 remain pending before physical T034. Keep deferred003 acceptance open for final delivery; rehearse G1 and complete the G2 production-readiness evidence.

**Document validation:** the remaining queue matches all 5 currently unchecked
feature-qualified IDs in the four canonical task files exactly once, excluding the
explicitly verified catalog entries. The detail catalog retains all 81 entries: 5 open
and 76 checked. Operational work and planning gates are
not additional task IDs. Relative links and prerequisite ordering are checked separately.
This is documentation validation, not new runtime, CI, device or provider evidence. 001/T129/T132/T136/T137/T152, 002/T064 and 003/T081/T082/T083/T084/T089/T090/T091/T092/T135 were closed only by documented local double-QA execution. No PR was merged or production deployment performed in this run. The synthetic LAN candidate is ready for manual acceptance.
