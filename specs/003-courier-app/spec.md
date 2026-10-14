# Feature Specification: Courier App

**Feature Branch**: `003-courier-app`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "App del mensajero (PWA instalable, funciona sin conexión): el mensajero inicia sesión con correo y contraseña y ve su ruta en curso con las paradas en el orden recomendado por el coordinador (puede completar cualquier parada pendiente). En cada parada de recogida confirma los envíos uno por uno; en cada entrega registra la prueba de entrega (nombre de quien recibe y foto, la foto no es obligatoria pero se pide; comprimida en el dispositivo), el recaudo contra entrega cobrado y su medio de pago; o registra una novedad con su motivo de la lista confirmada. Todo se guarda primero en el dispositivo y se sincroniza solo cuando hay señal, sin perder nunca un registro ni duplicarlo, con indicador visible de pendientes por sincronizar. Confirma los traspasos de paquetes recibidos de otro mensajero. Ve los cambios que el coordinador hizo a su ruta (envíos agregados, quitados, reordenados, reasignados, despacho deshecho). Ve el resumen de su día: entregas, recaudo que debe entregar. Atajos para llamar o escribir por WhatsApp al destinatario y abrir la dirección en el mapa. Incluye lo que la 002 dejó pendiente: qué decide el coordinador ante una Novedad (nuevo intento, reprogramar o devolver al comercio) y el viaje de devolución; cómo se aplica una acción registrada sin señal cuando el coordinador ya quitó o movió ese envío (el registro del mensajero nunca se pierde); regla de sesión del mensajero; si se notifica al mensajero al despachar. Sin ubicación en tiempo real (eso es de la app nativa, fase posterior). Construye sobre las especificaciones 001 y 002. Fuente: docs/business-master.md, docs/glossary.md, specs/002-routes-dispatch/spec.md (Assumptions)."

