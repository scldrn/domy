# Integral Remediation and Completion Plan

**Detailed execution companion:** [integral-execution-backlog.md](integral-execution-backlog.md)
records the current 81-task snapshot, each task's work/RED/dependencies/exit, held branches,
the two latest PR #32 failures and operational obligations beyond the checkbox count.
It supplements, not replaces, the canonical feature artifacts and task IDs.

## Current diagnostic slice and reserved follow-up — 2026-10-19 UTC

T141 is merged on `321ef93`. T153 now has native research, aligned R14/plan/quickstart,
scoped pre-implementation analysis, actual-monolith/PG-trigger and ordinary-error RED,
and 21 focused green tests. Full local check, 967 tests (242/531/194), 91 first-attempt
e2e (5.1 minutes) and build pass. Final review/convergence/publication remain; do not check it yet.
Keep it separate from preserved account integrity, T152 SDK context and the held
session/transport PRs. Accessibility PR #32's latest CI `39285191879` failed:
95 passed/one failed/one flaky, build skipped. Preserve both failures and keep the PR held.

The additional proven development recovery-link log is IV-41, owned by new T155,
Phase19 of 001. It remains open and requires its own test-first design/implementation
slice after the diagnostic boundary is verified. This is not an extra product feature
or permission for a public development mailbox. Existing owner CSV/photo decisions
and physical/infrastructure obligations remain authoritative, not reopened here.

**Baseline:** `9006db32270338670e51c609c6b67ba2750fec83`.
**Prepared:** 2026-10-18 UTC. **Authority:** Samuel requested the plan and then
authorized starting the recommended local work. On 2026-10-19 UTC he explicitly
authorized per-slice commit/push/PR/squash, conditional on review and clean local/latest-head
CI gates; infrastructure/deployment remain separate approvals. **State:** execution
started; not a readiness certificate.

## Objective and scope

Resolve every actionable finding IV-01–IV-34 in
[the consolidated audit](integral-verification.md), finish the approved 001–004 scope,
retain historical regressions and prove operational readiness. The planning baseline
had **76 open Spec Kit tasks**: 22 in 001, 2 in 002, 17 in 003 and 35 in 004.
Historical planning checkpoint: after local T141 completion (2026-10-19 UTC),
**75 remained open**: 21/2/17/35. The current count is 81 in the execution companion;
the following unpublished-T141 sentence is preserved as that checkpoint's history.
T141 is verified locally, not yet committed or published; the mapping below preserves
the full original queue, including this completed first task.
Checked historical tasks are regression obligations, not work to delete or rebuild.

This is the project-level execution/dependency plan, not a new feature or a substitute
for each feature's spec/research/data model/contracts/plan/checklists/tasks. Before a
slice changes behavior, align its affected artifacts, run read-only analyze, resolve
its CRITICAL/HIGH specification/design issues, then implement tests first and converge.
No unresolved design is silently marked approved because a roadmap exists.

“No technical debt” means no known actionable defect, unfinished integration, temporary
workaround, duplicated domain rule, unsafe migration or unexplained test failure is
accepted at closure. It is not a promise that software can be proven to have no unknown
defects. No waiver is assumed; inability to meet a requirement blocks its closure.

## Technical context and non-negotiable constraints

Keep the ratified TypeScript/Node/pnpm workspace, Hono, Drizzle/PostgreSQL, Better Auth,
React/Vite, Zod, private S3 storage and installed test tooling. Use the repository pins,
not invented “latest” versions. One server, database and bucket; no extra service,
repository layer, generic transaction framework or authentication implementation.
No new dependency is justified by this plan. A proven necessity must first be recorded
in the owning plan's Complexity Tracking and approved through the normal workflow.

Preserve integer COP, Bogotá calendar semantics, server-enforced roles, private photos,
device-first courier persistence, fixed session policy and append-only operational
history. Never clear pending work to make recovery easier. Keep all existing seeds,
steps, thresholds, deadlines, retries, workers and complete accessibility assertions.
Capacity tests retain the approved native isolated execution phase.

## Decision and research gates

