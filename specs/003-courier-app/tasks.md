---

description: "Task list for Courier App"
---

# Tasks: Courier App

**Input**: Design documents from `/specs/003-courier-app/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Depends on**: every task of features [001](../001-shipment-registration/tasks.md) and
[002](../002-routes-dispatch/tasks.md)

**Tests**: REQUIRED (Constitution VI). In every phase, test tasks come first and MUST fail
before their implementation tasks start. Integration tests run against real PostgreSQL and
S3Proxy (research R6). Feature 002 as built (research R17) is the base every task extends.

**Organization**: tasks are grouped by user story so each story can be implemented, tested,
and demonstrated on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story the task belongs to (US1–US7)
- Every description includes the exact file path

## Path Conventions

Monorepo defined in feature 001's plan: `apps/server/`, `apps/web/`, `packages/domain/`.
English kebab-case file names; Spanish URLs mapped in `apps/web/src/routes.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencies, object storage, and the installable app shell

- [X] T001 Add, with exact versions (plan.md, Technical Context), `workbox-precaching`, `workbox-routing`, and `workbox-window` 7.4.1 and `idb` 8.0.4 (and `vite-plugin-pwa` 1.3.0 and `fake-indexeddb` 6.2.5 as dev dependencies) to `apps/web/package.json`; add `@aws-sdk/client-s3` 3 and `web-push` 3.6.7 (with `@types/web-push` as a dev dependency) to `apps/server/package.json`; record them in the dependency list of `README.md`
- [X] T002 [P] Add an S3Proxy 4.1.1 service (`andrewgaul/s3proxy:4.1.1`, filesystem backend on a volume, fixed keys, research R6) to `compose.yaml`; add `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to `.env.example` and to the Zod schema in `apps/server/src/env.ts`; start an in-memory S3Proxy and pass those variables, with a test key pair, to the API in `apps/web/tests/e2e/global-setup.ts`, so CI needs nothing beyond Docker; update the services listed for `docker compose up -d` in `CLAUDE.md`
- [X] T003 [P] Configure `vite-plugin-pwa` with `injectManifest` in `apps/web/vite.config.ts` (manifest: name "Domy", Spanish description, standalone display, theme color from the tokens); render the provisional icons ("domy" in white on `#34495E`, design-system.md §11, owner decision 2026-10-14) with `apps/web/scripts/generate-app-icons.ts` (`pnpm icons`) into `apps/web/public/icons/`, linked from the manifest and `apps/web/index.html`; create the service worker `apps/web/src/sw.ts` that precaches the app shell, and register it in `apps/web/src/main.tsx` (FR-001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: record rules, tables, the function that applies a record, and the phone's
stores, which every user story needs

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

### Tests first

