---

description: "Task list for Shipment Registration and Dispatch Board"
---

# Tasks: Shipment Registration and Dispatch Board

**Input**: Design documents from `/specs/001-shipment-registration/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: REQUIRED. Constitution VI makes test-first non-negotiable for business rules, state
transitions, money, and idempotency. In every phase, test tasks come first and MUST fail
before their implementation tasks start. Integration tests run against real PostgreSQL
(Testcontainers).

**Organization**: tasks are grouped by user story so each story can be implemented, tested,
and demonstrated on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story the task belongs to (US1–US7)
- Every description includes the exact file path

## Path Conventions

Monorepo defined in plan.md: `apps/server/`, `apps/web/`, `packages/domain/`. File and folder
names are English kebab-case (Constitution VIII). URLs are user-facing and therefore Spanish
(Constitution VII); `apps/web/src/routes.ts` maps Spanish paths to English route files with
TanStack Router virtual file routes.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: repository skeleton, tooling, and quality gates

- [X] T001 Create the pnpm workspace at the repository root: `package.json` (private, `packageManager` pnpm 12, `engines.node` ">=24", scripts `dev`, `build`, `check`, `test`, `test:e2e`, `db:generate`, `db:migrate`, `db:seed`, `tokens`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), and `.nvmrc` (24)
- [X] T002 Create `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit`, target ES2024
- [X] T003 [P] Configure linting and formatting in `eslint.config.js` (typescript-eslint `strictTypeChecked`, `no-explicit-any`, `no-non-null-assertion`, ban `@ts-ignore`) and `prettier.config.js`; `pnpm check` runs Prettier check, ESLint with `--max-warnings 0`, and `tsc --noEmit` in every package
- [X] T004 [P] Scaffold `packages/domain/` with `package.json` (name `@domy/domain`, `exports` → `./src/index.ts`, dependency zod 4), `tsconfig.json`, `vitest.config.ts`, and an empty `src/index.ts`
- [X] T005 [P] Scaffold `apps/server/` with `package.json` (name `@domy/server`; hono, @hono/node-server, @hono/zod-validator, drizzle-orm, postgres, better-auth, resend, pino, write-excel-file; dev: drizzle-kit, vitest, testcontainers, @testcontainers/postgresql), `tsconfig.json`, `vitest.config.ts`, and `drizzle.config.ts`
- [X] T006 [P] Scaffold `apps/web/` with `package.json` (name `@domy/web`; react, @tanstack/react-router, @tanstack/react-query, react-hook-form, @hookform/resolvers, tailwindcss, sonner, papaparse, read-excel-file, @material-symbols/svg-400; dev: vite, @vitejs/plugin-react, @tanstack/router-plugin, vite-plugin-svgr, @playwright/test), `tsconfig.json`, `vite.config.ts` (proxy `/api` to the server), and `index.html` with `lang="es-CO"`
- [X] T007 [P] Create `compose.yaml` (PostgreSQL 18 for development), `.env.example` (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `APP_URL`, `API_PORT`, `RESEND_API_KEY`, `EMAIL_FROM`, `SENTRY_DSN`, `DOMY_FAKE_NOW`, each with a comment), and extend `.gitignore` (`node_modules/`, `dist/`, `test-results/`, `playwright-report/`)
- [X] T008 [P] Create `.github/workflows/ci.yml` running `pnpm check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` on push and pull request
- [X] T009 [P] Write `README.md` (what Domy is, setup commands from quickstart.md, links to `docs/` and the constitution) and `CLAUDE.md` (runtime guidance consistent with the constitution: language convention, glossary, Spec Kit flow, quality gates)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: shared domain rules, database, authentication, API skeleton, design system, and
test harnesses that every user story needs

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

### Tests first

- [X] T010 [P] Write failing unit tests in `packages/domain/src/text-normalization.test.ts`: lowercase, accents removed, punctuation removed, single spaces ("Copàcabana " → "copacabana", "Terminal del Norte" → "terminal del norte")
- [X] T011 [P] Write failing unit tests in `packages/domain/src/money.test.ts`: format 13000 → "$ 13.000"; parse "$ 13.000", "13000", "13 000" → 13000; reject decimals, negatives, and empty input
- [X] T012 [P] Write failing unit tests in `packages/domain/src/shipment-lifecycle.test.ts` for the transition table in data-model.md §Shipment lifecycle: allowed and refused transitions, editable statuses (`registered`, `assigned`, `dispatched`), final statuses (`delivered`, `returned`, `voided`), void allowed only from editable statuses
- [X] T013 [P] Write failing unit tests in `packages/domain/src/bogota-time.test.ts` (FR-039): at 19:30 in `America/Bogota` (00:30 UTC of the next day) the current day is the Colombian day; start and end of a Colombian day as instants; a local time on a service date converts to the right instant
- [X] T014 [P] Write failing unit tests in `apps/server/src/lib/clock.test.ts`: returns the system time; honors `DOMY_FAKE_NOW` only when `NODE_ENV` is `development` or `test`

### Domain

- [X] T015 [P] Implement `packages/domain/src/text-normalization.ts` (`normalizeText`) until T010 passes
- [X] T016 [P] Implement `packages/domain/src/money.ts` (`formatCop`, `parseCop`, integer COP only) until T011 passes
- [X] T017 [P] Implement `packages/domain/src/shipment-lifecycle.ts`: status list, transition table, `canTransition`, `isEditable`, `isFinal`, and Spanish UI labels from the glossary, until T012 passes
- [X] T018 [P] Implement `packages/domain/src/bogota-time.ts` (`bogotaToday`, `bogotaDayRange`, `bogotaLocalTimeToInstant`) until T013 passes
- [X] T019 Create shared enums and base Zod schemas in `packages/domain/src/schemas/enums.ts` (`userRole`, `shipmentKind`, `shipmentStatus`, `paymentMode`, `serviceLevel`, `packageSize`, `neighborhoodKind`, `rateEntryKind`) with Spanish labels, and export everything from `packages/domain/src/index.ts`

### Database

- [X] T020 Implement `apps/server/src/env.ts`: Zod-validated environment (`DATABASE_URL`, `BETTER_AUTH_SECRET` min 32 chars, `APP_URL`, `API_PORT`, `EMAIL_FROM`, optional `RESEND_API_KEY`, `SENTRY_DSN`, `DOMY_FAKE_NOW`); the process exits with a clear message when invalid
- [X] T021 Implement `apps/server/src/lib/clock.ts` until T014 passes, and `apps/server/src/db/client.ts` (postgres.js + Drizzle)
- [X] T022 [P] Define enums in `apps/server/src/db/schema/enums.ts` exactly as data-model.md §Enumerations (including `shipment_event_type` and `audit_action`)
- [X] T023 [P] Define `users`, `sessions`, `accounts`, `verifications` in `apps/server/src/db/schema/auth.ts` per data-model.md §Access: `role` not null default `courier`, `banned`, `ban_reason`, `ban_expires`, `failed_sign_in_count` default 0, `locked_until`; `email` unique case-insensitive
- [X] T024 [P] Define `merchants`, `merchant_aliases`, `pickup_points`, `couriers`, `courier_aliases`, `carriers` in `apps/server/src/db/schema/directories.ts` per data-model.md §Directories: merchant name unique by normalized value; `alias_normalized` unique per directory; partial unique index "at most one default per merchant"; `couriers.user_id` unique optional
- [X] T025 [P] Define `municipalities`, `rate_zones`, `neighborhoods`, `neighborhood_variants`, `rate_card_entries` in `apps/server/src/db/schema/geography.ts` per data-model.md §Geography and rates: `name_normalized` unique with `municipality_id`, trigram indexes, `needs_review`, `variant_normalized` unique; rate entries append-only with checks "`zone_rate` > 0; `express_surcharge` ≥ 0" and "`rate_zone_id` required when `kind = zone_rate`; null when `express_surcharge`"
- [X] T026 [P] Define `shipments`, `shipment_events`, `bulk_batches` in `apps/server/src/db/schema/shipments.ts` per data-model.md §Shipments, including the checks: "`cash_on_delivery` ⇒ `cod_amount > 0`; `recipient_pays_fee` ⇒ `cod_amount = fee`; `merchant_account` ⇒ `cod_amount = 0`", kind-specific required columns, "`status = 'voided'` ⇔ `void_reason is not null`", `fee > 0`, `window_start < window_end`, `tracking_number` char(8) unique, `client_event_id` unique, and the listed indexes
- [X] T027 [P] Define `audit_events` in `apps/server/src/db/schema/audit.ts` per data-model.md §Audit of master data (append-only; `entity_type`, `entity_id`, `action`, `actor_user_id`, `occurred_at`, `changes`, `client_event_id` unique)
- [X] T028 Generate and review the first migration in `apps/server/src/db/migrations/` (extensions `unaccent` and `pg_trgm`, all tables, checks, and indexes) and add the `db:generate` and `db:migrate` scripts to `apps/server/package.json`

### Server skeleton and authentication

- [X] T029 Implement `apps/server/src/lib/errors.ts`: `AppError` with the codes and HTTP statuses of contracts/http-api.md §Conventions, and a Hono error handler returning `{ error: { code, message, fields? } }` with Spanish messages
- [X] T030 Implement `apps/server/src/auth.ts`: Better Auth with the Drizzle adapter mapped to the plural tables, email and password with 8–128 characters and sign-up disabled, admin plugin with roles `owner`, `dispatcher`, `courier`, sessions of 30 days with refresh disabled, sessions revoked on password reset
- [X] T031 Implement `apps/server/src/lib/auth-guard.ts`: Hono middleware `requireRole(...roles)` that loads the session, refuses banned users, and returns `401 unauthenticated` or `403 forbidden`
- [X] T032 Implement `apps/server/src/lib/audit.ts`: `recordAudit(tx, { entityType, entityId, action, actorUserId, changes })` writing to `audit_events` in the caller's transaction, and `apps/server/src/lib/action-id.ts`: exactly-once helper that returns the current record when a request's `actionId` already exists as an event's `client_event_id` (FR-042)
- [X] T033 Implement `apps/server/src/app.ts` (request id, pino logger with redaction of passwords, cookies, and recipient phone, error handler, `/api/auth/*`, route mounting, exported `AppType`, static serving of the built web app in production) and `apps/server/src/index.ts` (entry point)
- [X] T034 Create the integration test harness in `apps/server/tests/setup/database.ts` (PostgreSQL 18 Testcontainer per test file, migrations applied, truncate between tests) and `apps/server/tests/setup/app.ts` (app factory, helpers to create and sign in users of each role, fake clock)

### Seed

- [X] T035 Compile the go-live neighborhood catalog as `apps/server/src/db/seed/neighborhoods.csv` (columns: name, municipality, rate zone, kind, variants): Medellín neighborhoods from the city's open data; Bello, Itagüí, Envigado, Sabaneta, La Estrella, Copacabana, Caldas, Girardota, San Antonio de Prado at municipality level; handoff places (Terminal del Norte, Terminal del Sur, airport, carrier offices); spelling variants derived from the destinations in `docs/discovery/raw/master-ledger-2027.xlsx` (names only, no personal data). One-time step that needs the local, git-ignored workbook; only the resulting CSV is versioned
- [X] T036 Implement `apps/server/src/db/seed/index.ts` (idempotent): municipalities; rate zones and standard rates from business master §6 (Medellín 13000; Bello–Itagüí 15000; Envigado–Sabaneta–La Estrella 16000; Copacabana 20000; San Antonio de Prado 19000; Terminales y aeropuerto 15000); standard express surcharge 4500; neighborhoods from T035; carriers; Amy Tecnology with its rate card (Medellín 9700; municipalities 10700; terminals 15000), flagged in a code comment and in the seed output as "inferred from the ledger; confirm with the owner before production"; the first owner account with credentials printed once

### Web foundation

- [X] T037 [P] Implement `scripts/generate-design-tokens.ts`: generate M3 roles (light, dark, high contrast; Tonal Spot) from seed `#2B3A8F` plus harmonized custom colors `success`, `warning`, `info` with `@material/material-color-utilities`, and write `apps/web/src/styles/tokens.css`
- [X] T038 Create `apps/web/src/styles/globals.css`: Tailwind 4 theme mapping shadcn/ui variables to M3 roles (design-system.md §3.4), the M3 type scale utilities, shape, elevation, motion, and state-layer tokens (§4–§6), self-hosted Roboto from `apps/web/public/fonts/`, and `prefers-reduced-motion`
- [X] T039 Initialize shadcn/ui with the Base UI layer (`apps/web/components.json`) and add the base components restyled to M3 in `apps/web/src/components/ui/`: button (filled, tonal, outlined, text), input, textarea, form, select, combobox, dialog, alert-dialog, badge, tabs, table, sidebar, toggle-group, calendar, popover, sonner; every interactive target at least 48 × 48 px
- [X] T040 [P] Implement `apps/web/src/components/icon.tsx` (Material Symbols Rounded, weight 400, SVG imports, sizes 20 and 24) and `apps/web/src/components/shipment-status-chip.tsx` (label + icon + color role per status, design-system.md §8)
- [X] T041 [P] Implement `apps/web/src/lib/api-client.ts` (Hono RPC client typed with `AppType`, TanStack Query client, mapping of API errors to Spanish messages), `apps/web/src/lib/format.ts` (`es-CO` dates and times in `America/Bogota`), and `apps/web/src/lib/clock.ts` (clock corrected with the server `Date` header)
- [X] T042 Implement routing in `apps/web/src/routes.ts` (virtual file routes mapping Spanish URLs to English files), `apps/web/src/main.tsx`, `apps/web/src/routes/root.tsx`, `apps/web/src/routes/panel-layout.tsx` (top app bar, navigation rail or drawer by window size class, session guard redirecting to `/ingresar`, navigation items by role), and the sign-in page `apps/web/src/routes/sign-in.tsx` with `apps/web/src/features/auth/sign-in-form.tsx`
- [X] T043 Create the end-to-end harness: `apps/web/playwright.config.ts`, `apps/web/tests/e2e/global-setup.ts` (test database, migrations, seed, server and web started), and `apps/web/tests/e2e/fixtures.ts` (signed-in owner, dispatcher, and courier sessions; fake clock control)

**Checkpoint**: `pnpm check` and `pnpm test` pass; the seeded owner can sign in and sees an
empty panel

---

## Phase 3: User Story 1 - Register a shipment (Priority: P1) 🎯 MVP

**Goal**: the dispatcher registers a shipment with automatic fee, payment mode rules, and a
tracking number, recorded with author and time

**Independent Test**: sign in as dispatcher, register a delivery for an existing merchant to
a catalog neighborhood with "Contraentrega", and verify fee, COD amount, tracking number,
status "Registrado", and the creation event

### Tests for User Story 1 ⚠️ write first, must fail

- [X] T044 [P] [US1] Unit tests in `packages/domain/src/fees.test.ts` for the fee rule (data-model.md): merchant zone rate over standard; express adds the surcharge; merchant surcharge of 0 is valid; latest `effective_from` not after `registeredAt`; ties won by latest `created_at`; missing zone rate → manual fee and `needsReview`; errand → manual, no review
- [X] T045 [P] [US1] Unit tests in `packages/domain/src/payment-modes.test.ts` (FR-009): "Contraentrega" requires COD > 0; "Flete al destinatario" sets COD = fee and follows a changed fee; "Crédito del cliente" sets COD = 0; the other two keep their COD when the fee changes
- [X] T046 [P] [US1] Unit tests in `packages/domain/src/delivery-windows.test.ts` (FR-010): presets to `windowStart`/`windowEnd` on the service date in `America/Bogota` ("En la mañana" 08:00–12:00, "En la tarde" 12:00–20:00, "Antes de las 17:00" → end 17:00), start < end, times within 08:00–20:00, warning flags for Sunday and past windows
- [X] T047 [P] [US1] Unit tests in `packages/domain/src/tracking-numbers.test.ts` (FR-011, research R6): 8 Crockford Base32 characters, no I, L, O, U; display `XXXX-XXXX`; normalization of lowercase, hyphen, O→0, I/L→1
- [X] T048 [P] [US1] Unit tests in `packages/domain/src/schemas/shipment.test.ts` for `ShipmentCreateInput`: client-generated `id` (UUID) required (FR-042), required fields per kind (FR-002), phone of 10 digits, reasons of 5–200 characters (FR-040), `fee > 0`, package count ≥ 1
- [X] T049 [P] [US1] Integration tests in `apps/server/tests/shipments-create.test.ts` covering spec US1 scenarios 1–14 (including the repeated create with the same `id` returning `200` and a single shipment, and the default service date at 19:30 Bogotá being the Colombian day), a one-off pickup address (FR-003), FR-035 ("Tarifa por revisar" when no rate exists), FR-037 (`422 confirmation_required` for fee > 100000 or COD > 2000000 without `confirmed`), FR-013 duplicates by reference and by phone, the `created` event with author and time, and `403` for a courier
- [X] T050 [P] [US1] Integration tests in `apps/server/tests/lookups.test.ts`: merchant search by name and alias; pickup points with the default; recipient suggestions limited to the same merchant (FR-004); fuzzy neighborhood search ("copàcabana" → Copacabana); neighborhood added by a dispatcher gets `needs_review = true` and an `audit_events` row (FR-036); repeating the add with the same `id` creates one neighborhood (FR-042)
- [X] T051 [P] [US1] End-to-end test in `apps/web/tests/e2e/register-shipment.spec.ts`: quickstart scenarios 1–4 and 15, keyboard-only registration, values kept in the form after a failed save (FR-038)

### Implementation for User Story 1

- [X] T052 [P] [US1] Implement `packages/domain/src/fees.ts` (pure `calculateFee`) until T044 passes
- [X] T053 [P] [US1] Implement `packages/domain/src/payment-modes.ts` until T045 passes
- [X] T054 [P] [US1] Implement `packages/domain/src/delivery-windows.ts` until T046 passes
- [X] T055 [P] [US1] Implement `packages/domain/src/tracking-numbers.ts` until T047 passes
- [X] T056 [US1] Implement `packages/domain/src/schemas/shipment.ts` (`ShipmentCreateInput`, `FeeQuoteInput`, `Shipment`, `ShipmentEvent`, `ShipmentDetail`) until T048 passes
- [X] T057 [P] [US1] Implement read and add endpoints for the form in `apps/server/src/routes/merchants.ts` (`GET /api/merchants`, `GET /:id/pickup-points`, `GET /:id/recipients`), `apps/server/src/routes/neighborhoods.ts` (`GET` fuzzy search with `unaccent` + `pg_trgm`, `POST` with an existing rate zone and `needs_review` for dispatchers), and `apps/server/src/routes/carriers.ts` (`GET`), until T050 passes
- [X] T058 [US1] Implement in `apps/server/src/routes/shipments.ts`: `POST /api/shipments/fee-quote`, `POST /api/shipments` (one transaction: insert with the client `id`, returning the existing shipment on conflict; rate card query, fee rule, payment mode rule, tracking number with retry on unique violation, `created` event), `GET /api/shipments/duplicates`, `GET /api/shipments/:id`, and `GET /api/shipments?trackingNumber=`, until T049 passes
- [X] T059 [P] [US1] Build the form fields in `apps/web/src/features/shipments/`: `merchant-combobox.tsx`, `pickup-point-select.tsx`, `recipient-autocomplete.tsx`, `neighborhood-combobox.tsx` (with "add neighborhood" dialog), `payment-mode-fields.tsx`, `delivery-window-field.tsx`, `fee-field.tsx` (calculated fee, override with reason), all with Spanish labels from the glossary
- [X] T060 [US1] Build `apps/web/src/features/shipments/shipment-form.tsx` and the route `apps/web/src/routes/shipment-new.tsx` (`/envios/nuevo`): fields by shipment kind, live fee quote, duplicate warning, Sunday and past-window warnings, confirmation dialogs for high amounts, success snackbar with the tracking number
- [X] T061 [US1] Implement form resilience in `apps/web/src/features/shipments/use-form-draft.ts` (FR-038, FR-042): values stay after failed saves, expired sessions, and lost connection; the shipment `id` is generated once per draft with `crypto.randomUUID()` and reused on every retry; no success message unless the server confirmed
- [X] T062 [US1] Build the shipment detail with its history in `apps/web/src/features/shipments/shipment-detail.tsx` and `apps/web/src/routes/shipment-detail.tsx` (`/envios/$trackingNumber`), until T051 passes

**Checkpoint**: User Story 1 works on its own — shipments can be registered and inspected

---

## Phase 4: User Story 2 - See the day on the dispatch board (Priority: P1)

**Goal**: a live board of the selected day with counts, at-risk and late flags, pending
shipments from previous days, and filters

**Independent Test**: register shipments with and without delivery windows, move the clock to
44 minutes before a window closes, and verify counts, "En riesgo", and later "Atrasado",
without reloading

### Tests for User Story 2 ⚠️ write first, must fail

- [X] T063 [P] [US2] Unit tests in `packages/domain/src/shipment-flags.test.ts` (FR-022): at risk from 45 minutes before `windowEnd`; late at and after it; only for `registered`, `assigned`, `dispatched`, `picked_up`, `exception`; never without `windowEnd`; past-day windows are late; remaining and overdue time in minutes, in days beyond 24 hours
- [X] T064 [P] [US2] Integration tests in `apps/server/tests/board.test.ts`: counts per status, list fields (FR-021), "pendientes de días anteriores" (earlier service date, not final) included in today's counts, filters by status, merchant, courier, rate zone, and flag, other dates, "today" resolved in `America/Bogota` at 19:30 (FR-039), `serverTime` present
- [X] T065 [P] [US2] End-to-end test in `apps/web/tests/e2e/dispatch-board.spec.ts`: quickstart scenarios 5–7 (flags with the fake clock, pending section, a change visible within 30 seconds in a second browser)

### Implementation for User Story 2

- [X] T066 [P] [US2] Implement `packages/domain/src/shipment-flags.ts` until T063 passes
- [X] T067 [US2] Implement `GET /api/shipments/board` in `apps/server/src/routes/shipments.ts` (`DispatchBoard` schema in `packages/domain/src/schemas/board.ts`) until T064 passes
- [X] T068 [P] [US2] Build `apps/web/src/features/board/board-filters.tsx` (status, merchant, courier, rate zone, and flag chips; state in typed URL search params) and `apps/web/src/features/board/status-counts.tsx`
- [X] T069 [US2] Build `apps/web/src/features/board/board-table.tsx`, `apps/web/src/features/board/pending-section.tsx`, and the route `apps/web/src/routes/dispatch-board.tsx` (`/`): polling every 20 seconds paused when hidden, flags recomputed every 30 seconds with the corrected clock, date picker, empty and loading states, until T065 passes

**Note**: shipments get a courier only through routes (feature 002), so the courier column and
the courier filter of FR-021 and FR-023 arrive with 002 T030. Board filtering and flags live
once in `packages/domain/src/dispatch-board.ts` (`filterBoard`), shared by the endpoint and the
page, which fetches the whole date and recomputes flags every 30 seconds.

**Checkpoint**: User Stories 1 and 2 form the office MVP

---

## Phase 5: User Story 3 - Correct or void a shipment (Priority: P2)

**Goal**: edit or void shipments not yet picked up, with full traceability, and let the owner
confirm fees marked for review

**Independent Test**: edit the COD amount of a registered shipment, void another with a
reason, and verify both in each shipment's history with author, time, and old and new values

### Tests for User Story 3 ⚠️ write first, must fail

- [X] T070 [P] [US3] Integration tests in `apps/server/tests/shipments-update.test.ts` covering spec US3 scenarios 1–7: recalculation with the original `registered_at`, override discarded, COD rule per payment mode, `409 version_conflict`, `409 invalid_transition` from `picked_up`, fields `trackingNumber`, `merchantId`, `kind` rejected, `updated` event with old and new values, a repeated `actionId` returning the current shipment without a second event (FR-042), void with reason 5–200 characters, and `POST /:id/confirm-fee` owner-only clearing `fee_needs_review` with a `fee_confirmed` event (FR-035)
- [X] T071 [P] [US3] End-to-end test in `apps/web/tests/e2e/edit-void-shipment.spec.ts`: quickstart scenarios 8–9, and the owner confirming a "Tarifa por revisar"

### Implementation for User Story 3

- [X] T072 [US3] Add `ShipmentUpdateInput` and `ShipmentVoidInput` (both with `actionId` and `version`) to `packages/domain/src/schemas/shipment.ts`
- [X] T073 [US3] Implement `PATCH /api/shipments/:id`, `POST /api/shipments/:id/void`, and `POST /api/shipments/:id/confirm-fee` in `apps/server/src/routes/shipments.ts` (optimistic `version`, lifecycle check, event with diff in the same transaction) until T070 passes
- [X] T074 [US3] Build the edit route `apps/web/src/routes/shipment-edit.tsx` (`/envios/$trackingNumber/editar`) reusing the shipment form, `apps/web/src/features/shipments/void-dialog.tsx`, the conflict message that keeps typed values, and `apps/web/src/features/shipments/confirm-fee-dialog.tsx` for the owner, until T071 passes

**Checkpoint**: shipments can be corrected and voided with a complete history

---

## Phase 6: User Story 4 - Register shipments in bulk (Priority: P2)

**Goal**: register up to 200 shipments for one merchant from a pasted list or a spreadsheet,
with a row-by-row preview

**Independent Test**: paste 20 rows for one merchant including 2 with errors and 1 misspelled
neighborhood, fix them in the preview, confirm, and verify 20 shipments with correct fees

### Tests for User Story 4 ⚠️ write first, must fail

- [X] T075 [P] [US4] Unit tests in `packages/domain/src/bulk-rows.test.ts` for contracts/bulk-template.md: header detection, the 19 columns in order, case- and accent-insensitive values, money parsing, date `DD/MM/AAAA`, window phrases ("antes de las 5pm", "de 1 a 5pm", "en la tarde"), unknown columns and more than 200 rows rejected
- [X] T076 [P] [US4] Integration tests in `apps/server/tests/bulk.test.ts` covering spec US4 scenarios 1–4: preview statuses `ready`, `needs_confirmation`, `invalid`; neighborhood proposal with similarity; duplicate flag; confirm creates all rows in one transaction or none; `bulk_batches` row and `bulk_batch_id` set; repeating the confirm with the same `batchId` returns the first result without new shipments (FR-042)
- [X] T077 [P] [US4] End-to-end test in `apps/web/tests/e2e/bulk-registration.spec.ts`: quickstart scenario 10 with pasted rows and with an uploaded `.xlsx`

### Implementation for User Story 4

- [X] T078 [P] [US4] Implement `packages/domain/src/bulk-rows.ts` (raw rows → partial `ShipmentCreateInput` with per-field errors) until T075 passes
- [X] T079 [US4] Implement `POST /api/bulk/preview` and `POST /api/bulk/confirm` in `apps/server/src/routes/bulk.ts` until T076 passes
- [X] T080 [P] [US4] Add the downloadable templates `apps/web/public/plantilla-envios.csv` and `apps/web/public/plantilla-envios.xlsx` with the exact Spanish headers of contracts/bulk-template.md
- [X] T081 [US4] Build `apps/web/src/features/bulk/bulk-input.tsx` (paste area, file upload parsed with Papa Parse and read-excel-file), `apps/web/src/features/bulk/bulk-preview-table.tsx` (inline fixes, neighborhood and duplicate confirmation), and the route `apps/web/src/routes/shipment-bulk.tsx` (`/envios/masivo`), until T077 passes

**Note**: rows are corrected in the list itself (the text area, also filled by an uploaded
file) and reviewed again; the preview table takes the neighborhood, duplicate, and amount
confirmations. A value that matches the catalog once accents and case are ignored
("copàcabana") is exact; only fuzzy matches ask for confirmation.

**Checkpoint**: high-volume merchants are registered in minutes

---

## Phase 7: User Story 5 - Search the history (Priority: P2)

**Goal**: find any shipment and export results

**Independent Test**: create shipments across several dates, search by merchant reference and
by recipient phone, verify results and history, and export a spreadsheet with Spanish headers

### Tests for User Story 5 ⚠️ write first, must fail

- [ ] T082 [P] [US5] Integration tests in `apps/server/tests/shipments-search.test.ts`: tracking number first (normalized input), merchant reference, merchant name or alias, recipient name (trigram) and phone (digits only), neighborhood, status, date range, `feeReview` filter (FR-024, FR-035), newest first, cursor pagination
- [ ] T083 [P] [US5] Integration tests in `apps/server/tests/shipments-export.test.ts`: owner only (`403` for dispatcher), CSV and `.xlsx` with the Spanish headers and order of contracts/bulk-template.md §Export columns, money as integers, Bogotá dates
- [ ] T084 [P] [US5] End-to-end test in `apps/web/tests/e2e/history-search.spec.ts`: quickstart scenario 11

### Implementation for User Story 5

- [ ] T085 [US5] Implement `GET /api/shipments/search` in `apps/server/src/routes/shipments.ts` (schemas in `packages/domain/src/schemas/search.ts`) until T082 passes
- [ ] T086 [US5] Implement `apps/server/src/lib/export.ts` (CSV and write-excel-file) and `GET /api/shipments/export` in `apps/server/src/routes/shipments.ts` until T083 passes
- [ ] T087 [US5] Build `apps/web/src/features/history/search-filters.tsx`, `apps/web/src/features/history/results-table.tsx`, the "Tarifa por revisar" filter, the owner-only export buttons, and the route `apps/web/src/routes/history.tsx` (`/historial`) with filters in typed URL search params, until T084 passes

**Checkpoint**: disputes are answered from history; data can be exported at any time

---

## Phase 8: User Story 6 - Maintain master data and the rate card (Priority: P3)

**Goal**: directories, neighborhood catalog, and an effective-dated rate card, with audit

**Independent Test**: create a merchant with two pickup points and an alias, add a
neighborhood, schedule a standard rate effective tomorrow, and verify today's and tomorrow's
fees

### Tests for User Story 6 ⚠️ write first, must fail

- [ ] T088 [P] [US6] Integration tests in `apps/server/tests/merchants.test.ts`: create, edit, deactivate; alias unique among merchants and not equal to another merchant's name (`409 duplicate_alias`); exactly one default pickup point while active ones exist; deactivation response includes the open shipment count; deactivated records absent from lookups and present in history; repeated create with the same `id` creates one record (FR-026, FR-027, FR-029, FR-042)
- [ ] T089 [P] [US6] Integration tests in `apps/server/tests/couriers-carriers.test.ts`: CRUD, courier alias namespace separate from merchants, deactivation, repeated create with the same `id` stored once (FR-042)
- [ ] T090 [P] [US6] Integration tests in `apps/server/tests/neighborhoods.test.ts`: dispatcher adds with an existing zone (`needs_review`), edits name and variants, cannot change `rateZoneId` (`403`); owner changes the zone and confirms the review; only the owner deactivates a neighborhood (`403` for the dispatcher); existing shipments keep their fee (FR-008, FR-026, FR-036)
- [ ] T091 [P] [US6] Integration tests in `apps/server/tests/rate-card.test.ts` covering spec US6 scenarios 1, 4, 6: owner only; effective date at 00:00 Bogotá; future entry not applied before its date; same date → latest added wins; no update or delete; history complete; merchant override of zone rate and of surcharge; a repeated entry with the same `id` is stored once (FR-028, FR-042)
- [ ] T092 [P] [US6] Integration tests in `apps/server/tests/audit-events.test.ts`: every master data change writes an `audit_events` row with author, time, and old and new values; a repeated `actionId` writes one row (FR-042); list is owner-only (FR-036)
- [ ] T093 [P] [US6] Integration tests in `apps/server/tests/master-data-export.test.ts`: owner only (`403` for dispatcher); CSV with Spanish headers for `merchants` (with aliases and pickup points), `couriers`, `carriers`, `neighborhoods` (with municipality and rate zone), and `rate-card` (with history) (FR-025)
- [ ] T094 [P] [US6] End-to-end test in `apps/web/tests/e2e/master-data.spec.ts`: quickstart scenarios 12 and 16, and spec US6 scenario 7

### Implementation for User Story 6

- [ ] T095 [P] [US6] Add master data schemas in `packages/domain/src/schemas/master-data.ts` (merchant, pickup point, courier, carrier, neighborhood, rate zone, rate card entry)
- [ ] T096 [US6] Complete `apps/server/src/routes/merchants.ts` (`POST`, `PATCH`, pickup point `POST` and `PATCH` with the default invariant) with audit, until T088 passes
- [ ] T097 [P] [US6] Implement `apps/server/src/routes/couriers.ts` and complete `apps/server/src/routes/carriers.ts` with audit, until T089 passes
- [ ] T098 [US6] Complete `apps/server/src/routes/neighborhoods.ts` (`PATCH` with owner-only `rateZoneId` and `needsReview`) and implement `apps/server/src/routes/rate-zones.ts` with audit, until T090 passes
- [ ] T099 [US6] Implement `apps/server/src/routes/rate-card.ts` (`GET /api/rate-card`, `GET /history`, `POST /entries`) and `apps/server/src/routes/audit-events.ts`, until T091 and T092 pass
- [ ] T100 [US6] Implement `GET /api/export/:dataset` in `apps/server/src/routes/export.ts` reusing `apps/server/src/lib/export.ts`, and the owner-only `apps/web/src/features/master-data/export-button.tsx` used by every master data screen, until T093 passes
- [ ] T101 [P] [US6] Build the merchant screens in `apps/web/src/features/master-data/merchants/` and the routes `apps/web/src/routes/merchants.tsx` (`/clientes`) and `apps/web/src/routes/merchant-detail.tsx` (`/clientes/$merchantId`): aliases, pickup points, default, deactivation warning
- [ ] T102 [P] [US6] Build the couriers and carriers screens in `apps/web/src/features/master-data/couriers/` and `apps/web/src/features/master-data/carriers/` with routes `apps/web/src/routes/couriers.tsx` (`/mensajeros`) and `apps/web/src/routes/carriers.tsx` (`/transportadoras`)
- [ ] T103 [P] [US6] Build the neighborhood catalog screen in `apps/web/src/features/master-data/neighborhoods/` and `apps/web/src/routes/neighborhoods.tsx` (`/barrios`), including the owner's review list
- [ ] T104 [US6] Build the owner-only rate card screen in `apps/web/src/features/master-data/rate-card/` and `apps/web/src/routes/rate-card.tsx` (`/tarifario`: current rates, scheduled entries, history, merchant overrides) and the change history screen `apps/web/src/routes/audit-log.tsx` (`/auditoria`), until T094 passes

**Checkpoint**: the owner and the dispatcher maintain all reference data without developer help

---

## Phase 9: User Story 7 - Access by role (Priority: P3)

**Goal**: account management, recovery, lockout, session rules, and role enforcement

**Independent Test**: create a dispatcher and a courier; the dispatcher reaches the panel but
not the rate card or users; the courier cannot open the panel

### Tests for User Story 7 ⚠️ write first, must fail

- [ ] T105 [P] [US7] Integration tests in `apps/server/tests/auth-sessions.test.ts` covering spec US7 scenarios 1, 4, 5: session valid on day 29 and expired on day 30 (fake clock, no refresh); banned user refused on the next request; owner revokes a user's sessions (FR-032, FR-033a)
- [ ] T106 [P] [US7] Integration tests in `apps/server/tests/auth-lockout-recovery.test.ts` covering spec US7 scenarios 2, 3, 7, 8: fifth consecutive failure → `423 account_locked` with `retryAt` 15 minutes later; success resets the counter; open sessions survive the lock; recovery link single-use and valid 60 minutes; same response for unknown email; completed recovery ends sessions and lifts the lock; password 8–128 characters; a signed-in user changes their own password (FR-030, FR-033)
- [ ] T107 [P] [US7] Integration tests in `apps/server/tests/users.test.ts`: only the owner creates, edits name and email, changes role, deactivates, and reactivates; no self-registration; `409 last_owner` when deactivating or demoting the last active owner; every change audited (FR-032, FR-036)
- [ ] T108 [P] [US7] Integration tests in `apps/server/tests/role-permissions.test.ts`: for every endpoint in contracts/http-api.md, assert the permission table of spec FR-031 for owner, dispatcher, and courier, and assert that the application registers no `DELETE` route (FR-017)
- [ ] T109 [P] [US7] End-to-end test in `apps/web/tests/e2e/access.spec.ts`: quickstart scenarios 13, 14, and 17, plus password recovery through the captured email

### Implementation for User Story 7

- [ ] T110 [US7] Add the lockout hook to `apps/server/src/auth.ts` (count consecutive failures in `users.failed_sign_in_count`, set `locked_until` on the fifth, reset on success and on completed recovery) until T106 passes for lockout
- [ ] T111 [US7] Implement `apps/server/src/lib/email.ts` (Resend, Spanish recovery email, captured in memory when `NODE_ENV=test`) and wire the 60-minute single-use reset in `apps/server/src/auth.ts` until T106 passes
- [ ] T112 [US7] Implement the last-owner guard and the audit of user changes as hooks on the admin endpoints in `apps/server/src/auth.ts` until T107 passes, and complete `requireRole` coverage on every route until T108 passes
- [ ] T113 [P] [US7] Build `apps/web/src/features/auth/recovery-request-form.tsx`, `apps/web/src/features/auth/reset-password-form.tsx`, `apps/web/src/features/auth/change-password-form.tsx`, and the routes `apps/web/src/routes/recover.tsx` (`/recuperar`), `apps/web/src/routes/reset-password.tsx` (`/restablecer`), and `apps/web/src/routes/account.tsx` (`/cuenta`)
- [ ] T114 [US7] Build the owner-only user management in `apps/web/src/features/users/` and `apps/web/src/routes/users.tsx` (`/usuarios`): create, edit, role, deactivate, reactivate, end sessions; hide navigation items and routes the role may not use; redirect couriers away from the panel, until T109 passes

**Checkpoint**: all seven user stories work independently

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: quality attributes that span user stories

- [ ] T115 [P] Add accessibility checks (axe) to every end-to-end spec through `apps/web/tests/e2e/fixtures.ts` and fix violations until WCAG 2.2 AA passes on all screens, and verify every panel screen stays usable at 600 px wide (FR-034, design-system.md §2)
- [ ] T116 [P] Add the scale test `apps/server/tests/search-scale.test.ts`: generate 100,000 shipments and assert search by tracking number, merchant reference, and recipient phone in under 2 seconds (SC-006)
- [ ] T117 [P] Add `apps/server/tests/log-redaction.test.ts`: no password, cookie, or recipient phone appears in logs (FR-041)
- [ ] T118 [P] Wire optional Sentry error reporting in `apps/server/src/index.ts` and `apps/web/src/main.tsx` (enabled only when `SENTRY_DSN` is set)
- [ ] T119 Verify the production build: `pnpm build` produces the web bundle and the server serves it; record the commands in `README.md`
- [ ] T120 Run every scenario of `specs/001-shipment-registration/quickstart.md` (1–17) and record the results in `specs/001-shipment-registration/quickstart-results.md`, including a go-live checklist item "Amy Tecnology rates confirmed by the owner"
- [ ] T121 Remove dead code and unused dependencies, and confirm `pnpm check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` pass with zero warnings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; blocks every user story
- **User Stories (Phases 3–9)**: depend on Foundational
- **Polish (Phase 10)**: depends on the user stories being delivered

### User Story Dependencies

- **US1 (P1)**: after Foundational. Uses seeded master data; no dependency on other stories
- **US2 (P1)**: after Foundational. Reads shipments; tests create them through the API, so it
  depends on US1's `POST /api/shipments` (T058)
- **US3 (P2)**: after US1 (edits what US1 creates and reuses its form)
- **US4 (P2)**: after US1 (reuses `ShipmentCreateInput` and the creation logic)
- **US5 (P2)**: after US1 (uses the detail page and shipments)
- **US6 (P3)**: after Foundational; extends the lookup routes that US1 starts (T057); its master data export (T100) reuses the export module of US5 (T086)
- **US7 (P3)**: after Foundational; T108 requires the routes of all other stories

### Within Each User Story

- Tests are written first and MUST fail before implementation
- Domain modules before server routes; server routes before web screens
- A story is complete when its end-to-end test passes

### Parallel Opportunities

- Setup: T003–T009 in parallel after T001–T002
- Foundational: T010–T014 together; T015–T018 together; T022–T027 together; T037, T040, T041
  in parallel with the server tasks
- In each story, all test tasks marked [P] together, then domain modules marked [P] together
- After US1, stories US3, US4, and US5 can proceed in parallel; US6 can proceed in parallel
  with US2

---

## Parallel Example: User Story 1

```bash
# Tests first, together:
Task: "Unit tests in packages/domain/src/fees.test.ts"
Task: "Unit tests in packages/domain/src/payment-modes.test.ts"
Task: "Unit tests in packages/domain/src/delivery-windows.test.ts"
Task: "Unit tests in packages/domain/src/tracking-numbers.test.ts"
Task: "Integration tests in apps/server/tests/shipments-create.test.ts"

# Then the domain modules, together:
Task: "Implement packages/domain/src/fees.ts"
Task: "Implement packages/domain/src/payment-modes.ts"
Task: "Implement packages/domain/src/delivery-windows.ts"
Task: "Implement packages/domain/src/tracking-numbers.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 and 2)

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: User Story 1 → validate registration on its own
4. Phase 4: User Story 2 → validate the board; this is the office MVP that replaces the
   daily sheet

### Incremental Delivery

1. Setup + Foundational → the owner can sign in
2. US1 + US2 → MVP
3. US3 → corrections and voiding
4. US4 → bulk registration (63 % of the volume)
5. US5 → history and export
6. US6 → self-service master data and rate card
7. US7 → accounts for the dispatcher and couriers, recovery, lockout
8. Polish → accessibility, scale, quickstart validation

Implementation of this feature starts only after features 002–004 have their own spec,
plan, tasks, and analysis (decision #35 in the business master).

---

## Notes

- [P] tasks touch different files and have no unfinished dependencies
- Verify each test fails before implementing; commit after each task or logical group
- Every task must leave `pnpm check` clean
- No task may add a dependency that is not listed in plan.md without updating the plan