| Gate | Recommendation / required evidence | Blocks only |
| --- | --- | --- |
| D1 CSV contract | RESOLVED by owner: spreadsheet-safe CSV, documented text transformations and intact numeric COP/date semantics. Test all formula-leading/control/quote/newline cases and actual supported spreadsheet behavior; do not reopen the product choice | Export implementation/verification remains |
| D2 Courier photo access | RESOLVED by owner: current 003 FR-036, own photos of work still present in the app. Define/test the enforceable active-route/held-work and pending-upload boundaries; no reproduced cache leak is claimed | Technical lifecycle/cache verification and final photo acceptance remain |
| D3 Numeric representation | Decide explicit representable per-field and aggregate bounds across SQL/domain/JSON/UI. Compare retaining int32 fields with validated limits and wider sums against an additive integer-storage migration. No arbitrary business cap, silent truncation or unsafe Number conversion | Monetary implementation and related response contract changes |
| D4 Auth transaction spike | Prove a native transaction-scoped Better Auth/Drizzle path containing guards, credentials/sessions, audit and replay receipt. `transaction:true` or an ordinary after-hook alone is not proof. Error Responses must cause rollback when appropriate | Implementation-ready auth atomicity/replay design |
| D5 Immutable upload spike | Prove conditional object creation capability on test storage and the selected provider, or a DB-row-serialized sole writer with recoverable finalization. Test object-success/DB-failure and interruption. PostgreSQL and S3 do not share a transaction | Upload implementation design and any justified schema additions |
| D6 Existing data | Determine whether any real operational data exists before deployment migration/backfill/repair. Audit proved failure mechanisms, not that production rows are corrupted. Reconciliation is read-only first; never fabricate old events or silently “repair” history | Data-changing migration/backfill/repair execution |
| D7 004 alignment | Reconcile finalized 003 custody/reverts/photos, safe money, settings/replay, token backfill, public worker/cache behavior and trusted proxy topology. Private merchant URLs included in messages must actually work before notification UI is released | 004 implementation after artifact alignment/analyze |

D1/D2 were answered explicitly after the planning snapshot; implementation approval alone
was not treated as choosing them. D3–D7 retain proposed investigations, not certified solutions.
Independent read-only research, regression preparation and unaffected fixes continue.
An unresolved gate prevents implementation of that design, not the whole program.

## Execution sequence and task ownership

Slice labels below are roadmap labels, not replacement Spec Kit task IDs. Each open
task has one primary owning slice. A slice can split into smaller tests/server/web PRs
when necessary; no branch lasts more than two days. A cross-feature change merges in
an order in which every intermediate head is compatible and passes all gates.

