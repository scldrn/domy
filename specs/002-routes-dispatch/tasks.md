---

description: "Task list for Routes and Dispatch"
---

# Tasks: Routes and Dispatch

**Input**: Design documents from `/specs/002-routes-dispatch/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Depends on**: every task of [feature 001](../001-shipment-registration/tasks.md) (foundation,
shipments, dispatch board, couriers, roles, audit, `lib/action-id.ts`)

**Tests**: REQUIRED (Constitution VI). In every phase, test tasks come first and MUST fail
before their implementation tasks start. Integration tests run against real PostgreSQL.

**Organization**: tasks are grouped by user story so each story can be implemented, tested,
and demonstrated on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story the task belongs to (US1–US5)
- Every description includes the exact file path

## Path Conventions

Monorepo defined in feature 001's plan: `apps/server/`, `apps/web/`, `packages/domain/`.
English kebab-case file names; Spanish URLs mapped in `apps/web/src/routes.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: the only new dependency of this feature

- [X] T001 Add `@dnd-kit/core` and `@dnd-kit/sortable` to `apps/web/package.json` and record them in the dependency list of `README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: route rules, database tables, and test helpers that every user story needs

**⚠️ CRITICAL**: no user story work can begin until this phase is complete

### Tests first

- [X] T002 [P] Extend `packages/domain/src/shipment-lifecycle.test.ts` with the transitions owned by this feature (data-model.md §Shipment lifecycle): `registered → assigned`, `registered → dispatched`, `assigned → registered`, `assigned → dispatched`, `dispatched → registered`, `dispatched → assigned`; and refusal of each from `picked_up` on
- [X] T003 [P] Write failing unit tests in `packages/domain/src/routes.test.ts` for `buildStops` (FR-005): one pickup stop per pickup place (same pickup point, or same one-off address and neighborhood), one delivery stop per shipment even at the same place, reverse pickup (pickup at the recipient, delivery at the merchant's pickup point), carrier handoff (delivery at the handoff place), errand (single stop), initial order "pickup stops first, then delivery stops, each in the order the shipments were selected"
- [X] T004 Write failing unit tests in `packages/domain/src/routes.test.ts` for `addShipmentToStops` (joins the pending pickup stop of its place, otherwise a new pickup stop at the end immediately before the new delivery stop, FR-011), `removeShipmentFromStops` (removes its pending tasks and a pickup stop left empty, FR-012), `moveStop` and `validateStopOrder` (a delivery stop stays after the pickup stop of its shipment; errand stops unconstrained; completed stops do not move, FR-006)
- [X] T005 Write failing unit tests in `packages/domain/src/routes.test.ts` for `isRouteFinished` (no `pending` task and no `pending` handover, FR-012), `routeProgress` (stops with no pending task ÷ total stops, whatever their position, FR-007), and `canUndoDispatch` (no task `completed` or `failed` and no shipment `picked_up`, FR-026)

### Domain

- [X] T006 Extend `packages/domain/src/shipment-lifecycle.ts` with this feature's transitions until T002 passes
- [X] T007 Implement `packages/domain/src/routes.ts` (`buildStops`, `addShipmentToStops`, `removeShipmentFromStops`, `moveStop`, `validateStopOrder`, `isRouteFinished`, `routeProgress`, `canUndoDispatch`, route status and task status labels in Spanish) until T003–T005 pass
- [X] T008 [P] Create `packages/domain/src/schemas/routes.ts`: `RouteCreateInput` (`id`, `actionId`, `serviceDate`, `shipmentIds`, optional `courierId`, optional `confirmed`), `RouteDetail`, `RouteSummary`, `RoutesBoard`, `Stop`, `Task`, `RouteEvent`, `Handover`, `UnassignedShipment`, action inputs with `actionId` and `version`, and reasons of 5–200 characters (FR-016)

### Database

- [X] T009 [P] Define `routes`, `route_stops`, `route_tasks`, `handovers`, `route_events` and their enums in `apps/server/src/db/schema/routes.ts` per data-model.md, including: unique `(service_date, number)`; partial unique index on `(courier_id) WHERE status = 'in_progress'`; checks "`status in ('in_progress', 'finished') ⇒ courier_id is not null`" and "`status = 'cancelled' ⇔ cancel_reason is not null`"; `position` unique with `route_id` (deferrable); partial unique index on `route_tasks (shipment_id, kind) WHERE status = 'pending'`; check "`blocked_by_handover_id is null or status = 'pending'`"; partial unique index on `handovers (shipment_id) WHERE status = 'pending'`; `route_events.client_event_id` unique and optional
- [X] T010 [P] Extend `apps/server/src/db/schema/shipments.ts`: `shipments.route_id`, `shipments.custody_courier_id`, the checks "`status = 'registered' ⇒ route_id is null`" and "`status in ('assigned', 'dispatched') ⇒ route_id is not null`", `shipment_events.route_id`, and the values `reassigned`, `handover_confirmed`, `handover_cancelled` in `shipment_event_type`
- [X] T011 Generate and review the migration for T009–T010 in `apps/server/src/db/migrations/`
- [X] T012 Create `apps/server/tests/setup/routes.ts`: helpers to create a route with shipments through the API, and a test-only helper that sets a task's status and a shipment's `picked_up` status directly, standing in for feature 003

### Skeleton

- [X] T013 Create `apps/server/src/routes/routes.ts` and `apps/server/src/routes/handovers.ts` mounted in `apps/server/src/app.ts` under `/api/routes` and `/api/handovers` with `requireRole('owner', 'dispatcher')` (FR-023) and the error codes of contracts/http-api.md added to `apps/server/src/lib/errors.ts`
- [X] T014 Register `/rutas` and `/rutas/$routeId` in `apps/web/src/routes.ts`, create the empty pages `apps/web/src/routes/routes-board.tsx` and `apps/web/src/routes/route-detail.tsx`, and add the "Rutas" item to the panel navigation in `apps/web/src/routes/panel-layout.tsx`

**Note**: `route_stops (route_id, position)` is a plain unique constraint: a reorder first
moves every position out of the way and then writes the final ones in the same transaction,
which gives the effect the data model asked of a deferrable constraint without one.
Feature 001's lifecycle already declared this feature's transitions, so T002 and T006 added
a focused test only.

**Checkpoint**: `pnpm check` and `pnpm test` pass; the "Rutas" page opens empty

---

## Phase 3: User Story 1 - Build a route and dispatch it (Priority: P1) 🎯 MVP

**Goal**: build a route from unassigned shipments, order its stops, assign a courier, and
dispatch it

**Independent Test**: with nine registered shipments from three pickup points, create a
route, reorder its stops, assign a courier, dispatch it, and verify statuses, route number,
and history

### Tests for User Story 1 ⚠️ write first, must fail

- [X] T015 [P] [US1] Integration tests in `apps/server/tests/shipments-unassigned.test.ts` (FR-001): only `registered` shipments with `service_date ≤` the date, with pickup point, rate zone, neighborhood, delivery window, COD amount, and flags; filters by rate zone and merchant
- [X] T016 [P] [US1] Integration tests in `apps/server/tests/routes-create.test.ts` covering spec US1 scenarios 1, 5, 6, 9: stops built per FR-005, shipments become `assigned`, route number unique per service date, `422 past_service_date`, the date rule of FR-003, `409 shipment_not_registered` for a shipment already on a route, `422 confirmation_required` beyond 15 shipments, two simultaneous creations that include the same shipment leave it on exactly one route (FR-004), a repeated create with the same `id` yields one route (FR-020), `created` event with author and time (FR-002, FR-022)
- [X] T017 [P] [US1] Integration tests in `apps/server/tests/routes-order-courier.test.ts` covering spec US1 scenarios 2 and 8 at the API level: `PUT /stop-order` accepts a valid order, returns `409 invalid_stop_order` for a delivery before its pickup and for a moved completed stop, `409 version_conflict` on a stale version, a repeated `actionId` has no second effect; `PATCH` sets and changes the courier of a route in preparation without a reason and records it (FR-006, FR-008, FR-021)
- [X] T018 [P] [US1] Integration tests in `apps/server/tests/routes-dispatch.test.ts` covering spec US1 scenarios 3, 4, 7: route `in_progress`, shipments `dispatched`, `dispatched` event; `422 courier_required`; `422 route_empty` for a route with no shipments; `409 courier_busy` with the current route number, including a route in progress from an earlier day and two simultaneous dispatches to the same courier (FR-009)
- [X] T019 [P] [US1] End-to-end test in `apps/web/tests/e2e/route-build-dispatch.spec.ts`: quickstart scenarios 1–5, including reordering with the keyboard only

### Implementation for User Story 1

- [X] T020 [US1] Implement `GET /api/shipments/unassigned` in `apps/server/src/routes/shipments.ts` until T015 passes
- [X] T021 [US1] Implement `POST /api/routes` and `GET /api/routes/:id` in `apps/server/src/routes/routes.ts` (one transaction: exactly-once check, route number, `buildStops`, shipment transitions with `shipment_events.route_id`, `route_events`), loading and saving the route through `apps/server/src/lib/route-store.ts`, until T016 passes
- [X] T022 [US1] Implement `PATCH /api/routes/:id` and `PUT /api/routes/:id/stop-order` in `apps/server/src/routes/routes.ts` until T017 passes
- [X] T023 [US1] Implement `POST /api/routes/:id/dispatch` in `apps/server/src/routes/routes.ts` (maps the partial unique index violation to `409 courier_busy`) until T018 passes
- [X] T024 [P] [US1] Build `apps/web/src/features/routes/unassigned-list.tsx`: shipments grouped by pickup point, ordered by rate zone and neighborhood, filters by rate zone and merchant, multi-selection, flags, and the empty state of FR-027
- [X] T025 [P] [US1] Build `apps/web/src/features/routes/stop-list.tsx` with dnd-kit: sortable stops, keyboard sensor with Spanish announcements, moves validated with `validateStopOrder` before sending, completed stops locked
- [X] T026 [P] [US1] Build `apps/web/src/features/routes/courier-select.tsx` (active couriers by name or alias, with the empty state "no active couriers")
- [X] T027 [US1] Build the route page `apps/web/src/routes/route-detail.tsx`: create a route from the selection (client-generated `id`, confirmation beyond 15 shipments), stops in order with address, neighborhood, shipments, delivery windows, and status (FR-019), courier, "Despachar", the `courier_busy` message offering to add the shipments to the current route, the conflict message that keeps the selection (FR-021), until T019 passes

### Alignment for User Story 1 (analysis of 2026-10-13, constitution 2.0.0)

- [X] T057 [US1] Declare the 15-shipment confirmation threshold of FR-005 once, in `packages/domain/src/routes.ts`, and use it in `apps/server/src/routes/routes.ts` and `apps/web/src/routes/routes-board.tsx` in place of their own constants (Constitution III); the confirmation cases of T016 and T019 keep passing
- [X] T058 [US1] Bring the route screens to `docs/design-system.md` (FR-024, Constitution VII): `PageHeader` with the page's actions (§8), the empty states of FR-027 with `EmptyState` (§8), sheets and data tables (§7), the supporting pane layout for route building (§5), and the route state mark in a new `apps/web/src/components/route-status-mark.tsx` (§3.3, §8), across `apps/web/src/routes/routes-board.tsx`, `apps/web/src/routes/route-detail.tsx`, and `apps/web/src/features/routes/*`, until T019 and its accessibility audit pass

**Checkpoint**: a route can be built, ordered, assigned, and dispatched

---

## Phase 4: User Story 2 - Follow the routes of the day (Priority: P1)

**Goal**: every route of the day on the dispatch board with progress, amounts, and flags

**Independent Test**: dispatch two routes, complete some tasks through the test helper, and
verify progress, flags, and the unassigned count within 30 seconds

### Tests for User Story 2 ⚠️ write first, must fail

- [X] T028 [P] [US2] Integration tests in `apps/server/tests/routes-board.test.ts` covering spec US2 scenarios 1–6: summary fields (number, courier, status, completed and total stops, COD to collect as the sum of the route's shipments, at-risk and late counts, pending handovers), `unassignedCount`, progress when stops are completed out of order, automatic `finished` when no task and no handover is pending, routes in progress from earlier dates under `routesFromPreviousDays`, `serverTime`; and `routeId` and `routeNumber` on each shipment of `GET /api/shipments/board` (FR-012, FR-018)
- [X] T029 [P] [US2] End-to-end test in `apps/web/tests/e2e/routes-board.spec.ts`: quickstart scenarios 6–8 (board content, change visible within 30 seconds in a second browser, "Rutas de días anteriores" with the fake clock)

### Implementation for User Story 2

- [X] T030 [US2] Implement `GET /api/routes/board` in `apps/server/src/routes/routes.ts` and the status recalculation used by every transaction that changes a task (`isRouteFinished` → `finished` with a `finished` event) in `apps/server/src/lib/route-status.ts`, and add `routeId`, `routeNumber`, and `courier` to `BoardShipment` (with the `courierId` filter of 001 FR-023 in `filterBoard`, `packages/domain/src/dispatch-board.ts`) in `packages/domain/src/schemas/board.ts` and to `GET /api/shipments/board` in `apps/server/src/routes/shipments.ts`, until T028 passes
- [X] T031 [P] [US2] Build `apps/web/src/features/routes/route-summary-card.tsx` (number, courier, status, progress, "Valor a recaudar", at-risk, late, and pending handover counts)
- [X] T032 [US2] Build `apps/web/src/routes/routes-board.tsx` (`/rutas`): routes of the date, "Rutas de días anteriores", "Sin asignar" with its count, polling every 20 seconds, empty states (FR-027); and add the courier and route number column to `apps/web/src/features/board/board-table.tsx` and the courier filter to `apps/web/src/features/board/board-filters.tsx` (feature 001, FR-021 and FR-023), until T029 passes

**Checkpoint**: User Stories 1 and 2 give the dispatcher the routes of the day at a glance

---

## Phase 5: User Story 3 - Adjust a route (Priority: P2)

**Goal**: add, remove, and reorder before and after dispatch, staying consistent with voiding
and editing shipments

**Independent Test**: add a shipment to a dispatched route, remove another not yet picked up,
reorder two pending stops, and verify statuses, stops, and history

### Tests for User Story 3 ⚠️ write first, must fail

- [X] T033 [P] [US3] Integration tests in `apps/server/tests/routes-adjust.test.ts` covering spec US3 scenarios 1–5: added shipment joins the pending pickup stop or gets a new one at the end before its delivery stop; status `assigned` in a draft route and `dispatched` in one in progress; removal returns the shipment to `registered`, deletes its pending tasks and an empty pickup stop; adding is refused with `409 shipment_not_registered` for a shipment already on a route or dated after the rule of FR-003, and with `422 confirmation_required` when the route grows beyond 15 shipments; `409 shipment_picked_up`; `409 shipment_not_movable` for a shipment in "Novedad"; voiding a shipment removes it from its route in the same transaction; editing its pickup point or address updates its stops; the last removal finishes a route in progress; every action recorded and exactly-once (FR-003, FR-005, FR-011, FR-012, FR-013, FR-020, FR-022)
- [X] T034 [P] [US3] End-to-end test in `apps/web/tests/e2e/route-adjust.spec.ts`: quickstart scenarios 9–10

### Implementation for User Story 3

- [X] T035 [US3] Implement `POST /api/routes/:id/shipments` and `POST /api/routes/:id/shipments/:shipmentId/remove` in `apps/server/src/routes/routes.ts` until T033 passes for adding and removing
- [X] T036 [US3] Update `POST /api/shipments/:id/void` and `PATCH /api/shipments/:id` in `apps/server/src/routes/shipments.ts` to remove the shipment from its route or update its stops in the same transaction, until T033 passes
- [X] T037 [US3] Add "Agregar envíos" (from the unassigned list, in `apps/web/src/features/routes/add-shipments-dialog.tsx`) and "Quitar de la ruta" (on the stops of `apps/web/src/features/routes/stop-list.tsx`) to `apps/web/src/routes/route-detail.tsx`, until T034 passes

**Checkpoint**: routes follow the day's changes without leaving the system

---

## Phase 6: User Story 4 - Reassign to another courier (Priority: P2)

**Goal**: move shipments or whole routes between couriers with a reason, with confirmed
handovers for packages already picked up

**Independent Test**: reassign a picked-up shipment to another courier's route, confirm the
handover, reassign a whole route, and verify the history shows who had each shipment and when

### Tests for User Story 4 ⚠️ write first, must fail

- [ ] T038 [P] [US4] Integration tests in `apps/server/tests/shipments-reassign.test.ts` covering spec US4 scenarios 1, 2, 6 and FR-014: a shipment not picked up moves with both stops and takes the target route's status; a picked-up shipment moves only to a route in progress (`409 route_not_in_progress` otherwise) and only with its delivery stop; same courier → no handover; another courier → pending handover; `409 shipment_not_movable` for a shipment in "Novedad" or in a final status; reason of 5–200 characters required; the `version` of both routes increments; `reassigned` events in the shipment and both routes with previous courier, new courier, reason, author, and time (FR-016)
- [ ] T039 [P] [US4] Integration tests in `apps/server/tests/handovers.test.ts` covering spec US4 scenarios 3, 4 and FR-025: custody stays with the previous courier while pending; the blocked delivery task cannot be completed (the database check refuses it); confirmation by owner or dispatcher sets `resolved_on_behalf`, moves custody, and unblocks the task; cancellation returns the delivery task to the previous route; a courier cannot cancel; one pending handover per shipment; moving the shipment again cancels the pending handover and creates a new one from the courier in custody; events recorded
- [ ] T040 [P] [US4] Integration tests in `apps/server/tests/routes-reassign.test.ts` covering spec US4 scenario 5 and FR-015: pending stops pass to the new courier, completed tasks keep `completed_by_courier_id`, picked-up shipments get pending handovers, `409 courier_busy` when the new courier has a route in progress, `409 route_not_in_progress` for a route in preparation; and FR-010: deactivating a courier returns `openRoutes`
- [ ] T041 [P] [US4] Integration test in `apps/server/tests/custody-history.test.ts` (SC-005): for a shipment picked up, handed over twice, and delivered, the ordered custody events leave no interval without a responsible courier
- [ ] T042 [P] [US4] End-to-end test in `apps/web/tests/e2e/route-reassign.spec.ts`: quickstart scenarios 11–13

### Implementation for User Story 4

- [ ] T043 [US4] Implement `POST /api/shipments/:id/reassign` in `apps/server/src/routes/shipments.ts` until T038 passes
- [ ] T044 [US4] Implement `POST /api/handovers/:id/confirm` and `POST /api/handovers/:id/cancel` in `apps/server/src/routes/handovers.ts` until T039 passes
- [ ] T045 [US4] Implement `POST /api/routes/:id/reassign` in `apps/server/src/routes/routes.ts` and add `openRoutes` to the courier deactivation response in `apps/server/src/routes/couriers.ts`, until T040 and T041 pass
- [ ] T046 [P] [US4] Build `apps/web/src/features/routes/reassign-dialog.tsx` (target route or courier, reason) and `apps/web/src/features/routes/handover-badge.tsx` ("Traspaso pendiente" with confirm-on-behalf and cancel); and show the open-routes warning when a courier is deactivated in `apps/web/src/features/master-data/couriers/` (FR-010)
- [ ] T047 [US4] Build `apps/web/src/features/routes/route-history.tsx` (route events and the custody history of a shipment) and wire reassignment into `apps/web/src/routes/route-detail.tsx` and the shipment detail `apps/web/src/features/shipments/shipment-detail.tsx`, until T042 passes

**Checkpoint**: custody of every package is traceable

---

## Phase 7: User Story 5 - Cancel a route or undo a dispatch (Priority: P3)

**Goal**: correct routes built or dispatched by mistake

**Independent Test**: cancel a route in preparation with a reason; undo a dispatch with
nothing picked up; verify statuses and history

### Tests for User Story 5 ⚠️ write first, must fail

- [ ] T048 [P] [US5] Integration tests in `apps/server/tests/routes-cancel-undo.test.ts` covering spec US5 scenarios 1–4: cancel in preparation with a reason → shipments `registered`, route `cancelled` keeping its number; `409 route_in_progress` when cancelling a route in progress; undo dispatch → route `draft`, shipments `assigned`, courier free for another route; `409 route_has_completed_stops` with a completed task or a picked-up shipment, including one received through a handover (FR-017, FR-026)
- [ ] T049 [P] [US5] End-to-end test in `apps/web/tests/e2e/route-cancel-undo.spec.ts`: quickstart scenarios 14–15

### Implementation for User Story 5

- [ ] T050 [US5] Implement `POST /api/routes/:id/cancel` and `POST /api/routes/:id/undo-dispatch` in `apps/server/src/routes/routes.ts` until T048 passes
- [ ] T051 [US5] Add "Cancelar ruta" and "Deshacer despacho" with their reason dialogs to `apps/web/src/routes/route-detail.tsx`, until T049 passes

**Checkpoint**: all five user stories work independently

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T052 [P] Extend `apps/server/tests/role-permissions.test.ts` with every endpoint of contracts/http-api.md: owner and dispatcher allowed, courier refused; no `DELETE` route registered (FR-023)
- [ ] T053 [P] Add the invariant test `apps/server/tests/routes-invariants.test.ts` (SC-002): after a random sequence of route actions by two users, every shipment not in a final status is either unassigned or on exactly one route in preparation or in progress, and no courier has two routes in progress; every action of the sequence is sent twice with the same `actionId` and has exactly one effect, and a stale `version` is always refused with `409 version_conflict` (FR-020, FR-021)
- [ ] T054 [P] Cover in the route end-to-end tests what the automatic WCAG 2.2 AA audit of `apps/web/tests/e2e/fixtures.ts` does not: keyboard-only reordering of stops and use at 600 px wide, and at least one passing test ending on each route screen so the audit reaches it (FR-024)
- [ ] T055 Run every scenario of `specs/002-routes-dispatch/quickstart.md` (1–16) and record the results in `specs/002-routes-dispatch/quickstart-results.md`
- [ ] T056 Confirm `pnpm check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` pass with zero warnings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** and **Foundational (Phase 2)**: after feature 001 is complete; they
  block every user story
- **User Stories (Phases 3–7)**: depend on Foundational
- **Polish (Phase 8)**: after the user stories

### User Story Dependencies

- **US1 (P1)**: after Foundational
- **US2 (P1)**: after US1 (needs routes and dispatch to show)
- **US3 (P2)**: after US1 and T030 (`lib/route-status.ts`)
- **US4 (P2)**: after US1 and T030; T039 and T041 use the test helper of T012 to mark pickups
- **US5 (P3)**: after US1 and T030

US3, US4, and US5 are independent of each other.

### Within Each User Story

- Tests first, failing; then server endpoints; then web screens
- A story is complete when its end-to-end test passes

### Parallel Opportunities

- Foundational: T002 and T003 together (T004 and T005 extend the same test file, in order); T008–T010 together
- US1: T015–T019 together; T024–T026 together; T057 before T058 (both edit `routes-board.tsx`)
- After US1: US2; after T030: US3, US4, and US5 in parallel
- Polish: T052–T054 together

---

## Parallel Example: User Story 1

```bash
# Tests first, together:
Task: "Integration tests in apps/server/tests/routes-create.test.ts"
Task: "Integration tests in apps/server/tests/routes-order-courier.test.ts"
Task: "Integration tests in apps/server/tests/routes-dispatch.test.ts"

# Then the web components, together:
Task: "Build apps/web/src/features/routes/unassigned-list.tsx"
Task: "Build apps/web/src/features/routes/stop-list.tsx"
Task: "Build apps/web/src/features/routes/courier-select.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 and 2)

1. Phases 1–2: dependency, route rules, tables
2. Phase 3: build and dispatch a route
3. Phase 4: routes on the dispatch board

### Incremental Delivery

1. US1 + US2 → routes replace WhatsApp lists
2. US3 → adjustments during the day
3. US4 → reassignment with custody
4. US5 → cancel and undo
5. Polish

Implementation starts only after features 003 and 004 have their own spec, plan, tasks, and
analysis (decision #35 in the business master).

### Delivery under Trunk-Based Development (constitution 2.0.0)

Each slice lands on `main` through its own short-lived branch and pull request:

| Branch | Tasks |
| --- | --- |
| `002-us1-routes` | Phases 1–3, including T057–T058 |
| `002-us2-routes-board` | Phase 4 |
| `002-us3-adjust-route` | Phase 5 |
| `002-us4-reassign` | Phase 6 |
| `002-us5-cancel-undo` | Phase 7 |
| `002-polish` | Phase 8 |

A story that would take more than two days splits into a tests-and-server branch and a web
branch. A story's entry point lands with its last slice, so unfinished work stays
unreachable: T032 (the routes board), T037 ("Agregar envíos", "Quitar de la ruta"), T047
(reassignment), and T051 ("Cancelar ruta", "Deshacer despacho"). T014's navigation item
landed together with User Story 1, in the same branch.

---

## Notes

- [P] tasks touch different files and have no unfinished dependencies
- Several tasks edit `apps/server/src/routes/routes.ts` and
  `apps/web/src/routes/route-detail.tsx`; they are sequential on purpose
- Verify each test fails before implementing; commit after each task or logical group
- Every task must leave `pnpm check` clean
