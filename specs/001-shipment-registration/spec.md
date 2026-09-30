# Feature Specification: Shipment Registration and Dispatch Board

**Feature Branch**: `001-shipment-registration`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Registro de envíos y tablero de despacho: el coordinador registra envíos (individual y masivo) con cliente, punto de recogida, destinatario, dirección con barrio del catálogo, modalidad de pago y valor a recaudar, tarifa automática del tarifario, franja de entrega, tamaño, unidades y referencia del cliente; ve el día en un tablero de despacho con estados, envíos en riesgo y atrasados, y busca en el historial. Incluye acceso por roles (propietario, coordinador, mensajero), directorios de clientes y mensajeros con alias, catálogo de barrios y zonas tarifarias, y tarifario con vigencias. Fuente: docs/business-master.md y docs/glossary.md."

Business context: [business master](../../docs/business-master.md) (§4–§7, §12 items I-01–I-07,
D-03, D-04, K-01–K-04, M-02). Vocabulary: [glossary](../../docs/glossary.md). UI terms in this
document appear in Spanish between quotes.

## Clarifications

### Session 2026-09-30

- Q: When a shipment from a previous day is still not delivered, how does it appear on the next day's dispatch board? → A: It appears automatically on today's board in a "Pendientes de días anteriores" section, keeping its original service date.
- Q: How is the express service level ("turbo", "urgente") priced against each zone's standard rate? → A: Zone rate plus a single fixed express surcharge with an effective date; merchants with special rates may have their own surcharge.
- Q: How is the fee of an errand (buying an item, making a bank deposit) calculated? → A: Always a manual fee with a reason, set by the dispatcher for each errand.
- Q: How long does a dispatcher or owner session stay open in the dispatch panel? → A: Until the user signs out, for at most 30 days.
- Q: What hours do the "En la mañana" and "En la tarde" delivery windows represent? → A: Operating day 8:00 a. m.–8:00 p. m.; morning 8:00–12:00, afternoon 12:00–20:00.

### Checklist review 2026-09-30

Decisions taken while closing `checklists/core-rules.md`:

- The dispatcher may add neighborhoods with an existing rate zone and edit names and
  variants; only the owner changes the rate zone of an existing neighborhood (owner
  decision, CHK027).
- A carrier handoff takes its rate zone from a catalog handoff place (CHK001).
- A recalculated fee discards the earlier override (CHK007).
- Rate card entries are append-only; the most recently added entry wins on the same
  effective date (CHK005, CHK009).
- Security defaults: passwords of 8–128 characters, 15-minute lock, 60-minute recovery
  link, recovery ends sessions, at least one active owner (CHK017–CHK021, CHK025, CHK026).
- Master data and user changes are audited; recipient data is kept 10 years (CHK022,
  CHK023).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register a shipment (Priority: P1)

The dispatcher receives a request by WhatsApp and registers it in the system instead of
retyping it into a spreadsheet. They pick the merchant (typing any known name or alias),
the merchant's default pickup point is filled in, they enter the recipient, the delivery
address with its neighborhood from the catalog, the payment mode and COD amount, and any
optional details (delivery window, size, package count, merchant reference, service level,
instructions). The fee is calculated automatically from the rate card. On saving, the
shipment gets a tracking number and appears on today's dispatch board.

**Why this priority**: registration is the entry point of the whole operation and replaces
the daily sheet (I-01, I-02, I-04, K-01). Without it nothing else in Phase 1 works.

**Independent Test**: sign in as dispatcher, register a delivery for an existing merchant to
a catalog neighborhood with "Contraentrega", and verify the shipment exists with the correct
fee, COD amount, tracking number, and status "Registrado", and that its creation is recorded
with author and time.

**Acceptance Scenarios**:

1. **Given** merchant "Bullish Hype" with a default pickup point and the standard rate card,
   **When** the dispatcher registers a delivery to a neighborhood in the Medellín rate zone
   with payment mode "Crédito del cliente", **Then** the shipment is saved with fee
   COP 13.000, COD amount 0, status "Registrado", a unique tracking number, and today as
   service date.
