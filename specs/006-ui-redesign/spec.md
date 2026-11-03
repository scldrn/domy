# Feature Specification: Coherent Redesign of Every Web Interface

**Feature Branch**: `006-ui-redesign`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Visual redesign of every web UI surface of Domy so the whole product shares one coherent, modern design language with extreme attention to detail. Scope: the owner/dispatcher panel (board, new shipment, bulk registration, routes, history, notify merchants, shipment detail and edit, master data: merchants, couriers, carriers, neighborhoods, rate card; administration: settings, users, audit), the courier app (/mensajero: route, stop, my day, pending, offline states, high contrast), the public pages (recipient tracking, merchant pages) and the sign-in/recovery screens. The reference is the dashboard proposal the owner approved in the design artifact (version 9): pizarra/slate surfaces with a lime accent, Archivo, the drawn route-d wordmark, sentence-first summaries, balanced density (what is used every hour stays on the page; the rest is one click away), state colors that only mean state, light and dark themes, phone widths, WCAG 2.2 AA. The redesign changes presentation and interaction quality only: no business rule, API contract, or data change, except read data a screen needs to show what the approved board shows. The design system document (docs/design-system.md) must be updated first (palette, tokens, components, patterns) because visual decisions belong to the owner; each area's proposal is rendered for the owner to approve before it is implemented. Known defects to fix along the way: the audit screen shows raw UUIDs instead of names. Delivered as slices per area, each one its own branch and pull request, with existing e2e and axe checks kept green."

Business context: the owner judged the current interface "muy feo" and wants a product that
impresses Cohex's owner, Santiago Marín, without losing what the dispatcher and the couriers
use every day. The reference is the dispatch board proposal, published as a private design
artifact (`Domy: nuevo tablero de despacho`, version 9, 2026-11-02), which went through three
rounds: too simple, then overloaded, then balanced. Its lesson is this feature's main rule:
**what people look at or act on every hour stays on the page; everything else is one click
away**. Builds on features 001–004; vocabulary from [the glossary](../../docs/glossary.md);
rules from [the design system](../../docs/design-system.md), which this feature updates first.

## Clarifications

### Session 2026-11-02

