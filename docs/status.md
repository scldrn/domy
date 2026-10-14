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
| 003 Courier app | Specified, planned, tasked, and analyzed against 002 as built on 2026-10-14 (research R17). Setup T001–T003 (#13), domain T004–T014 (#14), foundation T015–T025 (#15), US1 server and web T026–T040 (#16–#17), and courier account linking T094 (#18, squash `6af7c60`) are on `main`. PR #18 and its post-merge CI passed all gates. The seed sets the real office address (Robledo). T095–T097 correct accepted unchanged account links and master data edits, sharing transactional receipts and hiding them from Audit history; integration through `003-fix-account-idempotency` is next. US2 T041–T047 follows; effects of late records across routes arrive with US5 (T067) |
| 004 Tracking page and merchant link | Specified, planned, tasked, and analyzed; implementation not started |

## Next step

1. Deliver `003-fix-account-idempotency` (T095–T097) with the owner's approval through a pull
   request and green CI. Then create `003-us2-offline` from the updated `main`, following
   Phase 4 (T041–T047) of `specs/003-courier-app/tasks.md` with `/speckit-implement`, tests
   first. Do not repeat T094 or merge the already merged PR #18 again.
2. Before the end of 003: use the owner's Android phone and iPhone (iOS 16.4 or later for
   notifications) for the manual validation T087. The owner's DigitalOcean Spaces bucket
   (in the client's name) is needed only at deployment.
3. Then 004 the same way.
4. Before go-live: time SC-001, SC-004, and SC-006 of 002 with the dispatcher, and add a
   content security policy tested on the production host (002 quickstart-results; 003
   research R17 lists what the courier app needs from it).

## Idempotency correction validation

- T095's three new regression tests failed before the fix and
  all 10 account tests passed afterward. `pnpm check`, `pnpm build`,
  `pnpm test --maxWorkers=2` (201 domain, 362 server, 135 web tests), and
  `pnpm test:e2e` (60 scenarios) passed. The owner independently reran all gates, including
  the default-worker test suite: all passed and the route-invariants timeout did not recur.
- Owner review identified empty receipts appearing as edits (T096) and missing no-op
  receipts in the six master data directories (T097). Both regressions were reproduced
  before implementation. Receipts now share `auditedChange`, remain transactional and
  durable, and are excluded from Audit history before pagination. No migration is needed.
- After T096–T097, all four gates passed again: `pnpm check`, `pnpm build`, default-worker
  `pnpm test` (201 domain, 373 server, 135 web; 709 total), and `pnpm test:e2e` (60 scenarios).
  The route-invariants timeout did not recur. T095–T097 are ready for review and delivery;
  US2 remains the next implementation slice.

## US2 implementation context

- Checklists pass: requirements 16/16, courier rules 48/48. Feature context remains
  `specs/003-courier-app` in the local `.specify/feature.json`.
- Reuse `apps/web/src/lib/offline/` and `features/courier/courier-store.ts`: records and
  photos are saved in one IndexedDB transaction, and pending records replay over the
  snapshot using the shared domain rules. Open, reconnect, visibility, and 30-second
  synchronization triggers already exist in the store.
- T041–T045 must finish identity isolation, distinguish expired sessions from withdrawn
  access, keep unacknowledged items, handle batches without losing later records, and
  verify device-clock correction and exactly-once application. The server already applies
  one transaction per record and clamps its time to the receipt time.
- T046–T047 add the connectivity banner, pending counts and list, 2-hour and session
  warnings, guarded sign-out and cleanup, install guidance, and persistent-storage request.
  The layout's current session guard still needs network on a fresh page load: keeping a
  loaded route usable offline or after session expiry must be tested through that guard.
- T043 must exercise the built app and its active service worker. The current end-to-end
  setup starts Vite development, where the worker is disabled. Test reopening offline,
  lost responses and replay, reconnecting, and signing in again as the same courier.
- Notice acknowledgment transport is covered by T041; the actual notices, acknowledgment
  endpoint, handovers, and push notifications remain US5 (T061–T070).

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
