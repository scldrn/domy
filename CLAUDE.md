# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Domy is the operations and tracking system of Cohex, an urban courier business in Medellín.
This file must stay consistent with the [constitution](.specify/memory/constitution.md), which
wins in any conflict.

## Language

- Everything development-related is in English: code, file names, database objects, commits,
  developer documentation.
- Everything users see is in Spanish (Colombia), using the UI terms of
  [docs/glossary.md](docs/glossary.md). A concept has exactly one English name in code.

## Method

- Spec-Driven Development with GitHub Spec Kit is mandatory: specify → clarify → plan →
  checklist → tasks → analyze → implement → converge (`/speckit-*` skills in `.claude/skills/`).
- Each feature lives in `specs/NNN-…/` (spec, plan, research, data-model, contracts,
  quickstart, tasks, checklists); its number identifies it, not a branch.
- Spec Kit 1.1.3 (`.specify/init-options.json`). The `/speckit-*` skills need no CLI; the
  Specify CLI (`uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v1.1.3`)
  only upgrades them: `specify integration upgrade claude` and `specify extension update`.
- Implementation follows `specs/<feature>/tasks.md` in order, tests first. Deviations go back
  to the spec or plan, never silently into code.
- Mark a task `[X]` in `tasks.md` only when it is done and its tests pass.
- Code comments cite what they implement: requirements (`FR-042`), success criteria, user
  story scenarios, and research decisions (`research R9`) of the feature's spec.
- Background lives in [docs/business-master.md](docs/business-master.md) (how the business
  works, rates, decision log) and `docs/discovery/` (client interview and quote COT-2026-001,
  which bounds Phase 1 scope).

## Commands

Node 24 (`.nvmrc`), pnpm 12 (`corepack enable pnpm`), and Docker. Run from the repository root.

```bash
cp .env.example .env && pnpm install
docker compose up -d             # PostgreSQL 18 on :5432, Adminer on :8080, S3Proxy (photos) on :9100
pnpm db:migrate && pnpm db:seed  # the seed prints the password of propietario@example.com once
pnpm dev                         # web on :5173 (proxies /api), API on :3000 with node --watch

pnpm check      # prettier --check, eslint --max-warnings 0, tsc in every package
pnpm test       # Vitest in every package; server tests need Docker running
pnpm test:e2e   # Playwright, chromium only; needs Docker
pnpm build      # web bundle in apps/web/dist; the server build is only tsc --noEmit

# One file or one case
pnpm --filter @domy/domain exec vitest run src/fees.test.ts
pnpm --filter @domy/server exec vitest run tests/shipments-create.test.ts -t "case name"
pnpm --filter @domy/web exec vitest run src/features/board/day-sentence.test.ts
pnpm --filter @domy/web exec playwright test tests/e2e/register-shipment.spec.ts

pnpm db:generate  # SQL migration from apps/server/src/db/schema/ (drizzle-kit)
pnpm tokens       # regenerates apps/web/src/styles/tokens.css from the seed colors
pnpm icons        # regenerates the brand assets: apps/web/public/icons/ and src/assets/brand/
```

Generated, never edited by hand: `apps/web/src/route-tree.gen.ts` (TanStack Router plugin,
on `vite dev` and `vite build`), `apps/web/src/styles/tokens.css` (`pnpm tokens`),
`apps/web/public/icons/` and `apps/web/src/assets/brand/` (`pnpm icons`), and
`apps/server/src/db/migrations/` (`pnpm db:generate`). Prettier skips Markdown, `docs/`,
`.specify/`, `.claude/`, and those generated files, but only when it runs from the repository
root, where `.prettierignore` lives: `prettier --write src` from `apps/server` rewrites the
migration snapshots.

## Branches

Trunk-Based Development is mandatory; the rules are in the constitution (Development
Workflow & Quality Gates). One slice, one short-lived branch, one pull request:

```bash
git switch main && git pull --ff-only
git switch -c 002-us2-routes-on-board   # NNN-<slice> in a feature, <type>/<slug> outside one
# work, committing small steps; run the quality gates locally
git fetch && git rebase origin/main     # if main moved
git push -u origin HEAD && gh pr create --fill
gh pr checks --watch                    # never merge red or running CI
gh pr merge --squash --delete-branch
git switch main && git pull --ff-only
```

