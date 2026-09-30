# Feature Specification: Shipment Registration and Dispatch Board

**Feature Branch**: `001-shipment-registration`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Registro de envíos y tablero de despacho: el coordinador registra envíos (individual y masivo) con cliente, punto de recogida, destinatario, dirección con barrio del catálogo, modalidad de pago y valor a recaudar, tarifa automática del tarifario, franja de entrega, tamaño, unidades y referencia del cliente; ve el día en un tablero de despacho con estados, envíos en riesgo y atrasados, y busca en el historial. Incluye acceso por roles (propietario, coordinador, mensajero), directorios de clientes y mensajeros con alias, catálogo de barrios y zonas tarifarias, y tarifario con vigencias. Fuente: docs/business-master.md y docs/glossary.md."

Business context: [business master](../../docs/business-master.md) (§4–§7, §12 items I-01–I-07,
D-03, D-04, K-01–K-04, M-02). Vocabulary: [glossary](../../docs/glossary.md). UI terms in this
document appear in Spanish between quotes.

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
   **Then** the save is refused with a message to review the latest version, and no change
   is lost silently.

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
zone, spelling variants). The owner maintains the rate card: standard rates per rate zone
and service level, merchant-specific overrides, each with an effective date.

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
   receive an email with a single-use link valid for a limited time.
3. **Given** five consecutive failed sign-in attempts, **Then** the account is temporarily
   locked and the user is told when to retry.

---

### Edge Cases

- **Neighborhood not in the catalog**: the dispatcher can add it on the spot, choosing its
  municipality and rate zone; the addition is recorded and visible to the owner.
- **No rate for the zone** (neither merchant nor standard): the shipment can only be saved
  with a manual fee and a reason, and is marked for the owner's review.
- **Rate card changes during the day**: shipments already registered keep their frozen fee.
- **COD amount above COP 2.000.000**: saving requires an explicit confirmation (the highest
  collection in 27 months was COP 1.194.700).
- **Service date on a Sunday or a delivery window already past**: allowed with a warning.
- **Carrier handoff**: destination is a carrier and a destination town instead of a
  recipient address; recipient phone is optional.
- **Reverse pickup**: origin is the recipient's address and destination is the merchant's
  pickup point; the rate zone is taken from the recipient's neighborhood.
- **Errand**: requires a description of the task; recipient fields are optional.
- **Payment mode "Flete al destinatario" with an overridden fee**: the COD amount follows
  the final fee.
- **Session expires while filling a form**: after signing in again, the entered data is
  still there.
- **Connection lost in the dispatch panel**: the panel says so clearly, keeps unsaved form
  data, and never reports a save that did not happen.
- **Bulk list with unknown columns or over 200 rows**: rejected with an explanation before
  preview.

## Requirements *(mandatory)*

### Functional Requirements

**Registration**

- **FR-001**: The system MUST let the dispatcher and the owner register a shipment of kind
  delivery, reverse pickup, carrier handoff, or errand.
- **FR-002**: Every shipment MUST record merchant, shipment kind, service date (default
  today), pickup point, fee, payment mode, COD amount, and status; plus, depending on kind,
  recipient name and phone, delivery address, neighborhood, municipality, carrier and
  destination town, or errand description.
- **FR-003**: The system MUST offer merchants by any registered name or alias and fill the
  merchant's default pickup point, which the dispatcher can change to another of its pickup
  points or a one-off address.
- **FR-004**: The system MUST suggest recipients previously used for the selected merchant
  and fill their data when chosen.
- **FR-005**: Neighborhoods MUST be chosen from the catalog, tolerating accents, case, and
  registered spelling variants; the municipality and rate zone follow from the neighborhood.
- **FR-006**: The system MUST calculate the fee from the rate card in force at registration
  time: the merchant's override for the rate zone and service level if one exists, otherwise
  the standard rate.
- **FR-007**: The dispatcher MUST be able to override the calculated fee only with a reason;
  both values are kept.
- **FR-008**: The fee MUST NOT change when the rate card changes later; it changes only if
  the shipment itself is edited in a way that changes its rate zone or service level.
- **FR-009**: Payment mode MUST set the COD amount: "Contraentrega" requires an amount
  greater than zero; "Flete al destinatario" sets it equal to the fee; "Crédito del cliente"
  sets it to zero.
- **FR-010**: Optional fields MUST include delivery window (presets "Antes de las…",
  "Después de las…", "Entre… y…", "En la mañana", "En la tarde", or explicit times),
  package size (small, medium, large, extra large), package count, merchant reference,
  service level (standard or express), and instructions.
- **FR-011**: Every shipment MUST get a unique tracking number: short (at most 10
  characters), easy to read aloud, and without ambiguous characters. It is not the public
  tracking link, which uses a separate unguessable token (feature 004).
- **FR-012**: Money MUST be whole Colombian pesos, displayed as "$ 13.000".
- **FR-013**: The system MUST warn, without blocking, about a possible duplicate: same
  merchant, same merchant reference, same service date.

**Lifecycle and history**

- **FR-014**: A new shipment MUST start in status "Registrado". This feature also defines
  the transition to "Anulado"; the remaining statuses of the shared lifecycle (§Key
  Entities) are introduced by features 002 and 003.