2. **Given** merchant "Amy Tecnology" has a merchant rate card with COP 10.700 for the
   Bello–Itagüí zone, **When** the dispatcher registers a delivery to a neighborhood in
   Itagüí, **Then** the fee is COP 10.700, not the standard COP 15.000.
3. **Given** payment mode "Flete al destinatario", **When** the fee is COP 15.000, **Then**
   the COD amount is set to COP 15.000 automatically and cannot differ from the fee.
4. **Given** payment mode "Contraentrega", **When** the dispatcher leaves the COD amount
   empty or zero, **Then** the shipment cannot be saved and the field explains why.
5. **Given** the dispatcher types "bullish" in the merchant field, **When** the list
   appears, **Then** "Bullish Hype" is offered, and typing a registered alias also finds it.
6. **Given** the dispatcher needs a different fee (e.g., a negotiated price), **When** they
   override the calculated fee, **Then** a reason is required and both the calculated and
   the final fee are kept.
7. **Given** a delivery window "Antes de las 5:00 p. m." for today, **When** the shipment is
   saved, **Then** the window is stored as a latest delivery time of 17:00 on the service
   date.
8. **Given** a delivery window "En la tarde" for today, **When** the shipment is saved,
   **Then** it is stored as earliest 12:00 and latest 20:00, so it becomes "En riesgo" at
   19:15 if not delivered.
9. **Given** shipment kind "Diligencia", **When** the dispatcher registers it, **Then** no fee
   is calculated, a manual fee and a reason are required, and the shipment is not marked
   for the owner's review.
10. **Given** a standard express surcharge of COP 4.500, **When** the dispatcher registers an
    express delivery to the Medellín rate zone for a merchant on the standard rate card,
    **Then** the fee is COP 17.500.
11. **Given** a merchant whose express surcharge override is COP 0, **When** an express
    delivery is registered for it, **Then** the fee equals its zone rate.
12. **Given** shipment kind "Entrega a transportadora" to the handoff place "Terminal del
    Norte", **When** it is registered, **Then** the fee is the rate of that place's rate
    zone and the carrier and destination town are required.

---

### User Story 2 - See the day on the dispatch board (Priority: P1)

The dispatcher and the owner open the dispatch board and see every shipment of the selected
day: how many are in each status, which are at risk of missing their delivery window, which
are late, and which have exceptions. They filter by status, merchant, courier, and zone, and
open any shipment to see its details and history. The board updates by itself.

**Why this priority**: it replaces asking couriers by WhatsApp and scanning the sheet (D-03,
D-04); together with Story 1 it forms the minimum usable product for the office.

**Independent Test**: register shipments with and without delivery windows, move the clock
to 44 minutes before a window closes, and verify the board shows correct counts, flags the
shipment "En riesgo", and later "Atrasado", without reloading the page.

**Acceptance Scenarios**:

1. **Given** 20 shipments for today in various statuses, **When** the dispatcher opens the
   board, **Then** a count per status is shown and each shipment shows tracking number,
   merchant, recipient, neighborhood, status, delivery window, courier (if any), and COD
   amount.
2. **Given** a shipment not yet delivered with latest delivery time 17:00, **When** the time
   reaches 16:15, **Then** it is flagged "En riesgo" with the minutes remaining; **When** the
   time passes 17:00, **Then** it is flagged "Atrasado" with the minutes overdue.
3. **Given** a shipment with no latest delivery time, **Then** it is never flagged at risk or
   late.
4. **Given** another user registers or changes a shipment, **When** at most 30 seconds pass,
   **Then** the board shows the change without a manual reload.
5. **Given** the dispatcher selects a past or future date, **Then** the board shows that
   day's shipments.
6. **Given** a shipment with yesterday's service date that is neither delivered, returned,
   nor voided, **When** the dispatcher opens today's board, **Then** it appears in the
   section "Pendientes de días anteriores" with its original service date and days pending,
   and is included in today's counts and flags.

---

### User Story 3 - Correct or void a shipment (Priority: P2)

The dispatcher fixes mistakes (wrong address, wrong COD amount, new window) or voids a
request the merchant cancelled, as long as the shipment has not been picked up. Every
change is recorded with who made it, when, and what changed.

**Why this priority**: mistakes and cancellations happen daily; without traceable correction
the dispatcher would create duplicates, breaking the single source of truth (K-03).

