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
| 002 Routes and dispatch | All five user stories on `main` (#4–#7, #9). Polish (T052–T061) on `main` (#10), with the fixes its testing found recorded in `specs/002-routes-dispatch/quickstart-results.md`. Convergence found one gap, T062 (offer to add a route's shipments to the courier's route in progress), done on the short-lived branch `002-converge` |
| 003 Courier app | Specified, planned, tasked, and analyzed; implementation not started |
| 004 Tracking page and merchant link | Specified, planned, tasked, and analyzed; implementation not started |

## Next step

1. Merge `002-converge` into `main` through its pull request once CI passes; feature 002 is
   then complete.
2. Then 003 and 004 the same way, one slice per branch. For 003: the courier's pickup,
   delivery, and return events must record `custodyCourierId: [from, to]` in their `changes`,
   as the custody history of 002 reads it (002 data-model, Derived values), and set
   `on_behalf` on any event dispatch records for a courier ("Registrado por despacho").
3. Before go-live: time SC-001, SC-004, and SC-006 with the dispatcher, and add a content
   security policy tested on the production host (002 quickstart-results).

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
