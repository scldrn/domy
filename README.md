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
- [Project status](docs/status.md): where each feature stands and the next step
- [Engineering handoff](docs/engineering-handoff.md): the canonical verified candidate,
  local validation evidence and remaining acceptance
- [Detailed execution backlog](docs/integral-execution-backlog.md): all open tasks,
  preserved work, dependencies, verification criteria, and operational acceptance
- [Owner requests](OWNER-REQUESTS.md): questions and items the owner must answer or provide,
  in Spanish

## Requirements

- Node.js 24 LTS and pnpm 12 (`corepack enable pnpm`)
- Docker (PostgreSQL and photo storage for development, and for integration and end-to-end
  tests)

## Setup

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The seed prints the first owner's credentials once, and sets the catalog, the standard
rates, and the office address. The panel runs at <http://localhost:5173>, the API at
<http://localhost:3000>, and Adminer, a web interface to the development database, at
<http://localhost:8080> (system PostgreSQL, server `postgres`, and the user, password, and
database of `.env`). `docker compose up -d` also starts S3Proxy on <http://localhost:9100>,
which keeps the courier's photos on a local volume; the API creates its bucket on start.

### Courier app

Couriers use the same address on their phone: a courier account lands on `/mensajero`, works
without signal, and can be installed on the home screen. To try it:

1. In "Mensajeros", create the courier.
2. In "Usuarios", create an account with the role "Mensajero" and choose the courier in
   "Mensajero vinculado". Only the owner links accounts; an account not linked sees no route.
3. In "Rutas", dispatch a route to that courier, and sign in as the account on a phone or in
   the browser's device toolbar.

The offline behavior and the service worker are those of the built app: try them with
`pnpm build` and the production command below, as `pnpm dev` does not register the service
worker. Without VAPID keys in `.env`, development runs without phone notifications.

"Pendientes" shows saved actions and photos separately. Pending work survives reopening,
loss of signal, and session expiry; reconnecting sends it automatically. Sign-out and a
different account's sign-in are refused until it is synchronized. Keep browser storage
enabled and never clear site data while there are pending actions or photos.

## Quality gates

```bash
pnpm check      # format, lint with zero warnings, type check
pnpm test       # unit and integration tests (real PostgreSQL through Testcontainers)
pnpm test:e2e   # end-to-end tests (Playwright)
pnpm build
```

Playwright builds and serves the web app with Vite preview, including its real service
worker; offline cases use independent courier accounts and disposable test data.

## Production

One Node.js process serves the API and the built web app from the same origin.

```bash
pnpm install --frozen-lockfile
pnpm build                  # web bundle in apps/web/dist; the server is type-checked
pnpm db:migrate
cd apps/server
NODE_ENV=production node --env-file=../../.env src/index.ts
```

In production `.env` also needs:

- `RESEND_API_KEY` (recovery emails) and `APP_URL` set to the public address;
- the photo storage, a private bucket with the S3 API (DigitalOcean Spaces): `S3_ENDPOINT`,
  `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and
  `S3_FORCE_PATH_STYLE=false`. The bucket is created beforehand, with no public access and a
  lifecycle rule that deletes objects after 12 months (feature 003, research R6);
- the phone notifications: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`
  (`mailto:` an address of the company). Generate the pair once with
  `pnpm dlx web-push generate-vapid-keys` and keep it: a new pair invalidates every phone's
  subscription.

The server refuses to start in production without any of them. `SENTRY_DSN` and
`VITE_SENTRY_DSN` (read when the web app is built) turn on error reporting. Run
`pnpm db:seed` once, on the first installation, to create the catalog, the office address, and
the first owner account.

## Workspace

| Package | Purpose |
| --- | --- |
| `apps/server` | Hono API on Node.js, PostgreSQL through Drizzle, Better Auth |
| `apps/web` | React + Vite app: dispatch panel, installable courier app, public pages |
| `packages/domain` | Business rules and schemas shared by server and web |

## Dependencies

Each dependency is listed in the `package.json` of the package that uses it, with an exact
version. The ratified stack and the reason for every addition are in the constitution and in
each feature's `plan.md` and `research.md`. Additions by feature:

- 002: `@dnd-kit/core` and `@dnd-kit/sortable`, to reorder route stops by dragging and with
  the keyboard (research R3).
- 003: `vite-plugin-pwa` (development) with `workbox-precaching`, `workbox-routing`, and
  `workbox-window`, for the installable courier app that opens without signal (research
  R2); `idb`, for the records kept on the phone (research R3), tested with `fake-indexeddb`;
  `@aws-sdk/client-s3`, for photo storage (research R6); `web-push`, for phone notifications
  (research R8); `testcontainers` in the web package, for the photo storage of the end-to-end
  tests.