**Independent Test**: edit the COD amount of a registered shipment, then void another with a
reason, and verify both actions appear in each shipment's history with author, time, and
old and new values.

**Acceptance Scenarios**:

1. **Given** a shipment in status "Registrado", **When** the dispatcher changes its delivery
   address to a neighborhood in another rate zone, **Then** the fee is recalculated from the
   rate card in force at the original registration time and the change is recorded.
2. **Given** a shipment already picked up, **When** the dispatcher tries to edit or void it,
   **Then** the system refuses and explains that it is in route.
3. **Given** the dispatcher voids a shipment, **Then** a reason is required, the status
   becomes "Anulado", and the shipment remains searchable; it is never deleted.
4. **Given** two users edit the same shipment at the same time, **When** the second saves,
   **Then** the save is refused with a message to review the latest version, the typed
   values stay in the form, and no change is lost silently.
5. **Given** a shipment whose fee was overridden with a reason, **When** the dispatcher
   changes its neighborhood to one in another rate zone, **Then** the form shows the newly
   calculated fee, the earlier override is discarded, and a new override requires a new
   reason.
6. **Given** a shipment with payment mode "Contraentrega" and COD amount COP 80.000, **When**
   its fee changes, **Then** the COD amount stays COP 80.000.
7. **Given** a shipment with an overridden fee, **When** the dispatcher sets the fee back to
   the calculated value, **Then** no reason is required and the change is recorded.

---

### User Story 4 - Register shipments in bulk (Priority: P2)

For high-volume merchants (Amy Tecnology sends about 12 shipments a day), the dispatcher
selects the merchant and pastes a list copied from a spreadsheet or chat, or uploads a
spreadsheet file. The system shows a preview row by row, marks errors and unrecognized
neighborhoods, lets the dispatcher fix them, and creates all valid shipments at once.

**Why this priority**: 63 % of today's volume comes from one merchant (I-03); bulk entry
removes most of the remaining typing, but single registration must exist first.

**Independent Test**: paste 20 rows for one merchant, including 2 with errors and 1 with a
misspelled neighborhood, fix them in the preview, confirm, and verify 20 shipments exist with
correct fees and tracking numbers.

**Acceptance Scenarios**:

1. **Given** a pasted list whose columns follow the published template, **When** the
   dispatcher previews it, **Then** each row shows its parsed values, calculated fee, and
   either "Lista" or the specific errors found.
2. **Given** a row with neighborhood "copàcabana", **When** previewed, **Then** the system
   proposes the catalog neighborhood "Copacabana" and the dispatcher confirms or changes it.
3. **Given** 18 valid rows and 2 invalid rows, **When** the dispatcher confirms, **Then** 18
   shipments are created and the 2 invalid rows remain in the preview for correction.
4. **Given** a row whose merchant reference already exists for the same merchant and service
   date, **Then** the row is flagged as a possible duplicate and requires explicit
   confirmation.

---

### User Story 5 - Search the history (Priority: P2)

The dispatcher or owner finds any past shipment by tracking number, merchant reference,
merchant, recipient name or phone, neighborhood, status, or date range, and sees its full
detail and event history. The owner can export the results.

**Why this priority**: disputes ("never arrived") and merchant questions are answered from
history; it replaces scrolling the 20,000-row ledger (K-02) and fulfills data ownership
(Constitution IX).

**Independent Test**: create shipments across several dates, search by merchant reference
and by recipient phone, verify the right results and history, and export them as a
spreadsheet that opens with Spanish headers and the same values.

**Acceptance Scenarios**:

1. **Given** a tracking number, **When** searched, **Then** that shipment is shown first.
2. **Given** a recipient phone number, **When** searched, **Then** every shipment to that
   phone is listed, newest first.
3. **Given** a search result, **When** the owner exports it, **Then** a CSV/Excel file with
   every visible field is downloaded.
4. **Given** a shipment, **When** its detail is opened, **Then** every event is listed with
   who, when, and what changed.

---

### User Story 6 - Maintain master data and the rate card (Priority: P3)

