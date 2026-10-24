# Implementation Plan: Shipment Registration and Dispatch Board

## Account integrity slice — 2026-10-19 UTC

Branch `001-fix-account-integrity` starts from main `321ef93` after PR #29's verified
squash tree. Its post-merge CI `39189769655` is verified clean; no next merge may
bypass its own required clean verification. Filter: T130/T131/T150, research R18. Atomicity
is a prerequisite of the owner-invariant guard, so T131 moves into the same first
account slice instead of leaving a check outside its mutation transaction. Scoped
review additionally reproduced IV-36, tracked separately as T151: request-path logs
include the native password-recovery bearer token. Before changing the request logger,
retain the failing real native callback test; log `/api/auth/reset-password/:token`
for that callback path, matching the token-segment boundary case-insensitively and
including percent-encoded spellings without logging their original content. Keep
ordinary paths, request id/status/timing and omission of query strings. Do not mutate
the request passed to the auth library or its redirect. This uses a local path
expression in existing middleware, not a new logging wrapper. T132's
web/server replay lifecycle, T139's remaining boundaries and T146 lockout stay open.

Use `AuthConfig` data, the existing `createAuth` factory accepting `Executor`, and
native `db.transaction`. `app.ts` creates the root auth once; `index.ts` and
`tests/setup/app.ts` provide the original config. An administrative handler constructs
auth from the exact transaction; do not clone closed-over callbacks or inject a new
factory abstraction. Hold the shared account-admin advisory lock, revalidate actor,
lock/read the target user, enforce last-owner/link-role invariants, call the native
handler and audit actual committed values. Linking in `routes/couriers.ts` locks the
same user before courier rows. Capture failing Responses only outside rollback.
The pure last-owner/link-role decision lives once in
`packages/domain/src/account-rules.ts` with unit tests; the server supplies the locked
current/next role/activity and existence of another active owner/courier link. Use an
existence query, not an unnecessarily narrowed owner-count aggregate.

Replace generic unchecked auth body assertions with schema-driven input validation
using shared account schemas in `packages/domain/src/schemas/account.ts`. Preserve
the original Request for native cookies/origin/CSRF checks. `routes/auth.ts` exposes
the explicit contract paths; remove `app.ts`'s unbounded native wildcard delegation.
Preserve GET reset callback, ordinary bad credentials, recovery, fixed sessions and
all legitimate owner actions. Native 4xx retain native status/body; unexpected faults
use the existing Spanish generic error and sanitized logging, never raw SQL/credentials.
Session-ending audit records a non-secret count change, not session tokens.

Test first in `apps/server/tests/account-integrity.test.ts`, account-rule/schema tests and
the existing auth/browser suites. Use real PG contention/fault barriers for two-owner
demotion/ban, actor revocation, role/link races, and atomic account/credential/session/
audit failure. Include unsupported/encoded paths, malformed bodies, allowed actions,
true recovery callback and redaction. No mocked DB, sleeps, weakened assertions or
changes to worker/retry/deadline policy. Preserve RED and run all four gates/converge.

Scoped design Constitution Check: I native monolith/primitives, no added dependency or
wrapper; II preserve existing action behavior, keep missing T132 replay explicitly open;
III shared input schemas/roles, no duplicated business vocabulary; IV shared transaction
and truthful audit; V runtime validation/inferred outputs; VI permanent RED before code
and real PG; VII preserved Spanish feedback/keyboard/axe; VIII one branch, traceable
tasks and immutable history; IX library-managed credentials and sanitized failures.
No new constitutional exception, migration or complexity waiver. This checks the slice's
design, not global implementation conformance; existing defects remain tracked.

## Integral remediation execution alignment — 2026-10-18 UTC

The project-wide dependency/closure plan is
[`docs/integral-remediation-plan.md`](../../docs/integral-remediation-plan.md).
Existing task IDs and historical evidence remain authoritative; this adds no product
scope or permission to publish. Samuel authorized starting the recommended local work.
Start with the narrow T141 filter to repair the currently red verification boundary,
then execute the critical auth/data-integrity slices. Other findings remain open.

