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

## Clarifications

### Session 2026-09-30

- Q: When the day ends and a route in progress still has shipments not delivered, what happens to that route the next day? → A: It stays "En curso" until all its shipments are resolved, and appears on the next day's board in a "Rutas de días anteriores" section, where the dispatcher can remove or reassign shipments.
- Q: Can a courier have more than one route in progress at the same time? → A: No. One route in progress per courier; more work is added to the current route, and a new route can be dispatched to that courier only when the previous one is finished.
- Q: When a picked-up shipment is reassigned, must the receiving courier confirm they have the package? → A: Yes. The shipment stays in the previous courier's custody as "Traspaso pendiente" until the new courier confirms receipt in their app; the board shows unconfirmed handovers.
- Q: After dispatch, must the courier follow the stops in the dispatcher's exact order? → A: No. The order is a recommendation: the courier sees the stops in that order but may complete any pending stop; only the dispatcher reorders the list.
- Q: If a route was dispatched by mistake and nothing has been picked up, can the dispatcher undo the dispatch at once? → A: Yes. While no stop is completed, the dispatcher can return the route to "En preparación" with a reason; its shipments return to "Asignado" and the route leaves the courier's app.

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
7. **Given** courier A already has a route in progress, **When** the dispatcher tries to
   dispatch another route to A, **Then** the system refuses and offers to add the shipments
   to A's current route or to keep the new route in preparation.
8. **Given** a route in preparation, **When** the dispatcher moves a stop using only the
   keyboard, **Then** the stop changes position under the same rules as dragging.
9. **Given** a selection of 16 shipments, **When** the dispatcher creates the route, **Then**
   the system asks for confirmation before creating it.

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
5. **Given** a courier completes the fourth stop before the second, **Then** the route shows
   those stops as completed and the second stop still pending in its position.
6. **Given** a route dispatched yesterday with two shipments still not delivered, **When**
   the dispatcher opens today's board, **Then** the route appears under "Rutas de días
   anteriores", still "En curso", with its courier and pending shipments.

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
   a reason, **Then** it stays "Recogido", its delivery stop is added to B's route marked
   "Traspaso pendiente", and A remains responsible for it.