- `/speckit-specify` creates the feature's first branch itself (git extension hook), so run
  it from an up-to-date `main`. A branch that continues an existing feature points Spec Kit
  at it once: `export SPECIFY_FEATURE_DIRECTORY=specs/NNN-…`, which is then saved in the
  local `.specify/feature.json`.
- Unfinished work merges but stays unreachable: the navigation destination or link of a user
  story lands with its last slice.
- The repository's GitHub plan cannot protect `main`, so nothing blocks a merge with red CI:
  check it every time.

## Code

- TypeScript strict; the server runs `.ts` files directly with Node 24 type stripping, so no
  enums, namespaces, or parameter properties, and imports use the `.ts` extension.
- Business rules live once in `packages/domain`; server and web import them.
- No repository layer or wrappers around Hono, Drizzle, or Better Auth.
- Money is integer COP; instants are stored in UTC and shown in `America/Bogota`.
- Every mutation carries a client-generated `id` (creations) or `actionId` (everything else).
- Integration tests use real PostgreSQL through Testcontainers; never mock the database.

## Architecture

A pnpm workspace with three packages. Nothing is compiled except the web bundle:
`@domy/domain` and `@domy/server/app` are consumed as source through their `exports`.

### `packages/domain`

The only home of business rules: the shipment lifecycle state machine
(`shipment-lifecycle.ts`), fee resolution against the rate card (`fees.ts`), payment modes,
delivery windows, tracking numbers, text normalization for matching, Bogotá calendar time
(fixed UTC−05:00), the confirmation thresholds of large amounts (`money.ts`), what each courier
record does (`courier-records.ts`, `resolveCourierRecord`, used by the server and replayed by
the phone), the courier's day summary (`day-summary.ts`), and the Zod schemas in `schemas/`, which validate requests on the server
and forms on the web. Value lists such as `shipmentStatuses`, `shipmentKinds`, and `userRoles`
are declared here and the server builds its `pgEnum`s from them, so a new value starts here
and then needs a migration.

### `apps/server` (Hono API)

- `src/index.ts` wires the real dependencies from the environment (`env.ts` validates it with
  Zod and exits on error). `createApp(deps)` in `src/app.ts` receives `db`, `auth`, `clock`,
  `logger`, `storage` (the private photo bucket, `lib/storage.ts`, S3 API), and optional
  `push` (validated server-side VAPID configuration), so tests build
  the same app around a test database and a controlled clock.
  With `NODE_ENV=production` the same process also serves `apps/web/dist`.
- Each resource is a Hono sub-app in `src/routes/`, mounted in `app.ts`. Routes must stay
  chained (`new Hono<AppEnv>().use(...).get(...).post(...)`), in their module and in
  `app.ts`, or their types never reach `AppType` and the web client.
- Input goes through `validate(target, schema)` (`lib/validate.ts`) with the domain schemas;
  access through `requireRole(...)` (`lib/auth-guard.ts`), which also sets `c.get("user")`
  and `c.get("sessionExpiresAt")`.
- Errors are `throw new AppError(code, { message?, fields? })`. Codes, HTTP statuses, and
  default Spanish messages are catalogued in `lib/errors.ts`; every error response is
  `{ error: { code, message, fields? } }`. Unexpected errors are logged without SQL
  parameters, which hold recipients' data, and answered with a generic Spanish message.
- Time: handlers read `c.get("clock")()`, never `new Date()`. `DOMY_FAKE_NOW` moves the clock
  in development and tests; with `NODE_ENV=test` the app also exposes `POST /api/test/clock`
  and `GET /api/test/emails`. The `Date` response header follows the clock, and the web
  corrects its own clock with it (`apps/web/src/lib/clock.ts`).