| Slice | Owning tasks | Dependency and deliverable | Exit evidence |
| --- | --- | --- | --- |
| S00 Baseline reliability and traceability | 001 T141; 002 T064; 003 T131 | Start here: preserve both distinct failure records, diagnose keyboard highlight with retained trace and controlled real responses; retain T131 as unresolved until causal evidence exists. Phase-qualify duplicate historical IDs, correct present-tense summaries | Deterministic RED/mechanism before any fix; exact keyboard/offline/axe journeys retained. A later pass alone cannot close either investigation |
| S01 Auth surface and input/lockout | 001 T130/T139/T146 | Inventory every delegated plugin mutation, deny or constrain unused bypass paths without inventing permissions. Validate unknown auth/cursor input. Serialize last-owner invariant across different target owners and lockout counters | Real PG: sole owner, two-owner/mixed ban-demotion, link-role races, five simultaneous failures, malformed inputs, same-origin/CSRF and role matrix |
| S02 Atomic account actions and link intent | 001 T131/T132; 003 T135 | D4 then auth transaction/receipt design, including client-generated creation identity and all credential/session consequences. Bound receipts to actor/operation/target and define changed-body replay. Fix account dialog authoritative initialization and inactive existing links | Audit/credential/session failure rolls back the defined mutation; A→B→A and concurrent retries are exactly once; held-GET browser save preserves untouched link |
| S03 Master-data concurrency/replay | 001 T134/T135/T142/T148 | Shared transactional locking/diff/replay rules, not six divergent endpoint patches. Serialize cross-table name/alias identity checks and related pickup defaults. Replay accepted creations before later validity guards | Explicit lock-barrier PG tests: same-ID 201/200, truthful before/after chain, cross-table clashes rejected, day rollover replay and no false visible no-op edits |
| S04 Atomic bulk identity | 001 T133 | Align duplicate-row and mixed-existing-ID semantics before code. Prefer refusal of ambiguous duplicate row IDs; preserve legitimate batch replay and one event per actual creation | Existing+new and repeated-row-ID RED cases; all-or-none on invalid input; concurrent batch/individual registration and original-result replay |
| S05 Financial correctness | 001 T138/T147; 002 T063 | D3, then storage/schema/domain/JSON and wider route aggregates as one compatible change. Preserve registered fee/zone unless the actual pricing inputs change | Boundary sums never wrap/truncate; route creation cannot commit then fail serialization; catalog/rate update plus instructions-only edit preserves fee; all payment modes remain consistent |
| S06 Response/storage boundaries | 001 T136/T137 | Infer real Hono responses, preserve approved shared schemas; use the auth library's own contract where Hono is passthrough. Validate device/form data without duplicating response types | Compile-time drift rejection; valid-JSON invalid-shape/old/malformed drafts recover without losing pending work; no replacement of casts with another unchecked assertion |
| S07 Complete form and query behavior | 001 T140/T143/T144/T145/T149 | Preserve action lifecycle until acknowledgment; initialize from authoritative data, distinguish loading/error/empty and respect dirty user intent. Complete prior-recipient neighborhood fill and Spanish accessible/audit text | Actual browser held/failed GET, two inline creations, lost acknowledgment, invalid draft, no unintended deletion/unlink, full keyboard/axe and accurate Spanish feedback |
| S08 Photo evidence and access | 003 T133/T134 | D2/D5, then immutable bytes/first-arrival metadata, authorized lifecycle and retention behavior. Resolve existing-photo compatibility before any digest/upload-state migration | Actual PG/S3: concurrent identical/different bytes, lost response, both-store failure windows/interruption, retention retry, before-record refusal and same-browser identity isolation |
| S09 Safe and complete exports | 001 T128; 003 T085/T086 | D1 and S05/S08 contracts; finish courier-record/route/handover datasets and delivery columns in the existing shared serializer and owner UI | Spanish headers, exact numeric/date semantics, formula safety, authorization, corrected/reverted/no-op outcomes and complete row counts; no public photo URLs introduced |
| S10 Maintained toolchain | 001 T129 | Reassess actual advisory paths/exposure against primary sources at execution time; prefer compatible upstream resolution. Preserve pins until a demonstrated correction is designed | Frozen install, production/development audit inventory, all four gates; no suppression, blind override or unnecessary runtime package |
| S11 Courier contract/security/invariants/capacity | 003 T081/T082/T089/T090/T091/T092 | Extend existing tests instead of recreating working coverage. Fill route/office/return/late/duplicate record and ownership matrix after affected fixes | Exact endpoint/error/shape coverage; real PG invariants; busy-day snapshot <500 ms and batch50 <2 s under unchanged policy; one stored row per sent identity |
| S12 Courier usable primary flows | 003 T083/T093 | Reconcile ≤3 taps from Mi ruta with required review, confirmation and optional proof/collection. Align affected UI plan before behavior; no hiding confirmations or redefining tap counting to pass | Count route→committed-action taps including confirmations; 360/390 px standard/high contrast, required dark review, one hand, 48px hit targets, keyboard and full axe |
| S13 004 foundations | 004 T001–T008 | D7 after shared fixes. Add server-generated codes to single/bulk/merchant creation and existing rows safely; configure support, real proxy-bound limits/no-store/noindex, public layout and worker isolation | Migration from nonempty previous schema; unique stable 128-bit codes, no secret in logs/monitoring, forged forwarding-header tests and no private public-cache data |
| S14 004 tracking | 004 T009–T016 | S13 and current 003 operational state. Implement pure public projections and queue estimate, endpoint and phone UI | Every kind/status/decision/revert, privacy allowlist, expiry and uniform invalid links; anonymous real journey and <3 s at the specified weak network |
| S15 004 merchant page | 004 T023–T029 | S13/S14 and photo contracts. Plan alignment explicitly schedules this dependency before releasing messages containing its URL; preserve task IDs | Merchant isolation, 30-day list/detail boundary and explicit photo rule, invalidated old codes, inactive merchant, corrected totals/attempts and real private-storage proof |
| S16 004 manual notification | 004 T017–T022 | S14/S15 user entry points must work. Align task dependencies before changing the original execution order. Compose/open/copy manually; durable retry of notification mark, never automated sending | Same-tap wa.me/clipboard, ≤2 taps per merchant, 20/21 boundary, missing phone, new-only/all, void exclusions, response loss and first notified timestamp |
| S17 Public hardening and mobile acceptance | 004 T030–T032/T034; 003 T087 | Complete local technical matrix before owner validation. Do not treat a random-code scan as entropy proof or a Chromium viewport as Safari evidence | 21 courier and 14 public quickstart scenarios on actual phones, native installed notifications, airplane-mode/reopen/expiry and measured user-time results |
| S18 Operational readiness | 003 T084; 004 T033; OP-01–OP-05 below | Prepare approved production artifacts, runbooks and owner inputs; external provisioning requires exact target/cost/authority. No public production deployment from this planning approval | CSP compatible with built worker/manifest/photo previews, private bucket/retention, recovery mail, backup/restore, operational ownership and pilot handoff |
| S19 Final delivery | 003 T088; 004 T035 | All earlier required exits, including T131 causal closure, resolved. Complete feature-level convergence after implementation | All four gates and clean latest delivery-head CI, no flaky first attempts, full acceptance trace matrix and owner release approval |