3. **Given** a shipment with "Traspaso pendiente" to courier B, **When** B confirms receipt
   (or the dispatcher confirms it on B's behalf), **Then** custody passes to B and the
   history records who handed it over, who received it, and when.
4. **Given** a handover still pending, **When** the dispatcher cancels it, **Then** the
   delivery stop returns to courier A's route.
5. **Given** a route in progress, **When** the dispatcher reassigns the whole route to
   courier B with a reason, **Then** every pending stop now belongs to B, completed stops
   keep A as the courier who did them, and shipments A had already picked up are "Traspaso
   pendiente" until B confirms them.
6. **Given** a reassignment without a reason, **Then** it is refused.

---

### User Story 5 - Cancel a route or undo a dispatch (Priority: P3)

If a route was built by mistake, the dispatcher cancels it before dispatching. If it was
dispatched by mistake and the courier has not picked anything up, the dispatcher undoes the
dispatch in one action.

**Why this priority**: a convenience; the same result can be reached by removing the
shipments one by one.

**Independent Test**: cancel a route in preparation with a reason and verify its shipments
are "Registrado" again and the route remains in history as "Cancelada".

**Acceptance Scenarios**:

1. **Given** a route in preparation, **When** the dispatcher cancels it with a reason,
   **Then** its shipments return to "Registrado" and the route is "Cancelada".
2. **Given** a route in progress, **When** the dispatcher tries to cancel it, **Then** the
   system refuses and explains that shipments must be removed or reassigned, or the dispatch
   undone if nothing has been picked up.
3. **Given** a route in progress with no completed stop, **When** the dispatcher undoes the
   dispatch with a reason, **Then** the route returns to "En preparación", its shipments
   return to "Asignado", and it is no longer available to the courier.
4. **Given** a route in progress with at least one completed stop, **When** the dispatcher
   tries to undo the dispatch, **Then** the system refuses.

---

### Edge Cases

- **EC-01 Shipment already on another route**: adding it is refused; it can only be
  reassigned (FR-004, FR-014).
- **EC-02 Two dispatchers change the same route at once**: the second change is refused
  with a message to review the latest version (FR-021).
- **EC-03 Courier deactivated while having routes**: deactivation warns about the open
  routes; they stay with that courier until reassigned (FR-010).
- **EC-04 Courier already has a route in progress**: dispatching another to them is
  refused; shipments are added to the current route, or the new route waits in preparation
  (FR-009). This includes a route of an earlier day that is still in progress.
- **EC-05 Shipment edited while on a route**: if its pickup point or address changes, its
  stops are updated; from "Recogido" on it cannot be edited (FR-013; feature 001, FR-015).
- **EC-06 Pending shipment from a previous day**: it can be added to today's route and keeps
  its original service date (FR-003).
- **EC-07 Shipment in "Novedad" sent back for a new attempt** (feature 003): once it is
  "Registrado" again it can be added to any route (FR-003).
- **EC-08 Route left empty**: a route in preparation with no shipments can be cancelled; a
  route in progress with no pending shipments becomes "Finalizada" (FR-012, FR-017).
- **EC-09 Large selection**: creating or growing a route beyond 15 shipments asks for
  confirmation (FR-005).
- **EC-10 Response lost and the user retries**: no second route and no repeated effect
  (FR-020).
- **EC-11 Route not finished at the end of the day**: it stays "En curso" and is listed the
  next day under "Rutas de días anteriores" (FR-018).
- **EC-12 Handover never confirmed**: the shipment stays in the previous courier's custody
  and is counted on the board until it is confirmed or cancelled (FR-018, FR-025).
- **EC-13 Route dispatched by mistake**: while nothing has been picked up, the dispatch can
  be undone in one action (FR-026).
- **EC-14 Shipment moved again while its handover is pending**: the pending handover is
  cancelled and a new one starts from the courier who holds the package (FR-025).
- **EC-15 Picked-up shipment and a route in preparation**: it cannot be moved there, because
  the route may have no courier to receive it (FR-014).
- **EC-16 Nothing to show**: no unassigned shipments, no routes, or no active couriers
  produce a clear message with the next action (FR-027).

## Requirements *(mandatory)*

### Functional Requirements

**Building routes**

- **FR-001**: The dispatcher and the owner MUST be able to see, for a service date, the
  shipments not on any route ("Sin asignar"), grouped by pickup point and, inside each
  group, ordered by rate zone and neighborhood, with delivery window, COD amount, and
  flags. The list MUST be filterable by rate zone and by merchant.
- **FR-002**: They MUST be able to create a route for today or a future service date, never
  a past one, from one or more selected shipments. The route gets a number that is unique
  within its service date, used to name it ("Ruta 3"); a cancelled route keeps its number.
- **FR-003**: Only shipments in status "Registrado" can be added to a route, and only when
  their service date is not later than the later of the route's service date and today.
  Example: a shipment dated yesterday can join today's route; a shipment dated tomorrow
  cannot. Shipments keep their own service date.
- **FR-004**: A shipment MUST belong to at most one route that is "En preparación" or "En
  curso" at any time, even when two users act at the same moment.
- **FR-005**: The system MUST build the stops of a route:
  - one pickup stop per distinct pickup place, listing the shipments collected there; two
    shipments share a pickup stop when they have the same pickup point, or the same one-off
    address and neighborhood;
  - one delivery stop per shipment, even when several deliveries go to the same place;
  - for a reverse pickup, the pickup stop is the recipient's address and the delivery stop
    is the merchant's pickup point; for a carrier handoff, the delivery stop is the handoff
    place; an errand is a single stop.

  A new route starts with its pickup stops first, then its delivery stops, each in the order
  in which the shipments were selected. Creating or growing a route beyond 15 shipments MUST
  ask for confirmation.
- **FR-006**: In a route "En preparación" or "En curso", the dispatcher MUST be able to
  reorder stops by dragging them and with the keyboard. A delivery stop MUST stay after the
  pickup stop of its shipment (this includes reverse pickups); errand stops have no ordering
  constraint; completed stops MUST NOT move. An invalid move is refused with an explanation.
- **FR-007**: There is no automatic route optimization: the system groups and lists, and the
  dispatcher decides the order. The order is a recommendation for the courier, who may
  complete any pending stop (feature 003); only the dispatcher and the owner reorder stops.
  Progress counts completed stops, whatever their position.

**Assigning and dispatching**

- **FR-008**: The dispatcher MUST be able to set or change the courier of a route in
  preparation, choosing among active couriers by name or alias. No reason is required; the
  change is recorded.
- **FR-009**: Dispatching a route MUST require a courier and at least one shipment. It sets
  the route to "En curso" and its shipments to "En ruta", and makes the route available to
  that courier (feature 003). A courier MUST have at most one route in progress at a time,
  counting routes of earlier service dates, even when two users act at the same moment:
  dispatching a second one is refused, and the dispatcher either adds the shipments to the
  current route or leaves the new route in preparation. A courier may have any number of
  routes in preparation.
- **FR-010**: Deactivating a courier with routes in preparation or in progress MUST warn with
  their number; the routes stay assigned until the dispatcher reassigns them.

**Adjusting**

- **FR-011**: The dispatcher MUST be able to add shipments to a route in preparation or in
  progress. An added shipment joins the pending pickup stop of its pickup place if one
  exists; otherwise it gets a new pickup stop placed at the end, immediately before its new
  delivery stop, which is placed last. In a route in progress it becomes "En ruta"
  directly.
- **FR-012**: The dispatcher MUST be able to remove from a route a shipment that has not been
  picked up; it returns to "Registrado" and its stops are removed, together with a pickup
  stop left empty. A route in progress becomes "Finalizada" when every one of its shipments
  is delivered, returned, voided, in "Novedad", or removed, and it has no handover pending.
  A route that is "Finalizada" or "Cancelada" never reopens: a shipment sent back for a new
  attempt joins another route.
- **FR-013**: Voiding a shipment (feature 001) MUST remove it from its route in the same
  operation. Editing the pickup point or address of a shipment on a route MUST update its
  stops.

**Reassigning**

- **FR-014**: The dispatcher MUST be able to move a shipment that is "Asignado", "En ruta",
  or "Recogido" to another route, of the same or of another courier, with a reason:
  - a shipment not yet picked up moves with both stops to a route in preparation or in
    progress and takes the matching status ("Asignado" or "En ruta");
  - a shipment already picked up can move only to a route in progress; it stays "Recogido"
    and only its delivery stop moves. If the target route belongs to another courier, the
    move creates a pending handover (FR-025); if it belongs to the same courier, no
    handover is needed.
- **FR-015**: The dispatcher MUST be able to reassign a whole route in progress to another
  courier with a reason. Pending stops pass to the new courier; completed stops keep the
  courier who did them; each shipment the previous courier had picked up and not delivered
  gets a pending handover (FR-025). The route can be reassigned only to a courier without a
  route in progress; otherwise its shipments are moved into that courier's current route
  (FR-014). For a route in preparation, the courier is simply changed (FR-008).
- **FR-016**: Every reassignment MUST record the previous courier, the new courier, the
  reason, the author, and the time, in the history of the shipment and of the route. Every
  reason in this feature (reassign, undo dispatch, cancel) MUST be a text of 5 to 200
  characters.
- **FR-025**: Moving a picked-up shipment to another courier MUST create a pending handover
  ("Traspaso pendiente"): custody stays with the previous courier until the receiving
  courier confirms receipt (feature 003) or the owner or dispatcher confirms it on their
  behalf, marked as registered by dispatch. The receiving courier cannot deliver the
  shipment before confirming. Only the owner and the dispatcher can cancel a pending
  handover, which returns the delivery stop to the previous courier's route. Moving the
  shipment again while a handover is pending cancels it and creates a new one from the
  courier who holds custody. Requests, confirmations, and cancellations are recorded with
  author and time.

**Cancelling and undoing**

- **FR-017**: The dispatcher MUST be able to cancel a route in preparation with a reason; its
  shipments return to "Registrado" and the route remains in history as "Cancelada". A route
  in progress cannot be cancelled. Routes are never deleted.
- **FR-026**: The dispatcher MUST be able to undo the dispatch of a route in progress with a
  reason, while none of its stops is completed and none of its shipments has been picked
  up (including shipments that arrived through a handover): the route returns to "En
  preparación", its shipments return to "Asignado", and it stops being available to the
  courier. Otherwise undoing is refused.

**Dispatch board**

- **FR-018**: The dispatch board MUST show, for the selected date, every route with its
  number, courier, status, progress (completed stops out of total), total COD amount to
  collect, the number of its shipments at risk and late, and its handovers pending
  confirmation, plus the count of shipments "Sin asignar". The total to collect is the sum
  of the COD amounts of the shipments currently on the route and does not change with
  progress. Today's board MUST also list, in a separate section "Rutas de días anteriores",
  every route of an earlier service date that is still "En curso"; a route stays "En curso"
  across days until it meets the "Finalizada" rule (FR-012). Changes MUST appear within 30
  seconds without a reload.
- **FR-019**: Opening a route MUST show its stops in order with address, neighborhood,
  shipments, delivery windows, and status, and the route's history. Route history and the
  custody history of a shipment are visible to the owner and the dispatcher.
- **FR-027**: The routes screen MUST show a clear message, with the next action available,
  when there are no unassigned shipments, no routes for the selected date, or no active
  couriers.

**Integrity and access**

- **FR-020**: Creating a route MUST carry a client-generated identifier, so a repeated
  request never creates a second route. Every other route action (add, remove, reorder, set
  courier, dispatch, undo dispatch, move a shipment, reassign a route, confirm or cancel a
  handover, cancel) MUST carry a client-generated action identifier and have exactly one
  effect when repeated (feature 001, FR-042).
- **FR-021**: Concurrent changes to the same route MUST never overwrite each other silently:
  the second change is refused with a message, the screen shows the latest version, and
  the dispatcher's current selection is kept.
- **FR-022**: Every route action (create, add, remove, reorder, set courier, dispatch, undo
  dispatch, move a shipment, reassign a route, request, confirm, or cancel a handover,
  cancel, and the automatic finish) MUST be recorded with author and time in the route's
  history, and every shipment status change in the shipment's history with the route it
  refers to.
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
  pickup); "En ruta" → "Asignado" (dispatch undone).