T141 demonstrated design (before correction): a held real initial merchant response
keeps the list empty through keyboard typing. Releasing the real search response then
shows the sole intended option but leaves it without `data-highlighted`, reproducing
the unchanged five-second failure deterministically. Installed Base UI's ordinary
`autoHighlight=true` mode is input-change driven; an empty list clears its active
index, whereas late items restore a highlight only in its different `always` mode.
Do not change application selection policy or dependency versions to satisfy a test
that never navigates the available choices. This proves the local mechanism, not the
exact historical scheduling of the earlier full-suite failure.

Correct the keyboard-only test by waiting for its fixture's sole matching result,
pressing native ArrowDown, retaining the exact intended-option highlight assertion,
then Enter and the existing selected merchant/pickup/neighborhood, fee, success and
full axe checks. Apply the same actual-keyboard precondition to the neighborhood.
Keep the original normal, delayed-search and delayed-quote variants and the new
initial-response regression. No mocked successful responses, sleeps, forced input,
longer deadlines, retries or worker changes. Retain RED traces privately, run focused
repetitions followed by all four gates and scoped convergence before marking T141 done.
No closure of 003 T131 or other integral tasks is implied by this correction.

### T154 modal notification audit investigation — 2026-10-19 UTC

`001-fix-modal-notification-audit` starts independently from main `321ef93`.
PR #31 source `b4c83f3` passes check, 955 tests and build in CI `39273068925`,
but its 92-case browser gate has 91 first-attempt passes/one flaky master-data
scenario16. Its final dispatcher-page axe scan sees notification contrast1.69;
the normal retry passes. Restricted first-failure artifact `12196664566` is retained
privately (SHA-256 `0f9bd5370bdc7e58ecef4f394d5177f718f3c59fb7e76224799dc6ad8468218c`).
Both #31 and transport #30 remain held; no green-rerun substitution or merge.

The trace shows a real success notification, then an edit dialog; the shared helper
skips notification stabilization because a dialog exists. Axe starts before native
expiry and the toast becomes `data-removed=true` while the scan is in progress.
Installed Base UI explicitly preserves aria-live regions when hiding other content;
Sonner uses such a region. The helper's assumption that a modal hides notifications
is therefore false. This does not yet prove a stable production contrast defect.

Clarify: existing Spanish/M3/WCAG and focus requirements suffice; no new product,
visual choice, data model or API contract. Reviewer checklists remain read-only
(16/16, 47/47). Reuse T154's ordered diagnosis/RED/correction/gates obligations;
do not duplicate 003 T100/T112 or close other pending work.

Investigation-stage design: add an actual account-created toast and an actual open
modal to `access.spec.ts`, with the native test clock installed before their creation.
Advance native expiry at the existing pre-analyze hook: require the toast to remain
visible/stabilized and the original modal input to remain focused. The current
helper must fail before any correction. Retain original timing regressions, then
cover native pause cleanup: after scanning, the modal stays open/focused and the
notification expires normally. Include alertdialog/expiry-before-pause and the
courier's lower toaster where applicable, not only the panel's higher stack.

Resolve pause/cleanup capability before selecting the smallest correction. Native
Sonner keyboard expansion pauses expiry, and blur does not collapse, so restoring
modal focus before axe is a candidate, not sufficient proof of cleanup. Escape can
also close the modal; do not send it blindly. Real pointer hover/leave preserves
focus but may be blocked by courier sheets; never force through them. No global
clock/visibility manipulation, fake notifications/responses, altered lifetime,
z-index/color change, hidden/excluded nodes, closed modal, sleep or raised budget.
Record unsuccessful probes separately from actual application/harness RED. Refine
this design with demonstrated native behavior and re-analyze before correction.