The owner and the dispatcher maintain the merchants directory (names, aliases, WhatsApp
contact, pickup points, default pickup point), the couriers directory (names, aliases,
phone), the carriers list, and the neighborhood catalog (neighborhood, municipality, rate
zone, spelling variants). The owner maintains the rate card: a standard rate per rate zone,
a single express surcharge, and merchant-specific overrides of either, each with an
effective date.

**Why this priority**: registration depends on this data, but it can be seeded at go-live
and edited rarely afterwards.

**Independent Test**: create a merchant with two pickup points and an alias, add a
neighborhood to a zone, schedule a new standard rate effective tomorrow, and verify that a
shipment registered today uses the old rate and one registered tomorrow uses the new rate.

**Acceptance Scenarios**:

1. **Given** a rate change effective from a future date, **When** shipments are registered
   before that date, **Then** they use the current rate; from that date on, the new one.
2. **Given** a merchant or courier is deactivated, **Then** it cannot be selected for new
   shipments but remains visible in history.
3. **Given** an alias is already used by another merchant, **When** it is added, **Then**
   the system refuses it, so every alias identifies exactly one merchant.
4. **Given** the dispatcher, **When** they try to change the rate card, **Then** the action
   is not available; only the owner can change rates.
5. **Given** the dispatcher, **When** they add a neighborhood with an existing rate zone,
   **Then** it is saved and listed for the owner's review; **When** they try to change the
   rate zone of an existing neighborhood, **Then** the action is not available.
6. **Given** two rate entries for the same zone with the same effective date, **Then** the
   one added last applies.
7. **Given** a merchant with 3 open shipments, **When** it is deactivated, **Then** the
   system warns about the 3 open shipments, which keep working after confirmation.

---

### User Story 7 - Access by role (Priority: P3)

The owner creates accounts for the dispatcher and couriers, assigns roles, deactivates
accounts, and every user signs in with email and password and can recover access by email.
Each role sees only what it is allowed to.

**Why this priority**: required for real use and for security, but a single owner account
is enough to test Stories 1–6.

**Independent Test**: create a dispatcher and a courier; verify the dispatcher reaches the
dispatch panel but not the rate card or user management, and the courier cannot open the
dispatch panel at all.

**Acceptance Scenarios**:

1. **Given** a deactivated account, **When** its user tries to sign in or has an open
   session, **Then** access is denied immediately.
2. **Given** a user forgot their password, **When** they request recovery, **Then** they
   receive an email with a single-use link valid for 60 minutes.
3. **Given** five consecutive failed sign-in attempts, **Then** password sign-in is locked
   for 15 minutes and the user is told when to retry.
4. **Given** a dispatcher signed in 29 days ago who never signed out, **When** they open the
   panel, **Then** they are still signed in; **Given** 30 days have passed, **Then** they
   must sign in again.
5. **Given** the owner ends a user's sessions, **Then** that user must sign in again on
   every device.
6. **Given** a single active owner, **When** they try to deactivate or demote themself,
   **Then** the system refuses and explains that one active owner is always required.
7. **Given** a recovery request for an email that is not registered, **Then** the screen
   shows the same confirmation as for a registered email.
8. **Given** a locked account, **When** its user completes a password recovery, **Then** the
   lock is lifted and every earlier session of that user is ended.

---

### Edge Cases

- **EC-01 Neighborhood not in the catalog**: the dispatcher adds it on the spot, choosing
  its municipality and an existing rate zone; it is listed for the owner's review (FR-026,
  FR-036).
- **EC-02 No rate for the zone** (neither merchant nor standard): the shipment is saved
  only with a manual fee and a reason, and is marked "Tarifa por revisar" (FR-035).
- **EC-03 Rate card or neighborhood zone changes later**: shipments already registered keep
  their fee (FR-008).
- **EC-04 Unusually high amounts**: a COD amount above COP 2.000.000 or a fee above
  COP 100.000 requires explicit confirmation (FR-037).
- **EC-05 Service date on a Sunday, or a delivery window already past**: allowed with a
  warning (FR-010).
- **EC-06 Carrier handoff**: the destination is a handoff place from the catalog (bus
  terminal, airport, or carrier office), which gives the rate zone, plus the carrier and
  the destination town; recipient name and phone are optional (FR-002, FR-006).