Business context: [business master](../../docs/business-master.md) (§4.4, §7 steps 4–6, §8.1,
§12 items E-01–E-05, decisions #16, #19, #23, #29, #33). Vocabulary:
[glossary](../../docs/glossary.md). Builds on
[feature 001](../001-shipment-registration/spec.md) (shipments, shared lifecycle, dispatch
board, users and roles, audit) and [feature 002](../002-routes-dispatch/spec.md) (routes,
stops, reassignment, custody, handovers). UI terms appear in Spanish between quotes.

## Clarifications

### Session 2026-09-30

- Q: When the dispatcher dispatches or changes a route, must the courier get a notification on the phone even with the app closed? → A: Yes. A phone notification on dispatch and on every change (shipment added, removed, reassigned, dispatch undone, handover), once the courier has granted the permission; the board still shows whether the courier has seen it.
- Q: When a delivery fails and will be retried another day, where does the package stay meanwhile? → A: Either the courier keeps it, or the courier hands it to the dispatcher at the office; the business has an office. The dispatcher records the receipt at the office.
- Q: When the recipient pays the COD amount partly in cash and partly by transfer, must the courier record each part separately? → A: Yes. The app proposes the full amount in cash and lets the courier split it among cash, transfer to the company, and transfer to the merchant (FR-010).
- Q: If a courier records a delivery or an exception by mistake, who can undo it? → A: Only the owner or the dispatcher, with a reason; the courier asks them (FR-017, FR-035).
- Q: How long does a courier's session stay open on the phone? → A: The same as the dispatcher's: until the courier signs out, for at most 30 days; then the password is asked again.

### Session 2026-10-14

- Q: When the dispatcher edits a dispatched shipment (address, phone, or instructions), must the courier get a notice? → A: Yes. A notice "Envío actualizado" that stays until "Entendido", with a phone notification, like any other change to the route (FR-027, FR-040).
- Q: Which icons does the installable app use while the logo artwork is pending? → A: A provisional icon following design-system.md §11: the name "domy" in white on the seed color, replaced by the logo when it exists (FR-001).
- Q: Where is a courier account linked to the courier it works as? → A: In "Usuarios", by the owner only, when creating or editing an account with the courier role ("Mensajero vinculado"); "Mensajeros" shows each courier's account, read only. One account per courier and one courier per account; only an active courier account is linked; a linked account keeps its role until unlinked (FR-002).
- Q: Where is the office? → A: Carrera 90 # 65C-10, Urbanización Mirador de Barcelona, barrio Robledo, Medellín (FR-041).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Carry out a route (Priority: P1)

The courier opens the app on their phone, signs in once, and sees their route in progress:
its stops in the order the dispatcher recommended, the next one highlighted. At a pickup
stop they confirm each shipment as they receive it. At a delivery stop they confirm who
received it, take a photo, and record what they collected. One tap calls the recipient,
writes to them on WhatsApp, or opens the address in a map app.

**Why this priority**: it is the reason the app exists. It replaces lists and photos sent by
WhatsApp (D-02, E-01, E-03) and gives the dispatch board and the tracking page real
statuses.

**Independent Test**: dispatch a route of two pickups and four deliveries to a courier;
from a phone, confirm the pickups and record the deliveries, one with a COD amount; verify
the shipments are "Entregado" on the dispatch board with received-by name, photo,
collection, time, and the route is "Finalizada".

**Acceptance Scenarios**:

1. **Given** a route dispatched to a courier, **When** the courier opens the app, **Then**
   they see the route number, its stops in the dispatcher's order with address,
   neighborhood, shipments, delivery windows, and COD amounts, and the first pending stop
   highlighted.
2. **Given** a pickup stop with three shipments, **When** the courier confirms two of them,
   **Then** those two are "Recogido" in the courier's custody, and the stop stays pending
   until the third is confirmed or taken off the route.
3. **Given** a delivery stop of a picked-up shipment without COD amount, **When** the
   courier confirms the delivery, **Then** the app proposes the recipient's name as
   received-by name, asks for a photo, and records the shipment as "Entregado" with name,
   photo, time, and location.
4. **Given** the courier skips the photo, **Then** the delivery is recorded and the shipment
   is flagged "Sin foto" on the dispatch board.
5. **Given** a delivery with a COD amount of COP 85,000, **When** the courier records it,
   **Then** the app proposes COP 85,000 in cash, lets the courier split the amount among
   cash, transfer to the company, and transfer to the merchant, and asks for a photo of the
   receipt for any transfer.
6. **Given** the courier collected an amount different from the COD amount, **Then** a note
   is required and the shipment is flagged "Recaudo diferente" for the dispatcher.
7. **Given** a delivery stop whose shipment has not been picked up, **When** the courier
   tries to record the delivery, **Then** the app asks them to confirm the pickup first.
8. **Given** the courier completes the fourth stop before the second, **Then** both actions
   are accepted and the second stop stays pending in its position.
9. **Given** a carrier handoff, **When** the courier delivers it at the handoff place,
   **Then** they can record the freight they paid as a disbursement (amount, carrier, photo
   of the receipt).
10. **Given** any stop, **When** the courier taps the call, WhatsApp, or map shortcut,
    **Then** the phone opens the dialer, WhatsApp, or the map app with the recipient's
    number or the address.
11. **Given** a user who is not a courier, or a courier without a route in progress,
    **Then** the app shows no route and explains that none has been dispatched.

---

### User Story 2 - Keep working without signal (Priority: P1)

Couriers work in elevators, basements, and dead zones. Everything the courier records is
saved on the phone first and sent on its own when there is signal. The courier always sees
how many records are waiting, and never has to repeat or remember anything.

**Why this priority**: a delivery that happened and was not recorded is a lost payment, a
lost collection, and a dispute (E-05; Constitution II). Without this the app is less
reliable than WhatsApp.

**Independent Test**: load a route, turn on airplane mode, record a pickup, a delivery with
photo and collection, and an exception; close and reopen the app; turn the connection back
on; verify every record reaches the dispatch board exactly once, with the time at which it
happened.

**Acceptance Scenarios**:

1. **Given** a route already loaded and no signal, **When** the courier opens the app,
   **Then** the route is shown with everything needed to work.
2. **Given** no signal, **When** the courier records a delivery with a photo, **Then** the
   stop is shown as completed at once, and the app shows "1 pendiente por sincronizar".
3. **Given** pending records, **When** the phone is restarted or runs out of battery and is
   turned on again, **Then** the records are still there.
4. **Given** pending records, **When** signal returns, **Then** they are sent without the
   courier doing anything, within one minute, and the pending counter returns to zero.
5. **Given** a record was sent but the answer was lost, **When** the app sends it again,
   **Then** the shipment shows one delivery, one collection, and one history entry.
6. **Given** a delivery recorded at 10:05 without signal and sent at 11:30, **Then** the
   shipment's history shows it delivered at 10:05 and received at 11:30.
7. **Given** a photo that has not finished uploading, **Then** its record is already on the
   dispatch board marked "Foto pendiente", and the photo is attached when it arrives.
8. **Given** pending records, **When** the courier tries to sign out, **Then** the app
   refuses and explains that the records must be sent first.
9. **Given** the session expires while the courier is on a route, **Then** the route stays
   usable, new records are saved, and they are sent after the courier signs in again.
10. **Given** a phone that has never loaded the route and has no signal, **When** the courier
    opens the app, **Then** it explains that the route could not be loaded and retries on
    its own when signal returns.

---

### User Story 3 - Report what could not be done (Priority: P1)

When a delivery cannot be made, the courier reports a delivery exception with one of the
confirmed reasons, and keeps the package. When a shipment cannot be picked up or an errand
cannot be done, the courier reports the problem with a note. The dispatcher sees both at
once on the dispatch board.

**Why this priority**: today the status is always "Entregado" and exceptions are almost
never recorded (E-02); the real first-attempt rate is unknown.

**Independent Test**: on a dispatched route, report "Destinatario ausente" on one delivery
and a pickup problem on another shipment; verify the first is "Novedad" with reason, time,
and courier on the dispatch board, and the second is flagged "Problema de recogida".

**Acceptance Scenarios**:

1. **Given** a picked-up shipment, **When** the courier reports an exception with the reason
   "Destinatario ausente", **Then** the shipment becomes "Novedad", stays in the courier's
   custody, its stop counts as done, and the dispatch board shows it under "Novedades por
   decidir".
2. **Given** an exception report, **Then** the reason is one of "Destinatario ausente",
   "Dirección errada", or "Rechazado"; a note and a photo are optional.
3. **Given** a shipment the merchant did not have ready, **When** the courier reports a
   pickup problem with a note, **Then** the shipment keeps its status, stays on the route
   with its pickup pending, and is flagged "Problema de recogida" on the dispatch board.
4. **Given** an errand that could not be done, **When** the courier reports it with a note,
   **Then** it is flagged in the same way and stays pending.
5. **Given** a shipment flagged with a pickup problem, **When** the courier later picks it
   up, **Then** the flag disappears.

---

### User Story 4 - Decide what happens after an exception (Priority: P2)

For each shipment in "Novedad", the dispatcher decides: a new attempt (today or on another
date) or a return to sender. A new attempt puts the delivery back on a route; a return puts
a return stop on a route, which the courier completes at the merchant's pickup point.

**Why this priority**: it closes the loop feature 002 left open. Until it exists, a shipment
in "Novedad" stays where it is; exceptions are rare enough (tens per year recorded today)
to wait for P1.

**Independent Test**: with a shipment in "Novedad", decide a new attempt on the same route
and deliver it; with another, decide a return and complete the return stop; verify the
first is "Entregado" with two attempts in its history and the second is "Devuelto".

**Acceptance Scenarios**:

1. **Given** a shipment in "Novedad" whose route is still in progress, **When** the
   dispatcher decides "Nuevo intento" for today on that route, **Then** the shipment returns
   to "Recogido" and the route gets a new pending delivery stop for it.
2. **Given** a shipment in "Novedad", **When** the dispatcher decides "Nuevo intento" on a
   route in progress of another courier, **Then** the delivery stop is added there with a
   pending handover, as for any picked-up shipment (feature 002, FR-025).
3. **Given** a shipment in "Novedad", **When** the dispatcher reschedules it for tomorrow,
   **Then** it returns to "Recogido" with the new service date, leaves its route, and is
   listed under "Sin asignar" marked "En custodia de {courier}" until it is added to a
   route in progress.
4. **Given** a shipment in "Novedad", **When** the dispatcher decides "Devolver al
   remitente" on a route in progress, **Then** the route gets a return stop at the
   merchant's pickup point, and the shipment shows "Devolución en curso".
5. **Given** a return stop, **When** the courier completes it with the name of the person
   who received the package, **Then** the shipment becomes "Devuelto" and the courier's
   custody ends.
6. **Given** a delivered shipment that had one exception before, **Then** its history shows
   two delivery attempts with their times, couriers, and results.
7. **Given** a shipment in "Novedad" or waiting "En custodia de {courier}", **When** the
   dispatcher records "Recibido en oficina", **Then** the courier's custody ends, the
   office holds the package, and the shipment is marked "En oficina".
8. **Given** a shipment "En oficina" with a new attempt decided, **When** the dispatcher adds
   it to a route, **Then** the route gets a pickup stop at the office before its delivery
   stop, and the courier confirms the pickup there like any other.

---

### User Story 5 - Follow changes to the route and confirm handovers (Priority: P2)

While the courier is out, the dispatcher adds, removes, reorders, and reassigns. The courier
sees each change as a notice on their route and acknowledges it. A package received from
another courier is confirmed in the app. When the courier recorded something without signal
about a shipment the dispatcher had meanwhile changed, the record is kept and applied as the
fact it is.

**Why this priority**: without it, dispatchers still have to call couriers about every
change, and custody of handed-over packages is never confirmed by the person who holds
them.

**Independent Test**: with a route in progress open on a phone, add a shipment and remove
another from the dispatch panel and verify the notices; reassign a picked-up shipment to a
second courier and confirm the handover from that courier's phone; repeat a removal while
the first phone is offline and has recorded the pickup, and verify the result.

**Acceptance Scenarios**:

1. **Given** a route open in the app, **When** the dispatcher adds a shipment, **Then**
   within one minute with signal the courier sees the new stops and a notice "Envío
   agregado", which stays until the courier taps "Entendido"; with the app closed, the
   phone shows a notification.
2. **Given** the dispatcher removes a shipment, reorders stops, or reassigns a shipment to
   another courier, **Then** the courier sees the route updated and a notice naming the
   change.
3. **Given** the dispatcher undoes the dispatch or reassigns the whole route, **Then** the
   route leaves the courier's app with a notice, and any package the courier still holds is
   listed as "Entregar a {courier}" until the handover is confirmed.
4. **Given** a delivery stop marked "Traspaso pendiente" on the receiving courier's route,
   **When** that courier taps "Recibí el paquete", **Then** custody passes to them and the
   stop can be completed.
5. **Given** courier A recorded without signal the pickup of a shipment that the dispatcher
   had already removed from A's route, **When** the record arrives, **Then** the shipment is
   "Recogido" in A's custody, is flagged "Por revisar" for the dispatcher, and A's record
   is in its history.
6. **Given** courier A delivered without signal a shipment that the dispatcher had
   reassigned to courier B with a pending handover, **When** A's record arrives, **Then**
   the shipment is "Entregado" by A, the pending handover is cancelled, and B's stop
   disappears with a notice.
7. **Given** a record that cannot change the shipment (for example, a delivery of a
   shipment that was voided), **Then** the record is kept in the shipment's history as "No
   aplicado", flagged "Por revisar", and the courier sees a notice.
8. **Given** a route, **Then** the dispatch board shows when the courier's app last
   synchronized and whether the courier has acknowledged the latest change.

---

### User Story 6 - Record on behalf of a courier and correct mistakes (Priority: P2)

A courier's phone breaks, or they confirm the wrong shipment. The dispatcher records the
pickup, delivery, exception, or handover on the courier's behalf from the dispatch panel,
corrects the details of a delivery, or reverts a delivery or exception recorded by mistake,
always with a reason.

**Why this priority**: without it a dead phone stops the route in the system, and a wrong
tap is permanent.

**Independent Test**: from the dispatch panel, record a delivery on behalf of a courier and
verify it is marked "Registrado por despacho"; correct the collected amount of another
delivery with a reason; revert a delivery and verify the shipment is "Recogido" again with
its stop pending.

**Acceptance Scenarios**:

1. **Given** a shipment on a route in progress, **When** the dispatcher records its delivery
   with received-by name, collection, and the time it happened, **Then** the shipment is
   "Entregado", and the record is marked "Registrado por despacho" with the dispatcher as
   author.
2. **Given** a delivered shipment, **When** the dispatcher corrects the received-by name or
   the collected amounts with a reason, **Then** the new values apply and the history keeps
   the previous ones.
3. **Given** a delivery or an exception recorded by mistake, **When** the dispatcher reverts
   it with a reason, **Then** the shipment returns to "Recogido" in the same courier's
   custody and its delivery stop is pending again (on its route if it is still in progress;
   otherwise off route, as in User Story 4 scenario 3).
4. **Given** a courier, **Then** they cannot correct or revert a record already saved.

---

### User Story 7 - See my day (Priority: P3)

At any time the courier sees a summary of their day: deliveries done, exceptions, stops
still pending, what they collected by payment method, what they paid on merchants' behalf,
and the cash they should hand over.

**Why this priority**: it prepares the end-of-day cash-up and avoids the nightly messages
reporting collections; the formal cash-up is Phase 2.

**Independent Test**: record three deliveries (cash, transfer to the company, transfer to
the merchant) and one disbursement; verify "Mi día" shows each total and the cash to hand
over equal to cash collected minus disbursements.

**Acceptance Scenarios**:

1. **Given** deliveries with COP 100,000 in cash, COP 50,000 transferred to the company,
   COP 30,000 transferred to the merchant, and a disbursement of COP 12,000, **Then** "Mi
   día" shows those four amounts and "Efectivo por entregar: $ 88.000".
2. **Given** records still pending to synchronize, **Then** "Mi día" includes them.
3. **Given** the dispatcher corrected a collected amount, **Then** "Mi día" shows the
   corrected value after the next synchronization.

---

### Edge Cases

- **EC-01 Camera denied, broken, or no storage left**: the delivery is recorded without a
  photo and flagged "Sin foto"; a photo never blocks a record (FR-009).
- **EC-02 Location denied or unavailable**: the record is saved without location; location
  never blocks or delays a record (FR-015).
- **EC-03 Phone clock wrong**: the time of each record is corrected by the difference
  between the phone's clock and the system's clock measured at synchronization (FR-019).
- **EC-04 Records pending for a long time**: the app warns the courier after 2 hours with
  pending records, and the dispatch board shows each route's last synchronization (FR-020,
  FR-033).
