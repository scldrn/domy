# Integral Verification and Completion

Current execution details and task-by-task closure criteria are in
[integral-execution-backlog.md](integral-execution-backlog.md). It preserves the81-task
snapshot and the latest held CI failures; baseline sections below remain dated evidence.

## T153 execution and additional privacy finding — 2026-10-19 UTC

Current narrow branch: `001-fix-error-diagnostics`, based on `321ef93` (T141 merged).
Historical sections below retain their original baseline/authority. Publication is now
conditionally authorized per slice, not production deployment. T150–T154 are reserved
task IDs from preserved auth/session/accessibility work; this branch does not falsely
mark their absent implementations complete. PR #30/#31 require reconciliation; #32's
latest-head CI39285191879 failed(95 passed/one failed/one flaky; build skipped).
No flaky nominal-green run is merge evidence.

**IV-39 / T153, CRITICAL, contradicts FR-041/R14/Constitution IX:** real driver `22P02`
contains a request value in its message; current fallback logs/reports preserve it.
Permanent actual-monolith/PG-trigger RED passes generic HTTP500 and transaction rollback
but fails log privacy. An ordinary exception also fails privacy. The scoped correction
uses fixed classes/messages, native validated SQLSTATE and bounded verified source
locations;21 focused tests pass. Full local check,967 tests,91 first-attempt e2e and
build pass; final review/convergence/publication remain, so T153 is still unchecked.
This is not evidence about automatic Sentry context(T152).

**IV-41 / T155, CRITICAL, contradicts FR-030/R5/R14/Constitution IX:** native Better Auth
with a disposable migrated PostgreSQL and the actual development `createMailer`, without
an API key, successfully requests recovery and logs the actual URL with its nonempty
bearer. Captured results were reduced to booleans, not printed tokens; no customer data,
external delivery or provider account was involved. The source logs `{ url: message.url }`.
No approved development exception permits secrets in logs. This is distinct from the
request-path (T151), error fallback (T153) and SDK context (T152) surfaces.

Scoped mail convergence inspected FR-030, FR-041, US7/AC2, R5/R14 and all nine principles:
one new contradiction/CRITICAL, no duplicate existing task. Outcome `tasks_appended`:
only T155 appended in Phase19, no existing checkbox changed by that assessment.
Permanent RED, design alignment, implementation and all gates remain future work.
This checkpoint is not whole-feature/global convergence or certification.

## Status and authority

