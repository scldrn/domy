# Feature Specification: Tracking Page, Merchant Link, and WhatsApp Message

**Feature Branch**: `004-tracking-merchant-link`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Página de seguimiento pública, enlace privado del cliente y mensaje agrupado de WhatsApp: cada envío tiene un enlace de seguimiento que se abre sin iniciar sesión ni instalar nada y muestra el estado, 'N entregas antes de la tuya' con la franja de entrega, el nombre y teléfono del mensajero y el contacto de soporte de Cohex bajo la marca Domy; no muestra la foto, muestra 'Entregado a {nombre} a las {hora}'. Cada cliente tiene un enlace privado con sus envíos del día y sus estados, donde sí ve la foto de la prueba de entrega. El coordinador envía al cliente, en dos toques, un mensaje de WhatsApp agrupado con los enlaces de seguimiento de sus envíos; el cliente lo reenvía a sus destinatarios. Sin envío automático de mensajes (eso es Fase 3). Construye sobre las especificaciones 001, 002 y 003. Fuente: docs/business-master.md §4.5 y §12 (C-01, C-02, C-03), decisiones 8, 9 y 20, y docs/glossary.md."

Business context: [business master](../../docs/business-master.md) (§4.5, §7 step 4, §12 items
C-01–C-03, decisions #8, #9, #20). Vocabulary: [glossary](../../docs/glossary.md). Builds on
features [001](../001-shipment-registration/spec.md) (shipments, merchants, tracking
numbers), [002](../002-routes-dispatch/spec.md) (routes and stop order), and
[003](../003-courier-app/spec.md) (real statuses, received-by name, photos). UI terms appear
in Spanish between quotes.

## Clarifications

### Session 2026-09-30

- Q: Must the tracking page show the recipient the amount to pay at the door? → A: Yes, while the shipment is not delivered, returned, or voided: "Valor a pagar al recibir: $ 85.000" (FR-014).
- Q: How long must a tracking link keep showing information after the shipment is delivered, returned, or voided? → A: 7 days; afterwards the merchant still sees the shipment on its private link (FR-010).
- Q: On its private link, must the merchant see each shipment's fee and the day's totals? → A: Yes: the fee of each shipment ("por confirmar" while under review) and the day's totals of fees, COD amounts to collect, and amounts collected by payment method; no balance or netting (FR-019).
- Q: Can the recipient do anything from the tracking page, such as announce an absence or leave instructions? → A: No. The page is read-only; for any request the recipient uses the WhatsApp button to the support contact or, while the shipment is on its way, to the courier (FR-024).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Follow a shipment (Priority: P1)

A recipient receives a link from the merchant, opens it on any phone without signing in or
installing anything, and sees where their shipment is: its status in plain words, how many
deliveries the courier has before theirs, the delivery window, what they must pay at the
door, and how to reach the courier or the company. When it is delivered, the page says who
received it and when.

**Why this priority**: between pickup and delivery, merchants and recipients see nothing
today; it is the owner's main pain point (business master §7, C-01).

**Independent Test**: open the tracking link of a shipment at each stage (registered, on a
dispatched route, picked up, delivered, exception) in a private browser window, and verify
the page shows the right status and only the agreed information.

**Acceptance Scenarios**:

1. **Given** a registered shipment not yet on a dispatched route, **When** its tracking link
   is opened, **Then** the page shows the merchant's name, the tracking number, the status
   "Recibimos tu envío", the service date, and the delivery window if it has one, and no
   courier.
2. **Given** a shipment picked up on a route in progress with three pending delivery stops
   before its own, **When** the link is opened, **Then** the page shows "En camino", "3
   entregas antes de la tuya", the delivery window, and the courier's first name with
   buttons to call and to write on WhatsApp.
3. **Given** a shipment with a COD amount of COP 85,000 that is not delivered, **Then** the
   page shows "Valor a pagar al recibir: $ 85.000".
4. **Given** a delivered shipment, **Then** the page shows "Entregado a {received-by name} a
   las {time}" with the date, and no longer shows the courier's phone or the amount to pay.
5. **Given** a shipment in "Novedad", **Then** the page shows "No pudimos entregar tu envío"
   with the reason in plain words, and the support contact.
6. **Given** the page is open, **When** the shipment's status changes, **Then** the page
   shows the new status within one minute without a reload.
7. **Given** any tracking page, **Then** it never shows the proof-of-delivery photo, the
   recipient's phone, the full delivery address, the fee, or other shipments.
8. **Given** a link that does not exist, **Then** the page says the link is not valid,
   without revealing whether a similar one exists.

---

### User Story 2 - Send the merchant their tracking links (Priority: P1)

The dispatcher opens "Notificar clientes", sees each merchant with shipments today, and for
each one taps "Enviar por WhatsApp": WhatsApp opens on the merchant's number with a message
already written, listing the shipments with their tracking links. The merchant forwards
each link to its recipient. The dispatcher sees which merchants have been notified and which
have new shipments since.

**Why this priority**: it replaces writing each notification by hand and answering "¿ya
salió?" one by one (C-01, C-02). Without it nobody receives the links.

**Independent Test**: register five shipments for two merchants; from "Notificar clientes",
send the message to one merchant and verify the text, the recipient number, and that the
merchant is marked as notified; register another shipment for it and verify it is shown as
pending.

**Acceptance Scenarios**:

1. **Given** two merchants with shipments for today, **When** the dispatcher opens
   "Notificar clientes", **Then** each merchant appears with its number of shipments and how
   many have not been included in a message.
2. **Given** a merchant with a WhatsApp number and three shipments, **When** the dispatcher
   taps "Enviar por WhatsApp", **Then** WhatsApp opens on that number with a message that
   greets the merchant, lists the three shipments (recipient, neighborhood, tracking number,
   tracking link), and ends with the merchant's private link.
3. **Given** the message was opened in WhatsApp, **Then** the three shipments are marked as
   notified with the time and the user, and the merchant shows "Notificado".
4. **Given** a merchant already notified, **When** a new shipment is registered for it,
   **Then** the merchant shows "1 envío sin notificar" and the next message lists only that
   shipment.
5. **Given** a merchant without a WhatsApp number, **Then** the dispatcher can copy the
   message and is invited to add the number.
6. **Given** a merchant with more than 20 shipments to notify, **Then** the message states
   the number of shipments and gives the merchant's private link instead of listing each.
7. **Given** any shipment's detail, **When** the dispatcher taps "Copiar enlace de
   seguimiento", **Then** the link is copied.

---

### User Story 3 - See all my shipments (Priority: P2)

A merchant opens its private link and sees its shipments of the day with their statuses, and
for each delivered one, who received it, when, and the proof-of-delivery photo. It can look
at earlier days and open any shipment's tracking page.

**Why this priority**: the top merchants ask about all their shipments at once (C-03); Amy
Tecnology alone is 63 % of the volume. The tracking links of User Stories 1 and 2 already
answer the questions one by one.

**Independent Test**: open a merchant's private link in a private window; verify it lists
only that merchant's shipments for today with statuses, shows the photo of a delivered one,
and lets the merchant see yesterday.

**Acceptance Scenarios**:

1. **Given** a merchant with eight shipments today, **When** its private link is opened,
   **Then** the page lists the eight with tracking number, recipient, neighborhood, status,
   delivery window, fee, and COD amount, with totals by status and the day's totals of
   fees, COD amounts, and amounts collected.
2. **Given** a delivered shipment on that list, **When** it is opened, **Then** the merchant
   sees the received-by name, the time, the proof-of-delivery photos, and the amount
   collected.
3. **Given** a shipment in "Novedad", **Then** the merchant sees the reason and every attempt. Each nonblank current/attempt
   note is replaced by a contact-support notice; absent or blank notes show no note.
4. **Given** the private link, **When** the merchant chooses an earlier date within the last
   30 days, **Then** the page lists that day's shipments.
5. **Given** the private link of merchant A, **Then** no shipment of another merchant can be
   reached from it.
6. **Given** the owner or the dispatcher replaces a merchant's private link, **Then** the
   previous link stops working at once and the new one works.

---

### Edge Cases

- **EC-01 Voided shipment**: its tracking page says "Este envío fue anulado" and shows the
  support contact; no courier or amount (FR-005).
- **EC-02 Shipment on a route not yet dispatched, or not on a route**: the page shows no
  courier and no "entregas antes de la tuya" (FR-006, FR-007).
- **EC-03 Courier changes (reassignment or handover)**: the page shows the courier who is
  responsible at that moment: the route's courier before pickup, the holder of the package
  after (FR-007).
- **EC-04 Package held off route or at the office**: status "En camino" is replaced by
  "Reprogramado" with the new service date; no courier is shown (FR-005, FR-007).
- **EC-05 Several attempts**: the tracking page shows only the current state and, after an
  exception, that a new attempt or a return is under way (FR-005).
- **EC-06 The courier completes stops out of order**: "entregas antes de la tuya" counts the
  pending delivery stops placed before this one and is worded as an estimate (FR-006).
- **EC-07 Old link**: 7 days after the shipment reached a final status, the tracking page
  shows only that the link has expired; the merchant still sees the shipment on its private
  link (FR-010).
- **EC-08 Reverse pickup, carrier handoff, errand**: wording adapts to the kind (FR-008).
- **EC-09 Someone tries many links**: requests are limited, and an invalid link always gets
  the same answer (FR-011).
- **EC-10 Link shared in a chat**: the preview shows only the product name, never data of
  the shipment (FR-012).
- **EC-11 Merchant deactivated**: its private link stops working; tracking links of its
  shipments keep working until they expire (FR-022).
- **EC-12 Shipment voided or edited after the message was sent**: the link always shows the
  current state; the merchant is not re-notified automatically (FR-016).
- **EC-13 Support contact not set**: the pages show no contact buttons, and "Notificar
  clientes" reminds the owner to set it (FR-009).
- **EC-14 Merchant link opened on a day without shipments**: a clear message and the date
  selector (FR-019).
- **EC-15 Photo no longer available** (older than 12 months) or still pending: the merchant
  sees a message in its place (FR-020).

## Requirements *(mandatory)*

### Functional Requirements

**Tracking page**

- **FR-001**: Every shipment MUST have a tracking link that opens its tracking page without
  signing in and without installing anything, on any current phone or computer browser.
- **FR-002**: The tracking link MUST contain a secret code that cannot be guessed or derived
  from the tracking number, the merchant, or the date. The code is created with the
  shipment and never changes.
- **FR-003**: The tracking page MUST be in Spanish, under the Domy name, and show: the
  merchant's name, the tracking number, the status in plain words (FR-005), the service
  date, the delivery window if any, the neighborhood of the recipient's address (for a
  carrier handoff, the carrier and the destination town), and the support contact
  (FR-009). Times are shown in Bogotá time as "3:45 p. m.".