S00's keyboard investigation is the first implementation filter because the current
global gate is red; this does not demote the critical auth findings or allow release
before their fixes. T131 work may require future retained runner evidence and must
not be “closed by timeout budget.” Preparation of other independent slices can proceed,
but implementation/merge sequencing must follow their explicit dependency gates.

## Phase 0 research decisions and rejected shortcuts

| Area | Chosen planning direction | Alternatives rejected / unresolved |
| --- | --- | --- |
| Auth | Inventory native admin surface, then prove one native transaction boundary for guard+mutation+audit+receipt with actual installed APIs | External after-the-fact audit is already broken. Enabling adapter transactions alone or putting audit in an ordinary after-hook does not prove a shared transaction. A new auth system/wrapper service is rejected |
| Master data | Native PostgreSQL locking/constraints; consistent lock order; authoritative before-values inside the write transaction; preserve existing audit receipts | Independent prechecks and target-row locks alone cannot enforce cross-entity/global invariants. No generic repository/lock framework |
| Photos | First acknowledged bytes/metadata immutable; recoverable two-store protocol evaluated through D5 | No distributed-transaction claim. SDK support for conditional PUT is not evidence that the configured test/production provider honors it; no blind overwrite/retry |
| Money | One domain representability/checked-arithmetic contract propagated through storage and response types | No floating point, silent bigint-to-Number cast or business maximum invented to fit a column. D3 precedes implementation |
| Reliability | Retain failed trace, explain actual focus/highlight/session/sync sequence, add a controlled failing case and fix only the demonstrated layer | No sleeps, forced clicks, dismissed overlays, longer deadlines or retry-green closure |
| 004 | Pure allowlisted views in the existing domain and app; public pages cannot inherit private worker cache behavior; messages wait for working merchant links | No second app, automatic WhatsApp API or token lookup using human guide numbers |

These are design constraints, not completed spikes. Store each resolved decision in
its owning `research.md`, with rationale, alternatives and evidence, then align
`data-model.md`, `contracts/`, `plan.md`, checklist and quickstart as applicable.
No formal Phase 1 design sign-off is claimed for a gated slice today.

## Operational work not represented by a runtime feature task alone

These OP labels identify required planning deliverables, not completed Spec Kit tasks
or permission to change infrastructure. Before operational code/provisioning, express
the scope in approved artifacts/tasks and analyze it; preserve existing feature IDs.

| Item | Deliverable / prerequisite | Acceptance |
| --- | --- | --- |
| OP-01 Deployment/recovery runbook | Review production Compose/Caddy/runtime/networking/configuration, immutable release identity, migration procedure, restart/health checks and previous-version compatibility | Rehearsed clean install and upgrade in an isolated production-like environment; no exposed DB/Adminer; forward-fix or restore procedure defined before migration |
| OP-02 Backups and restore | Client-owned daily snapshots plus nightly PG dump to approved storage; retention, access and failure alert documented | Restore a backup into an isolated DB and verify counts, event relationships and representative flows. A successful dump is not proof of restore; record agreed recovery objectives |
| OP-03 Storage/email/monitoring | Private photo bucket and 12-month lifecycle; stable VAPID keys; verified recovery email; sanitized error/health monitoring | Actual authorized environment receipts; no secrets, tokens, session data or recipient PII in logs/artifacts/monitoring; expired photo behavior and recovery link tested |
| OP-04 Business/privacy inputs | Confirm inferred/missing rates, real directories/office/support, courier consent, client-owned accounts, final brand asset disposition | Owner records decisions; temporary wordmark remains explicitly provisional until approved artwork exists. No fabrication of consent or business rates |
| OP-05 Training and pilot | Dispatcher walkthrough, real-device acceptance, pilot support/incident owner, recovery rehearsal and acceptance evidence | Measured required SC user timings and scenario results; a pilot outcome measured later is not misrepresented as a prelaunch test pass |

