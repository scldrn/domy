# Research: Shipment Registration and Dispatch Board

Phase 0 of [plan.md](plan.md). Every decision below resolves an unknown of the Technical
Context. Versions were verified against the npm registry on 2026-09-30. As the first feature,
this research also fixes the project foundation that features 002–004 build on.

## R1. Toolchain versions

- **Decision**: Node.js 24 LTS, pnpm 12, TypeScript 6.0.x, React 19.3, Vite 8, Tailwind CSS
  4.3, shadcn CLI 4 (Base UI primitives), Hono 4.13 with `@hono/node-server` 2, Drizzle ORM
  0.45 with drizzle-kit 0.31, `postgres` (postgres.js) 3.4, Better Auth 1.7, Zod 4, Vitest 5,
  Playwright 1.63, PostgreSQL 18.
- **Rationale**: current stable releases compatible with each other. TypeScript stays on 6.0
  because typescript-eslint 8.71 supports `typescript >=4.8.4 <6.1.0`; TypeScript 7 (native
  compiler) is adopted once typescript-eslint supports it. Drizzle stays on 0.45 (latest
  stable; 1.0 is still a release candidate) and matches Better Auth's peer range.
- **Alternatives considered**: TypeScript 7.0 (blocked by lint tooling); Drizzle 1.0 RC
  (not stable).

### R1 addendum — bounded Vite security patch (001/T129, 2026-10-20)

The resumed registry audit identifies Vite 8.3.1 in the affected 8.3.0–8.3.2 range of
[GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv).
Adopt the exact same-minor patched release **8.3.3** through native pnpm update, preserving
all other direct pins, Drizzle ORM/Kit versions, the approved scoped esbuild override and
source-map-js 1.2.2. Accept only the patch's necessary dependency/peer snapshot resolution;
the orchestrator explicitly permits native normalization of the unchanged domain Vitest
5.0.3 importer to the shared peer graph. No override suppression or RC upgrade is added.
The advisory's Windows-specific file/environment conditions narrow demonstrated exposure;
this macOS validation does not reproduce a Windows exploit. Frozen install, repeated
all/dev/prod audits and the four integrated local gates must verify the resulting graph.

## R2. Monorepo layout and TypeScript execution

- **Decision**: pnpm workspaces with `apps/server`, `apps/web`, `packages/domain`. The server
  runs TypeScript directly with Node 24's built-in type stripping (`node --watch` in
  development, `node` in production). All packages enable `erasableSyntaxOnly` and
  `verbatimModuleSyntax`, so no enums, namespaces, or parameter properties are used.
- **Rationale**: removes a build step and a runner dependency (tsx, ts-node) for the server.
  Workspace packages resolve to their real path outside `node_modules`, where Node strips
  types. The web app is built by Vite. Type checking is a separate `tsc --noEmit` gate.
- **Alternatives considered**: tsx (extra dependency, same result); bundling the server with
  tsdown (only needed if type stripping proves insufficient, kept as fallback).

## R3. Client–server contract

- **Decision**: Hono routes validate input with `@hono/zod-validator` using schemas from
  `packages/domain`; the web app calls the API through Hono's typed RPC client (`hc`) with
  the server's exported `AppType`. TanStack Query manages fetching, caching, and the
  dispatch board's polling.
- **Rationale**: end-to-end types with no code generation and no duplicate API types
  (Constitution V). Schemas are shared, so the browser validates forms with the same rules
  the server enforces (Constitution III).
- **Alternatives considered**: OpenAPI generation (extra tooling); tRPC (non-HTTP-first,
  weaker fit for a future native client).

## R4. Web routing and forms

- **Decision**: TanStack Router with file-based routes and typed search params; forms with
  React Hook Form and the Zod resolver, rendered through shadcn/ui form components.
- **Rationale**: typed routes and search params cover board filters and history search in
  the URL (shareable, back-button safe). React Hook Form is shadcn/ui's form foundation.
- **Alternatives considered**: React Router 8 (less type safety for search params); TanStack
  Form (smaller shadcn/ui ecosystem).

## R5. Authentication, roles, sessions, and lockout

- **003 T131 session-read refinement (2026-10-19 UTC)**: a pending session fetch must
  not survive a native offline event and indefinitely hold cached courier navigation.
  Link a per-read AbortController to the native QueryFunctionContext signal and offline
  event; remove listeners after settlement. Interrupted reads keep the existing network
  error/fallback, not a fabricated valid session. Null/401/403/invalid DTO decisions,
  session expiry and sign-in/out/admin/password mutations stay unchanged. See 003's
  plan/R15 for retained real-browser RED, browser compatibility and required gates.

