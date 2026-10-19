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
- **Rationale**: enough to diagnose production issues on a single VPS; PII kept out of logs
  (Constitution IX).
- **Alternatives considered**: OpenTelemetry collector (unjustified extra process).

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