- **EC-05 App data erased or phone lost with pending records**: those records cannot be
  recovered; the app warns before sign-out, asks to be installed, and asks the phone to
  keep its data; the dispatcher records the missing actions on the courier's behalf
  (FR-020, FR-034).
- **EC-06 Session expired or courier deactivated while records are pending**: the records
  stay on the phone; an expired session sends them after the same courier signs in again;
  a deactivated courier can no longer send them: they stay readable on the phone and the
  dispatcher records them on the courier's behalf (FR-003, FR-020, FR-021, FR-034).
- **EC-07 Another courier signs in on the same phone**: not possible while records are
  pending, because sign-out is refused (FR-004).
- **EC-08 Same courier on two phones**: both show the same route; a record that repeats what
  is already recorded by that courier (same shipment, same result) is ignored without a
  flag (FR-024).
- **EC-09 Record for a shipment the dispatcher changed meanwhile**: applied as a fact when
  the shipment's status allows it, otherwise kept as "No aplicado"; always flagged "Por
  revisar" (FR-024–FR-026).
- **EC-10 Delivery before pickup**: the app asks to confirm the pickup first (FR-007).
- **EC-11 Collected amount different from the COD amount, or zero**: allowed with a note,
  flagged "Recaudo diferente" (FR-011).
- **EC-12 Exception decided while the courier is offline**: the courier sees the new stop or
  the return stop at the next synchronization, with a notice (FR-022, FR-029).
