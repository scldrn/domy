# Implementation Plan: Shipment Registration and Dispatch Board

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
| II. Zero Data Loss in the Field | Every creation carries a client-generated `id` and every other mutation a client-generated `actionId`, so each has exactly one effect (FR-042); updates and voiding also use `version`. Events have `occurred_at` and `recorded_at`, and `client_event_id` is reserved for the courier app (feature 003). Dispatch panel forms survive failures and expired sessions (FR-038). The device-persistence rules apply to feature 003 | ✅ |
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

No constitution violations. Two additions that could look like extra moving parts are
justified inside the principles:

| Addition | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| Testcontainers in tests | Constitution VI requires integration tests on real PostgreSQL, isolated per test file | A shared development database makes tests order-dependent; PGlite is not the production engine |
| `DOMY_FAKE_NOW` clock override (development and test only) | Deterministic validation of time-based flags (FR-022, SC-005) in manual and end-to-end tests | Waiting for real clock times is not reproducible |