- Exactly once: a creation is keyed by its client `id` (a repeated id returns the existing
  record with 200 instead of 201). Any other mutation's `actionId` is stored as the unique
  `client_event_id` of the shipment or audit event it writes, and `lib/action-id.ts` detects
  a replay. Shipments also carry a `version` for optimistic concurrency (`version_conflict`).
  A courier record is keyed by the `id` the phone generated (`courier_records` primary key):
  `applyCourierRecord` (`lib/courier-records.ts`) stores it once with its outcome (`applied`,
  `duplicate`, or `not_applied` with its reason; a well-formed record is never refused for the
  shipment's state) and executes the domain's decision on the shipment, task, custody, and
  history in one transaction per record.
- A change and its event share one transaction: `saveChange` in `routes/shipments.ts` for the
  append-only shipment history; `auditedCreate` and `auditedChange` (`lib/master-data.ts`) and
  `recordAudit` (`lib/audit.ts`) for master data and accounts. Shipments are voided and master
  data deactivated, never deleted.
- Auth is Better Auth (`src/auth.ts`) under `/api/auth`, with the admin plugin and the roles
  `owner`, `dispatcher`, and `courier`. Sign-up is disabled: the owner creates accounts.
  `routes/auth.ts` wraps the endpoints that need Domy's own rules (lockout, last active owner,
  a linked courier account's role, audit); every other `/api/auth/*` request goes straight
  to `auth.handler`.
- The courier app's API is `routes/courier.ts` under `/api/courier` (`requireRole("courier")`):
  the caller is the courier whose `couriers.user_id` is the signed-in account, linked by the
  owner (`PUT /api/couriers/accounts/:userId`); an account not linked gets `403`. Photos go
  through the server (`PUT /api/courier/photos/:id`, `GET /api/photos/:id`), never through
  public URLs. `lib/record-views.ts` gives the panel the records and their flags.
  `GET /api/courier/push-config` exposes only the public key or null. `lib/notices.ts`
  inserts notices in the action's transaction; request-local ids reach `lib/push.ts` after
  handlers finish, which reads committed rows and sends notifications without delaying the
  response. Acknowledgments and push subscriptions reuse audited idempotency receipts.
- Database: Drizzle with `casing: "snake_case"` (camelCase in TypeScript, snake_case in
  PostgreSQL), schema by area in `src/db/schema/`. Invariants are also CHECK constraints there
  (payment mode against COD amount, required fields per shipment kind, void and fee-override
  reasons). Searches match `*_normalized` columns written with `normalizeText`. The seed
  (`src/db/seed/`) is idempotent and loads the catalog from `neighborhoods.csv` and the
  standard rates.
- Logs are pino with cookies, passwords, and recipient phones redacted (`lib/logger.ts`).

### `apps/web` (React + Vite)

- Routes are TanStack Router virtual routes declared in `src/routes.ts`: Spanish URLs,
  English files in `src/routes/`. `panel-layout.tsx` is the signed-in panel of owner and
  dispatcher; couriers are sent to `/mensajero`, the courier app of `courier-layout.tsx`
  (navigation bar, high contrast). Search params stay strings (`main.tsx`) and each route
  validates its own.
- The courier app works without signal (feature 003, research R2–R4): a service worker
  (`src/sw.ts`, vite-plugin-pwa, production builds only) serves the app offline, and
  `src/lib/offline/` keeps the data in IndexedDB (`db.ts`: snapshot, outbox, photos, meta).
  A record is saved there first (`outbox.ts`), shown at once by replaying the outbox over the
  last snapshot with the domain's rules, and sent by `sync.ts`, which uses plain `fetch`
  rather than the typed client so it can run and be tested outside React. One store,
  `src/features/courier/courier-store.ts`, feeds every courier screen and runs the sync.
- Server calls live in each area's `src/features/<area>/api.ts` as
  `unwrap(api.api.<resource>.$get(...))`, with response types inferred from the endpoint,
  never supplied by the caller. `api` is `hc<AppType>` from `@domy/server/app`
  (`src/lib/api-client.ts`); `unwrap` turns an error body into an `ApiError` carrying the
  server's Spanish message and per-field messages. Data goes through TanStack Query. Forms
  use react-hook-form; the shipment form checks its input with the domain schema before
  sending and maps the server's `fields` back onto its own fields.
- Imports use the `@/` alias for `src/` and no file extension (bundler resolution), unlike
  server and domain.
- UI follows [docs/design-system.md](docs/design-system.md): Material Design 3 over Tailwind
  CSS 4 and shadcn/ui (`base-nova` style on Base UI) in `src/components/ui/`, with Domy's
  shared components in `src/components/`. Colors come only from the generated tokens; icons
  are single Material Symbols Rounded SVGs imported with `?react` and drawn with `Icon`.
- Every screen follows its approved proposal (feature 006, `specs/006-ui-redesign/proposals.md`)
  and opens with one sentence of its numbers (`SummarySentence`). Lists are `DataList` (a
  table that becomes cards under 820 px); states are `ShipmentStatusMark`, `RouteStatusMark`,
  and `ActiveMark`; empty and failed lists are `EmptyState` and `QueryErrorAlert`. Master data
  and administration screens share `MasterHeader`, `ListSheet`, and `DetailSheet`
  (`features/master-data/master-page.tsx`); the screens outside the panel share `AuthCard`.
  The panel's light or dark theme follows the computer until the person chooses
  (`lib/theme.ts`, `ThemeSwitch`); the courier app follows the phone, with high contrast one
  tap away. The top bar's search shows the day's matches as you type
  (`features/board/global-search.tsx`).
- Route files export only `Route` and never reference an imported value at module level
  (helpers, and `typeof` in types, go in `features/`): the router keeps such modules in every
  page's code, the public pages included. `tracking-page.spec.ts` caps the modules every page
  preloads and times the public cold start under 3 s.

### Tests

- Domain and web unit tests sit next to their code (`*.test.ts`).
- Server integration tests (`apps/server/tests/`) start one `postgres:18` per file
  (`setup/database.ts`: `startDatabase` in `beforeAll`, `truncate` in `beforeEach`), build the
  app with `createTestApp(db, { now })` from `setup/app.ts` (fixed clock with `setNow`,
  `signIn(role)` returning a session cookie, `request(path, { method, cookie, body })`), and
  load fixtures with `createCatalog` (`setup/catalog.ts`). Requests go through `app.request`,
  without an HTTP server. Courier tests use `courierWithAccount`, `snapshot`, and
  `sendRecords` (`setup/courier.ts`); route tests pick up and deliver through `pickUp` and
  `finishTask` (`setup/routes.ts`), which send real courier records; photo tests start
  S3Proxy in memory with `startStorage` (`setup/storage.ts`) and pass it as
  `createTestApp(db, { storage })`.
- End to end (`apps/web/tests/e2e/`): `global-setup.ts` starts its own PostgreSQL and photo
  storage (S3Proxy), migrates, seeds, adds test merchants, links the courier account to the
  courier "Mensajero Uno", and runs the API on :3100 (`NODE_ENV=test`,
  `DOMY_FAKE_NOW=2026-10-01T15:00:00Z`) and the built web app with Vite preview on :5174,
  saving one session per role. The real service worker supports offline reopening. Tests
  use the `ownerPage`, `dispatcherPage`, `courierPage`, and `setServerNow` fixtures of
  `fixtures.ts`; every passing test then runs axe (WCAG 2.2 AA) on the page it ended on, so an
  accessibility violation fails the test.

## Working with the owner

- Talk to the owner, Samuel Calderón, in Spanish, always.
- Commit and push only when he approves. After each user story, report what was done in
  Spanish and ask before committing and continuing.
- Each user story, or a smaller slice of one, is one short-lived branch and pull request;
  push, open, and merge it only with his approval.
- Never read outside this repository without his permission.
- Visual decisions (palette, typeface, icons, logo) are his: render the options so he can
  open them, and let him choose.
- `.env` and the client's data in `docs/discovery/raw/` never enter git.
- Current state and next step: [docs/status.md](docs/status.md).
- Questions for the owner and what he must provide go in [OWNER-REQUESTS.md](OWNER-REQUESTS.md),
  in Spanish: add each one when it comes up, and move it to «Resueltas» with his answer.

## Quality gates

`pnpm check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` must pass with zero warnings
before any branch merges into `main`, as CI runs them (`.github/workflows/ci.yml`) on every
pull request and on `main`. Commits and pull request titles follow Conventional Commits; the
title becomes the squashed commit on `main`.
