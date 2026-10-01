# Domy

Domy is the operations and tracking system of Cohex, an urban courier business in Medellín:
shipment registration, routes and dispatch, a courier app that works without signal, and a
public tracking page.

## Documentation

- [Constitution](.specify/memory/constitution.md): the non-negotiable engineering rules
- [Business master](docs/business-master.md): how the business works and every decision taken
- [Glossary](docs/glossary.md): English names in code, Spanish names in the interface
- [Design system](docs/design-system.md): Material Design 3 over Tailwind CSS and shadcn/ui
- [Specifications](specs/): one folder per feature, written with GitHub Spec Kit

## Requirements

- Node.js 24 LTS and pnpm 12 (`corepack enable pnpm`)
- Docker (PostgreSQL for development and for integration tests)

## Setup

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The seed prints the first owner's credentials once. The panel runs at
<http://localhost:5173>, the API at <http://localhost:3000>, and Adminer, a web interface to
the development database, at <http://localhost:8080> (system PostgreSQL, server `postgres`,
and the user, password, and database of `.env`).

## Quality gates

```bash
pnpm check      # format, lint with zero warnings, type check
pnpm test       # unit and integration tests (real PostgreSQL through Testcontainers)
pnpm test:e2e   # end-to-end tests (Playwright)
pnpm build
```

## Production

One Node.js process serves the API and the built web app from the same origin.

```bash
pnpm install --frozen-lockfile
pnpm build                  # web bundle in apps/web/dist; the server is type-checked
pnpm db:migrate
cd apps/server
NODE_ENV=production node --env-file=../../.env src/index.ts
```

In production `.env` also needs `RESEND_API_KEY` (recovery emails) and `APP_URL` set to the
public address; `SENTRY_DSN` and `VITE_SENTRY_DSN` (read when the web app is built) turn on
error reporting. Run `pnpm db:seed` once, on the first installation, to create the catalog and
the first owner account.

## Workspace

| Package | Purpose |
| --- | --- |
| `apps/server` | Hono API on Node.js, PostgreSQL through Drizzle, Better Auth |
| `apps/web` | React + Vite app: dispatch panel, courier app, public pages |
| `packages/domain` | Business rules and schemas shared by server and web |

## Dependencies

Each dependency is listed in the `package.json` of the package that uses it, with an exact
version. The ratified stack and the reason for every addition are in the constitution and in
each feature's `plan.md` and `research.md`. Additions by feature:

- 002: `@dnd-kit/core` and `@dnd-kit/sortable`, to reorder route stops by dragging and with
  the keyboard (research R3).
