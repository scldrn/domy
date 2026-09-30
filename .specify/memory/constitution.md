# Domy Constitution

Domy is the operations and tracking system for Santiago Marín's urban courier business
in Medellín, Colombia: a dispatch panel, a courier mobile web app, and a public
tracking page. This constitution defines the non-negotiable engineering rules for it.

## Core Principles

### I. Simplicity First

- The system MUST be a single deployable modular monolith: one server process, one
  PostgreSQL database, one object storage bucket. Any additional service, process, queue,
  or cache MUST be justified in the plan's Complexity Tracking table with the simpler
  alternative that was rejected and why.
- Framework and library primitives MUST be used directly. No wrapper layers, interfaces
  with a single implementation, factories for a single product, or configuration for
  values that never change.
- Code MUST NOT be written for requirements that are not in an approved spec. "Later"
  scaffolds for itself.
- A new dependency MUST NOT be added for what the platform, the standard library, an
  already-installed dependency, or a few lines of code can do.

**Rationale**: the client asked for a stable, maintainable product for a few dozen shipments a
day, not an architecture built for Uber-scale. Every extra moving part is another thing
that can fail at 7 a.m. with couriers waiting.

### II. Zero Data Loss in the Field

- Every courier action (pickup, delivery, COD collection, proof-of-delivery photo,
  delivery exception) MUST be persisted on the device before any network call, and MUST
  survive app restarts, loss of signal, and low battery shutdowns.
- Every mutation sent by a client MUST carry a client-generated UUID. The server MUST
  treat it as an idempotency key: replaying the same action any number of times MUST
  produce exactly one effect.
- Events MUST record both `occurredAt` (device time of the action) and `recordedAt`
  (server time of receipt). Business logic orders by `occurredAt`.
- Pending actions MUST sync automatically on app open, on reconnection, and periodically,
  and the courier MUST always see how many actions are pending.
- Proof-of-delivery photos MUST be compressed on the device before storage or upload.

**Rationale**: couriers work in elevators, basements, and dead zones. A delivery that
happened but was not recorded is a lost payment, a lost collection, and a customer dispute.

### III. Single Source of Truth for Domain Rules

- Every business rule — shipment states and allowed transitions, shipment kinds, payment
  modes, money calculations, validation schemas — MUST be defined exactly once in
  `packages/domain` and imported by both server and web app. Duplicating a rule is a violation.
- The shipment lifecycle MUST be an explicit, declared state machine. State changes MUST
  go through it; direct writes to a status field are forbidden.
- Money MUST be stored and computed as integer Colombian pesos (COP). Floating point MUST
  NOT be used for money.
- Timestamps MUST be stored as UTC (`timestamptz`) and displayed in `America/Bogota`.

**Rationale**: the current operation lives in spreadsheets where the same rule is copied
across cells and drifts. The system exists to end that class of error.

### IV. Transactional Integrity & Full Traceability

- A state change and its audit event MUST be written in the same database transaction.
- Every state change MUST record who did it, when, and — when available — where
  (device location at the moment of the action).
- Operational records (shipments, routes, events, COD collections) MUST NOT be hard-deleted.
  They are cancelled or archived with a recorded reason.
- Integrity rules MUST be enforced in PostgreSQL where it can express them (foreign keys,
  unique constraints, check constraints, not-null), not only in application code.

**Rationale**: the owner's pain is "the package never arrived" disputes and end-of-day
reconciliation. Both require an exact, tamper-evident history of what happened.

### V. Type Safety at Every Boundary

- TypeScript strict mode is mandatory everywhere, with `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` enabled. `any`, non-null assertions, and `@ts-ignore` are
  forbidden; `@ts-expect-error` requires an inline justification.
- Every external input — HTTP bodies, query strings, route params, uploaded files,
  environment variables, data read from device storage — MUST be validated with a Zod
  schema at the point it enters the system.
- The client-server contract MUST be type-checked end to end (Hono RPC types); hand-written
  duplicate API types are forbidden.

