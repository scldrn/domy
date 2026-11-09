---

description: "Task list for Tracking Page, Merchant Link, and WhatsApp Message"
---

# Tasks: Tracking Page, Merchant Link, and WhatsApp Message

**Input**: Design documents from `/specs/004-tracking-merchant-link/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts), [quickstart.md](quickstart.md)

**Development prerequisites**: verified technical implementations/contracts of features
[001](../001-shipment-registration/tasks.md), [002](../002-routes-dispatch/tasks.md),
and [003](../003-courier-app/tasks.md). Owner sequencing decision (2026-10-21,
“omite y continuemos”) defers physical 003/T093/T087 and final T088 while local 004
work proceeds. Those tasks remain open and gate final delivery, not local development.
See [local orchestration](../../docs/archive/local-orchestration.md).

**Tests**: REQUIRED (Constitution VI). In every phase, test tasks come first and MUST fail
before their implementation tasks start. Integration tests run against real PostgreSQL.
The 2026-10-21 alignment in research R12–R16 governs ambiguous historical task wording.

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

- [X] T001 Add `PUBLIC_BASE_URL` to `.env.example` and to the Zod schema in `apps/server/src/env.ts`, and expose only that validated origin to the web app through `apps/web/vite.config.ts`. Share the origin schema with the domain; HTTP(S) origin only, no credentials/path/query/hash, HTTPS and explicit value in production; development/test may fall back to APP_URL. Keep dynamic E2E/phone build and runtime origins equal; prove a sentinel secret is absent from the bundle (research R12)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: secret codes, new columns, public endpoint protection, and the public layout

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

### Tests first

- [X] T002 [P] Write failing integration tests in `apps/server/tests/secret-codes.test.ts`: every shipment created singly or in bulk gets a 22-character `tracking_code` different from its tracking number; every merchant gets a `link_code`; codes are unique, stable on concurrent creation replay/edits, and absent from creation audit snapshots; include a nonempty prior-schema upgrade/backfill and DB constraints (FR-002, FR-021)
- [X] T003 [P] Write failing integration tests in `apps/server/tests/public-protection.test.ts`: `/api/public/*` answers without a session; the 61st request in a minute from one address gets `429` with a Spanish message; every public response carries `Cache-Control: no-store` and `X-Robots-Tag: noindex`; the public web documents carry both `Cache-Control: no-store` and `X-Robots-Tag: noindex`; a request with forged `X-Forwarded-For` at the actual native Node adapter is still counted against its real transport peer; deployment proxy topology is verified separately under OP-01/G1 (FR-011, FR-012)

### Implementation

- [X] T004 Extend `apps/server/src/db/schema/shipments.ts` (`tracking_code`, `notified_at`, `notified_by`, event type `notified`), `apps/server/src/db/schema/directories.ts` (`merchants.link_code`, `link_replaced_at`), `apps/server/src/db/schema/audit.ts` (action `link_replaced`), and `apps/server/src/db/schema/settings.ts` (`support_phone`, `company_name`); generate and review the additive migration in `apps/server/src/db/migrations/`; stable per-row random backfill must precede effective unique/NOT NULL enforcement, preserve old fields/history and survive migration replay. Follow R13 and the D6 inventory; include code-format/notification-pair constraints, matching domain event/audit enums and display labels, and exclude new DB-generated merchant codes from audit snapshots before migration integration. T005 retains ordinary API generator ownership. Do not apply migrations to dev/LAN/production data during isolated QA
- [X] T005 Create `apps/server/src/lib/secret-code.ts` and generate the codes at creation in `apps/server/src/routes/shipments.ts`, `apps/server/src/routes/bulk.ts`, and `apps/server/src/routes/merchants.ts` through shared `apps/server/src/lib/registration.ts`, until T002 passes. Preserve seed/direct-fixture insertion compatibility, never log or audit codes, and never rotate an accepted creation on replay
- [X] T006 Create `apps/server/src/lib/rate-limit.ts`, the router `apps/server/src/routes/public.ts` mounted under `/api/public` with the limit and headers, and both `Cache-Control: no-store` and `X-Robots-Tag: noindex` for public web documents in `apps/server/src/app.ts`, until T003 passes; bind identity to the native transport peer, ignore untrusted forwarding headers, bound/clean the in-memory map, and redact all public bearer paths in request/error logs (R14)
- [X] T007 [P] Register `/seguimiento/$code` and `/cliente/$code` as lazy routes in `apps/web/src/routes.ts`; create `apps/web/src/features/public/public-layout.tsx` (Domy header, support contact buttons, 320 px wide); skip service worker registration on public routes in `apps/web/src/main.tsx` and exclude both public route prefixes from existing worker navigation fallback in `apps/web/src/sw.ts`; verify fresh and already-controlled browsers without removing courier caches/outbox; keep the generic title, description, and image in `apps/web/index.html` (FR-012, FR-023)
- [X] T008 [P] Add the support phone and company name to `GET`/`PATCH /api/settings` in `apps/server/src/routes/settings.ts` and to the settings page `apps/web/src/routes/settings.tsx`; independently configurable partial owner PATCH, omitted office fields preserved, explicit nullable support phone, nonempty company name default Cohex, native audited/idempotent no-op/replay protection retained (FR-009; R16)

**Checkpoint**: `pnpm check` and `pnpm test` pass; every shipment and merchant has its code

---

## Phase 3: User Story 1 - Follow a shipment (Priority: P1) 🎯 MVP

**Goal**: a public tracking page that shows only the agreed information for every status and
kind

**Independent Test**: open the tracking link of a shipment at each stage in a private
window and verify the page shows the right status and only the agreed information

### Tests for User Story 1 ⚠️ write first, must fail

- [X] T009 [P] [US1] Write failing unit tests in `packages/domain/src/public-tracking.test.ts` for `publicTrackingView`: every row of spec FR-005 and every kind of FR-008 (reverse pickup, carrier handoff, errand), "Reprogramado para {date}" after an exception, reason texts, courier only under the conditions of FR-007, amount to pay per FR-014, expiry 7 days after the final status and current again after a revert (FR-010), Bogotá time format; for each case, explicitly cover carrier/town destination before and after delivery, and the result contains no field outside data-model.md §Public tracking view (FR-003, FR-004, SC-004); assert FR-008 wording precedence and effective received-by source distinct from the forbidden intended recipient name (R17)
- [X] T010 [P] [US1] Extend `packages/domain/src/routes.test.ts` for `deliveriesBefore`: pending delivery and return stops before the shipment's own, completed stops skipped whatever their position, reverse pickups counted to their pickup stop (FR-006); use the explicit kind input and nullable missing-anchor result, with active-route eligibility gated by the caller; reverse pickup after pickup returns null even when its delivery task remains (R17)
- [X] T011 [P] [US1] Integration tests in `apps/server/tests/public-tracking.test.ts` covering spec US1 scenarios 1–8: `GET /api/public/tracking/:code` for each stage through the real record function of feature 003; the same `404 link_not_found` for an unknown code; an expired link returns only `expired` and the support contact
- [X] T012 [P] [US1] End-to-end test in `apps/web/tests/e2e/tracking-page.spec.ts`: quickstart scenarios 1–7 in a phone viewport, the page refreshing within a minute, and the status visible within 3 seconds with the network throttled to about 1.5 Mbps and high latency, in a browser without a session (FR-001, FR-013, SC-002, SC-003)

### Implementation for User Story 1

- [X] T013 [US1] Implement `packages/domain/src/public-tracking.ts` (`publicTrackingView`, public status and reason texts in Spanish) and `packages/domain/src/schemas/public.ts` (`PublicTracking`) until T009 passes
- [X] T014 [US1] Implement `deliveriesBefore` in `packages/domain/src/routes.ts` until T010 passes
- [X] T015 [US1] Implement `GET /api/public/tracking/:code` in `apps/server/src/routes/public.ts`, serializing only `publicTrackingView`, until T011 passes
- [X] T016 [US1] Build `apps/web/src/features/public/tracking-status.tsx` and the page `apps/web/src/routes/tracking.tsx` (status, queue, window, amount to pay, courier and support buttons, expired and invalid states, refresh every 30 seconds while visible), until T012 passes

**Checkpoint**: recipients can follow their shipments

---

## Phase 4: User Story 2 - Send the merchant their tracking links (Priority: P1)

**Goal**: "Notificar clientes" opens WhatsApp with each merchant's message in two taps

**Independent Test**: register five shipments for two merchants; send the message to one;
verify the text, the number, the "Notificado" mark, and the pending count after a new
shipment

### Tests for User Story 2 ⚠️ write first, must fail

- [X] T017 [P] [US2] Write failing unit tests in `packages/domain/src/merchant-message.test.ts` for `composeMerchantMessage`: greeting with the merchant's name, one entry per shipment (recipient, neighborhood, tracking number, tracking link), the merchant link at the end, count and merchant link only above 20 shipments, voided shipments left out in every mode and notified shipments excluded by default; the explicit includeNotified option includes notified shipments, and the 20/21 threshold applies after filtering (FR-016; R8)
- [X] T018 [P] [US2] Integration tests in `apps/server/tests/notifications.test.ts` covering spec US2 scenarios 1, 3, 4, 7: `GET /api/notifications` lists every merchant with shipments on the date with codes, domain `status` and `notifiedAt`, voided shipments left out; `POST /api/notifications` sets `notified_at` and `notified_by` once, writes `notified` events, and has one effect per `actionId`; `GET /api/shipments/:id` returns `trackingCode` and `notifiedAt`; `GET /api/shipments/export` includes the column "Notificado"; a courier gets `403` (FR-015, FR-017, FR-018, Constitution IX) Include empty-batch rejection, concurrent replay, actor/payload mismatch and non-secret normalized batch receipt assertions (R15).
- [X] T019 [P] [US2] End-to-end test in `apps/web/tests/e2e/notify-merchants.spec.ts`: quickstart scenarios 9–11, checking the `wa.me` address and message opened, the clipboard, and "Copiar enlace de seguimiento" Depends on verified T027–T029 merchant endpoints/pages/rotation as well as tracking; no dead destination in an opened/copied message.

### Implementation for User Story 2

- [X] T020 [US2] Implement `packages/domain/src/merchant-message.ts` and `packages/domain/src/schemas/notifications.ts` until T017 passes
- [X] T021 [US2] Implement `GET` and `POST /api/notifications` in `apps/server/src/routes/notifications.ts` (mounted in `apps/server/src/app.ts`, owner and dispatcher) and the new fields of `GET /api/shipments/:id` and of the shipment export in `apps/server/src/routes/shipments.ts`, until T018 passes; depends on verified T020 for the shared notification schemas. Reject empty batches; validate all IDs before atomic marks/events, serialize actionId and bind replay to actor/operation/sorted IDs; expose merchant isActive without hiding its work, and write both event clocks from the injected server instant (R15).
- [X] T022 [US2] Build `apps/web/src/features/notifications/merchant-notify-row.tsx` ("Enviar por WhatsApp" opening `wa.me` in the same tap, "Copiar mensaje", "all the shipments of the date" option, prompt to add a missing WhatsApp number, the notification sent with an `actionId` and retried) and the page `apps/web/src/routes/notify-merchants.tsx` (`/notificar`) with its item in `apps/web/src/routes/panel-layout.tsx` and the reminder when the support contact is not set; disable new open/copy for inactive merchants until activation while retaining their visible work and already-opened mark retries; add "Copiar enlace de seguimiento" and the notified time to `apps/web/src/features/shipments/shipment-detail.tsx`; until T019 passes

**Checkpoint**: User Stories 1 and 2 give every recipient a link without manual writing

---

## Phase 5: User Story 3 - See all my shipments (Priority: P2)

**Goal**: a private merchant page with the day's shipments, fees, totals, and proof of
delivery

**Independent Test**: open a merchant's private link in a private window; verify it lists
only that merchant's shipments, shows a delivered one's photo, and lets it see yesterday

### Tests for User Story 3 ⚠️ write first, must fail

- [X] T023 [P] [US3] Write failing unit tests in `packages/domain/src/public-tracking.test.ts` for `merchantDayView` and `merchantShipmentView`: strict list/detail allowlists; fee under review as `fee: null` plus `feeToConfirm`; canonical status totals excluding voided shipments while retaining their list rows; confirmed-fee, FR-014 COD-to-collect, and effective delivery-collection totals for the service-date cohort; detail status-time source/null cases, receiver only from the effective delivery/return record, collection from the effective delivery or zero, proof-photo states at the 24-hour boundary, and current-exception reason/note/attempts using corrected applied records; reject phone, address, courier/author identity, history, balance, and storage-key disclosures; replace all nonblank current/attempt notes with the contracted fixed support notice, preserve null/empty/whitespace as null, enforce literal-only nested note schemas, and verify source-input immutability without loading private redaction inputs (FR-019, FR-020, R19)
- [X] T024 [P] [US3] Integration tests in `apps/server/tests/merchant-link.test.ts` covering spec US3 scenarios 1–6: `GET /api/public/merchant/:code` for today and a date within 30 days, `422 date_out_of_range` beyond; shipment detail `404` for another merchant's shipment or one older than 30 days; photo streamed only for the merchant's shipments within the same 30-day Bogotá date window, direct older-photo access is uniform 404; `POST /api/merchants/:id/replace-link` makes the old code answer `404` at once and writes an audit event; a deactivated merchant's code answers `404` while its tracking links keep working (FR-019–FR-022) Include direct old-photo 404, deactivated-merchant tracking continuity, actor/target-bound replacement replay and absence of bearer secrets in audit events.
- [X] T025 [P] [US3] End-to-end test in `apps/web/tests/e2e/merchant-page.spec.ts`: quickstart scenarios 12–14

### Implementation for User Story 3

- [X] T026 [US3] Implement `merchantDayView` and `merchantShipmentView` in `packages/domain/src/public-tracking.ts` and strict `MerchantDay`, `MerchantShipmentSummary`, `MerchantShipment`, and totals schemas in `packages/domain/src/schemas/public.ts` until T023 passes; replace projected nonblank notes with one canonical fixed support notice helper, preserve absent/blank notes as null, and constrain nested note schemas to that literal or null (R19)
- [X] T027 [US3] Implement the three `/api/public/merchant/:code` endpoints in `apps/server/src/routes/public.ts` (photos through `apps/server/src/lib/storage.ts`) and `POST /api/merchants/:id/replace-link` with `linkCode` on `GET /api/merchants/:id` in `apps/server/src/routes/merchants.ts`, until T024 passes Enforce R16 date/ownership/code predicates on direct photos; bind replacement replay without re-rotation or bearer codes in audit changes.
- [X] T028 [P] [US3] Build `apps/web/src/features/public/merchant-shipment-list.tsx`, `apps/web/src/features/public/merchant-shipment-detail.tsx`, and the page `apps/web/src/routes/merchant-page.tsx` (date selector limited to 30 days, totals, empty state, refresh every 60 seconds)
- [X] T029 [US3] Add "Copiar enlace del cliente" and "Reemplazar enlace" (with confirmation) to the merchant screen in `apps/web/src/features/master-data/merchants/`, until T025 passes

**Checkpoint**: all three user stories work independently

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T030 [P] Extend `apps/server/tests/role-permissions.test.ts` with every endpoint of contracts/http-api.md: public endpoints without a session and read-only (no mutating method under `/api/public`); notifications and link replacement for owner and dispatcher only (FR-024)
- [X] T031 [P] Add `apps/server/tests/public-codes-scan.test.ts` (SC-005): 1,000 random codes against both public endpoints find nothing and all get the same answer
- [X] T032 [P] Extend the accessibility checks in `apps/web/tests/e2e/fixtures.ts` to the tracking page, the merchant page, and "Notificar clientes": WCAG 2.2 AA and usability at 320 px (FR-023)
- [X] T033 [P] Add to the go-live section of `README.md` the couriers' authorization to show their first name and phone on tracking pages, required by Constitution VII (v1.2.0) and Ley 1581 de 2012, and the `PUBLIC_BASE_URL` setting
- [ ] T034 Run every scenario of `specs/004-tracking-merchant-link/quickstart.md` (1–14) on a phone with mobile data measure the time to notify every merchant of a day (SC-001), and record the results in `specs/004-tracking-merchant-link/quickstart-results.md`
- [ ] T035 Confirm `pnpm check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` pass with zero warnings Final delivery also requires deferred 003/T093/T087/T088 and physical 004/T034; a technical gate pass alone does not satisfy those open tasks.

---

## Dependencies & Execution Order

### Phase Dependencies

The explicit execution order is foundations → US1 tracking → US3 merchant portal
→ US2 notification UI/delivery → final verification. Preserve task IDs; composer
unit RED may be prepared earlier, but T019/T022 require working T027–T029 pages.


- **Setup (Phase 1)** and **Foundational (Phase 2)**: after their verified technical baseline and the owner-approved physical deferral;
  they block every user story
- **User Stories (Phases 3–5)**: depend on Foundational
- **Polish (Phase 6)**: after the user stories

### User Story Dependencies

- **US1 (P1)**: after Foundational
- **US2 (P1)**: after Foundational; its message links point to the pages of US1 and US3,
  so delivery and browser acceptance wait for US1 and T027–T029 to pass
- **US3 (P2)**: after Foundational; T023 extends the test file of T009, so it runs after it

Only independent RED preparation may run in parallel; shared files and the ordered delivery dependencies remain sequential.

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
3. Phase 5: working merchant portal and replaceable private links
4. Phase 4: "Notificar clientes" after both link destinations work

### Incremental Delivery

1. US1 → recipients follow their shipments
2. US3 → merchants see their whole day
3. US2 → dispatcher composes notifications with working links
4. Polish

Implementation of features 001–004 starts after this analysis, with `/speckit-implement`
feature by feature (decision #35 in the business master).

---

## Notes

- [P] tasks touch different files and have no unfinished dependencies
- `apps/server/src/routes/public.ts` and `packages/domain/src/public-tracking.ts` are edited by
  several tasks; they are sequential on purpose
- Verify each test fails before implementing; commit after each task or logical group
- Every task must leave `pnpm check` clean

## Release change review — 2026-10-23

- [X] T036 Review shared bounded request limiting and IPv6 prefix keys without evicting live public buckets. Preserve public privacy, status and rate-limit contracts; full local gates required. See ../../docs/release-change-review-results.md.

## Production-readiness audit — 2026-11-02

- [X] T037 Limit "Notificar clientes" to today or earlier (FR-015, US2 scenario 8, finding F004-3). `isFutureServiceDate` in `packages/domain`, used by both sides; `GET /api/notifications` refuses a future date with `notification_date_in_future`; the date field has that maximum and a future date in the URL opens today. Marking a shipment stays unchanged, so a delayed acknowledgment still records (FR-017). Tests: domain `notifications.test.ts`, server `notifications.test.ts`, e2e `notify-merchants.spec.ts`.