**Current execution addendum (2026-10-19 UTC):** T141 (`321ef93`, PR #29), T153 (`fedbb63`, PR #33),
and T154 (`33e4797`, PR #32) are merged into `main` with clean prior/post-merge CI.
The separate `003-fix-session-recovery-readiness` branch (PR #31) resolves 003 T131:
it reproduces the pending-session dependency and cancels session reads on native
offline events and Query cancellation, preserving existing local fallback and authoritative
refusals. Rebased on `main` (`33e4797`), it inherits the T154 modal-notification scan stabilization.
PR #30 remains held separately for transport verification.

**IV-40 — modal notification scan race (T154):** merged into `main` via PR #32 (`33e4797`).
Base UI excludes aria-live regions from background hiding; Sonner is such a region.
`fixtures.ts` was corrected to stabilize accessibility scans with open modals/notifications without
dropping focus or user-expanded stacks, alongside fixing CI-LOCK and CI-POINTER.

Preserved unmerged findings remain open in the same inventory:

| ID | Finding and owning task |
| --- | --- |
| IV-35 | Native credential-write failure logs raw SQL/parameters and leaves an orphan user; actual trusted app/disposable PG RED, preserved T150 and atomicity T131. |
| IV-36 | Native emailed recovery GET returns 302 but logs its bearer path; preserved real-callback RED and T151. |
| IV-37 | Separate full-gate day-summary transport timeout led to held PR #30/T136; no claim it shares the recovery/modal causes. |
| IV-38 | CRITICAL, FR-041/R14/Constitution IX: native SDK default request/transaction metadata contains synthetic bearer/query values despite a safe Error. Actual Chromium/loopback intake additionally shows arbitrary message/cause and stack URL values surviving a context-only mask. T152 requires full real-app/browser envelopes and a reviewed privacy policy; these SDK probes are not a fix. |
| IV-39 | Resolved on `main` via PR #33 (`fedbb63`, T153 diagnostic boundary). |

All new probes use runtime-generated synthetic values and disposable/local/in-memory
intakes, without external reporting or printed payloads/secrets. No customer leak is
claimed. CSV-safe-for-Excel and own/current-work-only photo choices are explicitly
resolved; deployment/infrastructure remain outside authority. Subsequent baseline
paragraphs and metrics are historical wherever they differ from this addendum.

**Status: NOT READY FOR GLOBAL SIGN-OFF.** Baseline source is
`9006db32270338670e51c609c6b67ba2750fec83` (2026-10-17 in America/Bogota).
This is one project-level verification/completion stage, not a claim that everything
has already been audited or corrected. Samuel explicitly included implementation of
feature 004 after the initial inventory showed it had not started.

Review authority covers investigation and local verification. The explicit follow-up
includes completing 004 locally within this stage. Production changes still follow
specify/clarify/plan/checklist/tasks/analyze/implement/converge, tests first for behavior.
Commit, push, PR and merge remain separate owner decisions. One overall stage does not
override short-lived branches and small coherent PRs or permit weakened quality gates.
No production code, test policy, dependency or database schema has changed in this audit.

**Remediation follow-up (2026-10-19 UTC):** Samuel subsequently authorized starting
the recommended local work. The ordered plan is
[integral-remediation-plan.md](integral-remediation-plan.md). T141 is being verified
on `001-fix-keyboard-readiness`: deterministic initial-empty-response RED retained
in `.git/t141-keyboard-red/`, native keyboard navigation correction in the test,
20 focused passes, fresh check, 948 unit/integration passes, 91 first-attempt e2e
passes (5.1 minutes) and build. T141 is complete locally; 75 program tasks remain
open. The exact scoped review is in 001 `quickstart-results.md`. Historical audit
failures and all other findings remain recorded below; no global convergence is
implied. No commit, remote CI, publication or merge has been performed for this slice.
Samuel subsequently answered “autorizo” to per-slice commit/push/PR/squash with review
and clean local/latest-head CI gates (2026-10-19 UTC). This resolves publication authority,
not the pending CSV/photo choices or production infrastructure/deployment acceptance.

## Completion contract

A requirement is not complete because its task is checked or because CI is green. Each
in-scope requirement/acceptance scenario must have current implementation, integration
wiring and suitable passing verification, or an explicit unresolved status. Historical
corrections must retain their regression coverage. New ideas must be traced to an
approved requirement; future/unapproved scope is not silently implemented.

The final stage cannot be signed off until all of the following hold:

1. The approved 001–004 scope is implemented and connected from domain through database,
   API, browser and user-visible navigation, with contracts and operational exports aligned.
2. All actionable findings are resolved with regression evidence. No HIGH/CRITICAL
   finding or known functional omission remains. Lesser risks are not silently accepted;
   any exception requires the owner's explicit decision and bounded rationale.
3. All four gates pass on the actual delivery head; CI logs are checked for failed first
   attempts, retries, unexpected warnings and post-action failures. A retry-green run is
   not recorded as clean and a historical flaky run is never erased by later successes.
4. Real Android/iPhone scenarios, notification behavior, touch targets, tap budgets and
   user-time measurements have recorded evidence. Chromium emulation is not iOS validation.
5. Production readiness has evidence: private storage/lifecycle, validated configuration,
   recovery email, appropriate headers, backup/restore, client-owned accounts and required
   business/privacy approvals. No external infrastructure configuration is assumed verified.

## Baseline inventory, not verification coverage

| Feature | FR identifiers | Acceptance scenarios | Checked / total tasks | Baseline state |
| --- | ---: | ---: | ---: | --- |
| 001 Shipment registration | 44 | 50 | 127 / 127 | Implemented; checked tasks do not exclude newly found export-security risk |
| 002 Routes and dispatch | 27 | 30 | 64 / 64 | Implemented; newer courier/custody extensions must stay integrated |
| 003 Courier app | 42 | 49 | 118 / 132 | US1–US7 implemented; 14 open tasks including T131 |
| 004 Tracking and merchant communication | 24 | 21 | 0 / 35 | Planned, not implemented; explicitly included in this closure stage |
| Total | 137 | 150 | 309 / 358 | Inventory counts only, not 137 verified requirements |

These counts describe the baseline before new audit follow-up tasks. The audit appends
001 T128/T129 and 003 T133 without rewriting historical tasks or reviewer checklists.
No full semantic coverage percentage or feature-wide convergence is claimed.

## Confirmed findings and existing work

| ID | Severity / classification | Evidence | Required follow-up |
| --- | --- | --- | --- |
| IV-01 | HIGH, partial CSV security | `apps/server/src/lib/export.ts` `toCsv` returns a literal `=1+1` cell. Existing export tests cover commas/quotes, not formula-leading text | New 001 T128; agree spreadsheet-safe/text-round-trip contract, write failing regressions, then correct shared serialization |
| IV-02 | MEDIUM project risk, dependency review | Registry audit reports `source-map-js@1.2.1` high advisory GHSA-68fv-2mgg-jv7q and `esbuild@0.18.20` moderate GHSA-67mh-4wv8-2f99, both development paths | New 001 T129; assess exposure and compatible upstream correction, no blind overrides or suppression |
| IV-03 | HIGH, missing functionality | 003 FR-042 and contract export additions versus `routes/export.ts`, `lib/export.ts`, `routes/history.tsx`: no courier-records/routes/handovers datasets or delivery export columns | Existing 003 T085/T086; not merely an unchecked marker |
| IV-04 | HIGH, partial UX conformance | From route: open stop → register delivery → review → save, at least four taps before typing/photos. FR-038 requires at most three | Existing 003 T083/T093; prove a compliant flow without removing required confirmation or accessible review |
| IV-05 | HIGH, spec/contract inconsistency | 003 FR-036 limits photos to own records of routes still on the phone; contract's photo endpoint and `routes/photos.ts` enforce only own-record ownership | New 003 T133; clarify lifecycle and align contract/plan before implementation. Browser-cache identity isolation is unverified, not a reproduced leak |
| IV-06 | HIGH, unresolved historical reliability | T131 server-recovery first-attempt timeout remains unexplained. Later clean runs are not causal proof | Existing 003 T131; use controlled evidence and future retained runner traces, no guessed fix or rerun-until-green |
| IV-07 | HIGH, missing approved feature | 004 public tracking, merchant link and WhatsApp notification workflow have no mounted implementation in `app.ts`/web routes | Existing 004 T001–T035; align artifacts with 003 as built before implementation |
| IV-08 | Partial verification, not demonstrated product failure | Dedicated courier contract/security/scale tests and full mobile/tap matrix are not complete | Existing 003 T081–T083/T089–T093; reuse proven existing coverage, add only missing cases |
| IV-09 | External readiness unverified | Business decision #28 requires snapshots/nightly dump and tested restore before pilot; no repository backup/restore runbook or receipt found | Verify/provision through an approved deployment scope; absence here is not proof of absent external backups |

The CSV probe verifies emitted data only; no real Excel/LibreOffice exploit or data
exfiltration was executed. [OWASP's CSV-injection guidance](https://owasp.org/www-community/attacks/CSV_Injection)
explains why delimiter quoting alone is not formula protection and why spreadsheet-safe
exports and exact machine-readable round trips require a deliberate contract.

Dependency evidence comes from `pnpm audit --json`, `pnpm audit --prod --json` and
GitHub's advisory API. Production audit reports **zero advisories** at this baseline.
Development results are not a demonstrated runtime exploit. Advisory references:
[source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q),
[esbuild](https://github.com/advisories/GHSA-67mh-4wv8-2f99).

## One completion queue, preserving existing task identities

| Workstream | Existing/new tasks | Closure evidence |
| --- | --- | --- |
| Export safety and toolchain | 001 T128/T129 | Regression tests, compatible dependency inventory/audits, approved risk disposition |
| Photo lifecycle/privacy contract | 003 T133, complementing T090 | Agreed exact access rule, lifecycle and same-browser cache tests, no unsupported leak claim |
| Permissions and security | 003 T081/T090 | Endpoint-to-role inventory including push-config and PATCH settings; own/other courier isolation, batch/body/time/photo/push/session boundaries |
| Custody and exactly-once invariants | 003 T082 | Existing seeded routes test already uses real pickups/deliveries, but lacks the full late/duplicate courier-record and office/return invariant matrix |
| Operational portability | 003 T085/T086 | All documented CSV datasets, delivery columns, owner-only controls and matching UI |
| Contract and pure UI rules | 003 T089/T092 | Endpoint/error/shape checks plus missing collection/note/notice/action rendering cases; existing delivery-rules/sync-status/scheme tests reused |
| Measured capacity | 003 T091 | Busy-day courier snapshot and 50-record batch measured against original 500 ms / 2 s limits, not inferred from route scale tests |
| Accessibility/usability | 003 T083/T093 | 360/390 px, standard/high contrast, 48 px targets, tap budget, keyboard, full axe and actual phone review |
| Production documentation | 003 T084 | README is partly complete; add/review required CSP guidance and deployment evidence, no automatic checklist closure |
| Historical recovery flake | 003 T131/T132 | T132 retained-trace wiring is implemented; real failed-trace upload unobserved. T131 needs causal evidence before closure |
| Public/merchant functionality | 004 T001–T035 | All three stories, privacy/expiry/code/rate-limit/idempotency/headers, real photo isolation, mobile-network and notification workflows |
| Final acceptance | 003 T087/T088, 004 T034/T035 | Recorded real-device scenarios, measured timings, final four gates and actual-head CI |

T081 is not absent: the role matrix already includes many 003 endpoints. T082 is not
absent: its generator already uses real courier actions. T084 is not absent: README
already describes storage/VAPID keys and lifecycle. T092 has several existing pure
tests. Each needs a gap analysis, not deletion/recreation or unverified checkmarks.

## Historical corrections and scope additions

003 corrective tasks T095–T132 form 38 historical items: 37 checked, T131 still open.
They are inventory/claims to verify, not proof by themselves. Regression areas inspected
and included in the complete suite are:

- T095–T097: accepted no-op action receipts, late/concurrent master-data/account retries,
  empty audit-event filtering before pagination (`master-data.ts`, audit/account tests).
- T098–T102/T112: stored-session boundary validation, withdrawn/unlinked access, one
  actionable refusal, notification/axe lifetime races and modal controls/focus.
- T103–T106/T110/T116: held-return reassignment/release, office custody, immutable pickup
  place, settings action IDs, zero collection on returns and restored return stops.
- T107/T108/T111: isolated capacity sequencing and actual asynchronous readiness, retaining
  seeds/steps/limits and exact pending/history assertions.
- T113–T119: validated push destinations, committed-notice dispatch on later errors,
  renewed-key safety after delayed 410, precise handover notices, no-op reorder and atomic
  acknowledgment chunks. Existing regression cases remain in courier-notices/outbox tests.
- T120–T122/T126/T127: native worker completion, serialized/coalesced synchronization,
  real asynchronous keyboard readiness and maintained CI action runtime/installer.
- T123–T125/T128–T130: append-only revert history, actual changed values, Spanish validation,
  shared pending-stop rule, financial-row scroll preconditions and expanded-toast navigation.
- T131/T132: unresolved recovery timeout versus implemented diagnostic trace retention.

The approved additions in `business-master.md` (I-02/I-03/I-05/E-03/E-04/C-03) are part
of the closure inventory. C-01/C-02/C-03 depend on 004 and are not implemented merely
because registration and courier stories work. Later cash-up/reconciliation/statements,
native live location, automatic WhatsApp Business API, merchant self-service and historical
migration remain outside this stage unless separately specified and approved.

| Business improvement IDs | Trace / current disposition |
| --- | --- |
| I-01–I-07 | Registration/lookups, fees, bulk, typed fields, catalog, aliases and guides map to 001. Recipient autofill, keyboard and catalog/alias gaps are IV-22/23/27/30. I-01's background phrase “duplicate shipment” has no explicit duplicate-existing-shipment action in the feature intent or current detail UI: reconcile that wording before treating it as an approved extra action. I-02's mention of size-based pricing is bounded by decision #2: size is informative only now |
| D-01–D-05 | 002 route building, dispatch, board, alerts and reassignment; 003 supplies actual courier changes/custody |
| E-01–E-05 | 003 proof/time/location, exceptions/decisions, payment splits, disbursement capture and offline synchronization; evidence integrity and final validation remain open |
| C-01–C-03 | 004 tracking, grouped manual WhatsApp message and merchant page: all still unimplemented |
| K-01–K-04, M-02 | Single database, search, audit, backups/export and frozen historical fees: implementation exists except operational readiness and the documented export/audit/fee defects |
| I-08, C-04, F-01–F-06, M-01 | Explicit future/Phase 2/Phase 3, not silently added to this closure. “Mi día” is an estimate, not F-01 reconciliation |

## Constitutional review

| Principle | Evidence / remaining limitation |
| --- | --- |
| I Simplicity | Existing modular monolith; no new service/dependency added by this audit. Remediation must prefer shared/platform primitives |
| II Field data | IndexedDB-before-send, real idempotency regressions and serialized sync present; T131 and broader invariant closure remain |
| III Shared domain | Record resolution, lifecycle, progress and day summary are shared; no new duplicated rule introduced |
| IV Transactions/history | Transactional records/receipts, append-only events and DB constraints present; exhaustive late/custody verification remains |
| V Boundaries | Strict TypeScript, noUncheckedIndexedAccess/exactOptionalPropertyTypes, Zod boundaries and persisted-data regressions present |
| VI Test-first | Current full gates are baseline evidence only; behavior corrections and 004 require RED before implementation |
| VII UX | Spanish UI and existing axe checks; tap-budget mismatch and physical mobile evidence prevent global sign-off |
| VIII Order | Audit on a short-lived local branch, no external publication; historical checklists preserved; no skipped/TODO tests found in the scoped scan |
| IX Privacy/ownership | Auth guards/private storage present; export gaps, CSV risk, photo lifecycle mismatch and deployment/privacy approvals remain |

This checks all nine principles for the reviewed areas; it is not proof of every path
or a certificate that no technical debt exists. No raw client data or `.env` was read;
neither is tracked in git. No running production infrastructure was accessed.

## Verification evidence and limits

- Current `pnpm check`: PASS.
- Current `pnpm test`: PASS, 948 tests (242 domain / 512 server / 194 web), real PostgreSQL.
- Current `pnpm build`: PASS, built PWA/service worker (fresh deep-review run also passes).
- Initial inventory's full `env -u NO_COLOR pnpm test:e2e`: PASS, 90 first-attempt passes in 5.0
  minutes. Original cases, one worker, trace policy, deadlines and axe checks retained.
  Five expected negative-password warnings were observed; no unexpected warnings or
  failed attempts were observed. The T131 recovery case passed in 2.3 seconds, which is
  not a causal reproduction or a correction of its historical runner failure.
- **Fresh deep-review e2e run: FAIL, 89 passed / 1 failed, 5.2 minutes, exit 1.**
  `register-shipment.spec.ts:185`: the ordinary keyboard-only case waits five seconds
  for the visible Bullish Hype option's `data-highlighted` attribute, which remains
  absent. Its two controlled-delay variants pass. No retry or second full run was
  used to replace this result. Trace and error context are retained in ignored
  `.git/integral-e2e-keyboard/`; see IV-27. The earlier passing run is historical,
  not the current readiness result.
- Last remote main CI at this exact baseline is clean:
  [39081231438](https://github.com/scldrn/domy/actions/runs/39081231438), 948 tests and
  90 first-attempt e2e (12.9 minutes). This is not a new CI for the uncommitted audit docs.
- Real iOS/Android acceptance, production headers/provider configuration, backup restore,
  learner/timing outcomes and absence of every possible defect are **not verified** here.
- No code correction, new dependency, task completion, commit, push, PR or merge is
  claimed by this report. No production branch change is authorized by a review finding alone.

## Handoff and decisions needed before behavioral remediation

### Deep-review evidence added on 2026-10-18 UTC

The owner requested end-to-end depth after the initial inventory. The following are
additional **reproduced** failures, not fixes. Disposable PostgreSQL 18 instances use
the actual migrations, Better Auth and Hono application; no operational data is used.
Working diagnostic scripts are ignored under `.git/integral-*.mts`, not production tests.

| ID | Severity / source | Reproduction and observed result |
| --- | --- | --- |
| IV-10 | CRITICAL, Constitution IV/V; 001 FR-032/FR-036; 003 FR-002 | Authenticated, same-origin `POST /api/auth/admin/update-user` with `data.role=dispatcher` demotes the only owner: HTTP 200, zero active owners, zero user audit rows. The same endpoint changes a linked courier account to dispatcher (200), bypassing the dedicated set-role guard. `forwardAudited` delegates arbitrary data but only diffs name/email; its update and audit also do not share a transaction. Initial requests without Origin were correctly refused; the positive reproduction supplies the actual trusted Origin. This is an owner-authorized administrative request bypass, **not** an unauthenticated privilege escalation. |
| IV-11 | CRITICAL, Constitution IV; 001 FR-032/US7 AC6 | With two active owners, simultaneous same-origin `admin/set-role` requests demoting each account both return 200; the database then has zero active owners. `isLastOwner` checks outside a serialized transaction. |
| IV-12 | HIGH, 001 FR-033/US7 AC3 | Five simultaneous wrong-password requests for one existing account return five 401 responses; persisted `failed_sign_in_count=1`, no lock. The handler computes the increment from a stale pre-authentication read. This bypasses the required per-account five-failure lock; it does not prove bypass of every independent library/IP limit. |
| IV-13 | HIGH, Constitution III/V; 001 FR-012; 002 FR-018 | Shared shipment schema accepts a confirmed COP 3,000,000,000 fee; POST returns 500 and inserts nothing (PostgreSQL integer overflow). Separately, two individually valid COP 1,200,000,000 COD shipments each return 201; creating a route containing them commits the route but returns 500, and the routes board also returns 500. `codToCollect` casts SUM to int32. Monetary validation, storage and aggregate bounds are inconsistent. No hard business maximum or schema migration is silently selected by this audit. |
| IV-14 | MEDIUM, Constitution V; 001 access boundary | Sign-in body `{email:123,password:"bad"}` returns 500 before library validation, because `bodyOf` casts unknown JSON and calls `trim` on the unvalidated value. This demonstrates an input-validation failure, not a login bypass. |
| IV-15 | HIGH, 001 FR-008 | After registering at COP 13,000, changing that neighborhood's catalog zone, then PATCHing **only instructions** with the unchanged shipment version returns 200 with fee COP 15,000 and a changed rate-zone snapshot. `pricingPlace` resolves the current catalog even though no pricing field was edited. |
| IV-16 | CRITICAL, Constitution IV; 001 FR-016/FR-020/FR-042 | Bulk confirmation containing one existing shipment UUID and one new UUID returns 201 and inserts a second `created` event for the existing shipment. Two rows sharing a new UUID likewise return two successful row results with the same guide and insert two creation events for one stored shipment. `insertShipments` inserts events for all requested rows rather than only inserted rows; schema does not reject repeated row IDs. No random UUID collision is claimed; this is a validated request boundary and replay/integrity defect. |
| IV-17 | MEDIUM, Constitution V; 001 search contract | A base64url cursor containing `["not-a-date","not-a-uuid"]` passes JSON decoding and returns 500 from PostgreSQL casts instead of a validated 400. |
| IV-18 | HIGH, Constitution II; 001 FR-042 | Create a rate entry effective today: 201. Move the injected clock one day, resend the exact ID/body: 400, because date validation runs before existing-ID resolution. Similar pre-replay catalog checks in rate/neighborhood routes require regression coverage; only the date case is reproduced here. |
| IV-19 | CRITICAL, Constitution II; account administration | Same-origin ban(A), unban(B), delayed replay of ban(A) all return 200 and leave the account banned. The UUID supplied on the request is ignored and the web account API does not send one. This reproduces the original late-retry defect in user administration, which does not use the corrected master-data receipts. |
| IV-20 | CRITICAL, Constitution IV; 001 FR-036 | A disposable-database trigger intentionally rejects audit inserts. Updating an account name then returns 500 but the new name remains committed. This fault injection confirms that `forwardAudited` can persist an account change without its audit event; the trigger is removed and the entire database disposed afterward. |
| IV-21 | HIGH, 001 FR-026/FR-038 | Actual Chromium and migrated PostgreSQL: hold the edit-neighborhood detail GET, change its name, save before GET completes. PATCH returns 200 and existing variants become `[]`. `EditNeighborhoodDialog` initializes variants empty and allows saving while their authoritative load is pending; failed loads also have no readiness guard. |
| IV-22 | HIGH, 001 FR-026/FR-042 | Actual Chromium and PostgreSQL: create two differently named neighborhoods from the same mounted shipment field. Responses are 201 then 200, same UUID, both return the first name. Inline `AddNeighborhoodDialog` generates its creation UUID once and never rotates it after acknowledgment. |
| IV-23 | MEDIUM, 001 FR-004 | `RecipientAutocomplete` fills name, phone and address but explicitly sets `recipientNeighborhood` to null, despite the server returning the previous neighborhood. The advertised recipient-data autofill is incomplete and requires choosing the neighborhood again. Source-confirmed; not a claim of incorrectly stored neighborhood data. |
| IV-24 | HIGH, Constitution V; 001 FR-038 | Actual Chromium: sessionStorage draft `{id:<uuid>,values:{}}` parses as JSON, is trusted by `useFormDraft`, then crashes registration at a string operation. The page offers a generic connection/retry error; retry rereads the same invalid draft. Persisted shipment/bulk form shapes need runtime validation and a recoverable, non-destructive invalid-data path. |
| IV-25 | MEDIUM, 001 FR-034/FR-036; Constitution VII | Actual audit page shows `name: …` in English; `fieldLabels` translates only two office fields. Shared mobile sidebar also retains English accessible strings (`Sidebar`, `Displays the mobile sidebar.`, `Toggle Sidebar`); these are user-facing even when visually hidden. Unused English defaults in UI scaffolding are distinguished from reachable strings. |
| IV-26 | HIGH, 003 FR-002/T094 | Actual Chromium/PostgreSQL: hold the courier-list GET, open an already linked account's edit dialog, release/load the real list, save without selecting unlink. PUT returns 200 and the courier's `user_id` becomes null. `AccountDialog` initializes selected link before readiness, then compares it against the later loaded link. Source also shows the active-only list omits existing links to inactive couriers; that additional case still needs its regression. |
| IV-27 | HIGH, Constitution VI/VII; 001 keyboard acceptance; 003 T126 | Fresh full e2e: 89 pass and keyboard-only registration fails at `register-shipment.spec.ts:185`. The desired option is visible but never highlighted within five seconds; both delayed variants pass. Trace retained, no rerun-until-green. This is a current gate failure distinct from T131 and from the earlier fee-readiness failure; the precise app-versus-test cause is not yet established. |
| IV-28 | CRITICAL, Constitution II; 001 FR-042 | With an explicit PostgreSQL advisory-lock barrier at INSERT, two concurrent POSTs creating the same merchant UUID return 201 and 500, not created/replayed success. `auditedCreate` callers check existence before insertion without resolving a concurrent ID conflict. One row remains; this is a failed retry acknowledgment, not duplicate rows. Other master-data creation paths need the same contention matrix. |
| IV-29 | CRITICAL, Constitution IV; 001 FR-036 | Explicit PostgreSQL barriers force two different merchant edits to read the same initial row. Both return 200; both audit events claim the same old name (`Bullish Hype`), although one write necessarily followed the other. Reads used for diffs are not locked/serialized with the write. Master-data history is consequently inaccurate under valid concurrent edits. |
| IV-30 | HIGH, 001 FR-027 | Explicit INSERT barriers: create merchant A named X concurrently with merchant B whose alias is X. Both return 201; the database contains one name X and one alias X belonging to different merchants. Separate-table uniqueness and `checkNames` prechecks do not enforce the cross-table invariant under contention. |
| IV-31 | CRITICAL, Constitution II/IV; 003 FR-023 | Actual migrated PostgreSQL and private S3Proxy: upload photo UUID once (204), then upload different bytes under that same UUID an hour later (204). Owner GET returns the second bytes and `uploadedAt`/`byteSize` are replaced. This is a second effect for the same mutation key and silently replaces evidence. The existing replay test sends identical bytes and checks only response status. No other-account access is claimed. |
| IV-32 | MEDIUM, traceability/documentation debt | Feature 002 declares T057 and T058 twice in different phases. Its quickstart still describes direct task-status stand-ins already replaced by real records; the status feature table still describes PR #28 as awaiting merge while the newer next-step section correctly says merged. Preserve historical IDs/checkpoints; add unambiguous phase-qualified identity mapping and correct authoritative present-tense summaries, not old evidence. |
| IV-33 | CRITICAL, Constitution V | `unwrap<T>` accepts a caller-chosen generic response and casts JSON to it; API modules hand-write projections such as `Account`/recipient/neighborhood options. Hono request arguments are checked, but those asserted response types are not inferred from the actual endpoint. This is architectural boundary debt, not a reproduced failure of every response. Retain approved shared domain schemas, infer actual RPC responses, and validate independently persisted/unknown data at runtime. |
| IV-34 | MEDIUM, plan: design-system §8; Constitution VII | Master-data/users/audit screens render `data ?? []` without an error/loading branch. A failed query can look like an empty directory; users receive no actionable retry/error message there. Search combobox likewise reports no results after a failed search. Source-confirmed; existing final-page axe checks do not exercise transport-failure states. |

Negative check: an actual Chromium context fetched a private photo as owner, changed
to a different courier's real session in that same context, and fetched the same URL.
The second fetch returned **404**, matching a direct server request. Actual PostgreSQL
and S3Proxy were used. No cross-account browser-cache leak was reproduced in this
scenario; this does not settle the separate FR-036 lifecycle ambiguity or establish
Safari/Android cache behavior. IV-05 must not be described as a demonstrated leak.

These findings require traceable test-first remediation. No new task is marked done
and no application behavior has been changed.

## Review coverage and confidence

The review traversed the business scope and all four feature artifact sets, then the
shared domain, every server resource/helper, database schema/migrations/seed, web
routes/forms/shared controls, offline persistence/sync/worker, authentication,
exports, test harness, quality workflow and dependency/remote state. Production
modules were inspected beyond recent diffs. Generated artifacts were checked as
outputs (eight migration snapshot/journal links are coherent and actual migrations
run on PostgreSQL 18), not treated as separately authored application logic.
This is not a claim of a line-by-line audit of dependency source or every generated
snapshot, or proof that every possible interleaving has been tested.

| Feature / story scope | Current implementation and verification anchors | Assessment |
| --- | --- | --- |
| 001 US1 registration, all four kinds, fees/payment/windows/lookups | Domain schemas/fees/payment/bulk rules; `registration.ts`, shipment/lookups routes; shipment form/comboboxes; registration/lookup/domain tests and browser journeys | Built and wired; IV-13/15/22/23/24/27 prevent complete conformance |
| 001 US2 board, filters, flags and refresh | Shared dispatch-board/shipment-flags; board query; board route/table/ribbon; board/experience/accessibility tests | Built; current ordinary cases pass, not evidence that every future financial projection is safe |
| 001 US3 edits, voids, concurrency and history | Shared lifecycle; versioned `saveChange`; route-stop update integration; shipment detail/edit dialogs; update/void/fee-confirmation browser tests | Built; IV-15 fee snapshot and IV-13 bounds require correction |
| 001 US4 pasted/uploaded bulk | Bulk parsing/domain preview; atomic bulk route; spreadsheet/CSV input and preview; bulk API/e2e | Built; IV-16 corrupts creation traceability with valid repeated identities |
| 001 US5 search and export | Search schema/query/cursor; shared export serializer; history API/table/filters; search-scale/export/e2e | Built; IV-01/17 plus 003 operational export additions remain |
| 001 US6 directories, aliases, defaults, effective rates and auditing | Master schemas; `auditedCreate`/`auditedChange`; six directory resources; dialogs; master-data replay/export/tests | Built; IV-18/21/22/25/28/29/30/34 expose gaps beyond existing replay coverage |
| 001 US7 access, account management, lockout and recovery | Better Auth configuration/forwarder/guards; web auth/users/account; role/auth/recovery tests | Built; IV-10/11/12/14/19/20/26 block sign-off |
| 002 US1 build/order/assign/dispatch | Shared stop planning/lifecycle; transactional route store/routes; list/order/dialog wiring; create/dispatch/order/contract/e2e | Built; IV-13 aggregate failure; address-based pickup grouping matches the approved data-model/research decision, not a proven defect |
| 002 US2 boards/progress/previous days | Route progress/summary projections and cards; route-board/scale/browser checks | Built; IV-13 sums; 003 last-sync/notice additions are connected |
| 002 US3 add/remove/void/edit stop integration | Route and shipment resource orchestration; add/remove dialogs; invariant and adjustment tests | Built; retained route/custody regressions pass; broader 003 invariant matrix remains T082 |
| 002 US4 reassign/custody/handovers | Shared held-stop eligibility; reassignment/route-store; handover dialogs/history; real courier record integration | Built; 003 return/office/late-record extensions are connected, not stand-in task writes |
| 002 US5 cancel/undo | Guarded lifecycle/routes; reason UI; cancellation/undo tests | Built; no reopening of final routes inferred from package/errand reverts |
| 003 US1 route/pickup/delivery/photos/collections/disbursement | Shared record resolver; apply-record transaction; courier/photo resources; stop forms; PostgreSQL/S3/e2e | Built; IV-04/05/13/31 and final mobile/security verification remain |
| 003 US2 offline, identity, session, persistence and sync | Zod persisted courier data; IndexedDB transactions; serial/coalesced store; actual worker; offline unit/browser tests | Built; T131 remains unresolved; current T131 case passes, which does not prove historical cause fixed |
| 003 US3 exceptions/problems/undecided list | Shared resolver/selection; board `returnDecided`; forms and offline exception browser journey | Built; prior return/office/notice regressions retained |
| 003 US4 decisions, office and returns | Shared contextual lifecycle; decision/office/settings transactions; immutable pickup place; return/office browser journeys | Built; current journeys pass, including high original COD with zero return collection |
| 003 US5 notices, acknowledgment, handovers and push | Committed notice IDs; validated browser-vendor destinations; chunked atomic acknowledgments; native worker notification case | Built; actual Chromium notification passes, physical installed-iPhone/Android notification evidence remains open |
| 003 US6 on-behalf/correct/revert | Shared contextual reversions; indexed record-event identity; guard later operations; transactional state/history; correction/revert browser journeys | Built; original snapshots/tied-time/legacy/history regressions retained; no arbitrary rollback of later custody permitted |
| 003 US7 day estimate | Shared day-summary and route-progress; server snapshot plus offline projection; summary/outbox/day browser tests | Built; current offline/corrected/high-contrast checks pass; not Phase 2 settlement |
| 004 US1 public tracking, US2 merchant message, US3 private merchant link | Spec/plan/data-model/research/contracts/checklists/35 tasks versus mounted server/web/domain exports | Missing implementation throughout; approved closure includes completing it, not merely reviewing its plan |

Thirteen cross-cutting plan decisions were assessed: modular-monolith topology,
shared domain/lifecycle, database constraints/migrations, integer COP/Bogotá time,
library-based auth/roles, UUID replay lifecycle, atomic bulk import, offline identity
and storage, private photos/retention, transactional notices/push, append-only
history/corrections, open exports, and interface/performance verification policy.
Assessment includes contradictions and unverified obligations, not thirteen passes.

All 137 FR identifiers and 150 acceptance scenarios were included in the scope
inventory. Existing suites and selected high-risk assertions were inspected; all
948 unit/integration cases and all 90 browser cases were executed. This is **not**
a claim that each test assertion was independently proven sufficient or every
acceptance scenario passed on physical devices. New adversarial probes deliberately
target cases not covered by those suites. No skipped/TODO/focused-only tests were
found in the authored application/test/tooling scan; justified lint suppressions
are localized in test helpers. Test resource partitioning, seeds, step counts,
deadlines, retries and worker policy were not changed.

The PDF quote was read through native PDFKit (Poppler/pypdf are not installed),
alongside the curated interview/business decisions. Phase 2 settlement/receivables,
native store apps, automatic WhatsApp API and optional historical import remain
outside this delivery; backup/recovery, deployment, training and pilot readiness
are not eliminated merely because application tests pass. No raw workbook or `.env`
was opened. The bundled Spec Kit configuration, active Bash prerequisite path,
workflow/hooks/templates inventory and disabled auto-commit policy were reviewed;
alternative-platform extension ports were not executed or independently certified.

## Consolidated remediation and convergence receipt

There are 34 report entries: 9 CRITICAL, 16 HIGH, 7 MEDIUM and 2 verification/readiness
gaps without a demonstrated product failure (IV-08/09). The 25 deep-review additions
are 21 contradictions and 4 partial implementations (IV-23/27/32/34). Operational
severity in this report is distinct from the strict convergence rule: tasks addressing
an explicit constitutional MUST violation are labeled CRITICAL even when the
individual observed symptom has lower operational impact.

Before append, the findings/classification and inventory metrics were presented in
session. Prerequisites passed for 001–003 with feature persistence disabled; no
converge hooks are registered. **24 additional unchecked tasks** were appended:
001 Phase 13 T130–T149, 002 Phase 10 T063/T064, 003 Phase 43 T134/T135.
Previous tasks/checklist markers/descriptions were preserved. Combined findings
share a remediation task where appropriate; monetary storage versus route SUM
work is split explicitly across 001 T138 and 002 T063. The new task classifications
are 17 CRITICAL, 5 HIGH and 2 MEDIUM, 20 contradictions and 4 partial tasks.
004's existing T001–T035 were not duplicated and no convergence-before-implementation
claim was made for that feature. Outcome: `tasks_appended`, never global `converged`.

Order of implementation: auth permissions/atomicity/replay and evidence integrity;
money/boundaries/master-data concurrency; form readiness/autofill/Spanish/error
states and current keyboard gate; existing 003 closure work and photo decision;
004 alignment/analysis and implementation; full delivery-head gates and actual
device/deployment acceptance. Each correction still needs its own failing regression
before production changes, followed by verification. This audit does not authorize
one giant implementation branch or publication.

The consolidated review has produced the evidence and queue above; the overall
implementation/completion stage is not finished. Earlier 001 T128/T129 and 003 T133
remain open alongside the 24 new tasks. Existing pending work was not duplicated.

Two scope/contract decisions have been put to Samuel: current-work-only versus
historical access to courier photos, and spreadsheet-safe CSV versus exact text export
for import with XLSX for viewing. Do not silently decide these tradeoffs or modify a
contract merely to match current implementation. Completing 004 is explicitly approved
as part of the closure scope; its pre-implementation alignment/analysis remains required.

The next local work is to resolve those decisions, align the affected artifacts, and
execute the unified completion queue test-first. Publishing or merging is not included
in the current review/completion scope approval. Real phone and infrastructure evidence
must be collected from the owner/actual environments before final sign-off.