Constitution: I direct installed primitives/no dependency or abstraction; II–V no
mutation, persistence, domain or boundary change; VI controlled RED and every existing
budget/gate; VII complete axe/Spanish/real modal input and focus; VIII independent
short-lived slice with preserved failures; IX private traces/synthetic data, no auth
state/artifact disclosure. All nine pass this bounded investigation; runtime design
approval awaits its capability evidence. No complexity exception or global sign-off.

Selected scanner-only design after permanent RED: the new real-modal/native-clock
case fails (notification absent at the pre-axe gate, 6.3 seconds), retained privately
under `.git/t154-modal-notification-red/`; the helper is still unchanged at that RED.
Use existing native Alt+t expansion for a stack that was not already expanded,
await remaining notifications expanded or naturally absent, and restore the original
modal input BEFORE axe. Preserve preexisting user expansion rather than releasing it.
The current SDK exposes no pause/resume API. Its Escape and Base UI's global Escape
handler would both run, so Escape is rejected for modal cleanup. Real hover is not a
general replacement because courier sheets can cover the lower stack.

For modal cleanup ONLY, dispatch one bubbling native-constructed MouseEvent('mouseout',
relatedTarget=document.body) on the toaster, then verify native collapse/absence and
restore focus in finally. This is explicitly SYNTHETIC scanner-state cleanup
(isTrusted=false), not proof of a real hover, an unobscured target or a product action.
It invokes Sonner's existing onMouseLeave pause release without changing duration,
CSS, React internals or production code. Actual user-journey clicks/hit tests remain
unforced and unsimulated. Only release scanner-owned expansion on this idle completed-
action scan; do not interfere with a user's preexpanded stack or active drag.
Keep normal non-modal native Escape behavior. Cover modal/alertdialog, expiry-before-
pause, thrown pre-analyze hook, subsequent normal expiry, and the courier's lower
stack/preexpanded nine-point hit tests. All nine constitutional checks still hold:
this bounded test-fixture event is not a new runtime abstraction or UX change.

