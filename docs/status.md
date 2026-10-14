# Project status

Where Domy stands and what comes next, so any session can resume without the conversation
that produced it. Updated 2026-10-14; update it whenever a slice is merged or the next step
changes.

## Features

Work follows Trunk-Based Development (constitution 2.0.0): every slice lands on `main` through
a short-lived branch, so the specification and implementation of every feature live on `main`.

| Feature | State |
| --- | --- |
| 001 Shipment registration | Done and converged, on `main` |
| Panel identity (design) | On `main` (`c363847`); rules in [design-system.md](design-system.md) |
| 002 Routes and dispatch | Done and converged, on `main` (#4–#11); test and review results in `specs/002-routes-dispatch/quickstart-results.md` |
| 003 Courier app | Specified, planned, tasked, and analyzed again on 2026-10-14 against 002 as built (research R17): storage for development and tests moved from MinIO, whose images are gone, to S3Proxy; custody and "Registrado por despacho" aligned with 002; the quality tests of 002 added (T089–T093); slices and branches defined in tasks.md. Setup (T001–T003) on `main` (#13). The domain rules (T004–T014) on `main` (#14). The foundation (T015–T025: the courier records, photos, notices, push subscriptions, and company settings tables with migration `0004_courier_app`; the photo storage client over S3Proxy; `applyCourierRecord`, which now completes tasks and picks up packages in feature 002's tests instead of the test-only stand-ins; the server route skeletons and error codes; the phone's IndexedDB; the courier app's layout and empty pages at `/mensajero`) on `main` (#15). Effects of late records across routes (handovers, removals, notices) arrive with US5 (T067). US1 (P1, the MVP) split in two branches: `003-us1-server` (T026–T029, T032–T034) on `main` (#16); `003-us1-web` (T030, T031, T035–T040: the outbox replayed over the snapshot, the first sync loop, photos and location, the delivery and disbursement forms, "Mi ruta" and the stop screen, the records and flags on the panel) done with every gate green. Found while building it: nothing links a courier account to its courier, so T094 was added and the question is in OWNER-REQUESTS.md |
| 004 Tracking page and merchant link | Specified, planned, tasked, and analyzed; implementation not started |

## Next step

1. Merge `003-us1-web` into `main` through its pull request once CI passes. Then
   continue 003 one slice per branch, in the order of the table in
   `specs/003-courier-app/tasks.md` (Delivery under Trunk-Based Development): next
   `003-us2-offline` (Phase 4: working without signal), with `/speckit-implement` for that
   part only, tests first. T094 (linking a courier account) must land before go-live.
2. Needed before the end of 003, not before starting: an Android phone and an iPhone (iOS
   16.4 or later for notifications) for the manual validation T087, and the owner's
   DigitalOcean Spaces bucket (in the client's name) only at deployment.
3. Then 004 the same way.
4. Before go-live: time SC-001, SC-004, and SC-006 of 002 with the dispatcher, and add a
   content security policy tested on the production host (002 quickstart-results; 003
   research R17 lists what the courier app needs from it).

## Open with the client

Everything the owner must answer or provide is in [OWNER-REQUESTS.md](../OWNER-REQUESTS.md),
in Spanish, kept up to date there.

## Environment notes

- Local only, never in git: `.env` (recreate it from `.env.example`; `pnpm db:seed` prints new
  owner credentials) and `docs/discovery/raw/`, the client's spreadsheets with personal and
  banking data (keep an encrypted copy or ask the client for them again).
- Playwright's Firefox does not launch on the owner's macOS; WebKit runs with a temporary
  config. Add a permanent WebKit project when 003, the iPhone courier app, starts.
- The design proposals shown on 2026-10-01 (palettes, secondary colors, the board concept) were
  rendered outside the repository; the chosen direction is recorded in
  [design-system.md](design-system.md).