**Rationale**: fail loudly and precisely at the boundary instead of storing quietly wrong
data that surfaces days later in a courier's settlement.

### VI. Test-First Business Logic (NON-NEGOTIABLE)

- Every business rule, state transition, money calculation, and sync/idempotency behavior
  MUST have a failing test written before its implementation (red → green → refactor).
- Tests that touch the database MUST run against a real PostgreSQL instance, never a mock.
- The critical flows — register shipment, build and dispatch route, courier pickup and
  delivery while offline then sync, public tracking — MUST have end-to-end tests.
- Tests MUST be deterministic: no dependence on wall-clock time, network, or test order.
- Plain UI rendering and trivial wiring are exempt from test-first but not from review.

**Rationale**: every rule in this system was derived from a conversation with the client;
a silent regression reproduces the exact errors the system was commissioned to remove.

### VII. Effortless User Experience

- Every user-facing text MUST be in Spanish (Colombia), clear to a non-technical reader.
  No English, no jargon, no raw error codes reach a user.
- The courier app MUST be mobile-first and operable with one hand: touch targets of at
  least 48×48 CSS px, each primary action (confirm pickup, confirm delivery, report
  delivery exception) reachable in at most 3 taps from the route screen.
- The courier app MUST work on low-end Android phones (Android 10+ with Chrome) and on
  iPhone (iOS 16+ Safari, installed to the home screen).
- The public tracking page MUST work without login or installation and MUST expose no
  personal data beyond what the recipient already knows about their own shipment, with one
  exception approved by the project owner: while the shipment is on its way, the first
  name of the responsible courier and a phone to reach them; once delivered, the name of
  the person who received it. Nothing else (no photos, no recipient phone or full address,
  no fee). The couriers' authorization for this use of their data MUST be collected before
  go-live (Ley 1581 de 2012).
- Every error message MUST say what happened and what the user can do next.
- Every interface MUST follow `docs/design-system.md` (Material Design 3 over Tailwind CSS
  and shadcn/ui); deviations require updating that document first.
- Interfaces MUST meet WCAG 2.2 AA for contrast, labels, and keyboard access.

**Rationale**: the dispatcher is overloaded and couriers work on the street; if the tool
is slower than WhatsApp and a spreadsheet, it will not be adopted.

### VIII. Absolute Repository Order

- Everything development-related is in English: code identifiers, file and folder names,
  database objects, commits, and developer documentation.
- File and folder names use `kebab-case`; React components use `PascalCase` exports;
  variables and functions use `camelCase`; database tables and columns use `snake_case`.
- Business vocabulary is translated consistently using the glossary kept in
  `docs/glossary.md` (e.g., servicio → shipment, recaudo → COD collection, contraentrega →
  cash on delivery, mensajero → courier). A term has exactly one English name across the
  codebase.
- User-facing text MUST use the professional Spanish term defined in the glossary, never
  the legacy term (e.g., "Envío", not "Servicio"; "Novedad"; "Prueba de entrega").
- Formatting and linting are automated and MUST pass with zero warnings. Dead code,
  commented-out code, stray files, and unused dependencies are forbidden.
- Commits follow Conventional Commits. One feature per branch, named by Spec Kit.
- Every file lives in the one place the plan's project structure assigns to it.

**Rationale**: the owner of this codebase requires absolute order; consistency is what
lets any developer find anything in seconds, years from now.

### IX. Security, Privacy & Data Ownership

- Secrets MUST come from environment variables validated at startup and MUST never be
  committed, logged, or sent to the client.
- Access MUST be role-based (owner, dispatcher, courier) and enforced on the server for every
  request. A courier MUST only see their own routes and shipments.
- Public tracking links MUST use unguessable random tokens, never sequential identifiers.
- Passwords and session handling MUST use the vetted authentication library chosen in the
  plan; hand-rolled cryptography is forbidden.
- All business data belongs to the client and MUST be exportable at any time in an open
  format (CSV/JSON). Infrastructure accounts are registered in the client's name.