- **EC-13 New attempt or return when the holding courier has no route in progress**: the
  shipment waits off route under "Sin asignar", marked "En custodia de {courier}", until a
  route in progress can take it, or until the office receives it (FR-029–FR-031, FR-041).
- **EC-14 Handover stop on the receiving courier's route never confirmed**: it stays blocked
  and counted on the dispatch board (feature 002, EC-12); the dispatcher can confirm on
  behalf or cancel.
- **EC-15 Route dispatched while the app is closed**: the courier sees it the next time the
  app is opened or synchronizes, and receives a phone notification if they granted the
  permission (FR-022, FR-040).
- **EC-16 Reverse pickup with the recipient absent**: reported as a pickup problem; nothing
  is in custody yet (FR-014).
- **EC-17 Exception of a shipment that was the last pending stop**: the route becomes
  "Finalizada" (feature 002, FR-012); the decision places the shipment on another route in
  progress or leaves it waiting off route (FR-029).

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: Couriers MUST sign in with email and password, with recovery by email, using
  the accounts created in feature 001. The app MUST be usable from a phone's browser and
  installable on the phone's home screen.
- **FR-002**: A courier MUST see only the routes dispatched to them and the shipments on
  those routes, plus packages in their custody. Owner and dispatcher accounts do not use
  the courier app. The owner links each account with the courier role to the courier it
  works as, in "Usuarios"; an account not linked sees no route and is told to ask the owner.
  A linked account keeps the courier role until it is unlinked, and a courier's records stay
  with the courier when its account changes.