State-restoration boundary: initial focus inside the toaster does not itself prove
it was expanded (Sonner's onFocus does not set expansion). Preserve initial focus,
but release expansion introduced by the scanner even in this case; conversely, keep
a preexpanded stack untouched even if its original focus was in a modal input.
Cover the focused-but-collapsed state explicitly before final cleanup validation.
Its additional permanent regression fails after the full scan: the stack remains
expanded instead of restoring its initial collapsed state (6.6 seconds, retained in
`.git/t154-focused-stack-red/`). The existing focus-based cleanup exemption confuses
two independent states. Make pause release depend only on scanner ownership, while
focus restoration still preserves an already focused toaster. This is the same T154
cleanup contract, not a production behavior change. The earlier 96-case pass is an
intermediate candidate; repeat all final gates after this correction and added case.

Capability verification: the original modal test now preserves the toast/input
through the actual full scan and resumes expiry. Its first cleanup check mistakenly
uses Node's wall clock after advancing browser time and fails with "Cannot fast-forward
to the past"; the test now derives its next pause from the controlled browser clock.
The first added courier setup mixes controlled time and offline navigation and stalls
at the first stop click, BEFORE helper invocation. Retain it as a setup failure, not
application RED or proof of the scan mechanism. The corrected case uses an actual
online pickup notification and real courier sheet; native hit testing proves the toast
is beneath the sheet, then clock-controlled scan/focus/expiry assertions pass. Existing
offline/preexpanded two-toast/photo/save hit tests remain unchanged. All nine focused
cases pass three repetitions (27/27, 1.1 minutes); general gates remain required.

**Branch**: `001-shipment-registration` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-shipment-registration/spec.md`

## Summary

Replace the dispatcher's daily spreadsheet with shipment registration (single and bulk),
automatic fees from an effective-dated rate card, a live dispatch board with at-risk and late
flags and carried-over pending shipments, searchable history with export, master data
(merchants, couriers, carriers, neighborhoods, rate zones, rate card), and role-based access
for owner, dispatcher, and courier.

As the first feature, it also lays the project foundation: a pnpm monorepo with a Hono API
on Node 24, a React + Vite web app styled with Tailwind CSS and shadcn/ui following Material
Design 3, PostgreSQL through Drizzle, Better Auth, and business rules in a shared
`packages/domain` (see [research.md](research.md)).

## Technical Context

### T136 and T152 local execution alignment — 2026-10-20

The owner requires all validation in this run to execute locally, without remote CI
configuration, invocation or waiting. Preserve the four local quality gates and the
separate executor/orchestrator reviews; do not claim publication or deployment evidence.

For T136 (Constitution V), inventory real Hono response types before replacing the
caller-selected `unwrap<T>(Promise<Response>)` assertion with inference bound to the
endpoint's native `ClientResponse`. Remove unchecked consumer arguments and derive
lookup projections from endpoints. Preserve Hono route chaining and inferred JSON
returns through shared route/handover helpers. Re-export native Better Auth types only
as types; its HTTP passthrough remains unknown until runtime validation against schemas
checked against the native library response contract. Keep domain validation shared.
Permanent compile-time mismatch checks must fail before the correction and protect
against generic Response/type erasure; runtime tests retain Spanish errors, structured
details, 204 and network behavior. Do not implement account replay T132 in this slice.

For T152 (FR-041, research R14, Constitution IX), implement the native SDK error-only
policy in each app's reporting configuration and entry point. Preserve T153's safe
diagnostics and error delivery while excluding SDK-added personal/secret context and
non-error envelopes. Prove real-app/real-PG, native-browser and compiled lazy-browser
RED/GREEN against local capture, including disabled reporting. No shared reporting
framework, API/DB change, new dependency or external telemetry is authorized.

For the installed Sentry 11.1.0 SDK's default streaming lifecycle, omit the deprecated
`beforeSendTransaction` option: the SDK ignores it and warns. Do not replace it with
`beforeSendSpan`, whose native callback must return a span rather than discard one. Retain
`tracesSampleRate: 0`; focused native server/browser regressions must attempt a real span,
prove that no span envelope is delivered, and preserve sanitized error delivery.

Scoped design analysis: both existing corrective tasks cover the observed boundary
violations. All nine constitutional principles remain required: direct installed
primitives, intact pending work, shared domain rules, unchanged transactions, inferred
and validated boundaries, permanent RED, Spanish accessible UX, scoped files and safe
diagnostics. Resolve any newly discovered design inconsistency before implementation;
the known implementation defects are the work these tasks explicitly repair.

### T153 diagnostic correction boundary

Implement research R14's bounded diagnostic projection directly in
`apps/server/src/lib/errors.ts`. No schema, domain rule, public endpoint, response shape,
auth behavior, dependency, service or wrapper changes. Preserve expected AppError and
client HTTPException handling, ordinary pino delivery and the existing reporter.
Permit resetting the existing reporter to null for deterministic test cleanup.

Test first in `apps/server/tests/log-redaction.test.ts`: actual monolith request and real
PostgreSQL trigger failure (`22P02`), actual unique violation (`23505`, replacing the
old synthetic case without dropping its code assertion), and an ordinary exception from
a test-only native Hono route appended to the actual monolith (no production endpoint).
Capture complete log/reporter output without printing sensitive sentinels; verify generic
Spanish HTTP 500, rollback and retained useful diagnostics. Exercise source-frame
validation, malformed/mutable error values, safe fallback and bounded cost, using native
filesystem fixtures with recoverable cleanup. Preserve all existing privacy assertions.
Run all four gates and scoped convergence before checking T153. T150–T152 and the
separately published accessibility/session/transport slices are not closed by this fix.

Constitution re-check: I no added architecture/dependency/cache; II no sync changes;
III no duplicated domain rules; IV no transaction changes; V strict native types;
VI permanent real-PG RED before behavior; VII Spanish responses unchanged; VIII scoped
source/test/document locations and all gates; IX no arbitrary runtime values in diagnostics.
No Complexity Tracking exception is required. The source immutability assumption and
reporting-site fallback limits are explicit in R14, not a hostile-filesystem guarantee.

**Language/Version**: TypeScript 6.0 (strict), Node.js 24 LTS (native type stripping)

**Primary Dependencies**:
- Server: Hono 4.13, `@hono/node-server` 2, `@hono/zod-validator`, Drizzle ORM 0.45 +
  drizzle-kit 0.31, postgres.js 3.4, Better Auth 1.7 (admin plugin), Resend 6, pino 10,
  `write-excel-file`.
- Web: React 19.3, Vite 8, TanStack Router 1 and TanStack Query 5, React Hook Form 7,
  Tailwind CSS 4.3, shadcn/ui (Base UI), Sonner, Papa Parse, `read-excel-file`,
  `@material-symbols/svg-400` with `vite-plugin-svgr`, `@tanstack/virtual-file-routes`.
- Shared: Zod 4.
- Tooling: `@material/material-color-utilities` (token generation), Sentry 11 (optional).

**Storage**: PostgreSQL 18 with `unaccent` and `pg_trgm`. No object storage in this feature
(photos arrive with feature 003).

**Testing**: Vitest 5 (unit, and integration against real PostgreSQL via Testcontainers 12),
Playwright 1.63 (end to end)

**Target Platform**: Linux server (Docker Compose on a DigitalOcean VPS); dispatch panel in
current Chrome, Edge, Safari, and Firefox on desktop, usable down to 600 px wide

**Project Type**: Web application (monorepo: API server + single-page web app + shared
domain package)

**Performance Goals**: board changes visible to all users within 30 s (SC-004); search under
2 s with ≥ 100,000 shipments (SC-006); registration in under 45 s of user time (SC-001)

**Constraints**:
- Single deployable; monthly infrastructure within COP 60,000–130,000.
- Money as integer COP; times stored in UTC and shown in `America/Bogota`.
- Spanish UI; WCAG 2.2 AA.
- The dispatch panel requires connectivity but never loses form data.

**Scale/Scope**: about 20–40 shipments a day, 1–3 office users, 5–10 couriers, 130 active
merchants; 7 user stories, 44 functional requirements, about 15 screens

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Status |
| --- | --- | --- |
| I. Simplicity First | One server process (Hono also serves the built web app), one PostgreSQL, no queue or cache. Three workspace packages as ratified. Fuzzy search, idempotency, and audit use database features. No wrappers around Drizzle, Hono, or Better Auth | ✅ |
| II. Zero Data Loss in the Field | Every creation carries a client-generated `id` and every other mutation a client-generated `actionId`, so each has exactly one effect (FR-042); updates and voiding also use `version`. Events have `occurred_at` and `recorded_at`, and `client_event_id` is reserved for the courier app (feature 003). Shipment and bulk form drafts survive failures and expired sessions (FR-038), with validated storage and the exact bulk mutation retained across an uncertain response. The device-persistence rules apply to feature 003 | ✅ |
| III. Single Source of Truth | Lifecycle, fee rule, payment modes, delivery windows, flags, tracking numbers, and Zod schemas live in `packages/domain`, imported by server and web. Status changes only through the declared lifecycle. Money is integer COP; timestamps are UTC | ✅ |
| IV. Transactional Integrity & Traceability | Shipment change and `shipment_events` row in one transaction. Checks for payment mode, kind fields, and voiding. Append-only rate card and events. No deletes | ✅ |
| V. Type Safety at Every Boundary | Strict TypeScript with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Zod on every request, env, and file input. Hono RPC types with no duplicate API types | ✅ |
| VI. Test-First Business Logic | Domain rules written test-first; integration tests on real PostgreSQL; Playwright for this feature's critical flows; injected clock | ✅ |
| VII. Effortless UX | Spanish glossary terms, M3 design system, keyboard-first registration, 48 dp targets, WCAG 2.2 AA | ✅ |
| VIII. Absolute Repository Order | kebab-case files, structure below, ESLint and Prettier with zero warnings, Conventional Commits | ✅ |
| IX. Security, Privacy & Data Ownership | Better Auth (no hand-rolled crypto). Server-side role checks on every route. Env validated at startup. Export of shipments (CSV, Excel) and of every master data set (CSV). No bank accounts stored. PII kept out of logs | ✅ |

**Post-design re-check (after Phase 1)**: ✅ all principles still hold.
- The data model enforces payment-mode and kind rules with database checks.
- The API has no delete endpoints.
- The lockout hook is the only custom authentication logic, and it wraps Better Auth rather
  than replacing it.

## Project Structure

### Documentation (this feature)

```text
specs/001-shipment-registration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── quickstart-results.md   # written by task T120 during validation
├── contracts/
│   ├── http-api.md
│   └── bulk-template.md
├── checklists/
│   └── requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
domy/
├── apps/
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts              # entry: env, logger, HTTP server
│   │   │   ├── app.ts                # Hono app, middleware, routes; exports AppType
│   │   │   ├── env.ts                # Zod-validated environment
│   │   │   ├── auth.ts               # Better Auth config, roles, lockout hook
│   │   │   ├── db/
│   │   │   │   ├── client.ts
│   │   │   │   ├── schema/           # one file per aggregate (shipments.ts, merchants.ts, …)
│   │   │   │   ├── migrations/       # generated by drizzle-kit, reviewed, committed
│   │   │   │   └── seed/             # go-live seed: catalog, rate card, owner
│   │   │   ├── routes/               # one file per resource (shipments.ts, bulk.ts, merchants.ts, …)
│   │   │   └── lib/                  # errors.ts, clock.ts, export.ts, audit.ts, action-id.ts
│   │   ├── tests/                    # integration tests (Testcontainers)
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── routes.ts             # virtual file routes: Spanish URLs → English route files
│       │   ├── routes/               # TanStack Router route files
│       │   ├── features/             # shipments/, board/, bulk/, history/, master-data/, auth/
│       │   ├── components/ui/        # shadcn/ui components restyled to M3
│       │   ├── styles/               # tokens.css (generated), globals.css
│       │   └── lib/                  # api-client.ts, format.ts, clock.ts
│       ├── public/                   # static assets served as is
│       ├── tests/e2e/                # Playwright
│       ├── index.html
│       ├── vite.config.ts
│       └── package.json
├── packages/
│   └── domain/
│       ├── src/
│       │   ├── shipment-lifecycle.ts
│       │   ├── fees.ts
│       │   ├── payment-modes.ts
│       │   ├── delivery-windows.ts
│       │   ├── shipment-flags.ts
│       │   ├── tracking-numbers.ts
│       │   ├── bogota-time.ts
│       │   ├── text-normalization.ts
│       │   ├── money.ts
│       │   ├── schemas/              # Zod schemas shared by server and web
│       │   └── index.ts
│       └── package.json              # unit tests sit next to each module (*.test.ts)
├── scripts/
│   └── generate-design-tokens.ts     # M3 roles from the seed of design-system.md §3.1 → apps/web/src/styles/tokens.css
├── .github/workflows/ci.yml
├── compose.yaml                      # PostgreSQL 18 for development
├── .env.example
├── eslint.config.js
├── prettier.config.js
├── tsconfig.base.json
├── pnpm-workspace.yaml
└── package.json
```

**Structure Decision**: the web-application layout ratified by the constitution
(`apps/server`, `apps/web`, `packages/domain`).
- Server code is organized by technical role with one file per resource. Routes call
  Drizzle directly (no repository layer, Principle I), and business rules come from
  `packages/domain`.
- Web code is organized by feature.
- Tests follow their layer: unit tests next to domain modules, integration tests in
  `apps/server/tests`, end-to-end tests in `apps/web/tests/e2e`.

## Complexity Tracking

Accepted master data edits use `lib/master-data.ts`'s `auditedChange` to store the action's
audit event in the same transaction, including an empty-change receipt when nothing changed
(FR-042; review correction in feature 003, T097). The helper also accepts multiple changed
entities for account linking; the first event carries the action id. Empty-change receipts
remain stored but are excluded by `GET /api/audit-events` before pagination (FR-036, T096).
The existing unique `client_event_id` arbitrates concurrent retries; no migration or new
dependency is needed.

No constitution violations. Two additions that could look like extra moving parts are
justified inside the principles:

| Addition | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| Testcontainers in tests | Constitution VI requires integration tests on real PostgreSQL, isolated per test file | A shared development database makes tests order-dependent; PGlite is not the production engine |
| `DOMY_FAKE_NOW` clock override (development and test only) | Deterministic validation of time-based flags (FR-022, SC-005) in manual and end-to-end tests | Waiting for real clock times is not reproducible |


### T132 local execution alignment — 2026-10-20

Implement research R19 on top of verified T130/T131 and T136 boundaries. Add
`apps/server/src/db/schema/account-actions.ts`, export its receipt table, and generate
its Drizzle migration with `pnpm db:generate`; never hand-edit generated output. Retain
one native auth configuration and its transaction-bound executor. Runtime-validate and
allowlist success JSON against native Auth API types. Invoke native Origin/CSRF primitive
before receipt replay, revalidate current owner, bind intent and public normalized input,
and return cached safe success before target guards without replaying response cookies.
Keep last-owner/link-role guards, mutations, changed-only audit and receipts atomic.

Frontend account API/dialog own Zod-validated persistent intent/workflow metadata in
localStorage under actor-specific keys, with short Web Locks for cross-tab coordination.
Persist before network; preserve uncertainty and phase ACKs; match late ACKs by UUID.
Creation/link retries use the native created-user ID and one durable link action UUID.
No passwords or credential/session derivatives enter persistent metadata.

Test first: actual PostgreSQL A→B→A (ban/profile/role/unban), no-op and concurrent
retries, actor/operation/target/input conflict, creation mapping, rollback, current actor
revalidation, native Origin refusal and self-revoke/relogin replay. Browser/unit coverage
must exercise lost ACK/reload, cross-tab coordination, blocked storage, actor isolation,
late ACK and partial workflow resumption. All validation is local, and orchestrator
independently audits changes and the four gates before closing canonical T132.
Constitution I–IX: one receipt table solves existing exactly-once requirements; no new
layer/service/dependency; no secret persistence; direct native auth, generated schema,
strict DTOs, deterministic transactional tests and Spanish failure messages.

### T132 actor-binding refinement — 2026-10-20

Require the client session snapshot UUID in `X-Domy-Actor-Id` for the six native owner
account mutations and `PUT /api/couriers/accounts/:userId`. Validate it against the
cookie-authenticated actor. Native handlers perform this check after Origin/CSRF and
active-owner validation inside the existing transaction, before receipt lookup. The link
handler checks `c.get("user").id` before `auditedChange`; its authenticated identity is
stable for that request, and the guard must precede its existing receipt lookup. Missing
or malformed headers return safe `400 invalid_request`; a changed actor returns Spanish
`409 actor_changed` without identifiers or effects. The header does not grant access or
replace role, session, Origin, or CSRF checks. Other reads and auth endpoints do not need
it. A small shared validator keeps the rule consistent without changing the audit helper,
adding a transaction, or changing the receipt schema.

### T137 validated shipment drafts — 2026-10-20

Validate session-storage envelopes and shipment/edit form values with strict Zod schemas at
the read boundary. Form drafts may be incomplete, so do not run the final shipment create
schema while restoring them. Merchant and neighborhood selections validate the fields the
form consumes and preserve complete runtime API objects, including fields omitted by their
static `Pick` types; nested empty municipality/rate-zone IDs from `fromShipment` are valid
view-model data. Preserve malformed, wrong-shaped, or unknown-field raw data for local
download and explicit discard.

Before a single create or edit request, persist the exact validated request payload, its
mutation UUID/action UUID, and the visible form values in one pending envelope. An ambiguous
failure freezes the form behind an exact retry control. Do not send a different payload with
that UUID. Validate the response's shipment ID before replacing the pending envelope in one
storage write with a fresh UUID and next values. If storage refuses rotation, retain or
remove the old pending snapshot only through the explicit best-effort storage operations;
never enable a new network mutation with the old UUID. A storage read refusal blocks form
initialization; a write refusal preserves in-memory values and blocks networking until an
explicit retry succeeds.

Bind pending identity and target to the envelope and route at both read and write boundaries.
Reconstruct the pending input from the saved visible form with the existing mapper and compare
canonical payloads; bulk form and row merchants must agree with the batch. While pending, keep
form values visible but disabled and pause pricing, pickup-default and other auto-fill writes
that could change them. Before the first request, validate COD with the shared domain rule,
wait for the current fee quote when its inputs are complete, and validate manual-fee reasons
with the shared reason schema. Map server field errors back to visible fields while preserving
the exact pending identity. A `400 invalid_request` does not automatically prove that a concurrent
tab with the same UUID had no effect. Keep the saved request and fields disabled until the user
downloads the exact payload, reviews shipment history, and explicitly prepares a fresh intent.
Persist that new intent before unlocking fields; bulk recovery follows the same rule and preserves
its source rows.

At the same read boundary, bind each pending ID/action ID and target to its envelope and
route, then rebuild the pending request from the saved form with the existing mapper. Retain a
well-shaped payload that differs from its visible form as raw recovery data and never send it.
Bulk drafts also require the visible merchant and each row merchant to match the pending
confirmation input.

Edit drafts use a stable per-shipment key and persist the source `baseVersion`. An exact pending
update keeps its original request version and remains retryable even if the server has advanced
the shipment. An unsent edit with a missing or stale base version is held for local download and
an explicit reload from the current shipment before another mutation; never silently rebase the
old values. Keep pending form values visible but disabled while their exact request is uncertain.
A definitive `version_conflict` remains attached to the saved values until the current record has
been fetched and the pending marker can be cleared durably; then require the same explicit download
and reload decision. Read only the legacy versioned key that matches the currently loaded shipment.
Do not scan or overwrite other historical version keys; older unmatched keys remain outside the
automatic recovery path.

The valid legacy `{ id, values }` shape remains readable, but it has no record of whether a
request was sent or its exact final payload. Do not silently auto-save or reuse its UUID for
a new request. Keep the raw envelope available for local download, explain that an earlier
submission may already exist, and require an explicit informed decision that starts a new
UUID after the user checks the shipment history. This preserves legacy field values without
claiming retroactive exactly-once recovery.

Bulk confirmation stores the exact validated `BulkConfirmInput`, plus the remaining source
rows, including batch and row UUIDs, order, and accepted values, before sending. A reload or
uncertain response retries that exact payload; after a valid ACK it restores only the saved
remaining rows. It cannot silently re-preview a committed row under new identities. Only a
well-formed ACK with the matching batch and ordered row identities clears the pending
payload. A valid legacy bulk draft without pending batch IDs is explicitly uncertain: retain
its raw copy and require informed confirmation before creating a fresh attempt. This uses
the current form hook and route, reuses domain request schemas, and adds no endpoint, table,
dependency, or generalized persistence layer.

Keep lengthy warnings, duplicate tracking-number lists, form errors, and storage recovery
instructions in normal document flow. Reserve the sticky footer for the primary form action
so a high-count duplicate result cannot cover fields or block ordinary keyboard and pointer
access. Preserve the complete duplicate list and existing recovery actions.

## Release review alignment — 2026-10-23 (001/T156)

Native password requests wait in bounded memory before acquiring one of two sign-in
slots; PostgreSQL advisory locks preserve cross-process account serialization without
holding connections while waiting. Trusted native/proxy client identity is forwarded to
Better Auth. Production startup rejects the sample secret and missing recovery provider;
process failures drain with sanitized diagnostics. Shared dependency security patches
are pinned and revalidated. See ../../docs/release-change-review-results.md.
