# Feature Specification: Routes and Dispatch

**Feature Branch**: `002-routes-dispatch`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Rutas y despacho: el coordinador arma rutas del día agrupando envíos registrados por punto de recogida y zona tarifaria (típicamente 8 o 9 entregas sobre 2 o 3 recogidas), ordena las paradas arrastrándolas (recogidas y entregas intercaladas), asigna la ruta a un mensajero y la despacha para que le llegue a su app; puede quitar o agregar envíos, reordenar, reasignar un envío o una ruta completa a otro mensajero con motivo (incluso un envío ya recogido), y cancelar una ruta sin despachar. El tablero de despacho muestra las rutas del día con su mensajero, avance y envíos en riesgo o atrasados. Los envíos pasan de Registrado a Asignado y a En ruta según el ciclo de vida compartido. Sin optimización automática de rutas. Construye sobre la especificación 001 (specs/001-shipment-registration). Fuente: docs/business-master.md §7 y §12 (D-01, D-02, D-03, D-05) y docs/glossary.md."

Business context: [business master](../../docs/business-master.md) (§7 steps 3–4, §12 items
D-01–D-05). Vocabulary: [glossary](../../docs/glossary.md). Builds on
[feature 001](../001-shipment-registration/spec.md): shipments, the shared shipment lifecycle,
the dispatch board, couriers, roles, audit, and idempotent creation. UI terms appear in
Spanish between quotes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build a route and dispatch it (Priority: P1)

The dispatcher sees the shipments of the day that are not yet on a route ("Sin asignar"),
grouped by pickup point and rate zone. They select eight or nine, create a route, and the
system builds its stops: one pickup stop per pickup point with all the shipments collected
there, and one delivery stop per shipment. The dispatcher drags stops into the order the
courier will follow, assigns a courier, and dispatches the route, which releases it to that
courier.

**Why this priority**: it replaces grouping shipments by memory and sending lists by
WhatsApp (D-01, D-02). Without routes, couriers have nothing to execute in feature 003.

**Independent Test**: with nine registered shipments from three pickup points, create a
route, reorder its stops, assign a courier, dispatch it, and verify the shipments are "En
ruta", the route is "En curso" with its number, and every step is in the history.

**Acceptance Scenarios**:

1. **Given** nine shipments "Registrado" for today from three pickup points, **When** the
   dispatcher selects them and creates a route, **Then** the route is "En preparación" with
   three pickup stops (each listing its shipments) followed by nine delivery stops, and the
   nine shipments become "Asignado".
2. **Given** a route in preparation, **When** the dispatcher drags a delivery stop above the
   pickup stop of its own shipment, **Then** the move is refused with an explanation.
3. **Given** a route in preparation with a courier assigned, **When** the dispatcher
   dispatches it, **Then** the route becomes "En curso", its shipments become "En ruta", and
   the route is available to that courier.
4. **Given** a route without a courier, **When** the dispatcher tries to dispatch it,
   **Then** the system refuses and asks for a courier.
5. **Given** a reverse pickup, a carrier handoff, and an errand in the selection, **When**
   the route is created, **Then** the reverse pickup is collected at the recipient's address
   and delivered at the merchant's pickup point, the carrier handoff is delivered at its
   handoff place, and the errand is a single stop.
6. **Given** the dispatcher created a route but the response was lost, **When** they repeat
   the action, **Then** exactly one route exists.

---

### User Story 2 - Follow the routes of the day (Priority: P1)

On the dispatch board, the dispatcher and the owner see every route of the day with its
number, courier, status, progress (stops done out of total), COD amount to collect, and how
many of its shipments are at risk or late, plus the count of shipments still "Sin asignar".
Opening a route shows its stops in order with each shipment's status.

**Why this priority**: the dispatcher needs to know at a glance which couriers are out, how
far along they are, and what is still waiting (D-03, D-04).

**Independent Test**: dispatch two routes, mark some shipments as picked up and delivered
(through the means available), and verify the board shows each route's progress and flags
within 30 seconds, and the unassigned count.

**Acceptance Scenarios**:

1. **Given** two routes in progress and four shipments not on any route, **When** the
   dispatcher opens the board, **Then** it shows both routes with courier, progress, COD
   amount to collect, and flag counts, and "Sin asignar: 4".