- **FR-004**: The tracking page MUST NOT show the proof-of-delivery photo, the recipient's
  name, phone, or full address, the fee, the pickup address, the history of changes, or
  any other shipment. The destination is shown only as its neighborhood.
- **FR-005**: The status shown MUST follow this table:

  | Shipment | Text on the page |
  | --- | --- |
  | "Registrado" or "Asignado" | "Recibimos tu envío"; "Reprogramado para {date}" after an exception |
  | "En ruta" | "Tu envío va a ser recogido" |
  | "Recogido" on a route in progress | "En camino" |
  | "Recogido" on no route, or held at the office | "Reprogramado" with the service date |
  | "Entregado" | "Entregado a {received-by name} a las {time}", with the date |
  | "Novedad" without decision | "No pudimos entregar tu envío", with the reason |
  | "Novedad" with a return decided | "Tu envío será devuelto al remitente" |
  | "Devuelto" | "Devuelto al remitente" |
  | "Anulado" | "Este envío fue anulado" |

  The reasons are shown as "No encontramos a nadie", "La dirección no es correcta", and "El
  envío no fue recibido".
- **FR-006**: While a shipment is "Recogido" on a route in progress, the page MUST show how
  many pending delivery stops come before its own in the route's order, as "{N} entregas
  antes de la tuya" ("Eres la siguiente entrega" when none), worded as an estimate. For a
  reverse pickup it is shown while the shipment is "En ruta" and counts the stops before
  its pickup stop. It is not shown in any other state.