## Per-slice method and definition of done

1. Record owning feature/task/finding, exact approved contract, touched files and
   expected regression. Keep the slice small; align plans before deviations.
2. Read-only analyze: requirement/task coverage and all nine constitutional principles;
   stop that slice on unresolved CRITICAL/HIGH artifact/design issues.
3. Add the failing regression first using real PostgreSQL/storage/browser as needed.
   Keep RED evidence bounded and private. A diagnostic script is not a permanent test.
4. Implement the smallest shared/native correction, then refactor without changing
   behavior. Include every affected caller, not just the reproducer's endpoint.
5. Prove expected and hostile paths: normal/no-op, response loss, concurrent and late
   replay, cross-actor/target identity, stale version, invalid input, partial failure,
   revoked session and retained form/offline data, where relevant to that mutation.
6. Run focused tests, then sequential complete `pnpm check`, `pnpm test`,
   `pnpm test:e2e`, `pnpm build`. Do not compete heavy suites or weaken resource policy.
   Keep failed attempts as evidence. Expected negative-auth diagnostics are distinguished
   from unexpected warnings; no suppression to satisfy wording.
7. Converge against current artifacts, append only genuinely uncovered tasks, complete
   their tests/fixes, and update checkboxes only after their actual scope passes.
   A partial task remains unchecked even when its first subcase is fixed.
8. Respect the owner's explicit per-slice publication/conditional-merge authorization.
   Request approval for scope expansion or infrastructure/deployment. Preserve unrelated working changes;
   never sweep the whole dirty tree into a commit. Rebase/update only when safe, require
   clean latest-head CI, squash, verify resulting main tree/CI and retain historical
   failure receipts. No uncommitted future slice is bundled to “save time.”

## Integration and migration safeguards

Use additive reviewed Drizzle migrations only when the selected design needs one.
Rehearse upgrade from the previous schema with existing rows, not only a fresh test DB.
Preserve client identifiers, financial values, custody and append-only events. Token
backfill must generate stable secrets exactly once and enforce uniqueness/not-null only
after valid backfill; do not expose token material in SQL failure logs or public traces.
Inventory preexisting photos before adding any digest/state field; no guessed hashes.

Database rollback cannot undo a delivered email/push, browser clipboard action or S3
write. Define recoverable post-commit/finalization behavior and failure feedback rather
than claiming an atomic operation across independent systems. Production repair of
historical inconsistencies requires separate evidence, owner approval and reconciliation.

## No-debt exit contract and evidence ledger

Each IV entry must link to its owning task(s), approved design, regression file/case,
RED evidence, verified fix, all-gate delivery head and convergence result. Maintain the
same mapping for all 137 FRs/150 acceptance scenarios; classify each as automated,
physical acceptance, operational evidence or post-pilot outcome. Task counts alone are
not completion evidence. Add newly discovered defects to the same ledger/owning scope;
do not restart a series of vague whole-project reviews or conceal follow-up work.

Final sign-off requires zero open actionable audit findings or unfinished approved
feature work; no unexplained flaky failure; no temporary instrumentation, TODO fix,
unsafe cast, duplicated rule or unapproved dependency/advisory exception. A dependency
advisory that cannot be safely resolved remains a documented blocker unless the owner
explicitly changes the acceptance contract; this plan does not pre-accept an exception.
Physical/device/backup/provider/privacy evidence must exist before production release.

The user receives one consolidated completion report with scenario coverage, actual
gate/CI hashes, remaining pilot-only measurements, deployment/recovery instructions
and explicit owner acceptance. No “perfect/zero unknown bugs” certificate is issued.