2. **Given** a shipment on a route becomes "Entregado", **When** at most 30 seconds pass,
   **Then** the route's progress reflects it without a reload.
3. **Given** every shipment of a route is delivered, returned, voided, or in "Novedad",
   **Then** the route is shown as "Finalizada".
4. **Given** a route, **When** it is opened, **Then** its stops appear in order with address,
   neighborhood, shipments, delivery windows, and status.

---

### User Story 3 - Adjust a route (Priority: P2)

Requests keep arriving during the day. The dispatcher adds shipments to a route, removes
them, or reorders the remaining stops, both before and after the route is dispatched.

**Why this priority**: routes are released as they fill and change while couriers are out;
without adjustments the dispatcher would fall back to WhatsApp.

**Independent Test**: add a shipment to a dispatched route, remove another that has not been
picked up, reorder two pending stops, and verify statuses, stops, and history.

**Acceptance Scenarios**:

1. **Given** a route in progress, **When** the dispatcher adds a "Registrado" shipment,
   **Then** it joins the pending pickup stop of its pickup point (or a new one), gets a
   delivery stop at the end, and becomes "En ruta".
2. **Given** a shipment on a route that has not been picked up, **When** the dispatcher
   removes it, **Then** it returns to "Registrado", its stops disappear, and an empty
   pickup stop is removed.
3. **Given** a shipment already picked up, **When** the dispatcher tries to remove it,
   **Then** the system refuses and offers reassignment instead.
4. **Given** a stop already completed, **When** the dispatcher tries to move it, **Then**
   the move is refused; only pending stops can be reordered.
5. **Given** a shipment on a route is voided (feature 001), **Then** it leaves the route and
   its stops are updated.

---

### User Story 4 - Reassign to another courier (Priority: P2)

When a courier cannot continue (vehicle breakdown, overload), the dispatcher moves one
shipment, or the whole route, to another courier, stating the reason. A shipment that was
already picked up can be reassigned too, because couriers hand packages over in person.

**Why this priority**: it happens by phone today and leaves no trace of who had the package
(D-05); traceability of custody is what settles disputes.

**Independent Test**: reassign a picked-up shipment from one courier's route to another's
with a reason, then reassign a whole route, and verify the history shows who had each
shipment and when.

**Acceptance Scenarios**:

1. **Given** a shipment "En ruta" on courier A's route, **When** the dispatcher reassigns it
   to courier B's route with a reason, **Then** it leaves A's route, joins B's route with its
   pending stops, and the history records A, B, the reason, the author, and the time.
2. **Given** a shipment "Recogido" by courier A, **When** it is reassigned to courier B with
   a reason, **Then** it stays "Recogido", only its delivery stop is added to B's route, and
   the history records the change of custody.
3. **Given** a route in progress, **When** the dispatcher reassigns the whole route to
   courier B with a reason, **Then** every pending stop now belongs to B and completed stops
   keep A as the courier who did them.
4. **Given** a reassignment without a reason, **Then** it is refused.

---

### User Story 5 - Cancel a route in preparation (Priority: P3)

If a route was built by mistake, the dispatcher cancels it before dispatching.

**Why this priority**: a convenience; the same result can be reached by removing the
shipments one by one.

**Independent Test**: cancel a route in preparation with a reason and verify its shipments
are "Registrado" again and the route remains in history as "Cancelada".

**Acceptance Scenarios**:

1. **Given** a route in preparation, **When** the dispatcher cancels it with a reason,
   **Then** its shipments return to "Registrado" and the route is "Cancelada".
2. **Given** a route in progress, **When** the dispatcher tries to cancel it, **Then** the
   system refuses and explains that shipments must be removed or reassigned.

---

### Edge Cases

- **EC-01 Shipment already on another route**: adding it is refused; it can only be
  reassigned (FR-004, FR-014).
- **EC-02 Two dispatchers change the same route at once**: the second change is refused
  with a message to review the latest version (FR-021).
- **EC-03 Courier deactivated while having routes**: deactivation warns about the open
  routes; they stay with that courier until reassigned (FR-010).
