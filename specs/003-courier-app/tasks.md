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

- [ ] T053 [P] [US4] Integration tests in `apps/server/tests/exception-decision.test.ts` covering spec US4 scenarios 1–6 and FR-029–FR-032: new attempt on the same route; on another courier's route with a pending handover; rescheduled (off route, new service date, listed by `GET /api/shipments/unassigned` with `heldBy`); return stop at the place the shipment was picked up, including a reverse pickup; a return changed to a new attempt removes the pending return stop; `409 no_exception_to_decide`; a return record sets `returned` and ends custody; a problem on a return stop keeps it pending; attempts listed without reverted records; a held shipment is refused on a route in preparation with `409 route_not_in_progress`
- [ ] T054 [P] [US4] Integration tests in `apps/server/tests/office-receipt.test.ts` covering spec US4 scenarios 7–8 and FR-041: receipt for a shipment in "Novedad" and for one "Recogido" off route; custody passes to the office; `409 not_held_by_courier`; `409 office_not_configured`; with a new attempt the shipment is `registered` and a route gets a pickup stop at the office; with a return the route gets the office pickup before the return stop; the pickup record at the office gives custody to the courier; `GET` and `PATCH /api/settings` (owner only for `PATCH`, change audited)
- [ ] T055 [P] [US4] End-to-end test in `apps/web/tests/e2e/exception-decision.spec.ts`: quickstart scenarios 12–13

### Implementation for User Story 4

- [ ] T056 [US4] Implement `POST /api/shipments/:id/exception-decision` in `apps/server/src/routes/shipments.ts`, add `attempts` to `GET /api/shipments/:id`, and extend `GET /api/shipments/unassigned`, `POST /api/routes/:id/shipments`, and `POST /api/shipments/:id/reassign` to held shipments (in `apps/server/src/routes/shipments.ts` and `apps/server/src/routes/routes.ts`), until T053 passes
- [ ] T057 [US4] Implement `POST /api/shipments/:id/office-receipt` in `apps/server/src/routes/shipments.ts` and `GET`/`PATCH /api/settings` in `apps/server/src/routes/settings.ts` until T054 passes
- [ ] T058 [P] [US4] Build `apps/web/src/features/shipments/exception-decision-dialog.tsx` ("Nuevo intento" with date and route, "Devolver al remitente", "Recibido en oficina") and the attempts list in `apps/web/src/features/shipments/shipment-records.tsx`; extend `CustodyHistory` in `apps/web/src/features/routes/route-history.tsx` (and its unit test) with the office lines ("La recibe la oficina", "La recoge {courier} en la oficina")
- [ ] T059 [P] [US4] Show held shipments ("En custodia de {courier}", "En oficina") in `apps/web/src/features/routes/unassigned-list.tsx`, and build the office address form in `apps/web/src/routes/settings.tsx` with its item in `apps/web/src/routes/panel-layout.tsx`
- [ ] T060 [US4] In the courier app, complete a return stop with `apps/web/src/features/courier/delivery-form.tsx` (received-by name and photo, no collection) and list "En mi custodia" in `apps/web/src/routes/courier-route.tsx`, until T055 passes

**Checkpoint**: no shipment stays in "Novedad" without a way forward

---

## Phase 7: User Story 5 - Follow changes to the route and confirm handovers (Priority: P2)

**Goal**: notices and phone notifications for every change, handovers confirmed by the
courier, and late records applied as facts

**Independent Test**: change a route from the panel and verify the notices; confirm a
handover from the receiving courier's phone; remove a shipment while the first phone is
offline with its pickup recorded, and verify the result

### Tests for User Story 5 ⚠️ write first, must fail