- **FR-003**: A courier session MUST last until the courier signs out, for at most 30 days
  (the same rule as feature 001, FR-033a); then the app asks for the password again. The
  app MUST warn the courier when 2 days or fewer remain, so they can sign in again before
  starting a route. A session that expires during a route loses nothing: the route stays
  visible on the phone, records keep being saved, and they are sent after the courier
  signs in again (FR-021). Deactivating the courier's user ends access at the next request (feature
  001, FR-032): records still on that phone can no longer be sent, stay readable there
  (FR-020), and are recorded by the dispatcher on the courier's behalf (FR-034).
- **FR-004**: Signing out MUST be refused while records are pending to synchronize, with an
  explanation. After sign-out the phone keeps no route data. When the system refuses
  the phone because the user was deactivated or the owner ended the sessions, the app
  removes the route data at that moment and keeps only the list of pending records.
  Signing in needs signal.

**Carrying out a route**

- **FR-005**: The app MUST show the courier's route in progress: route number, stops in the
  dispatcher's order with kind, address, neighborhood, instructions, shipments with
  tracking number, merchant, recipient, package count and size, delivery window, COD
  amount, and at-risk or late flags. The first pending stop in that order is highlighted;
  the courier may open and complete any pending stop (feature 002, FR-007). The app also
  lists "En mi custodia": packages the courier holds that are on no route (FR-031), for
  reference only.
- **FR-006**: At a pickup stop, the courier MUST confirm each shipment individually. A
  confirmed shipment becomes "Recogido" and its custody starts with that courier. The stop
  is completed when none of its shipments is pending.
- **FR-007**: A delivery MUST NOT be recorded for a shipment that has not been picked up; the
  app offers to confirm the pickup first. An errand has a single stop and no pickup.
- **FR-008**: Recording a delivery MUST capture the received-by name, proposed as the
  recipient's name and editable (for a carrier handoff, proposed as the carrier's name; for
  a reverse pickup, as the merchant's name). The name has 2 to 100 characters. The shipment
  becomes "Entregado" and the courier's custody ends. Completing an errand captures an
  optional note instead of a received-by name. Nothing is collected at an exception or a
  return.
- **FR-009**: The app MUST ask for a proof-of-delivery photo at every delivery, return, and
  completed errand, and let the courier skip it. A delivery without photo is flagged "Sin
  foto" on the dispatch board. A record accepts up to three photos. Photos MUST be reduced
  on the phone, to about 200 KB while staying legible, before they are stored or sent. A
  photo problem MUST never block a record.
- **FR-010**: When a shipment has a COD amount greater than zero, recording its delivery MUST
  capture the amount collected, split among the payment methods "Efectivo", "Transferencia
  a la empresa", and "Transferencia al cliente". The app proposes the full COD amount in
  cash. For any transfer the app asks for a photo of the receipt, which can be skipped.
- **FR-011**: A collected total different from the COD amount MUST require a note and flag
  the shipment "Recaudo diferente" on the dispatch board. Amounts are whole pesos, zero or
  more; a collected total or a disbursement above COP 2,000,000 asks for confirmation
  (the threshold of feature 001, FR-037).
- **FR-012**: The courier MUST be able to record a disbursement for any shipment of the
  route on the phone, whether its stop is pending or done: amount greater than zero, carrier or payee, optional note, and a photo of the receipt (asked
  for, skippable). This feature captures disbursements; what is done with them is Phase 2.
- **FR-013**: The courier MUST be able to report a delivery exception for a picked-up
  shipment with one reason among "Destinatario ausente", "Dirección errada", and
  "Rechazado", an optional note, and optional photos. The shipment becomes "Novedad", stays
  in the courier's custody, and its delivery stop counts as done.
- **FR-014**: The courier MUST be able to report a problem on a shipment not yet picked up,
  or on an errand, with a note of 5 to 200 characters. The shipment keeps its status and
  stays pending on the route, flagged "Problema de recogida" on the dispatch board until it
  is picked up, completed, removed, or voided; a new report replaces the note shown. The
  dispatcher acts with the tools of
  features 001 and 002 (remove, reassign, void).