- **FR-007**: The page MUST show the first name (the first word of the name) of the courier
  responsible for the shipment,
  with buttons to call and to write on WhatsApp, only while the shipment is "En ruta" or
  "Recogido" on a route in progress and has no handover pending. The courier's phone is
  never shown after delivery, exception, return, or voiding.
- **FR-008**: Wording MUST adapt to the shipment kind:
  - a **reverse pickup** reads "Recogeremos el paquete en tu dirección" until it is picked
    up, then "En camino al remitente", then "Entregado al remitente a las {time}"; "entregas
    antes de la tuya" counts the stops before its pickup;
  - a **carrier handoff** reads "Entregado a la transportadora {carrier} para {town}" when
    delivered; the carrier's own tracking is outside this system;
  - an **errand** reads "Programada", "En curso", or "Realizada", with no courier queue.
- **FR-009**: The support contact (a phone number that can be called and written to on
  WhatsApp, and the company name "Cohex") MUST be set by the owner and shown on every
  tracking page and merchant page. While it is not set, no contact buttons are shown.
- **FR-010**: A tracking page MUST show full information until 7 days after the shipment
  became "Entregado", "Devuelto", or "Anulado"; after that it shows only that the link has
  expired, with the support contact. A reverted delivery or return makes the link current
  again.
