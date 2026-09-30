# Domy — guidance for agents

This file must stay consistent with the [constitution](.specify/memory/constitution.md), which
wins in any conflict.

## Language

- Everything development-related is in English: code, file names, database objects, commits,
  developer documentation.
- Everything users see is in Spanish (Colombia), using the UI terms of
  [docs/glossary.md](docs/glossary.md). A concept has exactly one English name in code.

## Method

- Spec-Driven Development with GitHub Spec Kit is mandatory: specify → clarify → plan →
  checklist → tasks → analyze → implement → converge.
- Implementation follows `specs/<feature>/tasks.md` in order, tests first. Deviations go back
  to the spec or plan, never silently into code.
- Mark a task `[X]` in `tasks.md` only when it is done and its tests pass.

## Code

- TypeScript strict; the server runs `.ts` files directly with Node 24 type stripping, so no
  enums, namespaces, or parameter properties, and imports use the `.ts` extension.
- Business rules live once in `packages/domain`; server and web import them.
- No repository layer or wrappers around Hono, Drizzle, or Better Auth.
- Money is integer COP; instants are stored in UTC and shown in `America/Bogota`.
- Every mutation carries a client-generated `id` (creations) or `actionId` (everything else).
- Integration tests use real PostgreSQL through Testcontainers; never mock the database.

## Quality gates

`pnpm check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` must pass with zero warnings.
Commits follow Conventional Commits.