- **FR-015**: While a shipment has not been picked up, the dispatcher MUST be able to edit
  it or void it; voiding requires a reason. After pickup, both are refused.
- **FR-016**: Every creation, edit, override, and voiding MUST be recorded with author,
  time, and old and new values, and shown in the shipment's history.
- **FR-017**: Shipments MUST never be deleted.
- **FR-018**: Concurrent edits MUST never overwrite each other silently.

**Bulk registration**

- **FR-019**: The dispatcher MUST be able to register up to 200 shipments for one merchant
  at once by pasting rows or uploading a spreadsheet that follows a published template with
  Spanish column names.
- **FR-020**: Bulk registration MUST show a row-by-row preview with parsed values,
  calculated fee, neighborhood matches to confirm, and specific errors, and MUST create only
  confirmed valid rows, keeping the rest for correction.

**Dispatch board**

- **FR-021**: The board MUST show, for a selected date (default today), the count of
  shipments per status and a list with tracking number, merchant, recipient, neighborhood,
  status, delivery window, courier, COD amount, and flags.
- **FR-022**: A shipment not delivered MUST be flagged "En riesgo" from 45 minutes before
  its latest delivery time and "Atrasado" after it, showing minutes remaining or overdue.
  Shipments without a latest delivery time are never flagged.
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
  (name, aliases, phone), carriers, and catalog neighborhoods (name, spelling variants,
  municipality, rate zone).
- **FR-027**: Each alias MUST identify exactly one merchant or one courier.
- **FR-028**: Only the owner MUST be able to manage rate zones and the rate card: standard
  rates per rate zone and service level, merchant overrides, each with an effective date,
  keeping the full history of past rates.
- **FR-029**: Deactivated records MUST disappear from selection lists and remain in history.

**Access**

- **FR-030**: Every user MUST sign in with email and password and be able to recover access
  through a single-use link sent by email.
- **FR-031**: The system MUST support the roles owner, dispatcher, and courier: the owner
  can do everything in this feature, including users and rate card; the dispatcher can do
  everything except users and rate card; the courier has no access to the dispatch panel.
- **FR-032**: Only the owner MUST be able to create, deactivate, and change the role of
  user accounts; deactivation ends open sessions immediately.
- **FR-033**: Five consecutive failed sign-in attempts MUST lock the account temporarily.

**User interface**

- **FR-034**: All user-facing text MUST be in Spanish (Colombia) using the glossary's UI
  terms, and the interface MUST follow the design system (`docs/design-system.md`).

### Key Entities

- **Shipment**: one unit of work for a merchant. Kind, service date, tracking number,
  merchant, pickup point, destination (recipient and address, carrier and town, or errand
  description), neighborhood, rate zone, fee (calculated, final, override reason), payment
  mode, COD amount, delivery window, size, package count, merchant reference, service level,
  instructions, status.
- **Shipment lifecycle** (shared by features 001–004): "Registrado" (registered),
  "Asignado" (assigned to a route), "En ruta" (route dispatched), "Recogido" (picked up),
  "Entregado" (delivered), "Novedad" (delivery exception awaiting a decision), "Devuelto"
  (returned to sender), "Anulado" (voided). This feature creates "Registrado" and
  "Anulado".
- **Shipment event**: an immutable record of something that happened to a shipment: type,
  author, time, changed values, reason.
- **Merchant**: business or person billed for shipments. Name, aliases, WhatsApp contact,
  pickup points (one default), active flag.
- **Pickup point**: named address of a merchant with neighborhood.
- **Courier**: person who delivers. Name, aliases, phone, active flag, optional user
  account.
- **Carrier**: third-party company for carrier handoffs. Name, active flag.
- **Neighborhood**: catalog entry with spelling variants, municipality, and rate zone.
  Includes special destinations such as bus terminals and the airport.
- **Rate zone**: group of neighborhoods sharing a rate (e.g., Medellín; Bello–Itagüí;
  Envigado–Sabaneta–La Estrella; Copacabana; terminals and airport).
- **Rate card entry**: fee for a rate zone and service level, standard or for one merchant,
  with an effective date.
- **User**: person with access. Name, email, role, active flag.
- **Bulk batch**: one bulk registration: merchant, rows, and per-row outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A dispatcher registers a standard delivery for a known merchant in under 45
  seconds on average (60 seconds for 9 out of 10).
- **SC-002**: A dispatcher registers 20 shipments for one merchant from a pasted list in
  under 3 minutes, including review.
- **SC-003**: 100 % of shipments have a fee from the rate card or an override with a reason;
  no shipment exists without a fee.
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
  may, through the rate card.
- The 45-minute at-risk threshold is a fixed business rule (owner delegated the value).
- Couriers get accounts in this feature, but their app is feature 003; routes and
  assignment are feature 002; tracking links and WhatsApp messages are feature 004.
- Finance (cash-up, statements, receivables, payouts) is Phase 2 and out of scope.
- Operating hours are Monday to Saturday; registering for other days is possible with a
  warning.
- Password recovery email is sent through the system's transactional email service.