- **EC-07 Reverse pickup**: origin is the recipient's address and destination is the
  merchant's pickup point; the rate zone comes from the recipient's neighborhood (FR-006).
- **EC-08 Errand**: requires a description and a manual fee with a reason; recipient
  fields and neighborhood are optional (FR-007a).
- **EC-09 Fee changes after registration**: the COD amount follows the payment mode rule
  (FR-009).
- **EC-10 Session expired, connection lost, or edit conflict while filling a form**: the
  typed values stay in the form and no save is reported unless it happened (FR-038).
- **EC-11 Bulk list with unknown columns or over 200 rows**: rejected with an explanation
  before the preview (FR-019).
- **EC-12 Deactivating a record with open shipments**: allowed; open shipments are not
  affected (FR-029).
- **EC-13 Pending shipment whose delivery window belongs to a past day**: shown as
  "Atrasado" (FR-022).
- **EC-14 Repeated failed sign-ins by a third party**: the legitimate user recovers access
  through password recovery and keeps any open session (FR-033).
- **EC-15 Last active owner**: cannot be deactivated or demoted (FR-032).

## Requirements *(mandatory)*

### Functional Requirements

**Registration**

- **FR-001**: The system MUST let the dispatcher and the owner register a shipment of kind
  delivery, reverse pickup, carrier handoff, or errand.
- **FR-002**: Every shipment MUST record merchant, shipment kind, service date (default
  today), pickup point, fee, payment mode, COD amount, and status; plus, depending on kind:
  - delivery and reverse pickup: recipient name and phone, address, and neighborhood;
  - carrier handoff: handoff place (a catalog entry of kind bus terminal, airport, or
    carrier office), carrier, and destination town;
  - errand: description of the task.
- **FR-003**: The system MUST offer merchants by any registered name or alias and fill the
  merchant's default pickup point, which the dispatcher can change to another of its pickup
  points or a one-off address.
- **FR-004**: The system MUST suggest recipients from past shipments of the selected
  merchant only, searchable by name or phone, and fill their data when chosen. A recipient
  is identified by phone number.
- **FR-005**: Neighborhoods MUST be chosen from the catalog, tolerating accents, case, and
  registered spelling variants; the municipality and rate zone follow from the neighborhood.
- **FR-006**: The system MUST calculate the fee from the rate card in force at registration
  time: the zone rate (the merchant's override for the rate zone if one exists, otherwise
  the standard rate) plus, for express service level, the express surcharge (the
  merchant's override if one exists, otherwise the standard surcharge; an override of zero
  is valid and means express costs that merchant nothing extra). The rate zone comes from
  the recipient's neighborhood for deliveries and reverse pickups, and from the handoff
  place for carrier handoffs. Errands are the exception: their fee is always entered
  manually (FR-007a).
- **FR-007**: The dispatcher MUST be able to override the calculated fee only with a reason;
  both values are kept.
- **FR-007a**: For errands, the dispatcher MUST enter the fee manually together with a short
  reason (e.g., the task and distance); it is an expected case and is not marked for the
  owner's review.
- **FR-008**: The fee MUST NOT change when the rate card or a neighborhood's rate zone
  changes later. It is recalculated only when the shipment itself is edited in a way that
  changes its rate zone or service level, always using the rate card in force at the
  original registration time. A recalculation discards any earlier override; the dispatcher
  sees the new fee before saving and may override it again with a reason.
- **FR-009**: Payment mode MUST set the COD amount: "Contraentrega" requires an amount
  greater than zero; "Flete al destinatario" sets it equal to the fee; "Crédito del cliente"
  sets it to zero. When the fee changes later, "Flete al destinatario" follows the final
  fee and the other two modes keep their COD amount.
- **FR-010**: Optional fields MUST include delivery window (presets "Antes de las…",
  "Después de las…", "Entre… y…", "En la mañana" = 8:00–12:00, "En la tarde" =
  12:00–20:00, or explicit times within operating hours 8:00–20:00), package size (small,
  medium, large, extra large), package count, merchant reference, service level (standard
  or express), and instructions. A service date on a Sunday or a window already past MUST
  produce a warning without blocking.