- **Decision**: Better Auth with email and password, the admin plugin, and three roles
  (`owner`, `dispatcher`, `courier`) defined with its access-control helper. Sessions live in
  PostgreSQL with a fixed 30-day lifetime and session refresh disabled (clarification Q4).
  The admin plugin provides user creation, role changes, deactivation (ban), and revoking a
  user's sessions (FR-032, FR-033a). Password reset uses Better Auth's reset flow with a
  single-use token valid for 60 minutes, sent through Resend, with sessions revoked on
  reset. Passwords have 8–128 characters (NIST SP 800-63B minimum, no composition rules).
  Self-registration is disabled; the seed creates the first owner. The last-active-owner
  rule (FR-032) is a check inside the transaction that bans or demotes.
- **Lockout (FR-033)**: Better Auth rate-limits by IP but has no per-account lockout. A
  `before` hook on the email sign-in endpoint counts consecutive failures per account in the
  database; the fifth failure locks the account for 15 minutes, and a success resets the
  counter.
- **Rationale**: vetted library (Constitution IX) that stores users and sessions in our own
  database; only the lockout needs custom code, and it is a small, testable rule.
- **Alternatives considered**: hand-rolled sessions (forbidden by Constitution IX); hosted
  auth (vendor dependency and data outside the client's account).

## R6. Tracking numbers

- **Decision**: 8 random characters from Crockford's Base32 alphabet (no I, L, O, U),
  displayed as two groups of 4 (`7K3F-9Q2M`), generated with `crypto.getRandomValues`,
  protected by a unique index with retry on collision. Input is normalized (case-insensitive,
  hyphen optional, O→0, I/L→1).
- **Rationale**: FR-011 (short, readable aloud, unambiguous). 32⁸ ≈ 1.1 × 10¹² values make
  collisions negligible at a few thousand shipments a year. The public tracking link uses a
  separate unguessable token defined in feature 004.
- **Alternatives considered**: sequential numbers (reveal volume, guessable); UUIDs (too long
  to read aloud).

## R7. Neighborhood catalog and fuzzy matching

- **Decision**: PostgreSQL extensions `unaccent` and `pg_trgm`. Each neighborhood has a
  canonical name and spelling variants; search normalizes input (lowercase, no accents, no
  punctuation) and ranks by trigram similarity. Bulk preview proposes the best match above
  a similarity threshold and asks for confirmation (FR-005, FR-020).
- **Initial catalog**: Medellín neighborhoods by comuna and corregimiento from the city's
  open data, plus Bello, Itagüí, Envigado, Sabaneta, La Estrella, Copacabana, Caldas,
  Girardota, and San Antonio de Prado as entries at municipality level (their rate depends
  only on the municipality), plus special destinations: Terminal Norte, Terminal Sur, the
  airport, and carrier offices. Spelling variants are seeded from the 551 distinct
  destinations in the historical ledger. Dispatchers add neighborhoods as they appear.
- **Rationale**: native database features instead of a search library; the catalog grows
  with real use.
- **Alternatives considered**: client-side fuzzy search library (duplicates logic, no index);
  geocoding API (cost, poor results with Colombian addresses; rejected in decision #19).

## R8. Rate card model

- **Decision**: one table of rate card entries, each either a zone rate or the express
  surcharge, standard or for one merchant, with `effective_from` (00:00 Bogotá of the
  effective day). The applicable value is the entry with the latest `effective_from` not
  after the registration time, ties won by the latest `created_at`, merchant entry first,
  standard second. Rows are never updated: a correction is a new row. The fee calculation is a pure function in `packages/domain`, fed by
  one query.
- **Rationale**: FR-006, FR-028, clarification Q2. Effective dates keep history without
  updates or deletes; the pure function is test-first friendly.
- **Alternatives considered**: separate tables per kind (more joins, same information);
  versioned rate cards as whole documents (heavier to edit for one change).

## R9. Dispatch board freshness and time

- **Decision**: TanStack Query polling every 20 seconds while the board is visible, paused
  when the tab is hidden. "En riesgo" and "Atrasado" flags are derived in
  `packages/domain` from the latest delivery time and a clock corrected by the server's
  time (from each response's `Date` header), recomputed every 30 seconds on screen.
- **Rationale**: FR-023 and SC-004 (≤ 30 s) at this scale; decision #30. Correcting the clock
  prevents wrong flags on office computers with drifting clocks.
- **Alternatives considered**: server-sent events (more moving parts for about 20 shipments
  a day).

## R10. Concurrency and audit

- **Master data audit (FR-036)**: one append-only `audit_events` table written by a small
  helper in the same transaction as each master data or user change.
- **Decision**: each shipment has an integer `version`; updates run
  `… WHERE id = $1 AND version = $2` and increment it; zero affected rows returns a conflict
  error shown as "Este envío cambió; revisa la versión más reciente" (FR-018). Every
  mutation writes a `shipment_events` row with author, time, type, reason, and a JSON diff
  in the same transaction (Constitution IV, FR-016).
- **Rationale**: optimistic concurrency without locks; the audit trail and the state change
  can never diverge.
- **Alternatives considered**: row locks (hold connections across user think time); database
  triggers for audit (hides logic outside the domain layer).

## R11. Bulk registration input and export output

- **Decision**:
  - Pasted rows: tab-separated text parsed with Papa Parse (auto-detects tabs and commas).
  - Uploaded files: `.xlsx` read in the browser with `read-excel-file`, `.csv` with Papa
    Parse.
  - Both produce raw string rows sent to a server preview endpoint that validates,
    matches neighborhoods, and computes fees. Confirmation sends the approved rows back and
    creates them in one transaction per batch (the 200-row limit keeps it small).
  - Exports: CSV generated on the server; `.xlsx` with `write-excel-file`.
- **Rationale**: the server remains the single place for validation and pricing; the
  libraries are small and actively maintained.
- **Alternatives considered**: SheetJS (the npm package is outdated; current builds are
  distributed outside npm); ExcelJS (heavier, slower maintenance).

## R12. Design system implementation

- **Decision**: shadcn/ui initialized with the Base UI primitive layer (the shadcn/ui
  default since July 2026) and Tailwind CSS 4. M3 color roles are generated once from the
  seed `#2B3A8F` (Tonal Spot, plus high contrast) with `@material/material-color-utilities`
  by a script, written to a committed tokens stylesheet, and mapped to shadcn/ui variables
  as defined in `docs/design-system.md` §3.4. Icons come from `@material-symbols/svg-400`
  (Rounded), imported one by one. Roboto is self-hosted.
- **Rationale**: tokens are generated, not hand-picked (design system §3.1); nothing
  generates colors at runtime.
- **Alternatives considered**: runtime dynamic color (unnecessary, one fixed seed); Radix
  primitives (still supported, but Base UI is the maintained default).

## R13. Testing strategy

- **T154 investigation refinement (2026-10-19 UTC)**: PR #31's retained first-failure
  trace shows Sonner expiry during a full axe scan with an open modal. Base UI keeps
  live regions outside background hiding; a modal is not proof that notification
  stabilization can be skipped. Use actual built-app notifications/modal input and
  a case-local native clock to reproduce missing stabilization before correction.
  Native keyboard expansion/pointer hover are candidates only until focus and normal
  expiry cleanup are proven, including modal Escape propagation and occluded courier
  toasters. Preserve existing 003 T100/T112 cases and all complete axe rules/budgets;
  reject hiding/dismissing nodes, changed lifetime/colors, force or a green-rerun loop.
  Permanent modal/native-clock RED proves expiry while the helper is unchanged.
  Select native Alt+t pause with original modal focus restored before axe; preserve
  an already expanded user stack. Native Escape cleanup would also close the modal,
  and hover cannot reach a courier toaster below its sheet. The smallest test-only
  cleanup uses one explicitly synthetic bubbling MouseEvent('mouseout') to invoke
  Sonner's native onMouseLeave release, verifying collapse/normal expiry in finally.
  It is NOT actual hover/hit-test evidence or an allowed product-interaction shortcut;
  no CSS, duration, production state, private React API or dependency changes.

- **Decision**:
  - Vitest unit tests next to the code for `packages/domain` (lifecycle, fees, payment
    modes, delivery windows, flags, tracking numbers, schemas), written first.
  - Vitest integration tests for the server against a real PostgreSQL 18 started with
    Testcontainers, one database per test file, migrations applied, data truncated
    between tests.
  - Playwright end-to-end tests for the critical flows of this feature: register a
    shipment, bulk registration, board flags, search.
  - A fake clock is injected wherever time matters.
- **Rationale**: Constitution VI (test-first, real PostgreSQL, deterministic tests).
- **Alternatives considered**: PGlite in-process PostgreSQL (fast, but not the production
  engine; lacks some extensions); mocked repositories (forbidden).

## R14. Observability and error reporting

- **Decision**: pino structured JSON logs with a request id per request (Hono `requestId`
  middleware); Sentry for server and browser errors when `SENTRY_DSN` is set (decision #27).
  Logs never include secrets, passwords, or full recipient phone numbers.
  IV-36/T151 additionally reproduces a native password-reset bearer token in the
  request path. The request logger must use the callback route template instead
  of that segment (including encoded/case variants), leaving the real native request
  and redirect untouched. A real emailed callback regression fails before correction;
  assert log privacy using booleans so failing tests do not print captured tokens.
- **Rationale**: enough to diagnose production issues on a single VPS; PII kept out of logs
  (Constitution IX).
- **Alternatives considered**: OpenTelemetry collector (unjustified extra process).

### OP-01 request-log boundary refinement (2026-10-23)

- Generate correlation IDs on the server; never adopt a client-supplied `X-Request-Id` as
  logger context. If the response returns a correlation header, return the generated value.
- Log a registered Hono route template or a fixed unmatched-route class, never an arbitrary
  request path. Preserve the existing public bearer and password-reset redactions before
  applying any route fallback. Do not log query strings, request headers, or bodies.
- Do not pass raw Resend, S3, or other provider error objects or `String(error)` values to
  Pino. Project only safe fixed failure metadata; provider messages, payloads, request URLs,
  recipients, keys, and arbitrary causes are not log fields.
- Verify with a native-server request containing distinct markers in an unmatched path,
  query, `X-Request-Id`, another header, and body, plus a provider failure sentinel. Assert
  marker absence without embedding marker values in failed assertion output, while retaining
  a useful route class, status, duration, and server-generated correlation ID.

### T152 refinement — native error-envelope privacy

- **Decision (2026-10-20)**: configure the installed native server/browser SDKs for
  error reporting only. Reconstruct a fresh allowlisted event in `beforeSend`; never
  spread SDK request/context/transaction/user/extra/tags, arbitrary causes, breadcrumbs,
  runtime messages or URL-bearing stack data into the result. Keep a bounded built-in
  classification, fixed message and useful validated structural locations. Server
  classification of T153's projected Error is a bounded disclosure policy, not proof
  of provenance; retain its fixed SQLSTATE projection without arbitrary message text.
  Browser frames refer only to verified immutable application chunks; label a reporting
  site fallback honestly rather than presenting it as the original fault.
  Omit caller timestamps and generate a fresh cryptographic event ID rather than trusting
  format-valid caller metadata. The application does not consume `captureException`'s
  returned ID; it is not a correlation promise for the outgoing projected event.
- **SDK boundary**: `beforeSend` does not filter every envelope type. Disable unneeded
  session, transaction/tracing, log, metric, replay, profile and attachment channels
  through supported native options/integrations; do not invent removed SDK options or
  disable ordinary error delivery. Verify the whole delivered envelope, not one field.
- **SDK 11.1 streaming correction (2026-10-21)**: with the native default
  `traceLifecycle: "stream"`, `beforeSendTransaction` is deprecated, ignored and emits a
  warning. `beforeSendSpan` must return a span and cannot discard it with `null`. Keep
  native `tracesSampleRate: 0` and omit both hooks; permanent native server/browser tests
  must attempt a real span, confirm no span envelope is delivered, and still capture the
  sanitized error envelope without configuring an ignored transaction hook.
- **Evidence required**: permanent RED before correction for the actual HTTP/Hono app
  with real PostgreSQL failure, the native browser SDK and the compiled lazy reporter
  handling an actual global browser error. Capture only in memory or loopback intake;
  explicitly test disabled reporting and useful enabled delivery. Assertions must not
  print synthetic sensitive sentinels. Child builds use empty/loopback DSNs and isolated
  builds disable environment-file loading. No external reporting, new dependency,
  telemetry wrapper, domain change or T153 callback change is needed.

### T153 refinement — fallback diagnostic privacy

- **Decision**: replace arbitrary exception text with fixed diagnostic messages and
  built-in class labels. Recognize database errors with the installed native
  `DrizzleQueryError`/`postgres.PostgresError` constructors; retain only a validated
  five-character SQLSTATE, never driver messages, queries, parameters, constraints or
  original causes. Construct an independent Error for the existing reporter.
- **Original locations**: accept only bounded V8 frame candidates referring to existing
  `.ts` files in `apps/server/src` or `packages/domain/src`, rooted from `import.meta.url`.
  Reject URL credentials/host/query/fragment, traversal, symlinks (including ancestor
  components), nonexistent files and out-of-bounds line/column positions. Emit only
  project-relative source paths and numeric positions, without function names or stack
  headers. A valid location bounds disclosure; it does not authenticate a supplied stack.
- **Fallback**: if no original frame survives, filter a freshly captured native Error
  stack using the same rules and label it `reporting_site`, not the original fault.
  No global `Error.prepareStackTrace` change, experimental stack API, dependency,
  persistent cache or logging wrapper is needed. Fail closed when source validation fails.
- **Boundaries**: inspect at most 32 frames from 64 KiB of stack and source files up to
  1 MiB, with per-call reuse only. Measure this rare error-path cost. Source deployment
  is immutable and runs `.ts` directly; this is not isolation against hostile replacement
  of source directories during validation. Revalidate if the deployment artifact changes.
- **Evidence**: real PostgreSQL 18 `22P02` includes a synthetic input in the driver message;
  the current handler logs/reports it. A native ordinary TypeError also leaks its message
  and stack header. No actual customer data or external reporting was used. Phase-0
  research verified native constructors and runtime APIs; integration/performance tests
  remain required before adopting the implementation.
- **Alternatives rejected**: trusting driver messages or mutable names, secret-pattern
  regexes, suppressing errors, arbitrary stack passthrough, scanning all source files,
  and confusing a newly captured handler stack with the original fault. SDK-added
  context (T152), native auth logs (T150), reset request paths (T151) and development
  recovery-email logging remain separately owned; this change cannot certify them safe.

## R15. Personal data retention (Ley 1581 de 2012)

- **Decision**: shipment records, including recipient name, phone, and address, are kept for
  10 years as commercial supporting documents (Código de Comercio, art. 60) and are never
  exported outside authorized roles. Recipient data appears only to the dispatcher and the
  owner in this feature. Photo retention (12 months) is handled in feature 003.
- **Rationale**: closes the low-impact compliance item left open by `/speckit-clarify`.
- **Alternatives considered**: shorter retention (conflicts with commercial record keeping).

## R16. Local development and CI

- **Decision**: `compose.yaml` at the root runs PostgreSQL 18 for development. Root
  scripts: `pnpm dev` (server + web with Vite proxy), `pnpm check` (format check, lint with
  zero warnings, type check), `pnpm test`, `pnpm test:e2e`, `pnpm db:generate`,
  `pnpm db:migrate`, `pnpm db:seed`. GitHub Actions runs `check`, `test`, `test:e2e`, and
  `build` on every push and pull request. Production deployment (Docker image, Caddy,
  DigitalOcean) is added when the first release is prepared.
- **Rationale**: Constitution quality gates; one command per gate.
- **Alternatives considered**: Turborepo or Nx (unneeded at three packages).

## R17. Keyboard selection with asynchronous catalog results (T141)

- **Decision**: keep the production combobox's native arrows-and-Enter interaction.
  The keyboard e2e test waits for its fixture's sole filtered result, uses ArrowDown,
  asserts that the intended option is highlighted, then uses Enter. Preserve normal,
  delayed-search and delayed-quote cases and add the initial-empty-response ordering.
- **Evidence**: holding the real initial merchant responses while typing, then releasing
  them, deterministically yields a visible Bullish Hype without `data-highlighted`.
  The unchanged five-second assertion fails; RED trace/context are retained in ignored
  `.git/t141-keyboard-red/`. Installed Base UI boolean `autoHighlight` uses input-change
  behavior; empty results clear its active index and late items need not restore it.
  This establishes a mechanism, not the exact schedule of the historical full-gate
  failure retained separately in `.git/integral-e2e-keyboard/`.
- **Rationale**: `search-combobox.tsx` already documents arrows and Enter. Keyboard access
  does not require automatic selection after an asynchronous response. Twenty focused
  corrected executions pass with real responses and unchanged full axe assertions.
- **Alternatives rejected**: changing application selection policy or upgrading a
  dependency for a test precondition; relying on an internal `always` mode not exposed
  by the installed public boolean prop; sleeps, extra time, retries, forced input or
  removing intended-selection assertions. No API/data-model/contract change is needed.

## R18. Native account transaction boundary and sanitized failures (T130/T131/T150)

- **Decision**: keep the existing Better Auth factory as the single policy/configuration
  definition. Separate its original inputs into `AuthConfig`; accept `Executor` rather
  than only `Db`. `createApp` constructs its root auth from config, and the admin route
  constructs another native instance from the same config and its exact Drizzle `Tx`.
  Do not inject a factory, wrap the auth API, mutate global auth or clone already-bound
  callbacks from `auth.options`: password recovery closes over its original executor.
- **Transaction**: acquire one transaction-scoped PostgreSQL advisory lock for account
  administration, revalidate the owner after waiting, then lock/read the target user.
  Last-owner/link-role guards, actual native mutation and audit share the transaction.
  Courier linking locks its target user before courier rows, using the same row boundary
  as role changes. No remote/user think time occurs inside a transaction.
  The pure refusal rule is defined once in domain `account-rules.ts`; SQL supplies
  locked state and existence facts, not a second independently defined business rule.
- **Failure**: an unsuccessful native HTTP Response must leave the callback through a
  private sentinel and be returned only after rollback. A selective native error hook
  rethrows unexpected/5xx faults to Hono's sanitized error path, preserving known native
  4xx responses. It must not print query parameters or suppress logging globally.
- **Evidence**: a private disposable real-PostgreSQL spike proves nine capabilities:
  audit-fault rollback of ban/sessions and user/credential creation; explicit Response
  rollback; preserved native duplicate-email 400; credential/session-deletion failure
  rollback; successful commit and real sign-in; nested savepoint rollback; two concurrent
  auth instances whose writes satisfy distinct transaction-local SQL marker triggers.
  It uses installed primitives, not database mocks. This is capability evidence, not
  permanent application coverage or a claim that guards/replay are already corrected.
- **New RED**: a trusted actual-app credential-write fault leaves an orphan user and
  sends raw account INSERT/password-column parameters to the native library logger.
  Captured values were observed in memory, never printed. A first relative probe got
  `MISSING_OR_NULL_ORIGIN` before writing; it is a harness refusal, not app RED.
- **Surface**: expose only the contract's native HTTP paths, including the actual emailed
  GET reset callback. Generic admin update accepts name/email only; unsupported admin
  and core mutation paths cannot bypass the guards through a wildcard delegate.
- **Alternatives rejected**: `transaction:true` alone, queued after-hooks, a global auth
  registry/factory abstraction, duplicated callbacks, raw SQL credentials, longer test
  deadlines and unconditional error throwing that turns normal 4xx into 500.
- **Boundaries**: no new table, migration, service or dependency. Native adapter's optional
  transaction flag remains unnecessary; the outer executor supplies atomicity. T132's
  complete client/server replay lifecycle and T139/T146's other boundary/lockout work
  remain separate unfinished work, not silently declared satisfied by this slice.


## R19. Bound account intent receipts and durable browser phases (001/T132)

- **Decision**: creation carries client `id`; every other account mutation carries
  `actionId`. These identify attempts, while Better Auth still generates native user,
  credential and session primary keys. Normalize public names with trim and emails to
  lowercase after strict validation. Preserve native password validation; a replay's
  different password is ignored because the first successful creation already committed.
  Neither passwords nor hashes, fingerprints, cookies or session tokens are compared,
  persisted in receipts or stored in browser intent metadata.
- **Boundary**: within R18's existing account-administration advisory lock, revalidate
  the current actor as an active owner and run native Origin/CSRF validation before
  receipt lookup. Match intent to actor, operation, native target (for edits) and normalized
  public input; conflicting reuse returns `409 idempotency_conflict`. A matching replay
  returns its original safe result before target-state/last-owner/link guards. It writes
  no user/session/audit effect and emits no stored Set-Cookie header. Thus a retried
  self-session-ending action after relogin cannot revoke the new session.
- **Native diagnostics**: pass the existing Pino logger to root and transaction auth.
  The supported native logger callback preserves level and a fixed diagnostic event,
  never native message/arguments (Origin/Referer can carry private URLs). Unexpected
  faults still propagate to the existing sanitized Hono handler with safe SQLSTATE.
  Test native checks in an isolated Node process with production import-time environment;
  Better Auth captures test defaults at module import, so runtime env stubbing is insufficient.
- **Storage**: one `account_action_receipts` row holds the intent UUID, actor FK,
  operation, native target FK, public input JSON, validated success JSON, native 2xx status
  and injected-clock time. CHECKs bound operation/status. Native writes, changed-only
  audit (client event UUID) and receipt commit or roll back together. Unchanged successes
  still receive a receipt without fictitious audit history.
- **Projection**: preserve native envelope shapes, validated against native Better Auth
  types: create/role/ban/unban `{ user }`, profile user directly, revoke `{ success: true }`.
  User fields are allowlisted to id/name/email/emailVerified/createdAt/updatedAt/image/
  role/banned/banReason/banExpires; no opaque native JSON passthrough.
- **Browser**: validate persistent actor/operation/target/public-input/intent metadata
  with Zod. Use a short Web Lock for read/check/write, never hold it during networking.
  Same-input tabs share identity; different pending input cannot overwrite it. ACK removes
  only its matching intent. Network/401/5xx/ambiguous response preserves it; definite native
  rollback 4xx can release it, while identity conflicts retain the original receipt.
  Storage failure or malformed pending data blocks sending without silent deletion.
- **Dialog**: persist only public workflow input, phase ACKs, native created-user ID and
  courier-link action UUID. Resume create→link or profile→role/link in valid role order,
  skipping acknowledged phases. Preserve actor isolation and pending work across reload;
  passwords remain memory-only and must be re-entered after uncertain creation reload.
- **Alternatives rejected**: audit-only lookup (misses no-ops), password fingerprints,
  client-selected native PK, network-held browser locks, replacing uncertain IDs, and
  bypassing native Origin validation on receipt replays. No dependency or service added.

### R19 actor-bound mutation refinement — cross-tab cookie replacement (2026-10-20)

A pending intent can be saved under owner A in one tab, then sent after another tab has
replaced the shared session cookie with owner B. Persisted actor isolation alone cannot
bind the request to the actor whose intent was saved. Require `X-Domy-Actor-Id` with the
UUID from the client's current session snapshot on the six native owner account mutations
and `PUT /api/couriers/accounts/:userId`. This header is an intent consistency check only;
the session cookie, current role check, and native Origin/CSRF validation remain the
authorization boundary.

Missing or malformed values return safe `400 invalid_request`. A valid UUID that differs
from the authenticated actor returns `409 actor_changed`, with no account, link, audit,
or receipt effects and no actor identifiers in the response. Native routes compare inside
the existing transaction after Origin/CSRF and active-owner validation, before receipt
lookup. The courier-link route compares the authenticated request user before entering
`auditedChange`, which also precedes its receipt lookup. No other authentication, read,
or password endpoint requires this header. Keep the guard small and shared; do not extend
the generic audit framework or add a new transaction for linking.

The real-PostgreSQL regression must switch the cookie from A to B while retaining A's
header, prove refusal without effects, then show that a valid B-bound request can use its
unconsumed intent. Existing Origin checks, owner/role checks, replay conflicts and all
session behavior remain covered.

### R19 browser lifecycle constraint — N2 account recovery finding (2026-10-20)

An uncertain ban must be acknowledged before a later unban or new mutation of that same
native account: otherwise a future ban could accidentally reuse the old successful ban
receipt and report success while leaving the account active. Coordinate all operation
intents for an actor/target with one short Web Lock. Show the pending simple operation's
explicit retry control even when refreshed server state would hide its normal button;
block different new mutations until its original ACK is recovered. Profile/role/link
workflows retain their existing public form and fixed phase IDs. A concurrent tab that
already completed a workflow may conservatively ask the other tab to reopen it; no
completion tombstone or invented success is needed. Definite rollback 4xx can release a
workflow only when its matching current stored state still has zero phase ACKs under the
lock. Retain all uncertain/401/5xx/502 outcomes and conservatively retain 409 responses.

The pending-creation workflow is keyed by `new`, and its validated native created-user ID
identifies the matching row's recovery instruction: reopen **Nueva cuenta**, not Editar.
Invalidate the actor's pending-intent query after every dialog submission, including
partial failures and success, so acknowledged recovery immediately releases ordinary
controls without a reload. New error-state browser coverage exposed an existing
FormDialog accessibility defect: `role=alert` on a `ul` removes its list semantics. The
bounded shared correction moves the live alert role to a surrounding div, preserving
the semantic ul/li, messages and full axe assertions.

### R19 retry validation refinement — preserve uncertain earlier commits

A generic 400 or 403 can precede receipt lookup; it cannot prove that an earlier uncertain
attempt never committed. Keep all failed outcomes except HTTP 400 with the installed native
admin code `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`, verified in Better Auth 1.7.6 admin
create/update routes after the wrapper's receipt lookup. Share this exact release predicate
between API intents and zero-ACK workflows. Validate the complete creation input, including
its memory-only password, before networking; a local validation error must retain earlier
pending IDs and workflow phases. An empty password after reload therefore requests re-entry
without discarding a potentially committed creation. No password/fingerprint is persisted.

Fresh creation forms must pass that same complete guard before acquiring workflow metadata,
so an invalid initial password does not leave a zero-ACK draft that blocks correcting public
inputs. Read existing validated workflow state first; after acknowledged creation the
remaining link phase needs no password. Earlier uncertain workflow/intent IDs remain intact
when local re-entry validation fails. The API keeps the same guard for direct callers.

## R20. Validated and recoverable shipment form drafts (001/T137)

- **Decision**: treat `sessionStorage` as untrusted input. Strictly validate the UUID
  envelope and each UI draft shape with Zod before mounting form consumers. Shipment forms
  may be incomplete, so validate their persisted UI shape rather than the final
  `ShipmentCreateInput`. Validate consumed merchant/neighborhood fields while preserving
  extra runtime API option fields; `fromShipment`'s empty municipality/rate-zone IDs are
  legitimate view-model values. Keep valid legacy `{ id, values }` envelopes readable.
  Preserve malformed or unknown raw data until local download and explicit discard. A failed
  storage read prevents form initialization; a failed write preserves in-memory values and
  blocks networking until an explicit persistence retry succeeds.
- **Single/edit uncertain outcome**: before a create or update request, atomically persist
  the exact final validated input, its UUID/action UUID, and the displayed values as pending.
  Freeze form editing after an ambiguous outcome and offer exact replay. Accept an ACK only
  when its shipment ID matches the pending target. Then replace the whole pending envelope
  with a new UUID and next form state in one storage write. This is required because current
  shipment endpoints can return an existing row for a repeated ID/action ID without
  comparing a changed request body; the UI cannot safely let an uncertain identity follow
  later edits.
- **Edit version boundary**: new edit envelopes are stored under a stable shipment key and
  retain `baseVersion`. A pending update may replay its exact older version after a commit,
  while an unsent draft whose baseline is unknown or stale must be downloaded and explicitly
  reloaded from the current shipment before another mutation. Never silently rebase user values.
  Keep pending values visible but disabled. On a definitive `version_conflict`, fetch the current
  shipment and clear the pending marker durably before showing the explicit reload decision.
  Read only a legacy versioned key matching the currently loaded shipment; leave other
  historical version keys untouched for assisted recovery.
- **Pending binding**: at the storage boundary, require the mutation UUID/action UUID and target
  to match the envelope and route, then reconstruct the request with the existing form mapper
  and compare the canonical payload both when reading and saving. This prevents a valid-looking
  envelope from showing form A while retrying request B, or a component effect from overwriting
  a pending snapshot before it is retried. Bulk pending rows also have to agree with the visible
  merchant. Retain mismatched raw data for local recovery without sending it.
- **Local validation while pending**: keep form values visible but read-only and pause pricing,
  pickup-default and other auto-fill writes. Before the first network request, use shared domain
  validation for COD and manual-fee reasons, and wait for the current quote when its inputs are
  complete. Restore server field errors onto visible form fields without automatically releasing
  the pending UUID on `400 invalid_request`. Because a concurrent tab may have committed the same
  identity, show the exact saved request for local download and require an explicit shipment-history
  review before replacing it with a new UUID. Apply the same informed decision to a rejected bulk
  batch while preserving its source rows. If persisting the fresh intent fails, keep the pending
  controls locked until that new envelope is stored.
- **Legacy uncertainty**: an old valid `{ id, values }` single/edit envelope contains no
  sent-state marker or exact final payload. Bulk drafts additionally never stored their
  preview batch/row UUIDs. Preserve their original raw JSON, keep valid visible form values,
  explain that an earlier request may have committed, and require explicit informed
  acknowledgement before creating a fresh intent. Do not silently migrate or imply exact
  replay is possible when the legacy payload was not persisted.
- **Bulk uncertain outcome**: persist the exact validated `BulkConfirmInput` (batch UUID,
  row UUIDs, order and accepted row values) and remaining source rows before confirmation.
  On reload or a lost ACK, retry that same payload. Validate a 2xx result against the
  pending batch and every ordered row identity before releasing it; restore only the saved
  remaining rows. Re-previewing committed rows would pair new IDs with an earlier effect.
- **Form feedback layout**: keep lengthy warnings, duplicate tracking-number lists, field
  errors, and storage recovery instructions in normal document flow. Reserve the sticky
  footer for the primary form action; a high-count duplicate result must not cover fields or
  block ordinary keyboard and pointer access. Preserve the complete duplicate list and
  existing recovery controls.
- **Rationale**: IV-24 demonstrates that syntactically valid JSON is not a valid form draft;
  Constitution V requires a runtime check at this browser-storage boundary. FR-042 makes
  each mutation UUID meaningful only for its exact pending request. Storage errors are
  explicit Spanish actions; raw draft data never enters logs or a remote service.
- **Alternatives rejected**: trust `JSON.parse` casts; silently replace corrupt data with an
  empty draft; validate incomplete fields with the final business schema; enable editing
  while a final mutation is uncertain; or retain bulk identity only in React state. No
  dependency, endpoint, persistence service, or database change is required.
