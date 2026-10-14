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
| 003 Courier app | Specified, planned, tasked, and analyzed again on 2026-10-14 against 002 as built (research R17): storage for development and tests moved from MinIO, whose images are gone, to S3Proxy; custody and "Registrado por despacho" aligned with 002; the quality tests of 002 added (T089–T093); slices and branches defined in tasks.md. Ready to implement |
| 004 Tracking page and merchant link | Specified, planned, tasked, and analyzed; implementation not started |

## Next step

1. Implement 003 one slice per branch, in the order of the table in
   `specs/003-courier-app/tasks.md` (Delivery under Trunk-Based Development), starting with
   `003-setup` (T001–T003): run `export SPECIFY_FEATURE_DIRECTORY=specs/003-courier-app`
   once, then `/speckit-implement` for that phase only, tests first.
2. Needed before the end of 003, not before starting: an Android phone and an iPhone (iOS
   16.4 or later for notifications) for the manual validation T087, and the owner's
   DigitalOcean Spaces bucket (in the client's name) only at deployment.
3. Then 004 the same way.
4. Before go-live: time SC-001, SC-004, and SC-006 of 002 with the dispatcher, and add a
   content security policy tested on the production host (002 quickstart-results; 003
   research R17 lists what the courier app needs from it).

## Open with the client

- Rates for Amy Tecnology, and for Caldas and Girardota (the rate card shows "Sin tarifa").
- The couriers' authorization for showing their first name and phone on the tracking page
  (Ley 1581 de 2012), before go-live.
- The logo artwork ("route d" direction approved, [design-system.md](design-system.md) §11).

## Environment notes

- Local only, never in git: `.env` (recreate it from `.env.example`; `pnpm db:seed` prints new
  owner credentials) and `docs/discovery/raw/`, the client's spreadsheets with personal and
  banking data (keep an encrypted copy or ask the client for them again).
- Playwright's Firefox does not launch on the owner's macOS; WebKit runs with a temporary
  config. Add a permanent WebKit project when 003, the iPhone courier app, starts.
- The design proposals shown on 2026-10-01 (palettes, secondary colors, the board concept) were
  rendered outside the repository; the chosen direction is recorded in
  [design-system.md](design-system.md).