- **FR-011**: Every shipment MUST get a unique tracking number: short (at most 10
  characters), easy to read aloud, and without ambiguous characters. It is permanent and
  never reused, including for voided shipments. It is not the public tracking link, which
  uses a separate unguessable token (feature 004).
- **FR-012**: Money MUST be whole Colombian pesos, displayed as "$ 13.000". Money fields
  MUST accept digits with optional "$", dots, and spaces, and reject decimals and negative
  amounts.
- **FR-013**: The system MUST warn, without blocking, about a possible duplicate: same
  merchant and service date with the same merchant reference or, when there is no
  reference, the same recipient phone.
- **FR-035**: When no rate exists for the rate zone, the shipment MUST be saved only with a
  manual fee and a reason and be marked "Tarifa por revisar". The owner MUST be able to
  filter marked shipments on the board and in history and confirm or correct the fee,
  which removes the mark and is recorded.
- **FR-037**: A fee MUST be greater than zero. A fee above COP 100.000 or a COD amount
  above COP 2.000.000 MUST require explicit confirmation before saving.
- **FR-040**: Every reason (fee override, errand fee, missing rate, voiding) MUST be a text
  of 5 to 200 characters.

**Lifecycle and history**

- **FR-014**: A new shipment MUST start in status "Registrado". This feature implements two
  transitions: creation into "Registrado", and voiding into "Anulado" from "Registrado",
  "Asignado", or "En ruta". The remaining transitions of the shared lifecycle (§Key
  Entities) are defined by features 002 and 003.
- **FR-015**: While a shipment is "Registrado", "Asignado", or "En ruta", the dispatcher
  MUST be able to void it with a reason or edit any field except tracking number, merchant,
  and shipment kind (to change those, the shipment is voided and registered again). From
  "Recogido" on, both are refused.
- **FR-016**: Every creation, edit, override, fee confirmation, and voiding MUST be recorded
  with author, time, and old and new values, and shown in the shipment's history.
- **FR-017**: Shipments MUST never be deleted.
- **FR-018**: Concurrent edits MUST never overwrite each other silently.
- **FR-036**: Every creation, change, deactivation, and reactivation of users and roles,
  merchants, pickup points, couriers, carriers, neighborhoods, rate zones, and rate card
  entries MUST be recorded with author, time, and old and new values, visible to the owner.
  Neighborhoods added by a dispatcher MUST be listed for the owner's review until the owner
  confirms them.
- **FR-038**: When a save fails because the session expired, the connection was lost, or
  another user changed the record, the values typed MUST remain in the form so the user can
  retry without retyping, and the system MUST NOT report a save that did not happen.
- **FR-039**: "Today", service dates, delivery windows, and effective dates MUST be
  interpreted in Colombian time (`America/Bogota`).

**Bulk registration**

- **FR-019**: The dispatcher MUST be able to register up to 200 shipments for one merchant
  at once by pasting rows or uploading a spreadsheet that follows a published template with
  Spanish column names. Lists with unknown columns or more than 200 rows MUST be rejected
  with an explanation before the preview.
- **FR-020**: Bulk registration MUST show a row-by-row preview with parsed values,
  calculated fee, neighborhood matches to confirm, and specific errors. Confirmation MUST
  create all confirmed valid rows together or none of them; rows that are invalid or not
  confirmed stay in the preview for correction.

**Dispatch board**

- **FR-021**: The board MUST show, for a selected date (default today), the count of
  shipments per status and a list with tracking number, merchant, recipient, neighborhood,
  status, delivery window, courier, COD amount, and flags. Today's board MUST also list,
  in a separate section "Pendientes de días anteriores", every shipment from earlier
  service dates that is not delivered, returned, or voided, keeping its original service
  date; these shipments are included in today's counts and flags.
- **FR-022**: A shipment in status "Registrado", "Asignado", "En ruta", "Recogido", or
  "Novedad" MUST be flagged "En riesgo" from 45 minutes before its latest delivery time and
  "Atrasado" after it, showing the time remaining or overdue (in days once it exceeds 24
  hours). Shipments without a latest delivery time, and shipments "Entregado", "Devuelto",
  or "Anulado", are never flagged.
- **FR-023**: The board MUST be filterable by status, merchant, courier, rate zone, and
  flags, and MUST reflect changes made by any user within 30 seconds without a reload.

