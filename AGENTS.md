# Repository Guidelines

## Authority & Workflow

Read `.specify/memory/constitution.md`, `CLAUDE.md`, `docs/status.md`, and `docs/archive/integral-execution-backlog.md`. The constitution governs; approved decisions and newer verified receipts supersede historical status paragraphs.

Follow Spec Kit: specify → clarify → plan → checklist → tasks → analyze → implement → converge. Align feature artifacts before behavioral changes; resolve CRITICAL/HIGH analysis findings first. Feature-qualified tasks (`001/T147`) are canonical. Treat reviewer-owned checklists as read-only requirements gates, never implementation progress. Close tasks only with passing evidence.

## Project Structure

- `apps/server`: Hono/Better Auth API; Drizzle schemas/migrations in `src/db/`.
- `apps/web`: React/Vite panel and courier PWA; `src/features/`, `src/components/`, assets in `public/`.
- `packages/domain`: business rules and Zod schemas shared by both apps.
- `specs/NNN-…/`: requirements, plans, contracts, tasks, and verification receipts.

## Development Commands

Use pinned Node.js 24, pnpm 12, and Docker; run from the repository root.

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev                 # API :3000, web :5173
pnpm check               # Prettier, ESLint, strict types
pnpm test                # Vitest unit/integration suites
pnpm test:e2e            # Chromium Playwright; Docker required
pnpm build               # Web bundle; server type-check
```

## Style & Interface

Use strict TypeScript, two-space indentation, double quotes, semicolons, and Prettier’s 100-column width. Forbid `any`, non-null assertions, and `@ts-ignore`. Use `kebab-case` files, `PascalCase` components, `camelCase` functions, and `snake_case` database objects. Server/domain imports include `.ts`; web uses extensionless imports and `@/`.

Development is English; UI and owner communication are Colombian Spanish. Follow `docs/glossary.md` and `docs/design-system.md`: generated tokens, WCAG 2.2 AA, 48px targets. Regenerate migrations/routes/tokens; never hand-edit them.

## Integrity & Security

Persist courier actions before networking; preserve pending work. Keep UUID mutations idempotent and changes/audit events transactional. Use integer COP, UTC storage, and Bogotá display. Enforce server-side roles and private photos. Never commit `.env` or `docs/discovery/raw/`.

## Testing & Evidence

Write failing business-rule regressions first. Colocate `*.test.ts(x)`; server integration tests use `apps/server/tests/` and real PostgreSQL/Testcontainers; browser `*.spec.ts` tests use `apps/web/tests/e2e/` and the built service worker. Use deterministic clocks. Preserve assertions, budgets, and axe coverage; investigate retry-green failures. All four quality gates must pass.

## Commits & Agent Handoff

Use short-lived branches (`NNN-<slice>` or `<type>/<slug>`), Conventional Commits (`fix(server): preserve audit history`), and squash PRs. Include task references, behavior, and validation. Check existing authorization before publishing/merging. The current orchestration is local-only: never invoke or await remote CI. Deployment requires separate approval. Preserve unrelated work; update status/receipts and `OWNER-REQUESTS.md`. Obtain permission before reading outside the repository.