- **FR-015**: Every record MUST capture the phone's location when available, without
  blocking or delaying the record. There is no continuous location sharing.
- **FR-016**: Each stop MUST offer shortcuts to call the recipient, write to them on
  WhatsApp, and open the address in a map app; pickup stops offer the same for the
  merchant's contact. A shortcut appears only when its phone number or address exists.
- **FR-017**: Before saving a delivery, exception, or return, the app MUST show what will be
  recorded (shipment, recipient, result, amounts) for the courier to confirm. A saved
  record cannot be changed or reverted by the courier.

**Working without signal**

- **FR-018**: Every courier record (pickup, delivery, collection, disbursement, exception,
  pickup problem, return, handover confirmation, acknowledgment of a notice) MUST be saved
  on the phone before anything is sent, and MUST survive closing the app, restarting the
  phone, and running out of battery. The app shows the result at once, without waiting for
  the connection. If the phone cannot save a record (for example, no storage left), the
  app MUST say so and MUST NOT show the action as done.
- **FR-019**: Every record MUST carry an identifier generated on the phone and have exactly
  one effect however many times it is sent. It MUST keep the time at which it happened and
  the time at which the system received it; the time at which it happened is corrected by
  the clock difference measured at synchronization and is never later than the time of
  receipt. A phone sends its records in the order in which they happened; a record that
  arrives after the shipment changed by other means is judged against the shipment as it
  is then (FR-024–FR-026).
- **FR-020**: Pending records MUST be sent automatically when the app opens, when the
  connection returns, and at least once a minute while the app is open, without the courier
  doing anything. The app MUST always show how many records and photos are pending, let the
  courier read the list of pending records, and warn the courier when records have been
  pending for more than 2 hours.
- **FR-021**: Records MUST be sent as the courier who made them. If the session expired, the
  records stay on the phone and are sent after that courier signs in again.
- **FR-022**: With signal, the app MUST refresh the route at least once a minute while it is
  open, and every time it is opened. A route already loaded MUST open and be fully usable
  without signal, with all the data of FR-005. If no route was ever loaded and there is no
  signal, the app says so and retries on its own.
- **FR-023**: Photos MUST be sent separately from their record, after it; a record whose
  photos have not arrived is marked "Foto pendiente"; if a photo has not arrived 24 hours
  after its record, the record is treated as having no such photo ("Sin foto" for a proof
  of delivery). Once a route is finished and its
  records and photos are sent, the phone MUST delete that route's personal data and photos
  within 24 hours.

**Records that arrive after the dispatcher changed the route**

- **FR-024**: A courier's record MUST never be rejected or lost because the shipment changed
  meanwhile. It is always stored in the shipment's history with its author, the time it
  happened, and the time it was received. A record that repeats what the same courier
  already recorded for that shipment has no effect and raises no flag.
- **FR-025**: A record about a shipment that is no longer on that courier's route MUST be
  applied as the fact it states whenever the shipment's status allows it, and flag the
  shipment "Por revisar":
  - a **pickup** of a shipment "Registrado", "Asignado", or "En ruta": the shipment becomes
    "Recogido" in that courier's custody. If it is on another courier's route in progress,
    a pending handover to that courier is created; if it is on a route in preparation, it
    leaves that route; then, or if it is on no route, it waits off route marked "En
    custodia de {courier}";
  - a **delivery, exception, or return** by the courier who holds custody: it applies, any
    pending handover of that shipment is cancelled, and its pending stop on another route
    is removed;
  - a **disbursement**: it is always stored, unless the shipment is "Anulado".
- **FR-026**: In every other case (for example, the shipment is "Anulado", "Entregado", or
  "Devuelto", or the author does not hold custody) the record MUST be kept as "No
  aplicado", flag the shipment "Por revisar", and show the courier a notice. The owner or
  dispatcher clears a "Por revisar" flag with a note of 5 to 200 characters; clearing it
  changes nothing else.

**Changes and handovers**

- **FR-027**: The app MUST show a notice for every change the dispatcher makes to the
  courier's route: route dispatched, shipment added (including the shipments of a route
  joined to the courier's route in progress), removed, voided, or updated (address, phone,
  or instructions edited while on the route), stops reordered,
  shipment reassigned to or from another courier, route reassigned, dispatch undone,
  exception decided, package received at the office, record corrected or reverted, record
  not applied. Notices stay until the courier taps "Entendido", which acknowledges all the
  notices shown; the acknowledgment is recorded with its time.
- **FR-040**: The system MUST send a phone notification to the courier, even with the app
  closed, when a route is dispatched to them and for every later change that produces a
  notice (FR-027). The app asks for the notification permission once, after sign-in. The
  notification names the change without personal data of recipients. A notification that
  cannot be delivered (permission denied, phone off, app not installed where the phone
  requires it) MUST never block or delay the dispatcher's action; the notice in the app
  and the acknowledgment on the dispatch board (FR-033) remain the reference.