- **Custody**: which courier is responsible for a shipment at each moment. It begins at
  pickup, passes to another courier only at a confirmed handover (never at the reassignment
  itself), and ends at delivery or return to the merchant (pickup, delivery, and return are
  recorded by feature 003).
- **Handover**: the transfer of a picked-up shipment between couriers. From courier, to
  courier, reason, status (pending, confirmed, cancelled), who confirmed, and when.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A dispatcher builds, orders, assigns, and dispatches a route of nine shipments
  from three pickup points in under 2 minutes.
- **SC-002**: At any moment, every shipment that is not in a final status is either counted
  as "Sin asignar" or on exactly one route in preparation or in progress.
- **SC-003**: Route progress and flags on the dispatch board reflect any change within 30
  seconds.
- **SC-004**: A dispatcher reassigns a shipment to another courier in under 30 seconds.
- **SC-005**: For any shipment, the ordered custody records (pickup, confirmed handovers,
  delivery or return) leave no interval between pickup and delivery without a responsible
  courier.
- **SC-006**: A dispatcher builds the day's routes without a separate list or spreadsheet.

## Assumptions

- Feature 001 is in place: shipments, shared lifecycle, dispatch board, couriers, roles,
  audit, and idempotent creation.
- Couriers see and execute dispatched routes in feature 003, which also marks stops as
  completed and tells the courier when a dispatched route changed. Until then, stops are
  completed only through the means feature 003 provides.
- A courier may have several routes on the same day, one after another: only one is in
  progress at a time (clarified 2026-09-30), and work that arrives meanwhile is added to it.
- A route belongs to one service date; shipments pending from earlier dates can join it. A
  route is never closed by the clock: it ends only when its shipments are resolved.
- Handing a picked-up package from one courier to another happens in person; the receiving
  courier confirms it in their app (feature 003 provides that action), and the dispatcher
  can confirm on their behalf.
- The 15-shipment confirmation threshold is a guard against selection mistakes; typical
  routes have 8–9 shipments over 2–3 pickups.
- Finance (COD cash-up per route) is Phase 2; this feature only shows the total to collect.
- Deferred to feature 003, which must define them consistently with this feature:
  - what the dispatcher decides for a shipment in "Novedad" (new attempt, reschedule, or
    return to sender) and the trip back to the merchant for a return; until that decision,
    a shipment in "Novedad" stays on its route and cannot be moved or removed;
  - how a courier's action recorded without signal is applied when the dispatcher has
    meanwhile removed or moved that shipment; the courier's record must never be lost
    (Constitution II).