**Search and export**

- **FR-024**: Users with dispatcher or owner role MUST be able to search shipments by
  tracking number, merchant reference, merchant, recipient name or phone, neighborhood,
  status, and date range.
- **FR-025**: The owner MUST be able to export search results to CSV and Excel with Spanish
  column names.

**Master data**

- **FR-026**: The dispatcher and the owner MUST be able to create, edit, and deactivate
  merchants (name, aliases, WhatsApp contact, pickup points, default pickup point), couriers
  (name, aliases, phone), and carriers. Both MUST be able to add catalog neighborhoods
  (name, municipality, an existing rate zone) and edit their names and spelling variants.
  Only the owner MUST be able to change the rate zone of an existing neighborhood.
- **FR-027**: Within its directory, each alias MUST identify exactly one merchant or exactly
  one courier and MUST NOT equal another record's name. The same text may name a merchant
  and a courier, because the two directories are never searched together.
- **FR-028**: Only the owner MUST be able to manage rate zones and the rate card: a standard
  rate per rate zone, one standard express surcharge, and merchant overrides of zone rates
  and of the express surcharge. Each entry has an effective date, a calendar day that
  starts at 00:00. Entries are never edited or removed: to correct a scheduled or current
  rate the owner adds a new entry, and when two entries share an effective date the most
  recently added applies. The full history of past rates is kept.
- **FR-029**: Deactivated records MUST disappear from selection lists and remain in history;
  shipments already open keep working with them. Deactivating a merchant MUST warn with its
  number of open shipments. A merchant with active pickup points MUST always have exactly
  one default.

**Access**

- **FR-030**: Every user MUST sign in with email and password and be able to change their
  own password. Passwords MUST have 8 to 128 characters, with no composition rules. Access
  MUST be recoverable through a single-use link sent by email, valid for 60 minutes. The
  recovery screen MUST show the same confirmation whether or not the email is registered.
  Completing a recovery MUST end all of that user's open sessions and lift any lock.
- **FR-031**: The system MUST support the roles owner, dispatcher, and courier with the
  permissions in the table below.
- **FR-032**: Accounts are created only by the owner; there is no self-registration, and the
  first owner account is created at installation. Only the owner MUST be able to create
  accounts, edit their name and email, change their role, and deactivate or reactivate
  them. After deactivation, the next request from any of that user's sessions MUST be
  refused. The system MUST always keep at least one active owner: the last active owner
  cannot be deactivated or demoted.
- **FR-033**: Five consecutive failed sign-in attempts MUST lock password sign-in for that
  account for 15 minutes, telling the user when to retry. The lock does not end sessions
  already open, and a completed password recovery lifts it.
- **FR-033a**: A dispatcher or owner session MUST last until the user signs out, for at most
  30 days; users MUST be able to sign out, and the owner MUST be able to end any user's
  open sessions. The session rule for couriers is defined by feature 003.
- **FR-041**: Recipients' personal data (name, phone, address) MUST be visible only to the
  owner and the dispatcher in this feature, MUST NOT appear in system logs, and MUST be
  kept for 10 years as commercial supporting records (Código de Comercio, art. 60), handled
  under Ley 1581 de 2012.

| Capability | Owner | Dispatcher | Courier |
| --- | --- | --- | --- |
| Register, edit, and void shipments; bulk registration | Yes | Yes | No |
| Dispatch board, search, shipment history | Yes | Yes | No |
| Export search results | Yes | No | No |
| Merchants, pickup points, couriers, carriers | Yes | Yes | No |
| Add neighborhoods; edit their names and variants | Yes | Yes | No |
| Change a neighborhood's rate zone; manage rate zones | Yes | No | No |
| View the rate card and fees | Yes | Yes | No |
| Change the rate card | Yes | No | No |
| Review "Tarifa por revisar" and neighborhoods added by dispatchers | Yes | No | No |
| Users, roles, sessions; history of master data changes | Yes | No | No |

**User interface**

- **FR-034**: All user-facing text MUST be in Spanish (Colombia) using the glossary's UI
  terms, and the interface MUST follow the design system (`docs/design-system.md`).

### Key Entities