- **FR-028**: The receiving courier MUST be able to confirm a pending handover ("Recibí el
  paquete"); custody passes to them and the stop is unblocked (feature 002, FR-025). The
  courier who holds a package with a pending handover sees it as "Entregar a {courier}",
  including after the route left their app.

**Deciding after an exception**

- **FR-029**: For a shipment in "Novedad", the owner or dispatcher MUST be able to decide:
  - **"Nuevo intento"**, with a service date (today by default) and optionally a route in
    progress (proposed: the route it is on, if still in progress): the shipment returns to
    "Recogido". With a route, it gets a new pending
    delivery stop there, with a pending handover if the route belongs to another courier.
    Without a route, or with a later date, it leaves its route and waits off route;
  - **"Devolver al remitente"**, optionally on a route in progress: the shipment shows
    "Devolución en curso" and gets a return stop at the place where it was picked up (the
    merchant's pickup point; for a reverse pickup, the recipient's address), under the
    same route and handover rules. While the return stop is not completed, the decision
    can be changed to "Nuevo intento", which removes the pending return stop.

  Until a decision is made, the shipment stays in "Novedad" on its route and cannot be moved
  or removed (feature 002, Assumptions).
- **FR-041**: The owner and the dispatcher MUST be able to record "Recibido en oficina" for a
  package a courier holds after an exception (shipment in "Novedad", or "Recogido" on no
  route): the courier's custody ends and the office holds the package, with author and
  time. Only the owner and the dispatcher can record it; the courier sees a notice. From
  then on:
  - with a new attempt decided, the shipment is "Registrado" with the office as its pickup
    place and its service date, and follows the normal flow of feature 002 (any route, a
    pickup stop at the office, pickup confirmed by the courier);
  - with a return decided, the route gets a pickup stop at the office before the return
    stop;
  - with no decision yet, it stays in "Novedad" marked "En oficina".

  The office has one address, set by the owner; "Recibido en oficina" cannot be recorded
  until it is set.
- **FR-030**: Completing a return stop MUST capture the received-by name and ask for a photo;
  the shipment becomes "Devuelto" and custody ends. A return stop cannot end in an
  exception: if the merchant is not there, the courier reports a problem with a note
  (FR-014) and the stop stays pending.
- **FR-031**: Shipments "Recogido" that are on no route MUST be listed under "Sin asignar"
  marked "En custodia de {courier}" with their service date, and MUST be addable only to a
  route in progress, where they get only a delivery stop (or return stop), with a pending
  handover if the route belongs to another courier. Shipments held by the office are listed
  marked "En oficina" and can be added to any route (FR-041).
- **FR-032**: Every delivery attempt MUST be kept: courier, time, result, reason. A reverted
  record does not count as an attempt. The fee of
  a shipment does not change with the number of attempts in this feature.

**Dispatch panel**

- **FR-033**: The dispatch board MUST show "Novedades por decidir", and the flags "Sin foto",
  "Foto pendiente", "Recaudo diferente", "Problema de recogida", and "Por revisar"; and for
  each route, the last time the courier's app contacted the system and how many changes
  the courier has not acknowledged.
- **FR-034**: The owner and the dispatcher MUST be able to record on a courier's behalf a
  pickup, delivery (with received-by name and collection), exception, pickup problem,
  return, and disbursement, stating the time it happened (now by default, never in the
  future). The record is attributed to the courier who holds the package or, before
  pickup, to the courier of its route. Such records are marked "Registrado por despacho"
  with the user as author.
- **FR-035**: The owner and the dispatcher MUST be able to correct, with a reason of 5 to 200
  characters, the received-by name, the collected amounts and payment methods, the reason
  and note of an exception, and a disbursement; and to revert the latest delivery,
  exception, or return of a shipment recorded by mistake. Reverting a delivery or an
  exception returns the shipment to "Recogido", and reverting a return returns it to
  "Novedad" with the return pending, in the custody of the courier who held it, with its
  stop pending again on its route if that route is still in progress, otherwise off route
  (FR-031). A reverted delivery's collection no longer counts. Corrections and reverts keep the previous values in the history and are
  notified to the courier.
- **FR-036**: The shipment detail MUST show its proof of delivery (received-by name, photos,
  time, location), collection by payment method with receipt photos, disbursements, every
  attempt, and every record "No aplicado". Photos are visible to the owner and the
  dispatcher, and to the courier only for their own records of routes still on the phone.
  Photos are kept 12 months and then deleted; the record stays and says the photo is no
  longer available.

**Summary**

- **FR-037**: The app MUST show "Mi día" for the current date: deliveries, exceptions,
  returns, and pending stops; amounts collected by payment method; disbursements; and
  "Efectivo por entregar" = cash collected − disbursements. It includes records still
  pending to synchronize and is labelled as an estimate until the cash-up of Phase 2.

**General**

- **FR-038**: All user-facing text MUST be in Spanish (Colombia) with the glossary's UI
  terms; the app MUST follow the design system (`docs/design-system.md`) and the
  constitution's rules for the courier app: usable with one hand, touch targets of at
  least 48 px, confirming a pickup, confirming a delivery, and reporting an exception
  within 3 taps of the route screen, a high-contrast option for sunlight, WCAG 2.2 AA, on
  Android 10 or later with Chrome and iPhone with iOS 16 or later.
- **FR-039**: Every record, decision, correction, revert, and cleared flag MUST be kept in
  the shipment's history (and the route's, when it changes the route) with author, time it
  happened, and time it was received. The history is visible to the owner and the
  dispatcher (feature 001).