- **FR-011**: An invalid, replaced, or deactivated link MUST always get the same "enlace no
  válido" answer. The system MUST refuse more than 60 requests a minute from one origin,
  so codes cannot be found by trial. An expired link reveals nothing about its shipment.
- **FR-012**: Tracking and merchant pages MUST ask search engines not to list them, and their
  link previews MUST show only the product name.
- **FR-013**: An open tracking page or merchant page MUST refresh on its own at least once
  a minute. The tracking page MUST be readable within 3 seconds on a weak mobile connection
  (about 1.5 Mbps with high latency).
- **FR-014**: When a shipment has a COD amount greater than zero and is not yet delivered,
  returned, or voided, the page MUST show "Valor a pagar al recibir" with the amount.

**WhatsApp message**

- **FR-015**: The owner and the dispatcher MUST be able to see, for a service date, every
  merchant with shipments, with the number of shipments and how many have not been included
  in a message ("Notificar clientes").
- **FR-016**: For a merchant, the system MUST compose a message in Spanish with a greeting,
  one entry per shipment of the date not yet notified and not voided (recipient's name, neighborhood, tracking number,
  tracking link), and the merchant's private link. With more than 20 shipments, the message
  gives the count and the private link instead of the entries. The dispatcher can choose to
  include all the shipments of the date instead of only the new ones.
- **FR-017**: "Enviar por WhatsApp" MUST open WhatsApp on the merchant's WhatsApp number with
  the message ready to send; "Copiar mensaje" copies it. Either action marks the included
  shipments as notified, with the user and the time. The system sends nothing by itself.
  A merchant without a WhatsApp number offers only "Copiar mensaje" and a way to add the
  number.
- **FR-018**: The shipment detail MUST offer "Copiar enlace de seguimiento" to the owner and
  the dispatcher, and show whether and when the shipment was notified.

**Merchant link**