- Bank account numbers of the client's customers MUST NOT be stored (out of scope by
  contract).

**Rationale**: the system handles cash collections and personal addresses and phone
numbers of third parties; a leak or a lock-in harms the client and their customers.

## Technology Stack & Constraints

The stack below is ratified. Replacing any item requires a constitution amendment.

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict), Node.js 24 LTS |
| Repository | pnpm workspaces monorepo: `apps/server`, `apps/web`, `packages/domain` |
| API | Hono (with RPC types consumed by the web app) |
| Database | PostgreSQL, accessed with Drizzle ORM; schema changes only through versioned migrations |
| Authentication | Better Auth, sessions stored in PostgreSQL |
| Web app | React + Vite, one PWA serving the dispatch panel, the courier app, and the tracking page |
| Styling and components | Tailwind CSS + shadcn/ui |
| Design language | Material Design 3, applied as defined in `docs/design-system.md` |
| Offline | Service worker for the app shell; IndexedDB outbox of idempotent actions |
| Validation | Zod |
| File storage | S3-compatible object storage for proof-of-delivery photos |
| Testing | Vitest (unit and integration against real PostgreSQL), Playwright (end to end) |
| Deployment | Docker Compose on a single VPS with Caddy (automatic HTTPS) |

Constraints:

- The courier app is a PWA in Phase 1. The API MUST remain client-agnostic (outbox of
  idempotent actions, domain rules in `packages/domain`) so a future native Expo app can
  consume it without server changes.
- Phase 1 scope is defined by quote COT-2026-001 (`docs/discovery/quote-cot-2026-001.pdf`).
  Reconciliation, settlement, and receivables (Phase 2) and store apps and automatic
  notifications (Phase 3) are out of scope until specified.
- Monthly infrastructure cost MUST stay within the quoted range (COP 60.000–130.000).

## Development Workflow & Quality Gates

Spec-Driven Development with GitHub Spec Kit is mandatory and strict. No production code
is written outside this flow.

1. `/speckit-specify` — a feature starts as a spec on its own branch. Specs describe what
   and why, never how.
2. `/speckit-clarify` — REQUIRED before planning. No `[NEEDS CLARIFICATION]` marker may
   remain in a spec that enters planning.
3. `/speckit-plan` — the plan MUST pass the Constitution Check; any violation is recorded
   in Complexity Tracking or the plan is rejected.
4. `/speckit-tasks` — tasks are ordered test-first and grouped by user story.
5. `/speckit-analyze` — REQUIRED before implementation; every CRITICAL or HIGH finding MUST
   be resolved first.
6. `/speckit-implement` — implementation follows the tasks exactly; deviations go back to
   the spec or plan, never silently into code.
7. `/speckit-converge` — REQUIRED after implementation, repeated until converged.

Quality gates (all MUST pass before a feature branch is merged):

- Type check, lint, and format check with zero errors and zero warnings.
- Full test suite green, including integration tests against PostgreSQL and end-to-end
  tests for affected critical flows.
- Production build succeeds.
- Every acceptance scenario in the spec is demonstrably satisfied.
- Changes to the database are expressed as a reviewed migration.

## Governance

- This constitution supersedes every other practice, guide, or habit in this repository.
  When a spec, plan, or task conflicts with it, the constitution wins.
- Amendments are made only through `/speckit-constitution`, with a written rationale, a
  Sync Impact Report, and the explicit approval of the project owner (Samuel Calderón).
- Versioning follows semantic versioning: MAJOR for removing or redefining a principle,
  MINOR for adding a principle or materially expanding guidance, PATCH for clarifications.
- Every plan's Constitution Check and every `/speckit-analyze` run MUST verify compliance
  with all nine principles. Unjustified complexity is grounds for rejection.
- Runtime development guidance for agents lives in `CLAUDE.md` and MUST stay consistent
  with this document.

**Version**: 1.2.0 | **Ratified**: 2026-09-29 | **Last Amended**: 2026-09-30