- **FR-042**: The owner MUST be able to export everything the field operation records
  (Constitution IX): the shipment export of feature 001 gains the delivery columns (status
  time, courier, received-by name, amounts collected by payment method, disbursements,
  number of attempts, last exception reason); and courier records, routes with their
  stops, and handovers are each exportable to CSV with Spanish column names. Photos stay
  in the client's own storage account.

### Key Entities

- **Courier record**: something a courier did or reported about a shipment: kind (pickup,
  delivery, exception, pickup problem, return, disbursement, handover confirmation), author,
  who it was made on behalf of, time it happened, time it was received, location, whether
  it was applied, and its phone-generated identifier.
- **Delivery attempt**: one visit to deliver a shipment, ending in a delivery or an
  exception (reason, note). A shipment can have several.
- **Proof of delivery**: received-by name, photos, time, and location of a delivery or a
  return.
- **COD collection**: money received at a delivery, as amounts per payment method (cash,
  transfer to the company, transfer to the merchant), with receipt photos and a note when
  the total differs from the COD amount.
- **Disbursement**: money the courier paid on the merchant's behalf for a shipment: amount,
  carrier or payee, receipt photo.
- **Exception decision**: what the dispatcher decided for a shipment in "Novedad": new
  attempt (date, route) or return to sender; author and time.
- **Office custody**: the office, not a courier, is responsible for a package from "Recibido
  en oficina" until a courier picks it up there. Custody records therefore name a courier
  or the office.
- **Return stop**: a stop at the place where the shipment was picked up, where an
  undeliverable shipment is given back.
- **Notice**: a change to a courier's route that the courier must see; acknowledged or not,
  and when.
- **Review flag** ("Por revisar"): a mark on a shipment whose record arrived after the
  dispatcher changed it; cleared by the owner or dispatcher with a note.
- **Shipment lifecycle transitions implemented here** (shared lifecycle, feature 001): "En
  ruta" → "Recogido" (pickup); "Recogido" → "Entregado" (delivery); "En ruta" → "Entregado"
  (errand completed); "Recogido" → "Novedad" (exception); "Novedad" → "Recogido" (new
  attempt, or exception reverted, while a courier holds the package); "Novedad" →
  "Registrado" (new attempt while the office holds the package); "Novedad" → "Devuelto"
  (return stop completed);
  "Entregado" → "Recogido" and "Devuelto" → "Novedad" (reverted by the dispatcher);
  "Registrado" or "Asignado" → "Recogido" (pickup record that arrives after the dispatcher
  changed the route).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % of the records a courier makes without signal reach the system exactly
  once after the connection returns, with the time at which they happened.
- **SC-002**: A courier records a delivery without COD amount, including the photo, in under
  30 seconds, and a delivery with COD amount in cash in under 45 seconds.
- **SC-003**: A route already loaded opens without signal in under 3 seconds on a mid-range
  phone.
- **SC-004**: With signal, a courier's record is visible on the dispatch board within 1
  minute, and a dispatcher's change is visible in the courier's app within 1 minute.
- **SC-005**: No proof-of-delivery photo is requested from couriers by WhatsApp after the
  first week of use.
- **SC-006**: Every shipment that was not delivered on the first visit has a recorded
  exception with its reason, so the first-attempt rate can be calculated.
- **SC-007**: For any shipment, the custody records (pickup, confirmed handovers, delivery
  or return) leave no interval without a responsible courier or the office, including records that
  arrived late (extends feature 002, SC-005).
- **SC-008**: A courier completes their first route in the app after at most 10 minutes of
  explanation.

## Assumptions

- Features 001 and 002 are in place. This feature changes them in these points, which are
  aligned in their documents when this feature is planned:
  - the shared lifecycle gains the transitions listed under Key Entities; in particular,
    after an exception a shipment returns to "Recogido" (the courier still holds the
    package), not to "Registrado";
  - "Sin asignar" also lists shipments "Recogido" that are on no route, and such shipments
    can be added to a route in progress (feature 002, FR-001, FR-003, FR-011, SC-002);
  - routes gain the stop kind "Devolución";
  - the test-only stand-in for courier actions in feature 002 is replaced by the real ones.
- Couriers use their own phones, mostly Android, with a recent browser; the app is a web
  app installed from the browser, not a store app (Phase 3).
- No real-time location sharing: location is captured only with each record (decision #33).
- Phone notifications depend on the courier granting the permission and, on some phones, on
  the app being installed on the home screen; they are an aid, never the only way to learn
  of a change.
- Who pays for a failed delivery attempt is still open with the owner (business master,
  decision 5c). This feature records every attempt, which is what Phase 2 needs to bill it
  either way; fees do not change here.
- A package whose delivery failed stays with the courier who holds it until it is delivered,
  handed over to another courier, returned to the merchant, or received at the office
  (clarified 2026-09-30). The office is a single place.
- The exception reasons are the three confirmed by the owner; pickup problems use a free
  note.
- The cash-up, its reconciliation, and courier pay are Phase 2; "Mi día" is informative.
- The tracking page and the merchant link (feature 004) read the statuses, the received-by
  name, and the stop order produced here.