- **FR-019**: Every merchant MUST have a private link that opens, without signing in, a page
  with that merchant's shipments for a date (today by default, any of the last 30 days):
  tracking number, merchant reference, recipient's name, neighborhood, status, delivery
  window, fee ("por confirmar" while the owner has not confirmed it, feature 001 FR-035),
  COD amount, and a link to each tracking page; with totals by status, the day's totals of
  fees, COD amounts to collect, and amounts collected by payment method (voided shipments
  and reverted records excluded), and a clear
  message when there are none. It shows no balance and no netting (Phase 2).
- **FR-020**: Opening a shipment of the last 30 days on the merchant page MUST show: the status with its time,
  the received-by name, the proof-of-delivery photos, the amount collected, and for an
  exception its reason and every attempt. Per the explicit owner decision of 2026-10-22,
  every nonblank current/attempt note is replaced by a contact-support notice, including
  benign notes; absent or blank notes show no note. Stored notes remain unchanged. A photo that is pending or no longer
  available is replaced by a message. The page never shows the recipient's phone, the
  courier's phone, or another merchant's data.
- **FR-021**: The merchant's private link MUST contain a secret code that cannot be guessed.
  The owner and the dispatcher MUST be able to copy it and to replace it; replacing it
  makes the previous link stop working at once. The replacement is recorded with author
  and time; the merchant receives the new link in the next message (FR-016). Otherwise a
  merchant link does not expire.
- **FR-022**: The private link of a deactivated merchant MUST stop working. Photos on the
  merchant page MUST be reachable only through a valid private link.

**General**

- **FR-023**: All text MUST be in Spanish (Colombia) with the glossary's terms; pages MUST
  follow the design system, work from 320 px wide, and meet WCAG 2.2 AA.
- **FR-024**: The public pages MUST be read-only: nothing can be changed or sent from them.
  A recipient's requests go through the WhatsApp buttons of FR-007 and FR-009.

### Key Entities

- **Tracking link**: the public address of one shipment's tracking page; carries the
  shipment's secret code.
- **Merchant link**: the private address of a merchant's page; carries the merchant's secret
  code, which can be replaced.
- **Notification**: the fact that a shipment was included in a message to its merchant: who
  and when.
- **Support contact**: the company's phone and name shown on public pages.
- **Public status**: the plain-language text shown for each state of a shipment (FR-005).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A dispatcher notifies every merchant of the day in under 2 minutes, with at
  most two taps per merchant.
- **SC-002**: A tracking page reflects a change of status within 1 minute.
- **SC-003**: A tracking page is readable within 3 seconds on a weak mobile connection
  (about 1.5 Mbps with high latency).
- **SC-004**: No tracking page shows information outside the list of FR-003–FR-008 and
  FR-014, verified for every status and shipment kind.
- **SC-005**: Trying 1,000 random links finds no shipment.
- **SC-006**: In a pilot week after the first month, counted by the dispatcher, fewer than
  one "¿ya salió?" question per ten shipments reaches the dispatcher.
- **SC-007**: In the same week, the top merchant asks the dispatcher about the status of its
  shipments less than once a day.

## Assumptions

- Features 001, 002, and 003 are in place; this feature adds no shipment status and changes
  no rule of theirs. It reads statuses, stop order, custody, received-by name, and photos.
- Messages are never sent automatically: the dispatcher sends them from their own WhatsApp,
  and the merchant forwards links to recipients (decision #9). Automatic notifications are
  Phase 3.
- The WhatsApp message goes to the merchant only. Copying one tracking link from a
  shipment's detail is available for the cases the dispatcher handles by hand.
- "Entregas antes de la tuya" is an estimate: the stop order is a recommendation to the
  courier (feature 002).
- The courier's first name and phone on the tracking page were confirmed by the owner
  (decision #8); they appear only while the courier is on the way.
- The merchant page shows fees, COD amounts, and amounts collected, but no balance or
  netting: statements are Phase 2 (clarified 2026-09-30).
- The support contact is stored with the office address introduced by feature 003.
- A merchant's self-service portal with sign-in is out of scope (business master, I-08).
