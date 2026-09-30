---

description: "Task list for Tracking Page, Merchant Link, and WhatsApp Message"
---

# Tasks: Tracking Page, Merchant Link, and WhatsApp Message

**Input**: Design documents from `/specs/004-tracking-merchant-link/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Depends on**: every task of features [001](../001-shipment-registration/tasks.md),
[002](../002-routes-dispatch/tasks.md), and [003](../003-courier-app/tasks.md)

**Tests**: REQUIRED (Constitution VI). In every phase, test tasks come first and MUST fail
before their implementation tasks start. Integration tests run against real PostgreSQL.

**Organization**: tasks are grouped by user story so each story can be implemented, tested,
and demonstrated on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story the task belongs to (US1–US3)
- Every description includes the exact file path

## Path Conventions

Monorepo defined in feature 001's plan: `apps/server/`, `apps/web/`, `packages/domain/`.
English kebab-case file names; Spanish URLs mapped in `apps/web/src/routes.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: configuration of the public address

- [ ] T001 Add `PUBLIC_BASE_URL` to `.env.example` and to the Zod schema in `apps/server/src/env.ts`, and expose it to the web app through `apps/web/vite.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: secret codes, new columns, public endpoint protection, and the public layout

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

### Tests first

- [ ] T002 [P] Write failing integration tests in `apps/server/tests/secret-codes.test.ts`: every shipment created singly or in bulk gets a 22-character `tracking_code` different from its tracking number; every merchant gets a `link_code`; codes are unique (FR-002, FR-021)
- [ ] T003 [P] Write failing integration tests in `apps/server/tests/public-protection.test.ts`: `/api/public/*` answers without a session; the 61st request in a minute from one address gets `429` with a Spanish message; every public response carries `Cache-Control: no-store` and `X-Robots-Tag: noindex`; the public web routes carry `X-Robots-Tag: noindex`; a request with a forged `X-Forwarded-For` behind the proxy is still counted against its real address (FR-011, FR-012)

### Implementation

- [ ] T004 Extend `apps/server/src/db/schema/shipments.ts` (`tracking_code`, `notified_at`, `notified_by`, event type `notified`), `apps/server/src/db/schema/directories.ts` (`merchants.link_code`, `link_replaced_at`), `apps/server/src/db/schema/audit.ts` (action `link_replaced`), and `apps/server/src/db/schema/settings.ts` (`support_phone`, `company_name`); generate and review the migration in `apps/server/src/db/migrations/`
- [ ] T005 Create `apps/server/src/lib/secret-code.ts` and generate the codes at creation in `apps/server/src/routes/shipments.ts`, `apps/server/src/routes/bulk.ts`, and `apps/server/src/routes/merchants.ts`, until T002 passes
- [ ] T006 Create `apps/server/src/lib/rate-limit.ts`, the router `apps/server/src/routes/public.ts` mounted under `/api/public` with the limit and headers, and the `noindex` header for public web routes in `apps/server/src/app.ts`, until T003 passes
- [ ] T007 [P] Register `/seguimiento/$code` and `/cliente/$code` as lazy routes in `apps/web/src/routes.ts`; create `apps/web/src/features/public/public-layout.tsx` (Domy header, support contact buttons, 320 px wide); skip the service worker registration on public routes in `apps/web/src/main.tsx`; keep the generic title, description, and image in `apps/web/index.html` (FR-012, FR-023)
- [ ] T008 [P] Add the support phone and company name to `GET`/`PATCH /api/settings` in `apps/server/src/routes/settings.ts` and to the settings page `apps/web/src/routes/settings.tsx` (FR-009)

**Checkpoint**: `pnpm check` and `pnpm test` pass; every shipment and merchant has its code

---

## Phase 3: User Story 1 - Follow a shipment (Priority: P1) 🎯 MVP

**Goal**: a public tracking page that shows only the agreed information for every status and
kind

**Independent Test**: open the tracking link of a shipment at each stage in a private
window and verify the page shows the right status and only the agreed information

### Tests for User Story 1 ⚠️ write first, must fail

- [ ] T009 [P] [US1] Write failing unit tests in `packages/domain/src/public-tracking.test.ts` for `publicTrackingView`: every row of spec FR-005 and every kind of FR-008 (reverse pickup, carrier handoff, errand), "Reprogramado para {date}" after an exception, reason texts, courier only under the conditions of FR-007, amount to pay per FR-014, expiry 7 days after the final status and current again after a revert (FR-010), Bogotá time format; for each case, the result contains no field outside data-model.md §Public tracking view (FR-003, FR-004, SC-004)
- [ ] T010 [P] [US1] Extend `packages/domain/src/routes.test.ts` for `deliveriesBefore`: pending delivery and return stops before the shipment's own, completed stops skipped whatever their position, reverse pickups counted to their pickup stop (FR-006)
- [ ] T011 [P] [US1] Integration tests in `apps/server/tests/public-tracking.test.ts` covering spec US1 scenarios 1–8: `GET /api/public/tracking/:code` for each stage through the real record function of feature 003; the same `404 link_not_found` for an unknown code; an expired link returns only `expired` and the support contact
- [ ] T012 [P] [US1] End-to-end test in `apps/web/tests/e2e/tracking-page.spec.ts`: quickstart scenarios 1–7 in a phone viewport, the page refreshing within a minute, and the status visible within 3 seconds with the network throttled to about 1.5 Mbps and high latency, in a browser without a session (FR-001, FR-013, SC-002, SC-003)

### Implementation for User Story 1

- [ ] T013 [US1] Implement `packages/domain/src/public-tracking.ts` (`publicTrackingView`, public status and reason texts in Spanish) and `packages/domain/src/schemas/public.ts` (`PublicTracking`) until T009 passes
- [ ] T014 [US1] Implement `deliveriesBefore` in `packages/domain/src/routes.ts` until T010 passes
- [ ] T015 [US1] Implement `GET /api/public/tracking/:code` in `apps/server/src/routes/public.ts`, serializing only `publicTrackingView`, until T011 passes
- [ ] T016 [US1] Build `apps/web/src/features/public/tracking-status.tsx` and the page `apps/web/src/routes/tracking.tsx` (status, queue, window, amount to pay, courier and support buttons, expired and invalid states, refresh every 30 seconds while visible), until T012 passes

**Checkpoint**: recipients can follow their shipments

---

## Phase 4: User Story 2 - Send the merchant their tracking links (Priority: P1)

**Goal**: "Notificar clientes" opens WhatsApp with each merchant's message in two taps

**Independent Test**: register five shipments for two merchants; send the message to one;
verify the text, the number, the "Notificado" mark, and the pending count after a new
shipment

### Tests for User Story 2 ⚠️ write first, must fail

- [ ] T017 [P] [US2] Write failing unit tests in `packages/domain/src/merchant-message.test.ts` for `composeMerchantMessage`: greeting with the merchant's name, one entry per shipment (recipient, neighborhood, tracking number, tracking link), the merchant link at the end, count and merchant link only above 20 shipments, voided shipments left out (FR-016)
- [ ] T018 [P] [US2] Integration tests in `apps/server/tests/notifications.test.ts` covering spec US2 scenarios 1, 3, 4, 7: `GET /api/notifications` lists every merchant with shipments on the date with codes and `notifiedAt`, voided shipments left out; `POST /api/notifications` sets `notified_at` and `notified_by` once, writes `notified` events, and has one effect per `actionId`; `GET /api/shipments/:id` returns `trackingCode` and `notifiedAt`; `GET /api/shipments/export` includes the column "Notificado"; a courier gets `403` (FR-015, FR-017, FR-018, Constitution IX)
- [ ] T019 [P] [US2] End-to-end test in `apps/web/tests/e2e/notify-merchants.spec.ts`: quickstart scenarios 9–11, checking the `wa.me` address and message opened, the clipboard, and "Copiar enlace de seguimiento"

### Implementation for User Story 2

- [ ] T020 [US2] Implement `packages/domain/src/merchant-message.ts` and `packages/domain/src/schemas/notifications.ts` until T017 passes
- [ ] T021 [US2] Implement `GET` and `POST /api/notifications` in `apps/server/src/routes/notifications.ts` (mounted in `apps/server/src/app.ts`, owner and dispatcher) and the new fields of `GET /api/shipments/:id` and of the shipment export in `apps/server/src/routes/shipments.ts`, until T018 passes
- [ ] T022 [US2] Build `apps/web/src/features/notifications/merchant-notify-row.tsx` ("Enviar por WhatsApp" opening `wa.me` in the same tap, "Copiar mensaje", "all the shipments of the date" option, prompt to add a missing WhatsApp number, the notification sent with an `actionId` and retried) and the page `apps/web/src/routes/notify-merchants.tsx` (`/notificar`) with its item in `apps/web/src/routes/panel-layout.tsx` and the reminder when the support contact is not set; add "Copiar enlace de seguimiento" and the notified time to `apps/web/src/features/shipments/shipment-detail.tsx`; until T019 passes

**Checkpoint**: User Stories 1 and 2 give every recipient a link without manual writing

---

## Phase 5: User Story 3 - See all my shipments (Priority: P2)

**Goal**: a private merchant page with the day's shipments, fees, totals, and proof of
delivery

**Independent Test**: open a merchant's private link in a private window; verify it lists
only that merchant's shipments, shows a delivered one's photo, and lets it see yesterday

### Tests for User Story 3 ⚠️ write first, must fail

- [ ] T023 [P] [US3] Write failing unit tests in `packages/domain/src/public-tracking.test.ts` for `merchantShipmentView`: list fields, "por confirmar" for a fee under review, day totals by status, of fees, of COD amounts, and of amounts collected by payment method with voided shipments and reverted records excluded; detail with received-by name, photo availability, amount collected, exception reason, note, and attempts; never the recipient's phone, the courier's phone, or a balance (FR-019, FR-020)
- [ ] T024 [P] [US3] Integration tests in `apps/server/tests/merchant-link.test.ts` covering spec US3 scenarios 1–6: `GET /api/public/merchant/:code` for today and a date within 30 days, `422 date_out_of_range` beyond; shipment detail `404` for another merchant's shipment or one older than 30 days; photo streamed only for the merchant's shipments; `POST /api/merchants/:id/replace-link` makes the old code answer `404` at once and writes an audit event; a deactivated merchant's code answers `404` while its tracking links keep working (FR-019–FR-022)
- [ ] T025 [P] [US3] End-to-end test in `apps/web/tests/e2e/merchant-page.spec.ts`: quickstart scenarios 12–14

### Implementation for User Story 3

- [ ] T026 [US3] Implement `merchantShipmentView` in `packages/domain/src/public-tracking.ts` and `MerchantDay` and `MerchantShipment` in `packages/domain/src/schemas/public.ts` until T023 passes
- [ ] T027 [US3] Implement the three `/api/public/merchant/:code` endpoints in `apps/server/src/routes/public.ts` (photos through `apps/server/src/lib/storage.ts`) and `POST /api/merchants/:id/replace-link` with `linkCode` on `GET /api/merchants/:id` in `apps/server/src/routes/merchants.ts`, until T024 passes
- [ ] T028 [P] [US3] Build `apps/web/src/features/public/merchant-shipment-list.tsx`, `apps/web/src/features/public/merchant-shipment-detail.tsx`, and the page `apps/web/src/routes/merchant-page.tsx` (date selector limited to 30 days, totals, empty state, refresh every 60 seconds)
- [ ] T029 [US3] Add "Copiar enlace del cliente" and "Reemplazar enlace" (with confirmation) to the merchant screen in `apps/web/src/features/master-data/merchants/`, until T025 passes

**Checkpoint**: all three user stories work independently

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T030 [P] Extend `apps/server/tests/role-permissions.test.ts` with every endpoint of contracts/http-api.md: public endpoints without a session and read-only (no mutating method under `/api/public`); notifications and link replacement for owner and dispatcher only (FR-024)
- [ ] T031 [P] Add `apps/server/tests/public-codes-scan.test.ts` (SC-005): 1,000 random codes against both public endpoints find nothing and all get the same answer
- [ ] T032 [P] Extend the accessibility checks in `apps/web/tests/e2e/fixtures.ts` to the tracking page, the merchant page, and "Notificar clientes": WCAG 2.2 AA and usability at 320 px (FR-023)
- [ ] T033 [P] Add to the go-live section of `README.md` the couriers' authorization to show their first name and phone on tracking pages, required by Constitution VII (v1.2.0) and Ley 1581 de 2012, and the `PUBLIC_BASE_URL` setting
- [ ] T034 Run every scenario of `specs/004-tracking-merchant-link/quickstart.md` (1–14) on a phone with mobile data measure the time to notify every merchant of a day (SC-001), and record the results in `specs/004-tracking-merchant-link/quickstart-results.md`
- [ ] T035 Confirm `pnpm check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` pass with zero warnings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** and **Foundational (Phase 2)**: after features 001–003 are complete;
  they block every user story
- **User Stories (Phases 3–5)**: depend on Foundational
- **Polish (Phase 6)**: after the user stories

### User Story Dependencies

- **US1 (P1)**: after Foundational
- **US2 (P1)**: after Foundational; its message links point to the pages of US1 and US3,
  which it does not need to be tested
- **US3 (P2)**: after Foundational; T023 extends the test file of T009, so it runs after it

US1, US2, and US3 can otherwise proceed in parallel.

### Within Each User Story

- Tests first, failing; then domain; then server endpoints; then web screens
- A story is complete when its end-to-end test passes

### Parallel Opportunities

- Foundational: T002 and T003 together; T007 and T008 together
- US1: T009–T012 together
- US2: T017–T019 together
- US3: T024 and T025 together
- Polish: T030–T033 together

---

## Parallel Example: User Story 1

```bash
# Tests first, together:
Task: "Unit tests in packages/domain/src/public-tracking.test.ts"
Task: "Unit tests in packages/domain/src/routes.test.ts for deliveriesBefore"
Task: "Integration tests in apps/server/tests/public-tracking.test.ts"
Task: "End-to-end test in apps/web/tests/e2e/tracking-page.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 and 2)

1. Phases 1–2: public address, codes, protection
2. Phase 3: the tracking page
3. Phase 4: "Notificar clientes"

### Incremental Delivery

1. US1 + US2 → recipients follow their shipments; no notification written by hand
2. US3 → merchants see their whole day
3. Polish

Implementation of features 001–004 starts after this analysis, with `/speckit-implement`
feature by feature (decision #35 in the business master).

---

## Notes

- [P] tasks touch different files and have no unfinished dependencies
- `apps/server/src/routes/public.ts` and `packages/domain/src/public-tracking.ts` are edited by
  several tasks; they are sequential on purpose
- Verify each test fails before implementing; commit after each task or logical group
- Every task must leave `pnpm check` clean
