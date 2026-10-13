# Project status

Where Domy stands and what comes next, so any session can resume without the conversation
that produced it. Updated 2026-10-13; update it whenever a slice is merged or the next step
changes.

## Features

Work follows Trunk-Based Development (constitution 2.0.0): every slice lands on `main` through
a short-lived branch, so the specification and implementation of every feature live on `main`.

| Feature | State |
| --- | --- |
| 001 Shipment registration | Done and converged, on `main` |
| Panel identity (design) | On `main` (`c363847`); rules in [design-system.md](design-system.md) |
| 002 Routes and dispatch | User Stories 1–3 on `main` (#4, #5, #6). User Story 4 (T038–T047), reassigning shipments and whole routes with handovers and the custody history, done on the short-lived branch `002-us4-reassign` with every gate green. User Story 5 and polish remain |
| 003 Courier app | Specified, planned, tasked, and analyzed; implementation not started |
| 004 Tracking page and merchant link | Specified, planned, tasked, and analyzed; implementation not started |

## Next step

1. Merge `002-us4-reassign` into `main` through its pull request once CI passes.
2. Continue 002 with User Story 5, cancelling a route or undoing a dispatch (T048–T051), on
   `002-us5-cancel-undo`; then polish (T052–T056) on `002-polish` and converge 002.
3. Then 003 and 004 the same way, one slice per branch. For 003: the courier's pickup,
   delivery, and return events must record `custodyCourierId: [from, to]` in their `changes`,
   as the custody history of 002 reads it (002 data-model, Derived values).

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
