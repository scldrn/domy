# Project status

Where Domy stands and what comes next, so any session can resume without the conversation
that produced it. Updated 2026-10-02; update it whenever a feature is merged or the next step
changes.

## Features

| Feature | Branch | State |
| --- | --- | --- |
| 001 Shipment registration | `001-shipment-registration-impl` | Done, converged, and merged into `main` |
| Panel identity (design) | `ui-polish` | Merged into `main` (`c363847`); rules in [design-system.md](design-system.md) |
| 002 Routes and dispatch | `002-routes-dispatch-impl` | Setup, foundation, and User Story 1 done (T001–T027, `37d56c3`); branched from `main` before the panel redesign |
| 003 Courier app | `003-courier-app` | Specified, planned, tasked, and analyzed; implementation not started |
| 004 Tracking page and merchant link | `004-tracking-merchant-link` | Specified, planned, tasked, and analyzed; implementation not started |

Each `NNN-…` branch holds the feature's specification; each `NNN-…-impl` branch holds its
implementation, created from `main` and merged back once converged.

## Next step

1. Merge `main` into `002-routes-dispatch-impl` and restyle the route screens
   (`routes/routes-board.tsx`, `routes/route-detail.tsx`, `features/routes/*`) to
   [design-system.md](design-system.md).
2. Continue 002 with User Story 2, the routes of the day on the board (T028–T032). It adds the
   route and courier to the board's shipments and the courier filter, which completes the
   courier column of 001's FR-021 and FR-023.
3. Then User Stories 3–5, polish, converge, and merge 002; then 003 and 004 the same way.

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