- [X] T004 [P] Extend `packages/domain/src/shipment-lifecycle.test.ts` with the transitions owned by this feature (data-model.md §Shipment lifecycle), including `dispatched → delivered` only for errands and the refusal of every transition not listed
- [X] T005 [P] Write failing unit tests in `packages/domain/src/courier-records.test.ts` for `resolveCourierRecord`: one case per row of data-model.md §What each record does (each kind applied, `duplicate`, `not_applied`), including the office pickup, the pickup of a shipment not on the author's route, and the delivery of a shipment whose pending task is on another route (FR-024–FR-026)
- [X] T006 [P] Write failing unit tests in `packages/domain/src/day-summary.test.ts`: collected total, the three totals by payment method, disbursements, cash to hand over = cash − disbursements, reverted and not-applied records excluded, grouping by Bogotá date, pending stops counted from the route and not from records (FR-037)
- [X] T007 [P] Extend `packages/domain/src/routes.test.ts`: a shipment held by a courier gets only a delivery stop, or only a return stop at the place it was picked up (the recipient's address for a reverse pickup); a shipment held by the office gets a pickup stop at the office address first; `validateStopOrder` keeps a return stop after its office pickup (FR-029, FR-031, FR-041)
- [X] T008 [P] Extend `packages/domain/src/shipment-flags.test.ts` with "Sin foto", "Foto pendiente" (only during the 24 hours after the record), "Recaudo diferente", "Problema de recogida", and "Por revisar" (FR-033, FR-023)

### Domain

- [X] T009 Extend `packages/domain/src/shipment-lifecycle.ts` until T004 passes
- [X] T010 Implement `packages/domain/src/courier-records.ts` (`resolveCourierRecord`, Spanish labels for record kinds, exception reasons, and notice types) until T005 passes
- [X] T011 [P] Implement `packages/domain/src/day-summary.ts` until T006 passes
- [X] T012 Extend `packages/domain/src/routes.ts` (return stop kind, held shipments, office pickup) until T007 passes
- [X] T013 [P] Extend `packages/domain/src/shipment-flags.ts` until T008 passes
- [X] T014 [P] Create `packages/domain/src/schemas/courier.ts`: the `CourierRecordInput` union by `kind` (at most three `proof` photos; note required when the collected total differs from the COD amount; received-by name of 2–100 characters; reasons and notes of 5–200 characters), `CourierSnapshot`, `CourierRoute`, `HeldShipment`, `HandoverToGive`, `Notice`, `DaySummary`, `ExceptionDecisionInput`, `RecordCorrectionInput`, `CompanySettings`

### Database

- [X] T015 [P] Define `courier_records`, `record_photos`, `courier_notices`, and `push_subscriptions` with their enums, kind-specific checks, and indexes in `apps/server/src/db/schema/courier-records.ts` per data-model.md
- [X] T016 [P] Define `company_settings` (single row) in `apps/server/src/db/schema/settings.ts`
- [X] T017 Extend `apps/server/src/db/schema/shipments.ts` (`held_at_office`, `return_decided`, `needs_review`, their checks, and the new `shipment_event_type` values), `apps/server/src/db/schema/routes.ts` (`stop_kind` value `return`, `route_tasks.problem_note`; `handovers.from_route_id` is already optional), and `apps/server/src/db/schema/directories.ts` (`couriers.last_synced_at`)
- [X] T018 Generate and review the migration for T015–T017 in `apps/server/src/db/migrations/`, and set a sample office address in `apps/server/src/db/seed/index.ts`

### Applying a record

- [X] T019 [P] Create `apps/server/tests/setup/storage.ts` (in-memory S3Proxy 4.1.1 through Testcontainers' `GenericContainer`, research R6) and `apps/server/src/lib/storage.ts` (`putPhoto`, `getPhoto` over `@aws-sdk/client-s3`)
- [X] T020 Write failing integration tests in `apps/server/tests/courier-records-apply.test.ts` for `applyCourierRecord`: a pickup sets status, custody, and the task in one transaction with `occurred_at` and `recorded_at`; the same `id` sent twice has one effect and returns the stored outcome; a record that cannot be applied is stored with outcome `not_applied`; the route status is recalculated; shipment events carry author, time it happened, and time received (FR-019, FR-024, FR-039); every custody move writes `changes.custodyCourierId` (and `heldAtOffice` for the office) as the custody history of feature 002 reads it, and the courier's own records write `on_behalf = false` (research R17)
- [X] T021 Implement `apps/server/src/lib/courier-records.ts` (`applyCourierRecord`: insert the record by its `id`, execute the result of `resolveCourierRecord` on the shipment, task, custody, photos expected, and events, then `lib/route-status.ts`) until T020 passes
- [X] T022 Replace the test-only stand-in of feature 002 in `apps/server/tests/setup/routes.ts` with calls to `applyCourierRecord`, and confirm the tests of feature 002 still pass

### Skeleton

- [X] T023 Create `apps/server/src/routes/courier.ts` (`requireRole('courier')`), `apps/server/src/routes/courier-records.ts`, `apps/server/src/routes/photos.ts`, and `apps/server/src/routes/settings.ts`, mounted in `apps/server/src/app.ts`, with the error codes of contracts/http-api.md added to `apps/server/src/lib/errors.ts`
- [X] T024 [P] Create `apps/web/src/lib/offline/db.ts`: the IndexedDB database with the stores `snapshot`, `outbox`, `photos`, and `meta` (data-model.md §Data on the phone)
- [X] T025 Register `/mensajero`, `/mensajero/parada/$stopId`, `/mensajero/mi-dia`, `/mensajero/pendientes`, and `/configuracion` in `apps/web/src/routes.ts`; create `apps/web/src/routes/courier-layout.tsx` (navigation bar, high-contrast option with the `[data-scheme="high-contrast"]` tokens that already exist) and the empty pages `courier-route.tsx`, `courier-stop.tsx`, `courier-day.tsx`, `courier-pending.tsx`, and `settings.tsx` in `apps/web/src/routes/`, replacing the waiting page `apps/web/src/routes/courier-home.tsx` (the panel already sends a courier to `/mensajero`)

**Checkpoint**: `pnpm check` and `pnpm test` pass, including feature 002's suite; a courier
signs in and lands on an empty "Mi ruta"

---

## Phase 3: User Story 1 - Carry out a route (Priority: P1) 🎯 MVP

**Goal**: the courier sees the route, confirms pickups, and records deliveries with
received-by name, photo, and collection

**Independent Test**: dispatch a route of two pickups and four deliveries; from a phone,
confirm the pickups and record the deliveries, one with a COD amount; verify the dispatch
board and that the route is "Finalizada"

### Tests for User Story 1 ⚠️ write first, must fail

- [X] T026 [P] [US1] Integration tests in `apps/server/tests/courier-route.test.ts` (FR-002, FR-005): `GET /api/courier/route` returns only the caller's route in progress with every field of `CourierRoute`, `null` without one, `sessionExpiresAt`, and updates `couriers.last_synced_at`; owner and dispatcher get `403`
- [X] T027 [P] [US1] Integration tests in `apps/server/tests/courier-records.test.ts` covering spec US1 scenarios 2–9: pickups one by one; delivery with received-by name, location, and photos declared; collection split among the three payment methods; a total different from the COD amount requires a note; errand completed with an optional note; delivery of a shipment not picked up is `not_applied`; disbursement stored; stops completed out of order; the route becomes `finished` (FR-006–FR-012, FR-015)
- [X] T028 [P] [US1] Integration tests in `apps/server/tests/photos.test.ts` (FR-009, FR-023, FR-036): `PUT /api/courier/photos/:id` stores the object and sets `uploaded_at`; `404` before its record; `413 payload_too_large` above 1 MB (the body limit of feature 002); repeating it is harmless; `GET /api/photos/:id` for owner and dispatcher, for the courier only on their own records, `404` when the object is gone
- [X] T029 [P] [US1] Extend `apps/server/tests/board.test.ts` with the flags `noPhoto`, `photoPending`, and `collectionDiffers` on `GET /api/shipments/board`, and the records, photos, and collection on `GET /api/shipments/:id` (FR-033, FR-036)
- [X] T030 [P] [US1] Unit tests in `apps/web/src/lib/offline/outbox.test.ts` with `fake-indexeddb`: a saved record survives reopening the database; replaying the outbox over the snapshot gives the state `resolveCourierRecord` produces; a record that cannot be saved rejects and nothing is shown as done (FR-018)
- [X] T031 [P] [US1] End-to-end test in `apps/web/tests/e2e/courier-route.spec.ts` with a phone viewport: quickstart scenarios 1–7, the photo through the file chooser

### Implementation for User Story 1

- [X] T032 [US1] Implement `GET /api/courier/route` and `POST /api/courier/records` (each record in its own transaction through `applyCourierRecord`) in `apps/server/src/routes/courier.ts` until T026 and T027 pass
- [X] T033 [US1] Implement `PUT /api/courier/photos/:id` in `apps/server/src/routes/courier.ts` and `GET /api/photos/:id` in `apps/server/src/routes/photos.ts` until T028 passes
- [X] T034 [US1] Add the three flags and the records to the board and shipment detail responses in `apps/server/src/routes/shipments.ts` and `packages/domain/src/schemas/board.ts` until T029 passes
- [X] T035 [US1] Implement `apps/web/src/lib/offline/outbox.ts` (save a record with its phone-generated `id` or a notice acknowledgment, replay records over the snapshot) and a first `apps/web/src/lib/offline/sync.ts` (send the outbox, upload photos whose record was acknowledged, fetch the snapshot; run on open and after each save) until T030 passes
- [X] T036 [P] [US1] Implement `apps/web/src/lib/offline/photos.ts` (reduce to 1600 px JPEG of about 200 KB with a canvas) and `apps/web/src/lib/offline/location.ts` (last position at most 2 minutes old, never awaited)
- [X] T037 [P] [US1] Build `apps/web/src/features/courier/photo-input.tsx` (camera through a file input, up to three photos, skippable) and `apps/web/src/features/courier/collection-fields.tsx` (full COD amount proposed in cash, split among the three payment methods, note when the total differs, confirmation above COP 2.000.000)
- [X] T038 [US1] Build `apps/web/src/features/courier/delivery-form.tsx` (received-by name proposed per shipment kind, photos, collection, receipt photo for transfers, the summary to confirm before saving, FR-017) and `apps/web/src/features/courier/disbursement-form.tsx`
- [X] T039 [US1] Build `apps/web/src/routes/courier-route.tsx` ("Mi ruta": route number, stops in order, first pending stop highlighted, the message when no route is dispatched) and `apps/web/src/routes/courier-stop.tsx` (tasks, confirm each pickup, "confirm the pickup first", call, WhatsApp, and map shortcuts shown only when their data exists, FR-016), until T031 passes
- [X] T040 [P] [US1] Build `apps/web/src/features/shipments/shipment-records.tsx` (proof of delivery, photos with "Foto pendiente" and "no longer available", collection by payment method, disbursements, location) in `apps/web/src/features/shipments/shipment-detail.tsx`, and show the three flags in `apps/web/src/features/board/board-table.tsx`

**Checkpoint**: a courier carries out a route from the phone with signal

---

## Phase 4: User Story 2 - Keep working without signal (Priority: P1)

**Goal**: nothing is lost or duplicated without signal, and the courier always sees what is
pending

**Independent Test**: load a route, go offline, record a pickup, a delivery with photo and
collection; restart; go online; every record arrives exactly once with the
time it happened

All record kinds are covered by the technical persistence and sync tests. The phone
journey's exception step depends on US3's T051 and is completed by T049, not claimed by US2.

### Tests for User Story 2 ⚠️ write first, must fail

- [X] T041 [P] [US2] Unit tests in `apps/web/src/lib/offline/sync.test.ts` with `fake-indexeddb` and a fake `fetch`: records sent in order, at most 50 per request; a record leaves the outbox only when acknowledged and the refreshed snapshot is committed; a failed request keeps unacknowledged work (successful photo uploads may already be removed); a `401` keeps the outbox and asks to sign in; a `401` before the known `sessionExpiresAt` (access withdrawn) clears the snapshot and keeps the outbox, and one after it (session expired) keeps both; notice acknowledgments are sent after the records; a photo is uploaded only after its record; `deviceNow` is sent; a different user cannot take over a non-empty outbox; a snapshot without a route that was finished removes its personal data and photos from the phone (FR-004, FR-018–FR-023)
- [X] T042 [P] [US2] Integration tests in `apps/server/tests/courier-records-sync.test.ts`: a batch answered twice has one effect per record; `occurred_at` is corrected by the offset to `deviceNow` and never later than `recorded_at`; a well-formed record whose state prevents application is stored as `not_applied` without stopping the other records; malformed request fields are refused at the boundary without effects; records of one shipment apply in the order sent (FR-019, FR-024, Constitution V)
- [X] T043 [P] [US2] End-to-end test in `apps/web/tests/e2e/courier-offline.spec.ts` with `context.setOffline`: quickstart scenarios 8–10 (US2's pickups and deliveries; the exception step is T049 after T051) and 21, the app opening offline from the service worker in under 3 seconds (SC-003), and the first open without signal (spec US2 scenario 10). Use the built app and its real service worker through `apps/web/tests/e2e/global-setup.ts`, keeping the existing suite working

### Implementation for User Story 2

- [X] T044 [US2] Complete `apps/web/src/lib/offline/sync.ts`, the identity and atomic persistence in `db.ts` and `outbox.ts`, and `apps/web/src/features/courier/courier-store.ts`: triggers on open, on the `online` event, on becoming visible, and every 30 seconds while visible; clock offset stored in `meta`; `401` handling; outbox tied to the signed-in user; acknowledged records and the refreshed snapshot committed together so a failed refresh cannot undo their visible results. Validate stored items and transport responses at the boundary, with shared response schemas in `packages/domain/src/schemas/courier.ts` (Constitution V). Integrate identity and expired/offline session handling in `apps/web/src/routes/courier-layout.tsx` and `apps/web/src/features/auth/session.ts`; until T041 passes
- [X] T045 [US2] Apply the clock offset and the per-record transaction isolation in `apps/server/src/routes/courier.ts` until T042 passes
- [X] T046 [US2] Write tests for the warning boundaries and count wording in `apps/web/src/features/courier/sync-status.test.ts`, then implement that pure logic in `sync-status.ts` and add to `apps/web/src/routes/courier-layout.tsx` the connectivity banner, separate pending action and photo counts on the navigation bar, synchronization feedback with retry (design-system.md §8), the warning when records are pending for more than 2 hours, and the warning when the session ends in 2 days or fewer (FR-003, FR-020)
- [X] T047 [US2] Build `apps/web/src/routes/courier-pending.tsx` (list of pending records and photos, sign-out refused while any is pending, sign-out clearing the database) and `apps/web/src/features/courier/install-hint.tsx` (how to install, `navigator.storage.persist()` after sign-in), until T043 passes

**Checkpoint**: User Stories 1 and 2 make the app reliable on the street

---

## Phase 5: User Story 3 - Report what could not be done (Priority: P1)

**Goal**: exceptions and pickup problems recorded by the courier and visible at once

**Independent Test**: report "Destinatario ausente" on a delivery and a problem on a pickup;
verify "Novedad" with its reason and the "Problema de recogida" flag

### Tests for User Story 3 ⚠️ write first, must fail

- [X] T048 [P] [US3] Integration tests in `apps/server/tests/courier-exceptions.test.ts` covering spec US3 scenarios 1–5: an exception sets `exception`, keeps custody, fails the delivery task, and may finish the route; reason required, note and photos optional; a problem sets `problem_note` without changing the status, a second report replaces it, and it clears when the task is completed; per-entry `returnDecided`, `exceptionsToDecide`, and `pickup_problem` on the board. Unit tests in `packages/domain/src/dispatch-board.test.ts` for one shared selection rule excluding decided returns and preserving board filter/count semantics (FR-013, FR-014, FR-033).
- [X] T049 [P] [US3] Write the end-to-end tests in `apps/web/tests/e2e/courier-exceptions.spec.ts` before T051: quickstart scenario 11 and the complete offline scenario 8 including its exception step; reopen, reconnect, and verify one exception record. They pass after T051–T052, not before the form exists.

### Implementation for User Story 3

- [X] T050 [US3] Add per-entry `returnDecided` to `BoardEntry` in `packages/domain/src/schemas/board.ts`, implement the shared undecided-exception selection rule in `packages/domain/src/dispatch-board.ts`, and use it for `exceptionsToDecide` in `GET /api/shipments/board` in `apps/server/src/routes/shipments.ts`; reuse the existing `pickup_problem` flag, until T048 passes. Do not implement US4 decision actions.
- [X] T051 [P] [US3] Build `apps/web/src/features/courier/exception-form.tsx` (three reasons, optional note and photos, summary to confirm) and `apps/web/src/features/courier/problem-form.tsx` (note of 5–200 characters), wired into `apps/web/src/routes/courier-stop.tsx`
- [X] T052 [US3] Show "Novedades por decidir" using the shared domain selection rule for its list and count, exclude those entries from the ordinary date sections, and preserve the "Problema de recogida" flag in `apps/web/src/routes/dispatch-board.tsx` and `apps/web/src/features/board/board-table.tsx`, until T049 passes; decided returns remain in ordinary sections.

**Checkpoint**: every failed visit leaves a record

---

## Phase 6: User Story 4 - Decide what happens after an exception (Priority: P2)

**Goal**: new attempt, return to sender, and receipt at the office

**Independent Test**: decide a new attempt and deliver it; decide a return and complete the
return stop; verify two attempts in the first history and "Devuelto" on the second

### Tests for User Story 4 ⚠️ write first, must fail

- [X] T053 [P] [US4] Integration tests in `apps/server/tests/exception-decision.test.ts` covering spec US4 scenarios 1–6 and FR-029–FR-032: new attempt on the same route; on another courier's route with a pending handover; rescheduled (off route, new service date, listed by `GET /api/shipments/unassigned` with `heldBy`); return stop at the place the shipment was picked up, including a reverse pickup; a return changed to a new attempt removes the pending return stop; `409 no_exception_to_decide`; a return record sets `returned` and ends custody; a problem on a return stop keeps it pending; attempts listed without reverted records; a held shipment is refused on a route in preparation with `409 route_not_in_progress`
  Include concurrent requests with the same `actionId` for both decisions, and late
  replays of each after a subsequent change (including a return changed to a new attempt).
  Assert one decision event and one set of tasks/handovers for the original action,
  no repeated custody or fee effect, and no reversal of the intervening change. A replay
  returns the current shipment rather than failing the current-state guard or applying
  the old decision again (Constitution II, IV, VI); these tests precede T056.
- [X] T054 [P] [US4] Integration tests in `apps/server/tests/office-receipt.test.ts` covering spec US4 scenarios 7–8 and FR-041: receipt for a shipment in "Novedad" and for one "Recogido" off route; custody passes to the office; `409 not_held_by_courier`; `409 office_not_configured`; with a new attempt the shipment is `registered` and a route gets a pickup stop at the office; with a return the route gets the office pickup before the return stop; the pickup record at the office gives custody to the courier; `GET` and `PATCH /api/settings` (owner only for `PATCH`, change audited). Before T057, add unit regressions in `packages/domain/src/shipment-lifecycle.test.ts` for the contextual off-route `picked_up → registered` office receipt with its service date preserved, rejection while on a route, and the unchanged generic transition prohibition; cover concurrent and late retries of receipt and unchanged settings (Constitution II–IV)
  Assert settings responses against `CompanySettings` as documented in the contract:
  GET without a body returns 200 and both fields null before configuration (including
  when the singleton row does not yet exist); PATCH returns 200 with the saved address
  and resolved neighborhood; a late replay returns the current configuration without
  restoring an older value. Owner and dispatcher can GET; only the owner can PATCH;
  couriers cannot use either endpoint.
- [X] T055 [P] [US4] End-to-end test in `apps/web/tests/e2e/exception-decision.spec.ts`: quickstart scenarios 12–13, including reporting a problem on a pending return without closing it, and office pickup followed by return while offline, reopening and synchronization. Before T060, extend `apps/web/src/lib/offline/outbox.test.ts` for office custody before that pickup, courier custody afterward and the return's local completion (FR-018, FR-030, FR-041)

### Implementation for User Story 4

T056 domain checkpoint: before server implementation, extend `shipment-lifecycle.test.ts`
for exception-decision state/date/route selection and held-routing eligibility, and
`courier-records.test.ts` for applied, non-reverted delivery-attempt selection. Implement
those pure rules in their corresponding domain modules, then consume them from T056.

T053 red evidence (2026-10-15): `exception-decision.test.ts` has 17 cases against a
fresh PostgreSQL 18 container. The run has 16 failures and 1 pass: 15 cases stop at the
absent decision endpoint (404), one at the missing `attempts` projection, and the existing
courier role guard passes. Fixture registration, dispatch, pickup and exception records
succeed first. Assertions after those blockers, including replay effects, must still be
verified during T056; they are not passing behavior yet. T053 remains unchecked until
green. Continue with T054/T055 before production implementation.

T054/T055 red evidence (2026-10-15): office/settings integration tests have 12 failures
against real PostgreSQL, at the absent settings, decision or receipt endpoints. The
lifecycle suite has 8 passing baseline cases and 2 failing receipt cases because the
expected domain export does not exist yet; its test-only signature loads the real module,
not a mock or production stub, and is replaced by a direct import in T057. The outbox
suite has 8 passes and 2 new failures: it incorrectly permits return before office pickup
and fails to replay the office pickup. Three phone scenarios cover quickstart 12–13,
return problems, reopening and offline pickup/return; both phone runs stop at the absent
decision button or office form. `pnpm check` passes. Downstream assertions are not yet validated. These tasks
remain unchecked until green, and convergence follows implementation, not this RED stage.

- [X] T056 [US4] Implement `POST /api/shipments/:id/exception-decision` in `apps/server/src/routes/shipments.ts`, add `attempts` to `GET /api/shipments/:id`, and extend `GET /api/shipments/unassigned`, `POST /api/routes/:id/shipments`, and `POST /api/shipments/:id/reassign` to held shipments (in `apps/server/src/routes/shipments.ts` and `apps/server/src/routes/routes.ts`), until T053 passes
- [X] T057 [US4] Implement `POST /api/shipments/:id/office-receipt` in `apps/server/src/routes/shipments.ts` and `GET`/`PATCH /api/settings` in `apps/server/src/routes/settings.ts` until T054 passes. Declare the guarded office-receipt transition once in `packages/domain/src/shipment-lifecycle.ts`; never relax generic route transitions. Preserve the service date and write custody and its event in one transaction; reuse `auditedChange` for settings, including unchanged receipts
- [X] T058 [P] [US4] Build `apps/web/src/features/shipments/exception-decision-dialog.tsx` ("Nuevo intento" with date and route, "Devolver al remitente", "Recibido en oficina") and the attempts list in `apps/web/src/features/shipments/shipment-records.tsx`; extend `CustodyHistory` in `apps/web/src/features/routes/route-history.tsx` (and its unit test) with the office lines ("La recibe la oficina", "La recoge {courier} en la oficina")
- [X] T059 [P] [US4] Show held shipments ("En custodia de {courier}", "En oficina") in `apps/web/src/features/routes/unassigned-list.tsx`, and build the office address form in `apps/web/src/routes/settings.tsx` with its item in `apps/web/src/routes/panel-layout.tsx`
- [X] T060 [US4] In the courier app, complete a return stop with `apps/web/src/features/courier/delivery-form.tsx` (received-by name and photo, no collection), reuse `problem-form.tsx` for a pending return without an exception action, and list "En mi custodia" in `apps/web/src/routes/courier-route.tsx`, until T055 passes. Extend the projection in `apps/web/src/lib/offline/outbox.ts` so an office pickup and the subsequent return replay correctly without signal, using the shared domain rules

**Checkpoint**: no shipment stays in "Novedad" without a way forward

---

## Phase 7: User Story 5 - Follow changes to the route and confirm handovers (Priority: P2)

**Goal**: notices and phone notifications for every change, handovers confirmed by the
courier, and late records applied as facts

**Independent Test**: change a route from the panel and verify the notices; confirm a
handover from the receiving courier's phone; remove a shipment while the first phone is
offline with its pickup recorded, and verify the result

### Tests for User Story 5 ⚠️ write first, must fail

Owner-approved US5 alignment (2026-10-15): T061 also tests
`GET /api/courier/push-config` with and without configured notifications, its exact
`{ publicKey: string | null }` shape, no private key/subject, and refusal of unlinked
couriers, owner and dispatcher. T066 defines its shared response schema in
`packages/domain/src/schemas/courier.ts` and implements the role/link-guarded endpoint.
T068 obtains that runtime configuration before subscribing and skips subscription when
the key is null; no web build-time variable, migration or dependency is added.

- [X] T061 [P] [US5] Integration tests in `apps/server/tests/courier-notices.test.ts` (FR-027, FR-033, FR-040): every action listed in FR-027 creates a notice for each affected courier in the same transaction, including joining a route to the courier's route in progress (`POST /api/routes/:id/join`) and editing a shipment on the route (`shipment_updated`), and cancelling a route in preparation creates none; the snapshot returns the unacknowledged ones; the acknowledgment sets `acknowledged_at` once; `unacknowledgedNotices` and `courierLastSyncedAt` on `GET /api/routes/board`; a phone notification is sent after commit with only the type and the route number; a failing push service does not fail the action; a `410` deletes the subscription; subscribing and removing a subscription
- [X] T062 [P] [US5] Integration tests in `apps/server/tests/courier-late-records.test.ts` covering spec US5 scenarios 5–7 and FR-024–FR-026: pickup of a removed shipment (off route, custody, "Por revisar"); of a shipment on another courier's route in progress (pending handover); on a route in preparation (leaves it); delivery by the holder after a reassignment (handover cancelled, the other stop removed, notice to the other courier); a disbursement for a shipment off the route; `not_applied` for a voided, delivered, or returned shipment or without custody, with a `record_not_applied` notice; a repeated record from a second phone is `duplicate` without a flag; `POST /api/shipments/:id/clear-review` with a note; cancelling a handover with no origin route leaves the shipment off route with its holder (research R17)
- [X] T063 [P] [US5] Extend `apps/server/tests/handovers.test.ts` and `apps/server/tests/custody-history.test.ts`: a `handover_confirmation` record gives custody and unblocks the task; `handoversToGive` stays in the giver's snapshot after the route left their app; custody history with the office and with late records leaves no interval without a holder (FR-028, SC-007)
- [X] T064 [P] [US5] End-to-end test in `apps/web/tests/e2e/courier-changes.spec.ts` with two phone contexts: quickstart scenarios 14–18 (the notification checked through the service worker's `push` event)

### Implementation for User Story 5

US5 initial test checkpoint (2026-10-15): owner-approved push configuration is aligned
before production implementation. Read-only scoped analysis maps all eight scenarios
to T061–T070 and the seven direct requirements FR-024–FR-028/FR-033/FR-040 plus buildable
SC-001/SC-004/SC-007 to tasks (10/10); all nine constitution principles checked, no
remaining HIGH/CRITICAL finding, no unmapped US5 task. The reviewer checklists remain
unchanged (16/16 and 48/48).

The first two-file PostgreSQL run reproduced 23 failures with three supported cases.
The expanded four-file run has 28 failures and 12 passes across 40 cases. Failures are
missing notices/configuration/subscription/review endpoints, omitted cross-route record
effects (500), and refusal to cancel a handover without an origin route (409). T063's
three added cases pass with the existing record/snapshot/office behavior, as do its six
baseline cases; no production rule was duplicated to make them fail artificially.
The final RED run adds a deferred constraint failure at commit, after inserting a notice,
and requires no push on that rollback: 29 failures and 12 passes across 41 cases.
T061 also covers after-commit, non-blocking push, exact payload privacy, HTTP 404/410
subscription removal, transient service failure, subscription no-op/concurrent/late
replays and acknowledgment isolation. Tests spy only on the external push transport;
PostgreSQL is real. Its test-app configuration seam is not a production implementation.

T064 has six phone cases covering quickstart 14–18, offline acknowledgments/handovers,
review clearing and the real built worker's push event with the app closed. Two runs
reproduce the same five missing-behavior failures; the second-phone duplicate case
passes. Assertions behind the initial failures are not yet validated. The second run
removes only the contradictory inherited NO_COLOR environment variable; no project
timeout, worker, retry, test or assertion setting changes. `pnpm check` and `pnpm build`
pass. T061/T062/T064 remain unchecked until green; implementation T065–T070, full
unit/integration/e2e gates and scoped convergence remain pending. No US5 production code,
dependency or migration has changed, and nothing has been committed or published.

- [X] T065 [US5] Implement `apps/server/src/lib/push.ts` (`web-push` client) and `apps/server/src/lib/notices.ts` (`notifyCourier`: notice row in the transaction, phone notification after commit), and call it from every action of FR-027 in `apps/server/src/routes/routes.ts` (including `join`), `apps/server/src/routes/shipments.ts` (including `PATCH` of a shipment on a route in progress), `apps/server/src/routes/handovers.ts`, `apps/server/src/lib/reassignment.ts`, and `apps/server/src/routes/courier-records.ts`
- [X] T066 [US5] Implement `POST /api/courier/notices/acknowledge` and the push subscription endpoints in `apps/server/src/routes/courier.ts`, and add `unacknowledgedNotices` and `courierLastSyncedAt` to `GET /api/routes/board` in `apps/server/src/routes/routes.ts`, until T061 passes
- [X] T067 [US5] Extend `apps/server/src/lib/courier-records.ts` with the effects across routes (handover created or cancelled, task removed from another route, shipment taken off a route in preparation, "Por revisar", `record_not_applied` notice), let `cancelHandover` in `apps/server/src/lib/reassignment.ts` cancel a handover with no origin route, and implement `POST /api/shipments/:id/clear-review` in `apps/server/src/routes/shipments.ts`, until T062 and T063 pass
- [X] T068 [P] [US5] Add the `push` and `notificationclick` handlers to `apps/web/src/sw.ts` (Spanish text per notice type, opens `/mensajero`) and implement `apps/web/src/lib/offline/push.ts` (ask for the permission once after sign-in, register the subscription)
- [X] T069 [P] [US5] Build `apps/web/src/features/courier/notice-list.tsx` (notices with one "Entendido" for all shown, acknowledged through the outbox) and the handover actions in `apps/web/src/routes/courier-stop.tsx` and `apps/web/src/routes/courier-route.tsx` ("Recibí el paquete", "Entregar a {courier}")
- [X] T070 [US5] Show the last synchronization and the unacknowledged changes in `apps/web/src/features/routes/route-summary-card.tsx`, and the "Por revisar" flag with its clearing dialog and the records "No aplicado" in `apps/web/src/features/board/board-table.tsx` and `apps/web/src/features/shipments/shipment-records.tsx`, until T064 passes

US5 final local closure (2026-10-15; supersedes only the initial checkpoint's pending
status, not its RED evidence): T061–T070 and T113–T119 pass. `pnpm check`, `pnpm test`
(226 domain + 472 server + 179 web = 877), `env -u NO_COLOR pnpm test:e2e`
(82/82, no retries, 4.7 minutes) and `pnpm build` pass. The six US5 journeys include
offline acknowledgments/handovers, late records, review clearing and an actual native
notification from the built worker with no app page open. Reviewed the three saved
phone/dialog screenshots and their passing WCAG scans. No test budget, assertion,
worker/retry policy or existing coverage was relaxed.

Final scoped convergence checked eight acceptance scenarios, ten direct requirements/
buildable criteria, eight plan decisions, all 17 US5/corrective tasks and nine principles:
zero remaining findings. Assessment left this file byte-for-byte unchanged (SHA-256
`3a99788fe01943d1f5cc781ee2bc1c32d3158a0b567cc01e1c30f474809e4a45`); checkboxes and this
closure note were updated afterward, not by convergence. Reviewer checklists remain
unchanged (16/16 and 48/48). T117's additive notice-enum migration was generated and
reviewed; no new dependency. Physical T087/T093, US6–US7 and feature-wide polish remain
pending. Samuel subsequently approved commit/push/PR with “Si”; publication must receive
fresh CI. No remote green result, merge or permission to begin US6 is claimed here.

**Checkpoint**: the dispatcher no longer needs to call couriers about changes

---

## Phase 8: User Story 6 - Record on behalf of a courier and correct mistakes (Priority: P2)

**Goal**: the dispatcher records for a courier, corrects, and reverts, with a reason

**Independent Test**: record a delivery on behalf; correct a collected amount; revert a
delivery; verify the marks and the history

### Tests for User Story 6 ⚠️ write first, must fail

- [X] T071 [P] [US6] Integration tests in `apps/server/tests/records-on-behalf.test.ts` covering spec US6 scenario 1 and FR-034: every kind except `handover_confirmation` recorded through `POST /api/shipments/:id/records` is stored with `on_behalf`, the dispatcher as author, and the courier who holds the package or whose route carries it, and every event it writes carries `on_behalf = true`, shown as "Registrado por despacho" in the histories of feature 002; `occurredAt` defaults to now; `422 occurred_in_future`; a courier gets `403`
- [X] T072 [P] [US6] Domain tests in `packages/domain/src/shipment-lifecycle.test.ts` and integration tests in `apps/server/tests/records-correct-revert.test.ts` covering spec US6 scenarios 2–4 and FR-035: a correction of each correctable field requires a reason and writes `record_corrected` with old and new values; reverting a package delivery or exception returns the shipment to `picked_up` with its task pending on a route in progress, or off route otherwise; reverting an errand completion returns it to `dispatched` with its errand task pending only if its original route is still in progress with the same courier, otherwise `registered` off route/unassigned, never creating custody (owner option A, 2026-10-16); cover a finished original route, a different courier on that route, and another current route of the original courier that must not be substituted; reverting a return goes back to `exception` with the return pending; `409 record_not_revertible` for a record that is not the latest; a reverted delivery's collection leaves the day summary and the attempts; the courier gets a notice
- [X] T073 [P] [US6] End-to-end test in `apps/web/tests/e2e/records-on-behalf.spec.ts`: quickstart scenario 19, including reverting and completing an errand again on its eligible original route and the off-route fallback without custody

### Implementation for User Story 6

- [X] T074 [US6] Implement `POST /api/shipments/:id/records` in `apps/server/src/routes/shipments.ts` until T071 passes
- [X] T075 [US6] Implement `POST /api/courier-records/:id/correct` and `POST /api/courier-records/:id/revert` in `apps/server/src/routes/courier-records.ts`, using the shared contextual revert rule in `packages/domain/src/shipment-lifecycle.ts` (including owner-approved errand behavior), until T072 passes; generic route transitions must not reopen final shipments
- [X] T076 [US6] Build `apps/web/src/features/shipments/record-on-behalf-dialog.tsx` and `apps/web/src/features/shipments/correct-record-dialog.tsx`, with "Registrado por despacho" and the revert action in `apps/web/src/features/shipments/shipment-records.tsx`, until T073 passes

**Checkpoint**: a dead phone or a wrong tap no longer blocks a route

US6 owner safety refinement (2026-10-16, A2 option A): T072 must also cover a package
record followed by office receipt, exception decision or confirmed custody transfer:
the revert is `409 record_not_revertible` with no changes to records, custody, history,
tasks, collections or notices. Include concurrency and accepted-action replay after a
later operation. T075 enforces this guard transactionally after replay recognition;
T073/T076 demonstrate the panel's explanatory conflict without rewinding later work.
Before T075, T072 also tests tied timestamps, unique/ambiguous legacy event linkage,
kind-specific correction validation and unchanged/concurrent/late correction receipts.
T074/T075 populate the internal `shipment_events.courier_record_id` trace link; generate
its nullable indexed FK migration from the schema, never edit generated migrations.
The shipment-history projection omits empty correction receipts but retains their rows.

---

## Phase 9: User Story 7 - See my day (Priority: P3)

**Goal**: the courier's summary of the day with the cash to hand over

**Independent Test**: record three deliveries with different payment methods and a
disbursement; verify each total and "Efectivo por entregar"

### Tests for User Story 7 ⚠️ write first, must fail

- [X] T077 [P] [US7] Integration tests in `apps/server/tests/courier-summary.test.ts` covering spec US7 scenarios 1 and 3: the `summary` of `GET /api/courier/route` returns today's counts and the four amounts from applied, not reverted records of that courier, with corrected values
- [X] T078 [P] [US7] End-to-end test in `apps/web/tests/e2e/courier-day.spec.ts`: quickstart scenario 20, including records still pending while offline
  Before T080, extend `apps/web/src/lib/offline/outbox.test.ts` for saved totals plus
  pending applied records, excluded duplicates/not-applied records, projected pending
  stops, reopen persistence, disbursements after delivery and held off route, corrected
  clock/Bogotá dates and day rollover. Extend `day-summary.test.ts` before adding its
  optional same-date baseline. Preserve the original snapshot and synchronization rules.

### Implementation for User Story 7

- [X] T079 [US7] Add `summary` to `GET /api/courier/route` in `apps/server/src/routes/courier.ts` with `day-summary.ts` until T077 passes
- [X] T080 [US7] Build `apps/web/src/routes/courier-day.tsx` ("Mi día": the `summary` of the stored snapshot plus the outbox through `day-summary.ts`, labelled as an estimate) until T078 passes

**Checkpoint**: all seven user stories work independently

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T081 [P] Extend `apps/server/tests/role-permissions.test.ts` with every endpoint of contracts/http-api.md: couriers reach only `/api/courier/*` and their own photos; owner and dispatcher reach the panel endpoints and not `/api/courier/*`; `PATCH /api/settings` owner only (FR-002, Constitution IX)
- [ ] T082 [P] Extend `apps/server/tests/routes-invariants.test.ts` with courier records in the random sequence, some sent twice and some late: a package has at most one holder (a courier or the office), a shipment delivered or returned has none, and every record sent has exactly one stored row (SC-001, SC-007)
- [ ] T083 [P] Extend the accessibility checks in `apps/web/tests/e2e/fixtures.ts` to the courier screens at 360 px wide: WCAG 2.2 AA in the standard and high-contrast schemes, touch targets of at least 48 px, and confirming a pickup, confirming a delivery, and reporting an exception within 3 taps of "Mi ruta" (FR-038)
- [ ] T084 [P] Document in `README.md` the deployment settings of this feature: the private bucket with its 12-month lifecycle rule, the storage and notification keys, how to generate the VAPID key pair, and what the production content security policy must allow for the courier app (`worker-src 'self'`, `manifest-src 'self'`, `img-src 'self' blob:`; research R17)
- [ ] T085 [P] Integration tests in `apps/server/tests/operations-export.test.ts` (FR-042, Constitution IX): owner only; `GET /api/shipments/export` includes the delivery columns of contracts/http-api.md; `GET /api/export/courier-records`, `/routes`, and `/handovers` return CSV with Spanish headers, money as integers, Bogotá dates
- [ ] T086 Extend `apps/server/src/lib/export.ts`, `GET /api/shipments/export` in `apps/server/src/routes/shipments.ts`, and `GET /api/export/:dataset` in `apps/server/src/routes/export.ts` until T085 passes, and add the three exports for the owner to `apps/web/src/routes/history.tsx`
- [ ] T087 Run every scenario of `specs/003-courier-app/quickstart.md` (1–21) on an Android phone and an iPhone and record the results, with the times of SC-002, in `specs/003-courier-app/quickstart-results.md`
- [ ] T088 Confirm `pnpm check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` pass with zero warnings

### Added on 2026-10-14: the quality bar feature 002 closed with (research R17)

They run before T087 and T088, which close the phase.

- [ ] T089 [P] Contract test `apps/server/tests/courier-contract.test.ts`: every endpoint of contracts/http-api.md is registered and every `/api/courier/*`, `/api/courier-records/*`, `/api/photos/*`, and `/api/settings` route is documented; every error code with its status; every body (`CourierSnapshot`, record results, `CourierRecord`, the additions to `Shipment`, `RouteSummary`, `RoutesBoard`, `UnassignedShipment`, and events) with exactly the documented shape
- [ ] T090 [P] Security test `apps/server/tests/courier-security.test.ts`: a courier reads only their own route, held packages, notices, summary, and photos, and never another courier's; records stated for another courier are attributed to the signed-in one; a batch above 50 records, a record with malformed fields, and a body above 1 MB are refused without effect; an `occurredAt` in the future is clamped to the time received; a photo id not declared by one of the courier's records is refused; push payloads carry no personal data; a deactivated courier's session is refused at the next request (FR-002–FR-004, FR-019, FR-040, Constitution IX)
- [ ] T091 [P] Performance test `apps/server/tests/courier-scale.test.ts` over the busy day of feature 002's `routes-scale.test.ts`: the snapshot of a route of 15 shipments answers in under 500 ms and a batch of 50 records is applied in under 2 seconds; record the timings in `specs/003-courier-app/quickstart-results.md` (SC-003, SC-004)
- [ ] T092 [P] Web unit tests next to the code for the courier screens' pure logic and components rendered to HTML: the collection split and its note rule, the received-by name proposed per shipment kind, notice texts per type, the pending counter and its 2-hour warning, the session warning, and the stop actions shown per task state (FR-005–FR-017, FR-020, FR-027)
- [ ] T093 Usability and interface review of the courier app on a phone (360 and 390 px, light, dark, and high contrast, one hand): walk a whole route offline and online, time SC-002's deliveries, count the taps of FR-038, check every screen against `docs/design-system.md` (courier app first: bottom navigation, connectivity banner, sync badge, primary actions in the bottom third), and the panel additions against feature 002's screens; fix what fails, test-first when it is behavior, and record the findings in `specs/003-courier-app/quickstart-results.md`
- [X] T094 Link a courier account to its courier (FR-002): `PUT /api/couriers/accounts/:userId` (owner only, one transaction, an audit event per courier changed) in `apps/server/src/routes/couriers.ts`, `account` on `GET /api/couriers`, the role of a linked account locked in `apps/server/src/routes/auth.ts`; "Mensajero vinculado" in `apps/web/src/features/users/account-dialog.tsx`, the linked courier on "Usuarios" and the account on "Mensajeros"; integration tests in `apps/server/tests/courier-accounts.test.ts` and an end-to-end step in `apps/web/tests/e2e/access.spec.ts` (found while building US1: nothing linked an account to its courier)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** and **Foundational (Phase 2)**: after features 001 and 002 are
  complete; they block every user story
- **User Stories (Phases 3–9)**: depend on Foundational
- **Polish (Phase 10)**: after the user stories

### User Story Dependencies

- **US1 (P1)**: after Foundational
- **US2 (P1)**: after US1 (completes the outbox and sync loop US1 starts)
- **US3 (P1)**: after US1
- **US4 (P2)**: after US3 (needs shipments in "Novedad")
- **US5 (P2)**: after US1; its notices for exception decisions, corrections, and reverts are
  wired when US4 and US6 exist, whichever comes later
- **US6 (P2)**: after US3
- **US7 (P3)**: after US1

US2, US3, and US7 are independent of each other; so are US4, US5, and US6, except for the
notices noted above.

### Within Each User Story

- Tests first, failing; then server endpoints; then web screens
- A story is complete when its end-to-end test passes

### Parallel Opportunities

- Setup: T002 and T003 together
- Foundational: T004–T008 together; T011, T013, T014 together; T015 and T016 together
- US1: T026–T031 together; T036 and T037 together
- After US1: US2, US3, and US7 in parallel; after US3: US4, US5, and US6 in parallel
- Polish: T081–T085 and T089–T092 together

---

## Parallel Example: User Story 1

```bash
# Tests first, together:
Task: "Integration tests in apps/server/tests/courier-route.test.ts"
Task: "Integration tests in apps/server/tests/courier-records.test.ts"
Task: "Integration tests in apps/server/tests/photos.test.ts"
Task: "Unit tests in apps/web/src/lib/offline/outbox.test.ts"

# Then, together:
Task: "Implement apps/web/src/lib/offline/photos.ts and location.ts"
Task: "Build apps/web/src/features/courier/photo-input.tsx and collection-fields.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, and 3)

1. Phases 1–2: dependencies, record rules, tables, the function that applies a record
2. Phase 3: carry out a route
3. Phase 4: without signal
4. Phase 5: exceptions and problems

### Incremental Delivery

1. US1 + US2 + US3 → couriers work from the app, the board shows real statuses
2. US4 → decisions after an exception
3. US5 → notices, notifications, handovers, late records
4. US6 → on behalf, corrections, reverts
5. US7 → "Mi día"
6. Polish

Implementation starts only after feature 004 has its own spec, plan, tasks, and analysis
(decision #35 in the business master); that condition holds since 2026-10-01.

### Delivery under Trunk-Based Development (constitution 2.0.0)

Each slice lands on `main` through its own short-lived branch and pull request, of at most
two days:

| Branch | Tasks |
| --- | --- |
| `003-setup` | Phase 1 (T001–T003) |
| `003-foundation-domain` | Phase 2: T004–T014 |
| `003-foundation-records` | Phase 2: T015–T025 |
| `003-us1-server` | Phase 3: tests and server (T026–T029, T032–T034) |
| `003-us1-web` | Phase 3: the courier's screens and the panel's records (T030, T031, T035–T040) |
| `003-courier-accounts` | T094 |
| `003-fix-account-idempotency` | T095–T097 |
| `003-us2-offline` | Phase 4 |
| `003-us3-exceptions` | Phase 5 |
| `003-us4-decisions` | Phase 6 |
| `003-us5-changes` | Phase 7 |
| `003-us6-on-behalf` | Phase 8 |
| `003-us7-my-day` | Phase 9 |
| `003-polish` | Phase 10 |

A story that would take more than two days splits into a tests-and-server branch and a web
branch. Each story's entry point lands with its last slice, so unfinished work stays
unreachable: the courier screens of each story, the panel's exception decision dialog
(T058), the office address item in the navigation (T059), and the "record on behalf" and
correction dialogs (T076). The courier app replaces the waiting page at `/mensajero` in
`003-foundation-records` (T025), before any user reaches the app: Domy is not live until
the go-live checklist of feature 001 is done.

---

## Notes

- [P] tasks touch different files and have no unfinished dependencies
- Several tasks edit `apps/server/src/routes/courier.ts`, `apps/server/src/routes/shipments.ts`,
  `apps/server/src/lib/courier-records.ts`, and `apps/web/src/routes/courier-stop.tsx`; they
  are sequential on purpose
- Verify each test fails before implementing; commit after each task or logical group
- Every task must leave `pnpm check` clean

## Phase 11: Account-link Idempotency Correction

- [X] T095 Write failing regression tests in `apps/server/tests/courier-accounts.test.ts` for accepted unchanged links and unlinks, retries after an intervening change, and concurrent retries; then remember those actions in `apps/server/src/routes/couriers.ts` with an empty-change audit receipt in the existing transaction, until the tests pass (FR-002, Constitution II). Update `docs/status.md` with PR #18's completed merge and the next slice, US2 (T041–T047).

Validation on 2026-10-14: the three new regressions failed before implementation, then all
10 courier account tests passed. `pnpm check`, `pnpm build`, and
`pnpm test --maxWorkers=2` passed (domain 201, server 362, web 135), and `pnpm test:e2e`
passed all 60 scenarios. Scoped convergence for
T095 found no remaining work; US2–US7 and polish keep their existing unchecked tasks. The
initial default-worker suite timed out in the existing route-invariants test; that file
passed alone, and the complete suite passed with two workers without changing its timeout.

## Phase 12: Convergence — Owner Review Corrections

- [X] T096 Write failing integration tests in `apps/server/tests/audit-events.test.ts` for hiding empty-change receipts, preserving their rows, and paging/filtering actual changes correctly; then filter receipts in `apps/server/src/routes/audit-events.ts` before pagination (feature 001 FR-036, Constitution VII; contradicts).
- [X] T097 Write failing regression tests in `apps/server/tests/master-data-idempotency.test.ts` for unchanged edits followed by another edit across merchants, couriers, carriers, neighborhoods, pickup points, and rate zones, unchanged deactivation followed by reactivation, concurrent retries, and invalid edits without a receipt. Centralize accepted-action receipts and single/multiple-entity audit events in `apps/server/src/lib/master-data.ts` (`auditedChange`), and use it in `apps/server/src/routes/couriers.ts` for account linking, preserving T095's regressions and per-courier audit events (feature 001 FR-042, feature 003 FR-002, Constitution II; CRITICAL, contradicts). Keep spec, contracts, plans, and `docs/status.md` aligned; remove status claims that become stale at commit.

Scope: complete these two corrections on the existing fix branch before US2. T097's
regressions are written before its implementation; T095's existing tests remain required.

Validation on 2026-10-14: before implementation, the focused PostgreSQL suite had 10
failures reproducing visible receipts and lost later edits, with 13 tests already passing
(including invalid edits without a receipt). After implementation, all 23 focused tests
passed. The existing multi-courier transfer test also verifies one keyed event, both
couriers' audit histories, and replay after an intervening unlink. All four gates passed:
`pnpm check`, `pnpm build`, default-worker `pnpm test` (domain 201, server 373, web 135;
709 total), and `pnpm test:e2e` (60 scenarios). The route-invariants timeout did not recur.

## Phase 13: Convergence — US2 Session Storage Boundary

- [X] T098 Write a failing regression in `apps/web/src/lib/offline/sync.test.ts` proving that a malformed stored snapshot cannot supply a trusted expiry when session access is refused, while pending records remain intact. Validate the snapshot and the transaction's current metadata in `refuseCourierSession` in `apps/web/src/lib/offline/sync.ts`, using only validated expiry data and preserving the existing unknown-expiry refusal behavior, until it passes (Constitution V, FR-004, T044; CRITICAL, contradicts). Repeat the quality gates and scoped US2 convergence; do not duplicate US3–US7 or polish tasks.

## Phase 14: Convergence — US2 CI Reliability

- [X] T099 Write a failing regression for the unlinked-account refusal during synchronization and after access withdrawal, then present its actionable reason once in `apps/web/src/routes/courier-layout.tsx` and `courier-route.tsx`, preserving retry and pending records (FR-002, FR-004, Constitution VII; partial).
- [X] T100 Write a regression for an automatically dismissing notification during an accessibility scan, then stabilize its visible state through Sonner's supported keyboard interaction in `apps/web/tests/e2e/fixtures.ts`, without excluding notifications or contrast rules, increasing timeouts, or adding sleeps (FR-038, Constitution VI; partial). Run the existing access scenarios and all quality gates.

Complete these baseline corrections before US3 T048–T052. The PR #20 CI passed, but its
access-role and recovery scenarios required retries; a green retry is not evidence of a
deterministic first pass. No future story or polish task is duplicated here.

Validation on 2026-10-14: T099 reproduced two refusal paragraphs before the UI correction;
T100 reproduced a disappearing notification before the accessibility helper correction.
The access suite then passed all seven cases. US3 tests first reproduced eight domain,
four API and three phone failures; the existing record effects were reused. All eight
domain and fourteen PostgreSQL cases now pass, including note replacement/late replay,
custody, private photo declarations, decided-return projection and flag cleanup after
pickup, errand completion, removal and voiding. The offline journey also exposed and
verified the correction for an action covered by fixed navigation/snackbars.
All four full gates passed: `pnpm check`, `pnpm test` (209 domain, 394 server, 170 web;
773 total), `pnpm test:e2e` (69 scenarios, all first pass), and `pnpm build`. No timeout or
worker settings changed. US4–US7 and polish retain their unchecked tasks.

## Phase 15: Convergence — Courier Modal Foreground

- [X] T101 CRITICAL Write a failing phone regression in `apps/web/tests/e2e/courier-exceptions.spec.ts` proving that visible synchronization notifications cannot cover the exception form's photo or confirmation controls. Keep notifications open through Sonner's native shortcut, check actual hit targets, then place the courier toaster below modal sheets but above navigation in `apps/web/src/routes/root.tsx`, preserving the panel's notification behavior. Repeat all gates and scoped convergence (FR-038, Constitution VII; contradicts).

Validation on 2026-10-14: the new hit-target regression failed on the covered photo button,
then passed with the courier toaster between navigation and sheets. Phone trace captures
were reviewed visually. All gates passed again: check, build, 773 unit/integration tests,
and the full 70-scenario e2e suite at first pass. The four focused US3 cases also passed
after online board checks were changed to await acknowledgment; two preceding attempts
failed at Docker port allocation before running any case (details in docs/status.md).
No timeout, worker or Docker configuration was changed.

## Phase 16: Convergence — Refusal Retry Target

- [X] T102 CRITICAL Reproduce the settled-page ambiguity in T099 by awaiting the "Pendientes por sincronizar" heading in `apps/web/tests/e2e/access.spec.ts`; then target the retry button inside the unique refusal alert and verify that it actually retries. Preserve the one-refusal assertion across synchronization and navigation. Do not use `.first()`, sleeps, longer timeouts, skipped assertions or application changes to conceal the two legitimate retry controls (Constitution VI, FR-002, FR-004, FR-020; contradicts). Repeat the gates and scoped convergence before merging US3.

Closure on 2026-10-15: the settled-page assertion reproduced the strict-selector failure
before the correction; ten focused repetitions and all 70 local e2e then passed. CI
`38682492089` at `8f5066e` passed check, all 773 unit/integration tests, all 70 e2e without
retries, and build. Scoped convergence checked FR-002/FR-004/FR-020, the refusal/retry
scenario, the shared session decision and all nine constitution principles, with no
remaining finding or new phase. Its assessment left tasks byte-for-byte unchanged;
this checkbox and closure are subsequent completion tracking. The separate local
full-suite invariant timeout remains documented in docs/status.md; no local full-suite
pass or resolved contention cause is claimed.

## Phase 17: Convergence — Return Custody on Route Reassignment

- [X] T103 HIGH Write a failing PostgreSQL regression in `apps/server/tests/exception-decision.test.ts` for reassigning an entire route with a courier-held, decided return: custody remains with its holder, exactly one pending handover goes to the new courier, and the return task waits for it. Then extend `POST /api/routes/:id/reassign` in `apps/server/src/routes/routes.ts` to use shared held-routing eligibility for decided returns, preserving ordinary shipments and completed history (003 FR-029/FR-031, feature 002 FR-025; partial). Repeat T053 and the route/reassignment/contract regressions and scoped convergence; T057–T060 retain their existing scope.

T053/T056/T103 checkpoint (2026-10-15): five new domain cases failed before their rules
were implemented; T103 reproduced a missing handover before correction. All 18 decision
cases and 93 existing PostgreSQL regression cases pass (111 total), as do all three
invariant seeds, 24 selected existing route/courier e2e without retries, and `pnpm check`.
An additional failing regression verified the rejection of courier-held packages at
draft-route creation before correcting it. Strict contract assertions retain `.strict()`
and explicitly cover the approved `heldBy` addition and null for ordinary shipments.
Repeated scoped convergence checked the server obligations of FR-029–FR-032, six US4
scenarios, SC-006/SC-007, six plan decisions and all nine principles: no additional finding.
Its final assessment left tasks unchanged; these checkboxes and this note are subsequent
tracking. T054/T055 and T057–T060 remain incomplete, with office integration and the
new phone journey still to verify. This is not a full-feature gate or convergence claim.

## Phase 18: Convergence — Held Returns and Route Release

- [X] T104 HIGH Add failing PostgreSQL regressions in `apps/server/tests/office-receipt.test.ts` for removing an office-held decided return, cancelling its draft route, and undoing dispatch before office pickup: the shipment keeps its exception/return decision and office custody and is listed unassigned after release. Add a failing case in `apps/server/tests/exception-decision.test.ts` refusing undo-dispatch when a decided return is held by a courier, even if that route's stops are still pending. Then extend the corresponding route actions in `apps/server/src/routes/routes.ts` without permitting generic `picked_up → registered`, using shared held-routing eligibility and transactional history (003 FR-029/FR-031/FR-041; feature 002 FR-017/FR-026; partial). Repeat the affected suites and scoped convergence before closing T057.

## Phase 19: Convergence

- [X] T105 HIGH Write failing PostgreSQL cases in `apps/server/tests/office-receipt.test.ts` for delivery and reverse-pickup shipments edited while registered at the office, then picked up again and returned: the return stop must retain the first actual pickup place, not the edited shipment address or the office. Hydrate that place from existing completed pickup history in `apps/server/src/lib/route-store.ts` for the held-return planner in `apps/server/src/lib/reassignment.ts`, without overwriting editable shipment fields or adding a migration. Repeat office, decision and route regressions and scoped convergence (FR-029/FR-041, US4/AC4; partial).

Backend checkpoint (2026-10-15): T104's four regressions and T105's two edited-address
regressions failed before correction and now pass. The latest decision/office/route
selection passes 73/73, following the wider 141/141 pre-T105 regression; domain passes
216/216 and all three invariant seeds pass alone after T105. `pnpm check` passes.
Repeated scoped convergence reviewed FR-029–FR-032/FR-041, server obligations of all
eight US4 scenarios, SC-006/SC-007, six plan decisions and nine constitution principles.
No additional backend finding remained; the final assessment left tasks byte-for-byte
unchanged (SHA-256 `b76a31382cc6438074e1c0372418f8914ad0b8de46035fdbe30da82dfa9f0fd7`).
These checkbox updates and this note are subsequent implementation tracking. The earlier
full server run failed three unchanged invariant seeds by timeout (422/425 passed);
isolated passing seeds do not establish full-suite stability. T055/T058–T060 retain
their pending UI/offline scope. This is not full-US4 convergence or a merge-ready claim.

Subsequent full backend gate: all 431 server tests passed, including the three invariant
seeds, in 118.37 seconds without other quality gates running concurrently. Original
workers and timeout limits were retained. This passing run does not establish the cause
or resolution of the prior intermittent timeout, and does not complete the pending web
scope or the full-story workspace/e2e gates.

## Phase 20: Convergence

- [X] T106 CRITICAL Reproduce in `apps/web/tests/e2e/exception-decision.spec.ts` an unchanged office-settings save followed by a different address on the same mounted form: each acknowledged save must end its action lifecycle, while a retry after a lost response retains its identifier. Correct `apps/web/src/routes/settings.tsx` so the second intentional change is persisted instead of silently replaying the first no-op receipt. Verify distinct action identifiers and the actual saved response, then repeat US4 journeys and convergence (FR-019/FR-041, Constitution II/VI; contradicts).

## Phase 21: Convergence

- [X] T107 HIGH Diagnose the intermittent full-suite deadline in `apps/server/tests/routes-invariants.test.ts` before declaring US4 merge-ready. The full `pnpm test` gate after the UI implementation passed 430/431 server cases but timed out seed 31337 at 30 seconds; the preceding full backend run passed all 431. Capture bounded, non-sensitive per-step/query or resource timing evidence to distinguish application waiting from test-host contention; do not infer a cause from a passing isolated repeat or the connection closing after timeout. Preserve all three seeds, 90 steps, assertions, original timeouts and worker settings. Implement only an evidence-backed correction within the approved rules, or request the owner's direction if resolution requires changing shared test-resource policy. Repeat all four gates and scoped convergence, retaining the failed-run record (Constitution VI, Development Workflow & Quality Gates; partial).

Owner-approved resolution (2026-10-15, after the above diagnostic constraint): Samuel
authorized isolating capacity/invariant execution from the rest without lowering coverage
or limits. The aligned plan names `apps/server/vitest.config.ts`: native projects retain
ordinary parallelism and run `tests/*-scale.test.ts` plus `routes-invariants.test.ts` in a
later, file-serial group. Confirm the complete test inventory is unchanged, preserve all
assertions and thresholds, and rerun the four gates; no production rule is changed.

## Phase 22: Convergence

- [X] T108 HIGH Correct the premature acknowledgment check in `apps/web/tests/e2e/exception-decision.spec.ts`: the full 74-case run reproduced one pending pickup after the test observed the old zero before local persistence completed. Await each pickup's visible local completion before the zero-pending assertion, and await the in-flight synchronization finishing before starting the next pickup. Keep the exact zero assertion, all downstream server/history/offline checks, original timeouts and workers; do not add sleeps or application changes for this test precondition. Repeat focused journeys and the full e2e gate (FR-018/FR-019, T055; partial).

## Phase 23: Convergence

- [X] T109 HIGH Reproduce the long-courier-name route picker overflowing its exception-decision dialog in `apps/web/tests/e2e/exception-decision.spec.ts`, including a 390 px viewport. Constrain the dialog grid and picker in `apps/web/src/features/shipments/exception-decision-dialog.tsx` so controls remain within the visible sheet, retain their complete accessible names and 48 px targets, and the decision can be saved without horizontal scrolling. Review actual captures and repeat the focused/full e2e and static gates (US4/AC1–AC4, Constitution VII, design-system.md §5/§10; partial).

## Phase 24: Convergence

- [X] T110 HIGH Reproduce in `apps/web/tests/e2e/exception-decision.spec.ts` a return whose original COD exceeds COP 2,000,000: its review must not claim money was collected or ask to confirm a collection, and the stored return must still have zero amounts. Correct the return initialization in `apps/web/src/features/courier/delivery-form.tsx` without changing the delivery confirmation threshold or domain collection rules. Preserve the ordinary-COD return coverage, then repeat focused/full e2e, all gates and scoped convergence (FR-030, plan: returns without collection, Constitution VII; contradicts).

US4 closure checkpoint (2026-10-15): T055/T058–T060 and T106–T110 are verified.
T106 reproduced stale settings after a no-op receipt; T108 reproduced a premature test
acknowledgment; T109 reproduced dialog overflow at 390 px; T110's added high-COD return
case failed on the false collection alert before initialization was corrected. The five
focused UI journeys and all 75 e2e now pass without retries; ordinary-COD returns remain
covered. No scenario, assertion, limit or timeout was weakened.

T107 retained the three failed complete-run records and bounded diagnostic evidence.
The owner-approved native project partition preserves all 323 collected declarations
across 46 files and all 431 runtime cases (fixture UUIDs normalized only for report-name
comparison). Detailed report timestamps prove 43 ordinary files finish before the three
serial capacity files. Two complete workspace runs and an additional complete server
run pass after isolation. Final gates after T110: `pnpm check`, `pnpm test` (216 domain,
431 server, 174 web; 821 total), `pnpm test:e2e` (75), and `pnpm build` all pass.

Scoped convergence checks 10 requirements/buildable criteria, 8 US4 acceptance scenarios,
7 plan decisions, all 16 US4/corrective tasks and all 9 constitution principles, with no
remaining gap. The assessment itself left this file unchanged; the checkboxes and this
checkpoint are subsequent implementation tracking. US5–US7 and feature-wide polish remain
pending. At this local checkpoint no US4 commit, push or PR existed. Samuel subsequently
approved commit, push and PR creation on 2026-10-15; merge and continuing US5 require
separate approval and green CI.

## Phase 25: Convergence

- [X] T111 HIGH Reproduce the US4 new-attempt navigation race in `apps/web/tests/e2e/exception-decision.spec.ts` by withholding the real courier snapshot after the dispatcher decides: the cached completed visit must not be mistaken for the new pending delivery at the same address. First demonstrate the current last-link selector choosing that completed visit, then select the uniquely pending delivery and await its visible refreshed state. Preserve all existing journey assertions, PostgreSQL/service-worker coverage, original timeouts, workers and retry policy; do not change application synchronization to accommodate a test precondition. Repeat the controlled regression, focused repetitions, all four gates and scoped convergence. Retain CI `38814337383`'s first-attempt failure (30 seconds waiting for “Registrar entrega”, retry passed), separately from the earlier run's unrelated recovery-test flake (US4/AC1/AC6, FR-022/FR-029, T055, Constitution VI; partial).

## Phase 26: Convergence

- [X] T112 HIGH Reproduce the accessibility-helper race from CI `38814284341` in `apps/web/tests/e2e/access.spec.ts`: a real notification can expire after discovery but before its native pause shortcut, so `fixtures.ts` must not require an already-removed notification to expand. Add a clock-controlled pre-pause test hook alongside the existing pre-scan hook, advance the real notification through expiry, and first reproduce the absent-toast assertion failure. Then stabilize either all remaining visible notifications or their completed disappearance, retaining the full axe scan, focus restoration, the existing visible-notification regression, and every accessibility rule. Do not change production notification lifetime, add sleeps, widen limits, remove assertions or exclude notifications. Repeat both notification cases, account recovery, focused/full e2e, all gates and convergence (003 FR-034, T100, Constitution VI/VII; partial).

T112 traceability clarification (implementation review): accessibility is 003 **FR-038**,
as in T100. The FR-034 reference above is a transcription error, not US6 scope or a change
to the intended notification/axe regression. The original convergence task is preserved.

T111/T112 local completion (2026-10-15): the controlled snapshot test first reproduced
the old selector matching a cached completed visit; the native expiry test first timed
out waiting for the vanished toaster. Both now pass with the actual app and PostgreSQL.
The four targeted cases pass ten repetitions each (40/40, one worker, no retries).
Final gates pass: `pnpm check`, `pnpm test` (216 domain, 431 server, 174 web; 821 total),
`pnpm test:e2e` (76/76, all first pass, 4.4 minutes), and `pnpm build`.
No production code, dependency, timeout, worker/retry policy or accessibility rule changed.

Scoped convergence checks FR-022/FR-029/FR-038/SC-006, US4/AC1/AC6, two plan decisions,
T055/T100/T111/T112 and all nine principles; no remaining gap. Assessment preserved the
file byte-for-byte; these completion markers/notes are subsequent implementation tracking.
The published CI's retry remains historical evidence, not validation of this local fix.
At this local checkpoint commit/push and new CI were still required. Samuel subsequently
authorized publishing T111/T112 on 2026-10-15; review that new head's CI before merge review.
Merge and continuing US5 require separate authorization.

## Phase 27: Convergence

- [X] T113 CRITICAL Add failing domain/API regressions proving a courier cannot register an arbitrary, local or credential-bearing push URL and cause server-side requests to it. Restrict `pushSubscriptionInput` in `packages/domain/src/schemas/courier.ts` to HTTPS push services of the supported browsers, with boundary validation and no configurable arbitrary host. Align the security constraint in the contract/plan before implementing; use browser-vendor primary documentation, preserve private-key isolation, and rerun subscription/transport cases (FR-040, Constitution V/IX; contradicts).
- [X] T114 HIGH Reproduce a record batch whose first record commits a `record_not_applied` notice but whose later record fails shipment-dependent validation. Ensure `apps/server/src/app.ts` sends push for the committed notice even though the HTTP response is an error, never for a rolled-back notice; use the existing committed-id lookup, preserve independent record transactions and all deferred-commit regressions (FR-024/FR-040, Constitution IV; partial).
- [X] T115 HIGH Add a delayed-410 regression in `apps/server/tests/courier-notices.test.ts`: an old push response must not delete a subscription whose encryption keys were renewed while it was in flight. Delete only the same version of the subscription in `apps/server/src/lib/push.ts`. Also verify a shipment void produces one `shipment_voided` notice rather than a second `shipment_removed` notice for the same action; preserve its route removal history and ordinary removal notices (FR-027/FR-040, Constitution II; partial).

## Phase 28: Convergence

- [X] T116 HIGH Reproduce cancellation of a pending handover for a decided return in `apps/server/tests/courier-late-records.test.ts`: restore a return task at the original pickup place on the holding courier's route, not a delivery task at the recipient. Reuse the domain's held-stop planner and immutable pickup projection in `apps/server/src/lib/reassignment.ts`; retain cancellation without an origin route, custody and all completed history (FR-028/FR-029/FR-031, T067, research R10/R17; contradicts).
- [X] T117 HIGH Test that confirming a handover names that actual change rather than saying the address changed. Add `handover_confirmed` to the shared notice kinds/texts in `packages/domain/src/courier-records.ts`, align the enum in data-model.md and the notification contract/plan, generate and review its PostgreSQL enum migration through `pnpm db:generate`, then select that notice in `apps/server/src/lib/route-store.ts`. Test both courier and dispatch confirmations, payload privacy and native-worker rendering; do not repurpose an inaccurate existing notice type (FR-027/FR-040, Constitution VII, research R9; contradicts).

## Phase 29: Convergence

- [X] T118 HIGH Reproduce an unchanged stop-order request generating a false change notice. In `apps/server/src/routes/routes.ts`, return through the existing unchanged-route path when the validated stop ids/order already match, preserving the route version and its protection against late replays. Extend `apps/server/tests/courier-notices.test.ts` with unchanged/real reorder and late replay cases; make the phone journey actually reorder two delivery stops rather than re-submit the original order (FR-027, Constitution VII; contradicts).
- [X] T119 HIGH Reproduce the courier being unable to acknowledge more than 200 accumulated notices. Keep the API's 200-id limit, but persist multiple uniquely keyed acknowledgment chunks atomically in `apps/web/src/lib/offline/outbox.ts` and show their combined local result through `courier-store.ts`; a storage failure must not leave half of the shown notices acknowledged. Define the shared transport limit once in `packages/domain/src/schemas/courier.ts`, test all chunks/reopening/rollback in `outbox.test.ts`, and retain unseen notices and synchronization retry behavior (FR-018/FR-027, Constitution II; partial).

## Phase 30: CI action runtime maintenance

- [X] T120 Inspect official action manifests/release migration notes and reproduce the Node 20/`url.parse()`/`punycode` warnings from PR #23's existing CI logs. Update only `pnpm/action-setup@v4` → `@v6` and `actions/setup-node@v5` → `@v7` in `.github/workflows/ci.yml` per the owner-approved plan alignment. Preserve Node/pnpm versions, cache, frozen lockfile, every quality command, tests and runner policies. Validate local check, complete latest-head CI and logs, document any harmless residual upstream warning rather than suppressing it, then run scoped convergence before the authorized squash merge (Constitution I/VIII; Development Workflow & Quality Gates).

T120 closure (2026-10-16): official manifests declare Node 24; current releases are
pnpm/action-setup v6.1.0 (pnpm 12 support) and actions/setup-node v7.1.0. The existing
`ce55c7e` run reproduced the three deprecations before the two-line workflow fix.
Local `pnpm check` and CI [38857856129](https://github.com/scldrn/domy/actions/runs/38857856129)
at `4392341` pass: 226 domain + 472 server + 179 web = 877 tests; 82/82 e2e without
retries (12.2 minutes); build. Logs contain none of the Node 20, `url.parse()` or
`punycode` deprecation warnings. GitHub's separate informational notice about the future
ubuntu-latest migration is not a runtime failure; no runner pin or warning suppression
was added. Scoped convergence checked T120, two action-runtime/compatibility decisions,
the unchanged quality gates and all nine principles: zero findings. Before/after
assessment SHA-256 was `230f4823779b6eb5ae4b600d963eaf014be32e2ef864cf04777a946f0742f9ca`;
this completion marker/note is subsequent tracking. Optional commit hooks were not used;
there are no converge hooks. The documentation closure must also receive green
latest-head CI before the authorized squash merge. Starting US6 is not authorized.

## Phase 31: Convergence

- [X] T121 HIGH Diagnose and reproduce the first-attempt failure in CI 38860188300 (`8ec27b5`), `courier-changes.spec.ts:194`: after offline handover confirmation/delivery and reconnection, the shipment still reads `picked_up` within the unchanged 5-second polling deadline; the retry passes. Establish whether the synchronization or test setup is responsible using deterministic evidence, then propose the smallest test-first correction under owner authorization. Preserve all scenarios, timing assertions, retries/workers and offline persistence/custody checks; do not rerun until green or call the flaky run clean. Obtain clean final-head CI and repeat scoped convergence before squash merge (US5/AC4, FR-020/FR-028, Constitution VI, Development Workflow & Quality Gates; partial).

T121 local checkpoint (2026-10-16; owner authorized correction and subsequent merge):
the real store/IndexedDB first reproduces three failures and two passing guards, then
the browser reproduces the same `picked_up`/`delivered` 5-second failure by controlling
an offline request's failure until after the native online event. The first browser
instrumentation had its own listener-registration race; it was corrected before the
meaningful RED. The historical CI interleaving remains unobserved, since no trace was
retained. Preserve that distinction rather than claiming historical proof.

One coalesced follow-up pass fixes dropped save/reconnect triggers, without concurrent
syncs, autonomous retry loops or changing pause/account safety. Six final store tests
pass; the final strengthened handover journey passes 10/10 repetitions in 44.9 seconds.
All local gates pass: check, 883 tests (226/472/185), 82/82 e2e without retries (4.7 min),
build. No limits, assertions, existing cases or runner policy were relaxed; the delivery
exactly-once assertion is additional. Scoped local convergence reviewed six FRs,
US5/AC4, two plan decisions, T121 and nine principles: zero findings. Assessment preserved
this file byte-for-byte at SHA-256
`2b24ae139cba92589a5d671ee8fd882a591925bd23e35a031305b723cc768ee7`;
this note is subsequent tracking. Keep T121 unchecked until fresh remote CI is inspected,
then complete its marker and require clean latest-head CI before the authorized squash.

T121 remote closure: CI [38919233855](https://github.com/scldrn/domy/actions/runs/38919233855)
at `5bd2b5d` passes check, all 883 tests (226/472/185), all 82 e2e without retries
(12.8 minutes) and build. Logs show no flaky cases or the three action deprecations.
The original `8ec27b5` flaky run remains historical evidence, not clean validation.
Final scoped convergence (same six FRs, US5/AC4, two plan decisions, T121 and nine
principles) has zero findings. Before/after assessment, this file stayed byte-identical
at SHA-256 `ce4b83ac5b7ceab4ac7256d23db12c70dac68278bde4c120c6c1c449b9ea9b44`;
the checked marker and this note were updated afterward. Reviewer checklists are
unchanged; no hooks changed. This tracking-only closure must also receive clean
latest-head CI before squash; merge/post-merge receipts live in PR #23. No US6 work
is authorized. Physical T087/T093 remain pending.

## Phase 32: Convergence

- [X] T122 HIGH Investigate and reproduce the first-attempt native-push failure in post-merge CI 38926371410 (`63c5070`), `apps/web/tests/e2e/courier-changes.spec.ts:433`: actual `getNotifications()` remains empty during the existing 5-second assertion, then the retry passes. Capture exact-origin registration/version lifecycle, permission and worker/push errors without recipient data or secrets; establish test-readiness versus application behavior with deterministic evidence before a fix. Align the plan with the proven cause, preserve real native notifications/full Chromium/built worker/app-closed scenario and every title/body/privacy assertion, add a failing regression first where behavior changes, repeat focused and full gates and scoped convergence. Do not enlarge timeouts, add retries or replace native APIs/handlers; do not call the post-merge flaky run clean. Local correction authorized; publication/PR/merge and US6 require separate approval (FR-040, US5/AC1, Constitution VI/VII, Development Workflow & Quality Gates; partial).

T122 local closure (2026-10-16): the original five-second empty-notification failure
reproduces before correction, including three failures in an intentionally interrupted
30-repeat diagnostic run (not a completed repetition gate). Bounded observations show
an activated worker, granted permission, trusted matching push, native display fulfillment
and successful push completion. The original query races unfinished native delivery;
Chromium can prune notification records not yet reported by its display platform.
The plan records official source permalinks and the historical CI-trace limitation.
The test now observes successful push completion for its exact origin/registration
before querying, inside the original single five-second assertion. No application code,
native API, handler, dependency, schema, migration, timeout or retry policy changed.
Temporary worker/probe instrumentation is removed; bounded safe diagnostics remain.

Final local gates: `pnpm check`; `pnpm test` (226 domain + 472 server + 185 web = 883);
`env -u NO_COLOR pnpm test:e2e` (82/82, 4.8 minutes, no retries); `pnpm build`.
The focused native case also passes 30/30 repetitions (1.0 minute). An earlier full
e2e invocation was intentionally stopped at 8 passed/1 interrupted/73 not run to remove
the terminal's conflicting NO_COLOR/FORCE_COLOR variables, not counted as a gate.
Scoped convergence checks FR-040, US5/AC1, the native validation/privacy plan decisions,
T122 and all nine principles with zero findings. Before/after assessment, tasks.md
remained byte-identical at SHA-256
`36ac15a5ef88d27a2e15dde0d673c74c823ff6b578c94be3550a17be8bce44db`;
this marker and closure note were updated afterward. Reviewer checklists remain
unchanged (16/16 and 48/48); no converge hooks exist and optional commit hooks were
not executed. Samuel subsequently authorized commit, push, a new PR and latest-head
CI review with “Si” on 2026-10-16. The branch's PR is the publication/CI receipt;
no remote result is claimed here. Merge and US6 need separate approval; physical
T087/T093 remain pending.

## Phase 33: Convergence

- [X] T123 HIGH Record a US6 reversion that restores an in-progress route task in that route's append-only history, with the shipment, author, reason and both timestamps, in the same transaction as its task/state/receipt/notice. Add failing PostgreSQL and route-history UI tests first; declare the explicit `record_reverted` event in the shared domain values, generate its PostgreSQL enum migration, and render its Spanish label. Preserve one courier notice and unchanged finished routes (FR-035, FR-039, US6/AC3; partial).
- [X] T124 HIGH Make US6 revert history describe only actual field changes: do not emit unchanged custody pairs for exceptions or errands, and describe restored custody as a reversion, never as a new physical pickup. Add server and UI regressions before implementation, then repeat focused/full gates and scoped convergence (FR-035, FR-039, Constitution IV/VII; partial).

US6 scoped assessment (2026-10-16): FR-034/FR-035, four acceptance scenarios,
FR-027/FR-039/FR-040, six technical decisions and all nine constitution principles
reviewed. Two partial/HIGH findings above; no missing, contradictory or unrequested
scope found. US7 and previously pending physical validation remain outside this slice.

## Phase 34: Convergence

- [X] T125 CRITICAL Keep US6 correction validation in Spanish and preserve submitted empty required fields for schema validation instead of silently omitting them. Add RED domain tests for amount/payee/exception errors and a web serialization regression; reuse the original record's Spanish field schemas and omit only an optional empty note. Filter an errand's inapplicable name field consistently for rendering and submission. Repeat all gates and scoped convergence (Constitution V/VII, FR-035, US6/AC2; contradicts).

US6 local closure (2026-10-16): T071–T076/T123–T125 pass after RED → GREEN work.
Final sequential gates pass: `pnpm test` (240 domain + 508 server + 190 web = 938),
`pnpm check`, `pnpm build`, `env -u NO_COLOR pnpm test:e2e` (86/86, 5.1 minutes,
first attempt). The five expected invalid-password warnings belong to the negative
lockout scenario, not build/lint warnings; nothing was suppressed. A prior stale-build
e2e run was intentionally interrupted at 23 passed/1 interrupted/62 not run and is not
counted as a gate. Limits, assertions, workers and retries are unchanged.

Final read-only scoped convergence checks FR-034/FR-035, all four US6 acceptance
scenarios, FR-027/FR-039/FR-040, nine implementation decisions, all nine constitution
principles and these nine tasks: zero remaining findings of any severity/type. Before
and after that assessment, tasks.md was byte-identical at SHA-256
`1f88d84686b0be2391f5fe7e01684160dc7547380ceeae5b84263cd5549d319a`;
checkboxes and this closure note were updated afterward. Reviewer checklists remain
unchanged (16/16 and 48/48). No converge hooks exist; optional commit hooks were not
executed. Generated migrations 0006/0007 are additive and reviewed; no new dependency.
Mobile entry/correction screenshots were inspected and e2e includes required-name
validation, truthful shipment/route history and the actual courier notice. Whole-route
reassignment safety covers delivery, exception and return; accepted-action replay still
precedes guards. US7, physical T087/T093 and feature-wide polish remain pending.
Samuel subsequently authorized commit, push and a PR with “Si” on 2026-10-16. The
branch's PR timeline is the publication/CI receipt; this checkpoint claims no remote
result. Merge and starting US7 still require separate approval.

## Phase 35: Convergence

- [X] T126 HIGH Investigate and reproduce the first-attempt keyboard-registration failure in PR #25 CI 38991329783 at `06e606b`, `apps/web/tests/e2e/register-shipment.spec.ts:163`. Distinguish asynchronous form readiness from an application defect using controlled real-server responses and a failing regression before correction. Align the plan with demonstrated evidence; preserve keyboard-only registration, real PostgreSQL/built app, success and accessibility assertions, all existing deadlines/retries/workers and coverage. Repeat focused repetitions, all four gates and scoped convergence. The historical CI has no retained trace and remains 85 passed/1 flaky, not clean. Only local investigation/correction is authorized; publication, merge and US7 require separate approval (Constitution VI/VII, Development Workflow & Quality Gates; feature 001 FR-006/FR-038 and keyboard registration; partial).

T126 local closure (2026-10-16): the original case fails once in 20 repetitions
(19 pass), at its unchanged five-second success assertion. A held real quote reproduces
that failure with a positive-fee validation error; a separate held merchant search
reproduces Enter selecting Amy Tecnology while Bullish Hype is already visible.
Both controlled RED traces are retained locally under ignored `.git/t126-red-fee` and
`.git/t126-red-search`. The first repetition run's artifacts were replaced before
inspection; neither that run nor the trace-less historical CI establishes an exact
interleaving. The plan records this evidence and its limits before final correction.

Await native desired-option highlighting, verify actual selected values/default pickup,
and await the visible real quote before the original keyboard submit. Keep the normal
network case and add controlled search/quote variants with explicit gates, not sleeps
or fake responses. Both controlled mechanisms fail without their readiness correction.
The three corrected cases pass 20 repetitions each (60/60, 2.3 minutes, no retries).
Final sequential gates pass: `pnpm check`; `pnpm test` (240 domain + 508 server +
190 web = 938); `env -u NO_COLOR pnpm test:e2e` (88/88, 5.1 minutes, first attempt);
`pnpm build`, including the actual service worker. The five invalid-password warnings
are expected output from the negative lockout case, not suppressed build/lint warnings.
No application, dependency, migration, CI policy, deadline, retry or worker changes.

Scoped convergence checks feature 001 FR-003/FR-005/FR-006/FR-038, US1/AC1 and AC5,
the keyboard critical flow, two readiness/real-response plan decisions, T126 and all
nine constitution principles: zero findings. Before/after assessment, this file stayed
byte-identical at SHA-256
`bd3e5db967caca42281e13684c6b5a80dc050780673ee843c08a10d4b951b771`;
this marker and note are subsequent implementation tracking. Reviewer checklists are
unchanged (16/16 and 48/48); no converge hooks exist and optional commit hooks were
not executed. Publication of this correction requires approval and fresh latest-head
CI; the published `06e606b` retry remains historical evidence, not clean validation.
Merge, US7 and physical T087/T093 remain outside this completed local correction.

Samuel subsequently authorized commit/push of T126 in PR #25 and latest-head CI review
with “Si” (2026-10-16). The PR timeline is the publication/CI receipt; this local
checkpoint claims no new remote result. Merge and starting US7 remain unauthorized.

## Phase 36: Convergence

- [X] T127 HIGH Investigate and reproduce the `PNPM_HOME` layout warning in PR #25 CI 38994299786 at `af78fa6`, checking the exact upstream installer source before changing `.github/workflows/ci.yml`. Replace only the warning-producing pnpm installer with the maintained official native installer if isolated before/after verification succeeds. Preserve pnpm 12.8.1 from `packageManager`, Node 24 from `.nvmrc`, checkout/setup-node and cache, explicit frozen install, all four quality commands, tests and runner policies; disable the successor's automatic dependency installation and runtime detection. Record evidence and limits, repeat local gates and scoped convergence, and require fresh latest-head CI after separately approved publication. No warning suppression, custom downloader, vendored action or application changes. Local investigation/correction authorized with “Si”; commit/push, merge and US7 require approval (plan: CI action runtime maintenance, Constitution I/VIII/IX, Development Workflow & Quality Gates; partial).

T127 local implementation checkpoint (2026-10-16): confirmed the exact CI installer
commit `0977fd99725f1db4007ccb2928dbb4e90d06cc86` bootstraps 11.19.0, places its own
shim in `PNPM_HOME` and emits the legacy-layout warning while successfully selecting
the project pin 12.8.1. The upstream source/report confirm the mechanism; the action's
official successor removes that bootstrap rather than suppressing its warning.

Executed the exact old/new published bundles in disposable Linux/arm64 containers
(`node:24-bookworm-slim`, image digest
`sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5`),
using copied public manifests and no host configuration/secrets. The old installation
passes the version/no-project-install checks but fails the no-warning assertion.
`pnpm/setup@v3` at `a0881977cd8ea73b1ed212236c99ca10dcc80cf4` installs 12.8.1 without
warnings, skips runtime installation and creates no project dependencies. Two initial
simulation errors (hyphenated inputs dropped by Bash and an incorrect expected log
phrase) were corrected before final assertions; they are not application defects.
Local ignored evidence is `.git/t127.8Jbh0u`; no action bundle is vendored in the repo.

The workflow changes only the installer and supported `install: false` /
`node-version-file: false` inputs. An executable comparison confirms every other
workflow byte plus the package-manager and Node pins are unchanged. Final sequential
local gates pass: `pnpm check`; `pnpm test` (240 domain + 508 server + 190 web = 938,
server phase 98.50 seconds); `env -u NO_COLOR pnpm test:e2e` (88/88 first attempt,
5.0 minutes); `pnpm build`, including the real service worker. The five expected
invalid-password warnings belong to the negative lockout scenario; none were suppressed.
No production code, dependency, lockfile, schema, migration, test or runner policy changed.

Read-only local convergence assesses three maintenance obligations (installer/version
provenance, unchanged quality gates, supply-chain verification), two plan decisions,
T127's locally verifiable implementation and all nine principles: zero local code gaps.
The assessment preserves tasks SHA-256
`3eb8ee9b6f2098bc998dbfdced2f8ba752b0b71ec31305b9f695c8d139e4924e`;
this checkpoint is subsequent tracking. Reviewer checklists stay unchanged at 16/16
and 48/48; no converge hooks exist and optional commit hooks were not executed.
**T127 stays unchecked** until separately authorized publication and fresh latest-head
GitHub CI verify setup, post-action/cache behavior, all gates and first-attempt e2e on
the actual runner. Local simulation is not remote CI and no remote result for this
change is claimed. Commit/push, merge and US7 require approval.

Samuel subsequently authorized commit/push of T127 in PR #25 and latest-head CI review
with “Si” (2026-10-16). Close verification tracking only after successful remote
evidence; the final published head must also pass CI. The PR timeline is the receipt.
Merge and starting US7 remain unauthorized.

T127 remote verification closure (2026-10-17): [CI 39003878509](https://github.com/scldrn/domy/actions/runs/39003878509)
on `12185b6` passes check, all 938 tests (240/508/190), all 88 e2e at first attempt
(9.5 minutes), build, setup and post-actions. Logs confirm native pnpm 12.8.1,
Node 24.21.0 from unchanged setup-node, skipped redundant runtime installation,
successful frozen install, and successful saves of both the existing pnpm store cache
and the successor's native lockfile-verification cache. The old layout warning and
the earlier action-runtime deprecations are absent. Expected negative-auth messages,
Git's default-branch hint and GitHub's informational future Ubuntu migration notice
are not suppressed or mistaken for installer failures. The old warning/flaky runs
remain historical evidence.

Final scoped convergence checks three maintenance obligations, two plan decisions,
T127 and all nine constitution principles with zero findings. The read-only assessment
preserves this file at SHA-256
`e8cbb2804c5519e37b5eb84fcde3b8384b1bc66c76de312896d9aadd2b4c5498`;
this checked marker and closure note are subsequent tracking, superseding the earlier
unchecked checkpoint. Checklists remain unchanged (16/16 and 48/48); no converge
hooks exist and no optional commit hook runs. Publish this verification closure under
the existing T127 publication approval and require clean final-head CI too; its receipt
lives in PR #25 rather than another self-referential status commit. No application,
workflow, dependency, lockfile or test changes accompany this tracking closure.
Merge, US7 and physical T087/T093 remain separate and unauthorized/pending.

Subsequent owner decision (2026-10-17): after verification-closure CI 39005250252 on
`c079292` passed all 938 tests/88 first-attempt e2e, check/build and setup/post-actions
without the layout warning, Samuel authorized squash-merging PR #25 with “Si”.
The approval/continuation checkpoint changes documentation only and must also receive
clean latest-head CI before squash. The PR timeline records the actual merge and
post-merge `main` verification. US7 still requires separate approval; T087/T093 remain
pending. No additional business implementation is authorized by the merge decision.

## Phase 37: Convergence

- [X] T128 CRITICAL Remove the duplicated pending-stop selection in `apps/server/src/routes/courier.ts` and `apps/web/src/lib/offline/outbox.ts`. Reuse the existing domain `routeProgress` rule (total minus completed) for FR-037, rather than copying its task-status predicate. Preserve the already passing domain progress cases, T077's shared-pickup-stop assertions and T078's projected/offline pending-stop assertions; repeat all four gates and scoped convergence. This is a behavior-preserving refactor, not a new business rule, response field or dependency (Constitution III, FR-037, plan: shared domain rules; contradicts).

## Phase 38: Convergence

- [X] T129 HIGH Correct the scroll precondition of the added financial-row visibility assertion in `apps/web/tests/e2e/courier-day.spec.ts`. The 360 px/high-contrast trace leaves the amount's bottom at 800.28125 while fixed navigation begins at 719: minimal viewport scrolling does not establish visibility above an overlay. Use native centered scrolling, then preserve the exact bounding-box assertion, actual 360/390 px app, all money/offline/correction checks and axe scans. Verify the unchanged application's scroll space with actual scrolled captures, repeat focused cases and all four gates; do not change production layout, deadlines, retries or workers to accommodate the helper (FR-038, T078, Constitution VI/VII; partial).

US7 local closure (2026-10-17): Samuel authorized starting locally with “Inicia”, after
PR #25 merged as `525ca94` with clean post-merge CI. T077's four PostgreSQL tests pass
against the existing server aggregation: no working implementation was removed to
manufacture RED. Foundation T006/T011 already supplied test-first domain calculation.
The new same-day-baseline test and four outbox tests fail before implementation;
the two phone cases fail at the missing summary before the page is built. T079 reuses
the existing server summary and T128 centralizes pending-stop progress. T080 adds the
estimated, dated page and the persisted replay projection with corrected Bogotá dates.

The initial complete 90-case e2e gate passes before the stronger scrolled-row check.
That additional check then exposes the T129 helper precondition (89 passed/1 failed,
5.0 minutes), not a missing scroll allowance in the app. Its trace/context are retained
locally under ignored `.git/us7-scroll-red`. Native centered scrolling preserves the
same above-navigation bound and needs no production change. Both cases pass five
repetitions each (10/10, 31.1 seconds), with scrolled 360/390 px captures inspected.
A subsequent check catches a void-arrow style error in the test helper; explicit braces
resolve it without changing behavior. Neither failed gate is called clean.

Final sequential gates after all corrections pass: `pnpm check`; `pnpm test`
(242 domain + 512 server + 194 web = 948, server 97.08 seconds); `pnpm build`;
`env -u NO_COLOR pnpm test:e2e` (90/90, 5.1 minutes, first attempt). The five expected
invalid-password warnings belong to the negative lockout scenario; none are suppressed.
No dependency, migration, API response shape, CI setting, deadline, retry or worker
policy changes. Phone tests use the built service worker and real PostgreSQL and cover
offline totals/reopening, exactly-once synchronization, dispatch corrections, no-route
zero totals, high contrast and financial rows above fixed navigation.

Final scoped convergence reviews FR-037/FR-018/FR-019/FR-022/FR-035/FR-038, all three
US7 acceptance scenarios, six plan decisions, eight tasks (T006/T011/T077–T080/T128/T129)
and all nine principles: zero findings. Its read-only assessment leaves tasks unchanged
at SHA-256 `1f806815456959a5f29640ee58c3c243c998861c8ea06a4bd29f4f2b0de11008`;
these checked markers and this note are subsequent implementation tracking. Checklists
remain unchanged (16/16 and 48/48); no converge hooks exist and optional commit hooks
are not executed. No commit, push, PR or remote CI is claimed. Physical T087/T093 and
feature-wide polish remain pending; this does not close the entire feature.

US7 publication authorization (2026-10-17): Samuel approved commit, push and opening
the PR with “sI”. Publish T077–T080/T128/T129 and inspect fresh latest-head CI, including
first-attempt e2e and installer/post-action warnings. The PR timeline records the actual
publication/CI receipt; this authorization checkpoint claims no new remote result.
Merge, physical T087/T093 and continuation to feature-wide polish remain separate.

US7 merge authorization (2026-10-17): PR #26 source `7125292` passed CI 39038016265:
check/build, 948 tests (242/512/194), 90 first-attempt e2e (12.8 minutes), setup and
post-actions without installer/runtime warnings. The PR timeline records its exact
source/tree/base receipt and retains the failed local scroll/lint history. Samuel
authorized squash merge with “Si”. This approval/continuation checkpoint changes
documentation only and must also receive clean latest-head CI before squash; the PR
timeline records the actual squash and post-merge main verification. Continuing to
polish and physical T087/T093 remain unauthorized/pending. No further implementation
is authorized by this merge decision.

## Phase 39: Convergence

- [X] T130 HIGH Investigate and deterministically reproduce notification interception before the exception form in `apps/web/tests/e2e/courier-exceptions.spec.ts`, as observed in post-merge CI 39043360351 at `e43ea1e` (89 first-attempt passes, one flaky). Distinguish test navigation readiness from an application defect with the real built app, PostgreSQL, service worker and native expanded Sonner notifications. Align the plan with demonstrated evidence before correction; preserve the photo/save nine-point hit tests, full axe scan, visible notifications and all existing deadlines/retries/workers. Do not force clicks, dismiss/hide notifications, mock a successful response or rerun until green. Retain RED evidence, repeat focused cases, all four gates and scoped convergence. Historical CI uploaded no trace artifact; do not claim its exact scheduling was reproduced. Local correction only is authorized; publication, merge and feature-wide polish require separate approval (FR-038, T101, Constitution VI/VII and quality gates; partial).

T130 local closure (2026-10-17): explicitly awaiting both real offline pickup/sync
notifications and completed finite animations reproduces the original 30-second
delivery-link interception. Initial diagnostics pass while the stack is still entering;
waiting only for the first toast/expanded attribute does not establish stable geometry.
Centering the entire card also fails because Sonner's native expanded interaction area
extends into its gap. Both failed traces/contexts remain under ignored `.git/t130-red`
and `.git/t130-card-center-red`; neither is called clean. Historical CI uploaded no trace,
so only the mechanism, not its exact scheduling, is locally demonstrated.

The correction is test-only: center-scroll and normally click the visible address inside
the same accessible link. Keep the shared helper and production layout untouched; do not
force a covered card-center click. Both notifications must remain visible and expanded
at the unchanged photo/save nine-point hit checks, with the complete axe scan retained.
Ten focused repetitions pass (10/10, 36.8 seconds). All four gates pass: `pnpm check`,
`pnpm test` (242 domain + 512 server + 194 web = 948; server 126.45 seconds), `pnpm build`,
`env -u NO_COLOR pnpm test:e2e` (90/90, 5.2 minutes, first attempt). The five expected
invalid-password warnings belong to the negative lockout case and are not suppressed.
No application, dependency, migration, API, CI setting, timeout, retry or worker change.

Read-only scoped convergence checks FR-038, three plan decisions, T100/T101/T112/T130
and all nine principles: zero findings. It preserves tasks SHA-256
`1bb156f019bc4000dab33fca820039d5c3d75872c06cd102148e099bbe14c34c`;
this checked marker and closure note are subsequent implementation tracking. Checklists
remain unchanged (16/16 and 48/48); no convergence hooks exist and optional commit hooks
are not executed. No commit, push, PR or new remote CI is claimed. Publication/merge,
feature-wide polish and physical T087/T093 remain separate and unauthorized/pending.

T130 publication authorization (2026-10-17): Samuel approved commit, push and opening
the PR with “Si”, including review of fresh latest-head CI. Publish this test-only
correction and its aligned documentation; the PR timeline records actual commit/tree/base
and CI evidence. The preceding local checkpoint claims no remote verification. Preserve
the historical flaky CI and both local RED trials. No merge, feature-wide polish or
physical-validation completion is authorized by this publication decision.

T130 merge authorization (2026-10-17): PR #27 source `bf26d7b` passed CI 39057471380
with check/build, all 948 tests (242/512/194), 90 first-attempt e2e (10.8 minutes), setup
and post-actions. Its timeline receipt records exact source/tree/base and preserves the
historical flaky main run, both RED trials and expected negative-auth/infrastructure logs.
Samuel authorized squash merge and post-merge main CI verification with “Si”. This
approval/continuation checkpoint changes documentation only and must also pass fresh
latest-head CI before squash. The PR timeline records the actual merge and subsequent
CI outcome; no merge result is claimed here. Feature-wide polish and physical T087/T093
remain separate and unauthorized/pending.

## Phase 40: Convergence

- [ ] T131 HIGH Investigate and deterministically reproduce the distinct first-attempt server-recovery failure in `apps/web/tests/e2e/courier-offline.spec.ts:191`, post-merge CI 39071328672 at `f4f124d`: `openStop` waits for the delivery-stop link at caller line 222 until the unchanged 30-second timeout (89 first-attempt passes/one flaky). Establish test navigation readiness versus an application/session/synchronization defect with controlled real transport ordering, built app, PostgreSQL and service worker before selecting the smallest correction. Align the plan with demonstrated evidence; preserve the unavailable-server scenario, cached route, saved pickup, automatic recovery, pending-count assertions, subsequent delivery, full axe scan and every deadline/retry/worker policy. Retain RED evidence, repeat focused cases, all four gates and scoped convergence. Do not infer T130's overlay cause, force clicks, hide notifications, mock successful responses or rerun until green. Historical CI uploaded no trace artifact; its exact scheduling and a browser crash are not proven. Only local investigation/correction is authorized; commit/push/PR, merge and feature-wide polish require separate approval (FR-018/FR-020/FR-022, US2/AC4, T043/T044, Constitution VI/VII and quality gates; partial).

T131 investigation checkpoint (2026-10-17, NOT completion): original case passes ten
repetitions (39.8 seconds) and ten under temporary 4× Chromium CPU throttling (48.8
seconds). Three controlled real-session/late-503 interleavings also pass. Two initial
diagnostic harness failures (ambiguous retry selector; fulfilling a removed interception)
are preserved, not misclassified as application RED. Experimental test/CPU changes
were removed; application, original tests, shared helper and workflow are unchanged.
Fresh build and a single complete diagnostic e2e run pass: 90/90, 5.8 minutes, first
attempt, traces retained at `.git/t131-suite-baseline`. Other evidence is inventoried
in ignored `.git/t131-local-investigation.md`; no repeat-until-green loop was used.

The historical CI has zero uploaded artifacts and the workflow has no upload step,
although Playwright retains failed traces on its runner. Root cause is still unknown;
local passes do not resolve the flaky run. T131 remains unchecked, with no claimed
correction, final four-gate closure or convergence. Request owner authority to prepare
and publish a narrowly scoped CI diagnostic/trace-retention PR (including failures
whose retry makes the job green) before changing the workflow or publishing anything.
Do not guess a navigation/sync fix, weaken a limit or start feature-wide polish.

## Phase 41: Convergence

- [X] T132 Retain Playwright failure traces in `.github/workflows/ci.yml` after either successful or failed e2e execution, including a failed first attempt followed by a successful retry. Upload only `apps/web/test-results/**/trace.zip` through the official SHA-pinned upload-artifact action, with seven-day retention, hidden files excluded and no-files ignored. Do not upload authentication storage, environment files, arbitrary reports or local investigation traces; retain existing test policies and application behavior. Validate workflow structure, condition outcomes and allowlist, run all four local gates and scoped convergence. This implementation task does not claim a real remote failed-trace upload or resolve T131; never induce an application failure or rerun until green to manufacture evidence. No merge or feature-wide polish is authorized (plan: T131 diagnostic retention, FR-018/FR-020/FR-022, Constitution VI/IX and quality gates; missing).

Publication authorization (2026-10-17): Samuel approved preparing, committing, pushing
and opening the diagnostic CI PR with “Si”, including latest-head CI review. This
supersedes only the earlier diagnostic-publication restriction; it does not authorize
merge, a guessed recovery fix, feature-wide polish or physical-validation completion.
After local T132 completion, publish the authorized diagnostic PR and audit its exact-head
CI and artifact handling as a delivery checkpoint in its timeline, not a self-referential
status-only commit. Distinguish a clean/no-trace execution from an actual failed-trace
upload and explicitly record any remaining upload-verification limitation.

T132 local implementation checkpoint (2026-10-17): check/build pass, all 948 tests
(242 domain / 512 server / 194 web) pass, and all 90 e2e pass first attempt in 5.1
minutes, with the original trace policy and no failure traces generated. Five expected
negative-password warnings remain visible in e2e; no unexpected warnings are observed.
The retained structural check in ignored `.git/t132-workflow-verification.mjs` detects
the missing baseline upload, parses current YAML, verifies existing steps/triggers/runner
unchanged, ten condition combinations and eight path examples (Node glob model, not
an Actions upload). The installed Playwright trace lifecycle retains failed attempts
independently of successful retries; its default preserves output directories.

Read-only analyze and scoped convergence cover three supporting requirements
(FR-018/020/022), US2/AC4, the retention design and all nine constitutional principles:
I direct official action/no app service or dependency; II–V courier persistence,
domain rules, transactions and type boundaries unchanged; VI all gates, no business
behavior change or fabricated application RED; VII UI/axe untouched; VIII English
development artifacts, minimal ordered workflow; IX private trace-only diagnostics,
seven-day retention, no production credentials added. Zero additional T132 findings;
convergence left tasks SHA-256 `a05ff8a32c80093126cbfaffb8cf7e3959eb6ae32f2d302dc7fad7869d082b47`
unchanged before this subsequent completion marker/checkpoint. Checklists remain
byte-identical, 16/16 and 48/48. No convergence hooks exist; optional commit hooks are
not executed (autocommit disabled). T131 and physical/polish tasks remain open. Remote
CI/artifact verification is not claimed here; the authorized PR timeline records it.

T132 merge authorization (2026-10-17): PR #28 source `393e5c7` passed CI
39077701647 with check/build, all 948 tests (242/512/194), 90 first-attempt e2e
(13.7 minutes), setup and post-actions. The trace-upload step succeeded with no files
and zero artifacts, verifying the no-files path, not a real failed-trace upload.
The PR timeline preserves exact source/tree/base and the historical flaky evidence.
Samuel authorized squash merge and verification of the resulting main CI with “Si”.
This documentation-only authorization checkpoint must pass fresh latest-head CI
before squash; the timeline records actual merge hashes/results. T131 remains open;
no causal patch, feature-wide polish or physical-validation completion is authorized.

## Phase 42: Convergence

- [ ] T133 HIGH Resolve the courier-photo access inconsistency identified by integral verification IV-05: spec FR-036 limits a courier to their own records of routes still on the phone, whereas `contracts/http-api.md` and `apps/server/src/routes/photos.ts` currently enforce only own-record ownership. Clarify the intended lifecycle and an enforceable boundary with the owner before changing the spec or broadening/narrowing access; align spec, contract and plan. Add regressions for the approved lifecycle and for authenticated photo caching across sign-out/account changes in the same browser, using actual authentication/storage and browser cache rather than only separate request clients. Current tests prove direct-request ownership, not lifecycle or browser-cache isolation; no cross-account cache leak is claimed reproduced by this finding. Implement any demonstrated defect test-first and repeat all gates (FR-002/FR-004/FR-023/FR-036, Constitution IX; contradicts).

## Phase 43: Convergence

- [ ] T134 CRITICAL Preserve first-acknowledged proof-photo evidence on retry. Reproduce IV-31 with PostgreSQL and private S3 storage: a different body under an already uploaded UUID currently overwrites bytes and arrival metadata. Align the immutable upload/replay contract, then add same/different-body, concurrent-upload, lost-response, storage/metadata failure and retention regressions before implementation. Preserve upload-after-record ordering and authorization; do not confuse this reproduced overwrite with T133's separate access-lifecycle question (FR-023, Constitution II/IV; contradicts).
- [ ] T135 HIGH Keep an existing courier-account link when the owner edits an account before courier query readiness or while its linked courier is inactive. Reproduce IV-26 first in the browser with a held real GET: opening before load and saving afterward currently unlinks it (200). Wait for authoritative initialization or preserve untouched link intent, show failed loads, and distinguish deliberate unlink/relink from missing list data. Cover lost responses with 001 T132 without duplicating its account-action work (FR-002, T094; contradicts).

## Phase 44: Convergence

- [ ] T136 HIGH Diagnose and deterministically reproduce the fresh full-gate `courier-day.spec.ts:123` timeout retained in ignored `.git/account-integrity-e2e-failure/`: 90 passed / 1 failed, 5.2 minutes. The APIRequestContext's first summary GET records roughly 5,003 ms of DNS lookup before an 18 ms response wait; browser records/snapshot requests succeed on reconnection. Establish the transport-versus-application cause with controlled native resolution/connection evidence before correction, preserving the same real built app, PostgreSQL, service worker, summary/offline/correction/axe checks and all deadlines/retries/workers. Do not equate this with unresolved T131's different navigation timeout, infer a fix from later fast DNS samples, print trace cookies/tokens or replace the failure with an unexplained green rerun. Align the plan before implementation and verify all gates/latest-head CI (FR-020/FR-022, US7/AC1–AC3, Constitution VI; partial).

T136 local verification (2026-10-19 UTC, remote verification still required): the
permanent native DNS-refusal control passes while the configured localhost request
fails (one failed, 18 ms); trace/context remain in ignored `.git/t136-loopback-red/`.
Coherent literal loopback for origins/cookies/preview/proxy fixes that regression;
23 selected recovery/day/offline/push/harness cases pass in 54.5 seconds. Five
repetitions of the two day and three harness cases pass 25/25 in 39.4 seconds.
Check initially catches require-await and then contextual overloaded return inference
in the fault callback; a directly rejecting `Promise<never>` fixes both without casts
or rule changes. Fresh check passes; full tests pass 948 (242/512/194; server
140.33 seconds); full e2e passes 92/92 first attempt in 5.2 minutes; build passes.
Expected negative-password diagnostics remain visible. No timeout, worker, retry,
workflow, dependency, migration, production listener or application behavior changes.

Scoped convergence assesses FR-020/FR-022/FR-037, US7/AC1–AC3, four transport/
native-origin/persistence/unchanged-policy decisions, T136 and related regression
obligations T043/T044/T078/T121/T131/T132, and all nine principles. Zero new findings;
existing unresolved T131 and physical/polish tasks are not duplicated or closed.
The assessment itself leaves this file byte-identical at SHA-256
`6b6302d8bff2a57695434d7d05ae32820deb335c2fc1a8489445fc63d1246262`;
this note is subsequent implementation tracking. Reviewer checklists stay unchanged
at 16/16 and 48/48. No convergence hooks exist; optional commit hooks are not executed
(autocommit disabled). T136 remains unchecked until authorized publication and actual
latest-head CI inspection. Its PR timeline must preserve source/tree/base, clean
first-attempt outcomes and post-actions before squash; no global sign-off is claimed.