- **EC-04 Courier already has a route in progress**: dispatching another is allowed with a
  warning (FR-009).
- **EC-05 Shipment edited while on a route**: if its pickup point or address changes, its
  stops are updated; from "Recogido" on it cannot be edited (FR-013; feature 001, FR-015).
- **EC-06 Pending shipment from a previous day**: it can be added to today's route and keeps
  its original service date (FR-003).
- **EC-07 Shipment in "Novedad" sent back for a new attempt** (feature 003): once it is
  "Registrado" again it can be added to any route (FR-003).
- **EC-08 Route left empty**: a route in preparation with no shipments can be cancelled; a
  route in progress with no pending shipments becomes "Finalizada" (FR-012, FR-017).
- **EC-09 Large selection**: creating or growing a route beyond 15 deliveries asks for
  confirmation (FR-005).
- **EC-10 Response lost and the user retries**: no second route and no repeated effect
  (FR-020).

## Requirements *(mandatory)*

### Functional Requirements

**Building routes**

- **FR-001**: The dispatcher and the owner MUST be able to see, for a service date, the
  shipments not on any route ("Sin asignar"), grouped by pickup point and by rate zone, with
  neighborhood, delivery window, COD amount, and flags.
- **FR-002**: They MUST be able to create a route for a service date from one or more
  selected shipments. The route gets a number that is unique within its service date, used
  to name it ("Ruta 3").
- **FR-003**: Only shipments in status "Registrado" can be added to a route, including
  shipments from earlier service dates, which keep their original date.
- **FR-004**: A shipment MUST belong to at most one route that is "En preparación" or "En
  curso" at any time.
- **FR-005**: The system MUST build the stops of a route: one pickup stop per distinct
  pickup address, listing the shipments collected there, and one delivery stop per shipment.
  For a reverse pickup, the pickup stop is the recipient's address and the delivery stop is
  the merchant's pickup point; for a carrier handoff, the delivery stop is the handoff
  place; an errand is a single stop. A route beyond 15 deliveries MUST ask for confirmation.
- **FR-006**: The dispatcher MUST be able to reorder stops by dragging them, and with the
  keyboard. A delivery stop MUST stay after the pickup stop of its shipment, and completed
  stops MUST NOT move.
- **FR-007**: There is no automatic route optimization: the system groups and lists, and the
  dispatcher decides the order.

**Assigning and dispatching**

- **FR-008**: The dispatcher MUST be able to set or change the courier of a route in
  preparation, choosing among active couriers by name or alias.
- **FR-009**: Dispatching a route MUST require a courier and at least one shipment. It sets
  the route to "En curso" and its shipments to "En ruta", and makes the route available to
  that courier (feature 003). If the courier already has a route in progress, the system
  MUST warn and allow it.
- **FR-010**: Deactivating a courier with routes in preparation or in progress MUST warn with
  their number; the routes stay assigned until the dispatcher reassigns them.

**Adjusting**

- **FR-011**: The dispatcher MUST be able to add shipments to a route in preparation or in
  progress. An added shipment joins the pending pickup stop of its pickup address if one
  exists, or gets a new pickup stop, and gets a delivery stop at the end; in a route in
  progress it becomes "En ruta" directly.
- **FR-012**: The dispatcher MUST be able to remove from a route a shipment that has not been
  picked up; it returns to "Registrado" and its stops are removed, together with a pickup
  stop left empty. A route in progress whose shipments are all delivered, returned, voided,
  in "Novedad", or removed becomes "Finalizada".
- **FR-013**: Voiding a shipment (feature 001) MUST remove it from its route in the same
  operation. Editing the pickup point or address of a shipment on a route MUST update its
  stops.

**Reassigning**

- **FR-014**: The dispatcher MUST be able to reassign a shipment that is "Asignado", "En
  ruta", or "Recogido" to another route of the same service date, with a reason of 5 to 200
  characters. A shipment not yet picked up moves with both stops; a shipment already picked
  up stays "Recogido" and only its delivery stop moves.
- **FR-015**: The dispatcher MUST be able to reassign a whole route in progress or in
  preparation to another courier with a reason. Pending stops pass to the new courier;
  completed stops keep the courier who did them.