- **Shipment**: one unit of work for a merchant. Kind, service date, tracking number,
  merchant, pickup point, destination (recipient and address, carrier and town, or errand
  description), neighborhood, rate zone, fee (calculated, final, override reason), payment
  mode, COD amount, delivery window, size, package count, merchant reference, service level,
  instructions, status, "Tarifa por revisar" mark.
- **Shipment lifecycle** (shared by features 001–004): "Registrado" (registered),
  "Asignado" (assigned to a route), "En ruta" (route dispatched), "Recogido" (picked up),
  "Entregado" (delivered), "Novedad" (delivery exception awaiting a decision), "Devuelto"
  (returned to sender), "Anulado" (voided). This feature creates "Registrado" and
  "Anulado".
- **Shipment event**: an immutable record of something that happened to a shipment: type,
  author, time, changed values, reason.
- **Audit event**: an immutable record of a change to a user, merchant, pickup point,
  courier, carrier, neighborhood, rate zone, or rate card entry: author, time, changed
  values.
- **Merchant**: business or person billed for shipments. Name, aliases, WhatsApp contact,
  pickup points (one default), active flag.
- **Pickup point**: named address of a merchant with neighborhood.
- **Courier**: person who delivers. Name, aliases, phone, active flag, optional user
  account.
- **Carrier**: third-party company for carrier handoffs. Name, active flag.
- **Neighborhood**: catalog entry with spelling variants, municipality, and rate zone.
  Includes handoff places: bus terminals, the airport, and carrier offices. Entries added
  by a dispatcher are pending the owner's review.
- **Rate zone**: group of neighborhoods sharing a rate (e.g., Medellín; Bello–Itagüí;
  Envigado–Sabaneta–La Estrella; Copacabana; terminals and airport).
- **Rate card entry**: either a zone rate (fee for one rate zone) or the express surcharge
  (fixed amount added for express service level), standard or for one merchant, with an
  effective date.
- **User**: person with access. Name, email, role, active flag.
- **Bulk batch**: one bulk registration: merchant, rows, and per-row outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A dispatcher registers a standard delivery for a known merchant in under 45
  seconds on average (60 seconds for 9 out of 10).
- **SC-002**: A dispatcher registers 20 shipments for one merchant from a pasted list in
  under 3 minutes, including review.
- **SC-003**: 100 % of shipments have a fee greater than zero, and every fee that does not
  come from the rate card (override, errand, missing rate) has a reason.
- **SC-004**: Any change to a shipment is visible on every open dispatch board within 30
  seconds.
- **SC-005**: 100 % of shipments with a latest delivery time are flagged at risk at least 45
  minutes before it and late immediately after it, if not delivered.
- **SC-006**: A shipment is found by tracking number, merchant reference, or recipient phone
  in under 2 seconds with at least 100,000 shipments in history.
- **SC-007**: The owner performs zero manual consolidation: every shipment is available in
  history, search, and export the moment it is registered.
- **SC-008**: A dispatcher who has never used the system registers 5 shipments correctly
  after a walkthrough of 10 minutes or less.

## Assumptions

- The dispatch panel is used on a desktop or laptop with an internet connection; it does not
  need to work offline, but it must never lose form data or report a save that did not
  happen.
- The neighborhood catalog, rate zones, standard rate card, Amy Tecnology's rate card,
  merchants, couriers, and carriers are loaded at go-live from the business master and the
  owner's input; no historical shipments are migrated (migration not contracted).
- Package size does not affect the fee (owner decision 2026-09-30); express service level
  adds a fixed surcharge (clarified 2026-09-30; about COP 4.500 in 2026 data).
- The 45-minute at-risk threshold is a fixed business rule (owner delegated the value).
- Couriers get accounts in this feature, but their app and session rule are feature 003;
  routes and assignment are feature 002, including removing a voided shipment from its
  route; tracking links and WhatsApp messages are feature 004.
- The seed loads a standard express surcharge of COP 4.500, which the owner can change.
- Finance (cash-up, statements, receivables, payouts) is Phase 2 and out of scope.
- Operating hours are Monday to Saturday, 8:00 a. m. to 8:00 p. m. (clarified 2026-09-30);
  registering for other days is possible with a warning.
- Password recovery email is sent through the system's transactional email service.