- Q: Does the board's lime replace the current teal as the accent of all of Domy? → A: Yes, lime everywhere (panel, courier app, public pages, sign-in); always as a fill under dark text, never as text on a light surface.
- Q: Does the courier app also take the board's dark pizarra surfaces? → A: No: light surfaces by default, pizarra only in its header and navigation bar, dark theme when the phone asks for it, and high contrast kept.
- Q: How does the owner approve proposals: per area or per screen? → A: Per screen: each screen gets its own proposal and approval before it is implemented (the board's is already approved).
- Q: Does the panel have its own light/dark switch that remembers the choice? → A: Yes: it follows the computer by default; the header switch changes it and the panel remembers the choice on that computer.
- Q: Which area is redesigned first after the board? → A: Daily operation (new and bulk shipment, detail and edit, routes, history, notify), as US2 already orders.

## Screens in scope

| Area | Screens (Spanish URL) | Users |
| --- | --- | --- |
| Panel shell | Navigation rail, top bar, global search, theme, account | Owner, dispatcher |
| Daily operation | Tablero `/`, Nuevo envío, Registro masivo, Detalle y edición de envío, Rutas and route detail, Historial, Notificar clientes | Owner, dispatcher |
| Master data | Clientes and client detail, Mensajeros, Transportadoras, Barrios, Tarifario | Owner, dispatcher |
| Administration | Configuración, Usuarios, Auditoría, Mi cuenta | Owner (account: everyone) |
| Courier app | Mi ruta, Parada, Mi día, Pendientes, offline and sync states, high contrast | Couriers |
| Public pages | Seguimiento `/seguimiento/…`, enlace del cliente `/cliente/…` | Recipients, merchants |
| Sign-in | Ingresar, Recuperar, Restablecer contraseña, courier waiting page | Everyone |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The dispatcher runs the day from the new board (Priority: P1)

The dispatcher opens the panel and, without scrolling at a common laptop size, reads one
sentence about the day, sees how many shipments are in each stage, has the few things that
need a decision now with one action each, and sees every courier's progress. Assigning,
notifying, and the full list are one click away. The new visual language (palette, type,
wordmark, shell) arrives with this story, so every other panel screen already sits inside the
new shell, even before its own redesign.

**Why this priority**: the board is the screen used all day and the one the client will
judge; the owner approved its proposal, and the shell and design foundation it needs are the
base of every later story.

**Independent Test**: sign in as dispatcher on a day with shipments in every state; compare
the board with the approved proposal; act on each item of "Por resolver"; filter the list by
stage, courier, and alert; repeat in dark theme and at phone width.

**Acceptance Scenarios**:

1. **Given** a day with registered, in-progress, delivered, exception, and pending-from-earlier
   shipments, **When** the dispatcher opens the board at 1440×900, **Then** the day sentence,
   the stage counts, the first five items to resolve, and the courier list are visible without
   scrolling, and every number agrees with the shipment list below.
2. **Given** an exception waiting for a decision, **When** the dispatcher presses its action,
   **Then** the shipment's detail opens with the decision choices, and after deciding, the item
   leaves "Por resolver" and the counts update.
3. **Given** a route in preparation, **When** the dispatcher dispatches it from the courier
   list, **Then** it behaves exactly as dispatching does today and the courier moves to "en ruta".
4. **Given** any other panel screen not yet redesigned, **When** it opens, **Then** it shows
   the new rail, top bar, wordmark, and colors, and still works as before.

---

### User Story 2 - Every daily-operation screen speaks the same language (Priority: P2)

Registering one or many shipments, opening and editing a shipment, building and following
routes, searching the history, and notifying merchants look and behave like the board: same
headers, same state marks, same tables, same forms and messages, and the same density rule.

**Why this priority**: these are the screens used dozens of times a day after the board.

**Independent Test**: complete each daily flow end to end (register, bulk register, edit,
create and dispatch a route, find a past shipment, send a WhatsApp notice) in the new design,
and check each screen against its approved proposal.

**Acceptance Scenarios**:

1. **Given** the new-shipment form, **When** the dispatcher registers a cash-on-delivery
   shipment with keyboard only, **Then** it takes no more steps than today and every field
   error appears beside its field in Spanish.
2. **Given** the routes screen, **When** the dispatcher selects unassigned shipments and
   creates a route, **Then** the selection, the route, and its stops read with the same state
   colors and shapes as on the board.

---

### User Story 3 - The courier app feels like the same product, built for the street (Priority: P3)

Couriers see the same brand, type, and state colors as the panel, adapted to one-handed use
outdoors: large targets, one primary action per screen, calm offline and sync states, and the
high-contrast mode for direct sunlight.

**Why this priority**: couriers are the most constrained users; the redesign must improve
their screens without risking deliveries, so it follows once the language is proven.

**Independent Test**: on a low-end Android phone and an iPhone, run a whole route (pick up,
deliver, report an exception, skip a photo) online and offline, in normal and high contrast.

**Acceptance Scenarios**:

1. **Given** a courier on "Mi ruta", **When** they confirm a pickup, a delivery, or an
   exception, **Then** each takes at most 3 taps from the route screen, as today.
2. **Given** no signal, **When** the courier records a delivery, **Then** the record is kept
   and the pending-sync state reads calmly, exactly as today, in the new design.

---

### User Story 4 - Recipients, merchants, and first-time visitors see a polished Domy (Priority: P4)

The tracking page, the merchant link, and the sign-in screens carry the brand with the same
care: the wordmark, a clear status, and nothing more than each visitor needs.

**Why this priority**: these are the screens people outside Cohex see; they shape the
client's and recipients' impression of the service.

**Independent Test**: open a tracking link and a merchant link without signing in at 320 px
and on desktop, in light and dark; sign in, recover, and reset a password.

**Acceptance Scenarios**:

1. **Given** a tracking link for a shipment on its way, **When** a recipient opens it on a
   phone, **Then** the status and delivery window are visible first and no data beyond what
   the constitution allows appears.

---

### User Story 5 - Master data and administration are as clear as the rest (Priority: P5)

Clients, couriers, carriers, neighborhoods, rates, settings, users, the audit log, and the
account page follow the same patterns; the audit log names people and records instead of
showing internal identifiers.

**Why this priority**: used weekly rather than hourly, but inconsistency here undermines the
whole product, and the audit log has a known defect.

**Independent Test**: create, edit, and deactivate one record of each kind; read the audit
log after those changes.

**Acceptance Scenarios**:

1. **Given** changes to a client and a user, **When** the owner opens "Auditoría", **Then**
   each entry names who did it and which record changed, and no internal identifier is shown.

---

### Edge Cases

- A day with no shipments, a day with hundreds, and a past day: the board and lists show a
  calm empty state, keep their length bounded ("Ver todos"), or read in the past tense.
- Very long names of clients, recipients, neighborhoods, and errands wrap to at most two
  lines; nothing is cut silently.
- Data still loading, a server error, a lost session, and a stale screen after a long time
  open: each has its own state with a message that says what to do.
- The device switches between light and dark while the panel is open; the owner chooses a
  theme different from the device's.
- Couriers using the largest system text size, or a screen narrower than 360 px.
- Users who navigate only with the keyboard or a screen reader; users who ask for reduced
  motion.
- An owner-only screen opened by a dispatcher: it stays hidden from navigation and refused,
  as today.

## Requirements *(mandatory)*

### Functional Requirements

**Design foundation and approval**

- **FR-001**: The design system document MUST be updated and approved by the owner before any
  screen is implemented: palette and color roles (including the lime accent and the dark
  pizarra surfaces of the approved board), type scale, spacing, shape, motion, components, and
  the patterns of §8 that change.
- **FR-002**: Every color shown MUST come from the design system's named roles; no screen may
  introduce its own colors.
- **FR-002a**: Lime MUST replace the teal accent in every app (focus, "now", current page,
  the one primary action); it MUST appear only as a fill or mark under dark text or on dark
  surfaces, never as text or a thin line on a light surface.
- **FR-003**: For each screen, a rendered proposal MUST be shown to the owner (light, dark, and
  phone width where the screen is used on phones) and approved before that screen is
  implemented; the approved board proposal (version 9) already counts for the board. A
  screen's proposal MUST be shown beside the already approved screens of its area, so
  coherence is judged together.
- **FR-004**: Any change to an approved proposal during implementation MUST go back to the
  owner before it ships.

**Coherence**

- **FR-005**: The same element MUST look and behave the same everywhere: page header,
  section header, buttons, tables and lists, forms and field errors, state marks, tags,
  tracking numbers, money, dates and times, empty, loading, and error states, dialogs, side
  panels, and confirmation messages.
- **FR-006**: Shipment and route states MUST use one color, one mark, and one label each, on
  every screen and in every app; color MUST never be the only signal.
- **FR-007**: Each panel screen MUST open with what the person needs to know (a sentence or a
  short summary) and MUST have at most one emphasized primary action.
- **FR-008**: Each screen MUST follow the density rule: what is looked at or acted on every
  hour stays visible; secondary information sits behind one click (a link, a side panel, a
  "Ver todos"); long lists show a bounded first page.
- **FR-009**: The drawn wordmark and the symbol MUST be the only representation of the brand.
- **FR-010**: All visible text MUST be Spanish (Colombia) with the glossary's terms; no
  internal identifier, code, or English word may reach a user.

**Every screen**

- **FR-011**: Every screen MUST work in light and dark themes; the panel MUST follow the
  computer's preference by default, offer a light/dark switch in its header, and remember the
  choice on that computer.
- **FR-012**: The panel MUST be fully usable from 1024 px up; down to 360 px it MUST show
  every screen without horizontal page scroll and keep searching, opening a shipment, and the
  "Por resolver" actions available;
  the courier app and public pages MUST be designed for 360 px first and work from 320 px.
- **FR-013**: Every screen MUST meet WCAG 2.2 AA (contrast, labels, keyboard access, visible
  focus, target size of at least 24×24 px in the panel and 48×48 px in the courier app) and
  respect reduced motion.
- **FR-014**: Every screen MUST define its empty, loading, and error states in the new design.

**Behavior preserved**

- **FR-015**: The redesign MUST NOT change business rules, permissions, what each role can do
  or see, or what each action records; only what the board proposal needs to show may add
  read-only information.
- **FR-015a**: The courier app MUST use light surfaces by default, with pizarra only in its
  header and navigation bar; it MUST follow the phone's dark preference and keep its
  high-contrast mode.
- **FR-016**: The courier app MUST keep working without signal exactly as today, keep its
  one-tap high-contrast mode, and keep every primary action within 3 taps of the route screen.
- **FR-017**: The public pages MUST keep showing only the data the constitution allows.

**Board (US1)**

- **FR-018**: The board MUST show, in this order: the day sentence with the date control; the
  stage counts with their progress bar, each acting as a filter; the two shortcuts to the
  screens that own assigning and notifying, with their counts; "Por resolver" (top five, one
  action each, the rest behind "Ver todos" and a one-line "Además" summary); the couriers'
  progress with call and dispatch; and the shipment list with status tabs, an alert filter,
  client and courier filters, and a bounded first page.
- **FR-019**: Opening a shipment from the board MUST show its detail and its available
  actions without leaving the board.

**Known defects**

- **FR-020**: The audit log MUST show names (people, clients, couriers, shipments by tracking
  number) instead of internal identifiers.

**Delivery**

- **FR-021**: The work MUST be delivered as independent slices in this order: foundation and
  board, daily operation, courier app, public pages and sign-in, then master data and
  administration; each releasable on its own, with every existing automated check
  passing at each step.

### Key Entities

- **Design system**: the documented set of color roles, type, spacing, shape, motion,
  components, and patterns every screen uses; owned by the owner.
- **Screen proposal**: a rendered, interactive picture of one screen in the new design, shown
  to the owner in light, dark, and phone width beside the approved screens of its area; it
  is approved, changed, or rejected.
- **Board summary**: what the board reads per day: shipments per stage, items to resolve,
  each courier's stops and progress, unassigned shipments, and merchants still to notify.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % of the screens listed in scope are shown to the owner as proposals and
  approved before release; the owner signs off the finished set as coherent.
- **SC-002**: At 1440×900, the board shows the day sentence, the stage counts, the first five
  items to resolve, and every active courier without scrolling; the whole board is at most two
  screen heights long on a day with 40 shipments.
- **SC-003**: In a timed walkthrough, the dispatcher finds the most urgent item and acts on it
  in under 10 seconds from opening the board.
- **SC-004**: Zero accessibility violations on every screen, in light and dark, at desktop and
  phone widths, in the automated checks.
- **SC-005**: Zero colors outside the design system's roles and zero internal identifiers
  visible to users, across all screens.
- **SC-006**: Every daily flow takes no more steps than before the redesign, and every
  courier primary action stays within 3 taps.
- **SC-007**: Every existing automated test passes after each slice, with no test removed to
  make a slice pass.
- **SC-008**: On a low-end Android phone, the courier app's route screen appears no slower
  than before the redesign.

## Assumptions

- The owner approved the board's look (version 9) and the drawn wordmark (option 1) on
  2026-11-02; the other areas have no approved proposal yet.
- The redesign keeps the current navigation structure and URLs; renaming or merging screens
  is out of scope unless a proposal shows it and the owner approves it.
- The board's courier progress uses information the system already records (route stops,
  pickups, deliveries, last sync); showing it may need new read-only views, but no new data.
- The panel's minimum comfortable width stays a laptop (1024 px); phones are supported for
  reading and urgent actions, as today.
- The merchant portal (feature 005) is not in scope; if it starts later, it adopts this
  design system.
- Physical acceptance tests already pending (T087, T093, T034, T088, T035) are unaffected and
  stay pending.