- [ ] T061 [P] [US5] Integration tests in `apps/server/tests/courier-notices.test.ts` (FR-027, FR-033, FR-040): every action listed in FR-027 creates a notice for each affected courier in the same transaction, including joining a route to the courier's route in progress (`POST /api/routes/:id/join`) and editing a shipment on the route (`shipment_updated`), and cancelling a route in preparation creates none; the snapshot returns the unacknowledged ones; the acknowledgment sets `acknowledged_at` once; `unacknowledgedNotices` and `courierLastSyncedAt` on `GET /api/routes/board`; a phone notification is sent after commit with only the type and the route number; a failing push service does not fail the action; a `410` deletes the subscription; subscribing and removing a subscription
- [ ] T062 [P] [US5] Integration tests in `apps/server/tests/courier-late-records.test.ts` covering spec US5 scenarios 5–7 and FR-024–FR-026: pickup of a removed shipment (off route, custody, "Por revisar"); of a shipment on another courier's route in progress (pending handover); on a route in preparation (leaves it); delivery by the holder after a reassignment (handover cancelled, the other stop removed, notice to the other courier); a disbursement for a shipment off the route; `not_applied` for a voided, delivered, or returned shipment or without custody, with a `record_not_applied` notice; a repeated record from a second phone is `duplicate` without a flag; `POST /api/shipments/:id/clear-review` with a note; cancelling a handover with no origin route leaves the shipment off route with its holder (research R17)
- [ ] T063 [P] [US5] Extend `apps/server/tests/handovers.test.ts` and `apps/server/tests/custody-history.test.ts`: a `handover_confirmation` record gives custody and unblocks the task; `handoversToGive` stays in the giver's snapshot after the route left their app; custody history with the office and with late records leaves no interval without a holder (FR-028, SC-007)
- [ ] T064 [P] [US5] End-to-end test in `apps/web/tests/e2e/courier-changes.spec.ts` with two phone contexts: quickstart scenarios 14–18 (the notification checked through the service worker's `push` event)

### Implementation for User Story 5

- [ ] T065 [US5] Implement `apps/server/src/lib/push.ts` (`web-push` client) and `apps/server/src/lib/notices.ts` (`notifyCourier`: notice row in the transaction, phone notification after commit), and call it from every action of FR-027 in `apps/server/src/routes/routes.ts` (including `join`), `apps/server/src/routes/shipments.ts` (including `PATCH` of a shipment on a route in progress), `apps/server/src/routes/handovers.ts`, `apps/server/src/lib/reassignment.ts`, and `apps/server/src/routes/courier-records.ts`
- [ ] T066 [US5] Implement `POST /api/courier/notices/acknowledge` and the push subscription endpoints in `apps/server/src/routes/courier.ts`, and add `unacknowledgedNotices` and `courierLastSyncedAt` to `GET /api/routes/board` in `apps/server/src/routes/routes.ts`, until T061 passes
- [ ] T067 [US5] Extend `apps/server/src/lib/courier-records.ts` with the effects across routes (handover created or cancelled, task removed from another route, shipment taken off a route in preparation, "Por revisar", `record_not_applied` notice), let `cancelHandover` in `apps/server/src/lib/reassignment.ts` cancel a handover with no origin route, and implement `POST /api/shipments/:id/clear-review` in `apps/server/src/routes/shipments.ts`, until T062 and T063 pass
- [ ] T068 [P] [US5] Add the `push` and `notificationclick` handlers to `apps/web/src/sw.ts` (Spanish text per notice type, opens `/mensajero`) and implement `apps/web/src/lib/offline/push.ts` (ask for the permission once after sign-in, register the subscription)
- [ ] T069 [P] [US5] Build `apps/web/src/features/courier/notice-list.tsx` (notices with one "Entendido" for all shown, acknowledged through the outbox) and the handover actions in `apps/web/src/routes/courier-stop.tsx` and `apps/web/src/routes/courier-route.tsx` ("Recibí el paquete", "Entregar a {courier}")
- [ ] T070 [US5] Show the last synchronization and the unacknowledged changes in `apps/web/src/features/routes/route-summary-card.tsx`, and the "Por revisar" flag with its clearing dialog and the records "No aplicado" in `apps/web/src/features/board/board-table.tsx` and `apps/web/src/features/shipments/shipment-records.tsx`, until T064 passes

**Checkpoint**: the dispatcher no longer needs to call couriers about changes

---

## Phase 8: User Story 6 - Record on behalf of a courier and correct mistakes (Priority: P2)

**Goal**: the dispatcher records for a courier, corrects, and reverts, with a reason

**Independent Test**: record a delivery on behalf; correct a collected amount; revert a
delivery; verify the marks and the history

### Tests for User Story 6 ⚠️ write first, must fail

- [ ] T071 [P] [US6] Integration tests in `apps/server/tests/records-on-behalf.test.ts` covering spec US6 scenario 1 and FR-034: every kind except `handover_confirmation` recorded through `POST /api/shipments/:id/records` is stored with `on_behalf`, the dispatcher as author, and the courier who holds the package or whose route carries it, and every event it writes carries `on_behalf = true`, shown as "Registrado por despacho" in the histories of feature 002; `occurredAt` defaults to now; `422 occurred_in_future`; a courier gets `403`
- [ ] T072 [P] [US6] Integration tests in `apps/server/tests/records-correct-revert.test.ts` covering spec US6 scenarios 2–4 and FR-035: a correction of each correctable field requires a reason and writes `record_corrected` with old and new values; reverting a delivery or an exception returns the shipment to `picked_up` with its task pending on a route in progress, or off route otherwise; reverting a return goes back to `exception` with the return pending; `409 record_not_revertible` for a record that is not the latest; a reverted delivery's collection leaves the day summary and the attempts; the courier gets a notice
- [ ] T073 [P] [US6] End-to-end test in `apps/web/tests/e2e/records-on-behalf.spec.ts`: quickstart scenario 19

### Implementation for User Story 6

- [ ] T074 [US6] Implement `POST /api/shipments/:id/records` in `apps/server/src/routes/shipments.ts` until T071 passes
- [ ] T075 [US6] Implement `POST /api/courier-records/:id/correct` and `POST /api/courier-records/:id/revert` in `apps/server/src/routes/courier-records.ts` until T072 passes
- [ ] T076 [US6] Build `apps/web/src/features/shipments/record-on-behalf-dialog.tsx` and `apps/web/src/features/shipments/correct-record-dialog.tsx`, with "Registrado por despacho" and the revert action in `apps/web/src/features/shipments/shipment-records.tsx`, until T073 passes

**Checkpoint**: a dead phone or a wrong tap no longer blocks a route

---

## Phase 9: User Story 7 - See my day (Priority: P3)

**Goal**: the courier's summary of the day with the cash to hand over

**Independent Test**: record three deliveries with different payment methods and a
disbursement; verify each total and "Efectivo por entregar"

### Tests for User Story 7 ⚠️ write first, must fail

- [ ] T077 [P] [US7] Integration tests in `apps/server/tests/courier-summary.test.ts` covering spec US7 scenarios 1 and 3: the `summary` of `GET /api/courier/route` returns today's counts and the four amounts from applied, not reverted records of that courier, with corrected values
- [ ] T078 [P] [US7] End-to-end test in `apps/web/tests/e2e/courier-day.spec.ts`: quickstart scenario 20, including records still pending while offline

### Implementation for User Story 7

- [ ] T079 [US7] Add `summary` to `GET /api/courier/route` in `apps/server/src/routes/courier.ts` with `day-summary.ts` until T077 passes
- [ ] T080 [US7] Build `apps/web/src/routes/courier-day.tsx` ("Mi día": the `summary` of the stored snapshot plus the outbox through `day-summary.ts`, labelled as an estimate) until T078 passes

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

- [ ] T102 CRITICAL Reproduce the settled-page ambiguity in T099 by awaiting the "Pendientes por sincronizar" heading in `apps/web/tests/e2e/access.spec.ts`; then target the retry button inside the unique refusal alert and verify that it actually retries. Preserve the one-refusal assertion across synchronization and navigation. Do not use `.first()`, sleeps, longer timeouts, skipped assertions or application changes to conceal the two legitimate retry controls (Constitution VI, FR-002, FR-004, FR-020; contradicts). Repeat the gates and scoped convergence before merging US3.
