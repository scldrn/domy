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
| 003 Courier app | Setup T001–T003 (#13), domain T004–T014 (#14), foundation T015–T025 (#15), US1 T026–T040 (#16–#17), account linking T094 (#18), and idempotency corrections T095–T097 (#19, squash `5c8b107`) are on `main`. PR #19 and its post-merge CI passed all gates. US2 T041–T047 and corrective T098 are implemented, locally validated, and converged on `003-us2-offline`; the owner approved commit, push, and PR publication. Its PR supplies the current GitHub CI status; merging still needs approval. Its phone journey covers pickups and deliveries; US3 completes the exception step. Effects of late records across routes arrive with US5 (T067) |
| 004 Tracking page and merchant link | Specified, planned, tasked, and analyzed; implementation not started |

## Next step

1. Verify GitHub CI for the US2 PR from `003-us2-offline`; publication is approved. Ask the
   owner before merging, and merge only with green CI, then update `main`. Continue US3 (T048–T053) on a new
   `003-us3-exceptions` branch only with approval. Write T049's offline exception regression
   before T051's form; validate the complete exception phone journey after the form passes.
   Do not repeat T094–T097 or merge the already merged PR #19 again.
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
  The route-invariants timeout did not recur. T095–T097 landed on `main` through PR #19
  (squash `5c8b107`) after all GitHub CI gates passed, with the owner's approval.

## US2 implementation context

- Started from `5c8b107` on `003-us2-offline`. The owner approved clarifying the offline
  scenario's dependency: US2 validates pickups and deliveries on the phone and every
  record kind technically; US3 adds the exception form and completes its offline phone
  journey. Tests first, T041–T043, before T044–T047; no US3 interface is built early.

- Checklists pass: requirements 16/16, courier rules 48/48. Feature context remains
  `specs/003-courier-app` in the local `.specify/feature.json`.
- Reuse `apps/web/src/lib/offline/` and `features/courier/courier-store.ts`: records and
  photos are saved in one IndexedDB transaction, and pending records replay over the
  snapshot using the shared domain rules. Open, reconnect, visibility, and 30-second
  synchronization triggers already exist in the store.
- Identity is checked atomically before saving or sending. Sign-in and sign-out share the
  same pending-data guard, including photo-only queues and unreadable ownership. Expired
  sessions keep the route; withdrawn access clears only the snapshot. A temporary server
  error does not withdraw access. Acknowledged records leave the outbox together with the
  refreshed snapshot, preserving the visible local result if refresh fails.
- The banner and pending page show actions and photos, warn after 2 hours and within 2 days
  of expiry, and offer retry, installation guidance, and persistent-storage request.
- The server already applied one transaction per record and clamped occurrence time to
  receipt time; T042 verifies this behavior rather than introducing another implementation.
- T043 serves the built app with Vite preview and its real active service worker. Each
  case owns an independent courier account and route. Coverage includes offline reopening
  within 3 seconds, photos, response loss after commit, reconnecting, expiry and same-user
  reauthentication, unavailable server, guarded logout, cleanup, and accessibility.
- Notice acknowledgment transport is covered by T041; the actual notices, acknowledgment
  endpoint, handovers, and push notifications remain US5 (T061–T070).

## US2 validation

- Tests first: the expanded sync suite initially reproduced 15 failures before T044;
  ownership on save also failed before its correction. Later consumer review reproduced
  four failures around temporary server failure, malformed successful sign-in, and `403`
  withdrawal before correcting those paths. T098 then reproduced one more failure: a
  malformed stored snapshot supplied an untrusted expiry during session refusal.
- T042's seven PostgreSQL tests passed against the existing server behavior, including
  actual Better Auth expiry under a controlled process clock. No duplicate server
  implementation or migration was necessary.
- Final gates on 2026-10-14: `pnpm check`, `pnpm build`, default-worker `pnpm test`
  (201 domain, 380 server, 170 web; **751 total**), and `pnpm test:e2e` (**64 scenarios**)
  passed. The built shell and real service worker reopen the loaded route in under 3 seconds
  in the automated Chromium phone viewport; this is not a physical-phone timing claim.
- The initial full unit run, concurrent with static checks, hit the existing 30-second
  route-invariants timeout once. Both subsequent complete default-worker runs, without
  concurrent gates, passed; no timeout or worker setting was changed. Monitor it in CI.
- The retry-target check initially measured a scaled notification hidden in Sonner's
  collapsed stack. It now opens the stack via its accessible shortcut and waits for finite
  animations before checking the visible button's minimum 48 × 48 px area. The final full
  end-to-end suite passed, with no reduced thresholds or disabled accessibility checks.
- Scoped convergence completed with no remaining findings for US2 and T098: 13
  requirements/success criteria, 10 acceptance scenarios, 8 plan decisions, all 9
  constitution principles, and the 8 completed tasks. The final convergence pass left
  `tasks.md` byte-for-byte unchanged and appended no empty phase. This does not declare
  the whole feature complete: US3–US7 and polish retain their existing tasks. Physical
  Android/iPhone validation remains T087/T093.

| Completed scope | Evidence |
| --- | --- |
| FR-001–FR-004, FR-021: authentication, identity, expiry, withdrawal, logout | Existing auth and courier-access suites; `session.test.ts` (8), `sync.test.ts` (23), offline expiry/logout e2e |
| FR-018–FR-019, SC-001: durable ordered records and exactly-once effects | IndexedDB/outbox regressions, server `courier-records-sync.test.ts` (7), lost-response-after-commit e2e |
| FR-020, FR-022, SC-003–SC-004: automatic synchronization, pending view and warnings, cached route | Shared triggers, `sync-status.test.ts` (3), offline reload/reconnect and unavailable-server e2e |
| FR-023: separate acknowledged photo upload and finished-route cleanup | Sync refusal/ordering regressions, actual stored proof and empty-store logout e2e |

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