- **FR-016**: Every reassignment MUST record the previous courier, the new courier, the
  reason, the author, and the time, in the history of the shipment and of the route.

**Cancelling**

- **FR-017**: The dispatcher MUST be able to cancel a route in preparation with a reason; its
  shipments return to "Registrado" and the route remains in history as "Cancelada". A route
  in progress cannot be cancelled. Routes are never deleted.

**Dispatch board**

- **FR-018**: The dispatch board MUST show, for the selected date, every route with its
  number, courier, status, progress (completed stops out of total), total COD amount to
  collect, and the number of its shipments at risk and late, plus the count of shipments
  "Sin asignar". Changes MUST appear within 30 seconds without a reload.
- **FR-019**: Opening a route MUST show its stops in order with address, neighborhood,
  shipments, delivery windows, and status, and the route's history.

**Integrity and access**

- **FR-020**: Creating a route MUST carry a client-generated identifier, so a repeated
  request never creates a second route; every other route action MUST have exactly one
  effect when repeated (feature 001, FR-042).
- **FR-021**: Concurrent changes to the same route MUST never overwrite each other silently.
- **FR-022**: Every route action (create, add, remove, reorder, set courier, dispatch,
  reassign, cancel) MUST be recorded with author and time in the route's history, and every
  shipment status change in the shipment's history with the route it refers to.
- **FR-023**: Only the owner and the dispatcher MUST be able to view and manage routes in the
  dispatch panel. A courier's access to their own routes is defined by feature 003.
- **FR-024**: All user-facing text MUST be in Spanish (Colombia) with the glossary's UI
  terms, and the interface MUST follow the design system (`docs/design-system.md`).

### Key Entities

- **Route**: work assigned to one courier for a service date. Number within the date,
  service date, courier, status ("En preparación", "En curso", "Finalizada", "Cancelada"),
  ordered stops, cancellation reason.
- **Stop**: a place in a route with a position and a kind. A pickup stop lists the shipments
  collected there; a delivery stop belongs to one shipment; an errand stop is the errand
  itself. A stop is pending or completed.
- **Route event**: an immutable record of an action on a route: type, author, time, changed
  values, reason, couriers involved.
- **Shipment lifecycle transitions implemented here** (shared lifecycle, feature 001):
  "Registrado" → "Asignado" (added to a route in preparation); "Asignado" → "Registrado"
  (removed, or route cancelled); "Asignado" → "En ruta" (route dispatched); "Registrado" →
  "En ruta" (added to a route in progress); "En ruta" → "Registrado" (removed before
  pickup).
- **Custody**: which courier is responsible for a shipment at each moment, derived from the
  route it is on and its reassignments.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A dispatcher builds, orders, assigns, and dispatches a route of nine shipments
  from three pickup points in under 2 minutes.
- **SC-002**: At any moment, 100 % of the day's shipments are either on exactly one active
  route, in a final status, or counted as "Sin asignar"; none is unaccounted for.
- **SC-003**: Route progress and flags on the dispatch board reflect any change within 30
  seconds.
- **SC-004**: A dispatcher reassigns a shipment to another courier in under 30 seconds.
- **SC-005**: For any shipment, the history answers "which courier had it, and when" for its
  whole life, with no gaps.
- **SC-006**: A dispatcher builds the day's routes without a separate list or spreadsheet.

## Assumptions

- Feature 001 is in place: shipments, shared lifecycle, dispatch board, couriers, roles,
  audit, and idempotent creation.
- Couriers see and execute dispatched routes in feature 003, which also marks stops as
  completed and tells the courier when a dispatched route changed. Until then, stops are
  completed only through the means feature 003 provides.
- A courier may have several routes on the same day, including more than one in progress
  (routes are released as they fill); the system warns but does not block.
- A route belongs to one service date; shipments pending from earlier dates can join it.
- Handing a picked-up package from one courier to another happens in person; the system
  records the reassignment, not the physical handover.
- The 15-delivery confirmation threshold is a guard against selection mistakes; typical
  routes have 8–9 deliveries over 2–3 pickups.
- Finance (COD cash-up per route) is Phase 2; this feature only shows the total to collect.
