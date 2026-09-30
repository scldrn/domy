# Business Master

Single reference for how Santiago Marín's courier business works today, what it costs in
manual effort, and how the system improves it. Derived from the client interview, quote
COT-2026-001, and a full analysis of the two operating workbooks. Specs, plans, and data
models MUST be consistent with this document; when reality turns out to differ, update this
document first. All terms follow the [glossary](glossary.md).

- **Last updated**: 2026-09-30
- **Sources**
  - [Client interview](discovery/client-interview-transcript.md) (2 recordings, 10 min)
  - [Quote COT-2026-001](discovery/quote-cot-2026-001.pdf)
  - Master ledger: `docs/discovery/raw/master-ledger-2027.xlsx` (original name
    `FORMATO ENTREGAS ACTUALIZADO 2027.xlsx`, 10 sheets)
  - Daily sheets: `docs/discovery/raw/daily-settlements-2027.xlsx` (original name
    `Liquidacion diaria 2027.xlsx`, 636 sheets)
  - The raw workbooks contain personal and banking data and are git-ignored. This document
    contains aggregates only; no recipient names, phone numbers, or bank accounts.
- **Evidence levels**: **Confirmed** (stated by the owner or unambiguous in the data),
  **Inferred** (strong pattern in the data, needs a yes/no from the owner), **Open** (unknown).

---

## 1. Business overview

- Last-mile courier service for online shops and individuals in Medellín and its
  metropolitan area, with nationwide reach through carrier handoffs. **Confirmed.**
- The company operates as **Cohex** ("Cohexpress" in some records). When "cohex" appears
  as the courier in the ledger, the company itself did the shipment. **Confirmed.**
- The system is named **Domy**; that is the product name users see. Cohex appears as the
  operator (for example, the support contact on the tracking page). **Confirmed.**
- Operates Monday to Saturday from 8:00 a.m. to 8:00 p.m.; no shipment is recorded on any
  Sunday in 27 months of data. **Confirmed.** Delivery window presets: "en la mañana" =
  8:00–12:00, "en la tarde" = 12:00–20:00 (confirmed 2026-09-30).
- Merchants request shipments by WhatsApp; the dispatcher registers them in a daily sheet,
  builds routes, and dispatches them to couriers. **Confirmed.**
- Revenue is the fee per shipment. COD collections belong to merchants and are remitted
  after netting fees and disbursements. **Confirmed.**
- The whole operation depends on two spreadsheets maintained by hand. Reducing that manual
  effort is the primary reason the client commissioned the system. **Confirmed.**

## 2. Actors

| Actor | Today | Notes |
| --- | --- | --- |
| Owner | Santiago Marín | Owns the business. Keeps the master ledger, statements, receivables, and courier payouts. Full access, including finance. **Confirmed.** |
| Dispatcher | John | Runs day-to-day operations: keeps the daily sheet and dispatches routes. **Confirmed.** A courier "Jhon" also appears in the ledger on fixed weekly pay; the system allows one person to hold both roles if needed. |
| Couriers | 4–6 active per week in 2026 (median 4) | Paid by commission or fixed pay (§8.4). 64 distinct people historically once aliases are merged. |
| Merchants | 130 active in 2026 | Highly concentrated (§3). |
| Recipients | Merchants' customers | Receive no information from the business today. |
| Carriers | Intercity bus companies and national couriers | Shipments to other towns are handed off at bus terminals or carrier offices; the courier pays the freight (§8.2). |

## 3. Key figures

From the ledger sheet (20,490 shipments, 2024-05-18 → 2026-08-14, 662 working days).

| Year | Shipments | Working days | Shipments/day | Average fee | With COD collection | Active couriers | Active merchants |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2024 (May–Dec) | 7,153 | 185 | 38.7 | COP 11,919 | 37 % | 27 | 365 |
| 2025 | 9,756 | 297 | 32.9 | COP 12,604 | 22 % | 38 | 336 |
| 2026 (to Aug 14) | 3,580 | 180 | 19.9 | COP 13,326 | 18 % | 28 | 130 |

- **Volume is falling.** The "31 shipments a day" in the quote is the all-time average;
  2026 runs at about 20 a day (≈ 96 a week), 90th percentile 28, maximum 36.
- **One merchant dominates.** Amy Tecnology is 63 % of 2026 shipments; the top 10 merchants
  are 91 %. Its needs (sizes, merchant references, carrier handoffs, special rates) deserve
  first-class support, and it is the best candidate for bulk registration (§12, I-03).
- **COD collections**: 2026 median COP 103,000, maximum COP 1,194,700.
- **Busiest weekdays**: Tuesday and Friday; lightest: Saturday.

## 4. What the business sells

### 4.1 Shipment kinds

| Kind | How it appears in the data | Evidence |
| --- | --- | --- |
| Delivery | Default: pickup point → recipient | Confirmed |
| Carrier handoff | Destination is a bus terminal (1,262 shipments) or a carrier office (Interrapidísimo, Servientrega, Coordinadora: 518); the courier pays the freight | Confirmed |
| Reverse pickup | Note "devolución" (47 shipments, mostly one merchant) or destination "recogida" (274) | Confirmed (owner delegated to the data) |
| Errand | "compra" (buying an item), "consignación" (bank deposit) | Confirmed (owner delegated to the data) |
| Gift baskets (anchetas) | Separate batch sheets with fees of COP 14,000–17,000 per destination | Exists; ownership **Open**. Needs no special feature: they are registered as ordinary deliveries for the merchant that sends them. |

### 4.2 Shipment attributes

- **Package size**: pequeño, mediano, grande, extragrande; recorded since August 2026, only
  for Amy Tecnology. **Confirmed.** Size does **not** change the rate for now; it is an
  informative attribute.
- **Package count**: "2 bolsas", "2 cajas 1 bolsa" (283 notes). **Confirmed.**
- **Merchant reference**: e.g. "D-254", "11-F". **Confirmed.**
- **Service level**: express ("turbo", "urgente") costs more (median COP 17,500).
  **Inferred.**
- **Sales channel** (Amy Tecnology only): "flex" (211, 2024), "compra directa" (428,
  2024–2025). **Inferred** to be marketplace channels; stored only as a merchant reference.

### 4.3 Delivery windows

About 8 % of shipments carry a window written as free text: "antes de las 5pm" (most
common), "antes de la 1pm", "después de las 2pm", "de 1 a 5pm", "en la mañana", "urgente".
**Confirmed.** Model: optional earliest and latest delivery time.

A shipment not yet delivered becomes **at risk** 45 minutes before its latest delivery
time and **late** once that time passes. **Decided** (owner delegated the value): 45
minutes leaves room to reassign or call the recipient within a route of 8–9 stops.

### 4.4 Delivery exceptions and proof of delivery

- **Exception reasons** (complete list, confirmed by the owner): recipient absent, wrong
  address, rejected. Any exception accepts an optional note.
- **Next step after an exception**: depends on the situation, so the dispatcher chooses per
  case among reattempt the same day, reschedule to another day, or return to sender.
  **Confirmed.**
- **Where the package stays meanwhile**: with the courier, or the courier hands it to the
  dispatcher at the company's office. **Confirmed** (2026-09-30).
- **Failed attempt billing**: the owner answered "se pierde la ida" (the trip is lost).
  Who absorbs it — the merchant is charged the fee, or the business absorbs it — is
  **Open** (to be verified with the owner).
- **Proof of delivery** (confirmed by the owner):
  - The photo is not mandatory but is always requested. The courier can skip it, and the
    shipment is flagged "sin foto" on the dispatch board.
  - The name of the person who received the shipment is always recorded. It defaults to
    the recipient's name and the courier can change it in one tap.
  - Photos are kept 12 months, then deleted automatically. **Decided** (owner asked for "a
    prudent time"): it covers every statement cycle and dispute window, keeps storage
    around 1.5 GB a year, and honors the temporality principle of Ley 1581 de 2012.

### 4.5 Tracking and notifications

- The tracking page shows status, "N deliveries before yours" plus the delivery window,
  courier name, courier phone, and a support contact for Cohex, under the Domy name.
  **Confirmed.**
- The tracking page does **not** show the proof-of-delivery photo. It shows "Entregado a
  {received-by name} a las {time}". **Decided** (owner asked for a recommendation): the
  link can be forwarded to anyone and the photo may show a person or a home. Merchants see
  the photo in their private link (§12, C-03).
- The grouped WhatsApp message with tracking links goes to the **merchant only**; the
  merchant forwards it to recipients. **Confirmed.**

## 5. Payment modes and the netting rule

The quote's three service types are one rule, found in the merchant statement sheet:
`net balance = Σ COD collections − Σ fees`.

| Payment mode | At the door | Effect on merchant balance | Share (2025–26) |
| --- | --- | --- | --- |
| Cash on delivery | Recipient pays the amount the merchant set | + collection − fee | 16 % |
| Recipient pays fee | Recipient pays exactly the fee | + fee − fee = 0 | 5 % |
| Merchant account | Nothing collected | − fee (merchant owes) | 79 % |

- **Confirmed**: each shipment needs only a **COD amount** (0 if none) and a **fee**. The
  payment mode is a preset that fills the COD amount; there is no separate logic per mode.
- **Confirmed**: what the COD amount includes (product only, or product + fee) is the
  merchant's decision; the business collects what it is told.
- **Confirmed** payment methods for the collection: cash to the courier, transfer to the
  company (bank or Nequi), transfer directly to the merchant (counts as collected but
  never touches the business).

## 6. Rates

**Confirmed structure**: fee by rate zone, with merchant-specific rate cards and
surcharges. **Confirmed values** (standard column, by the owner); rates change over time, so
the owner edits the rate card in the system, with effective dates:

| Rate zone | Standard | Amy Tecnology (small) |
| --- | --- | --- |
| Medellín neighborhoods | COP 13,000 (12,000 until 2025) | COP 9,700 |
| Bello, Itagüí | COP 15,000 | COP 10,700 |
| Envigado, Sabaneta, La Estrella | COP 16,000 | COP 10,700 |
| Copacabana | COP 20,000 | COP 10,700 |
| San Antonio de Prado | ≈ COP 19,000 | — |
| Bus terminals, airport | COP 15,000 | COP 15,000 |

- Amy Tecnology rates are **Inferred** from the data and are loaded as its merchant rate
  card; other merchants with special rates are loaded by the owner at go-live.
- Rates rose about 8 % from 2025 to 2026; a shipment MUST freeze its fee at registration.
- Coverage in the data: Medellín, Bello, Itagüí, Envigado, Sabaneta, La Estrella,
  Copacabana, Caldas, Girardota and Rionegro (rare), plus the rest of the country through
  carriers.

## 7. Current process, step by step

Manual effort per step is detailed in §12.

1. **08:00 — intake.** Merchants send requests by WhatsApp. Pickup points are known per
   merchant; the message brings recipient, destination, instructions, COD amount, and
   sometimes a window, size, or reference.
2. **Registration.** The dispatcher retypes each request into that day's daily sheet
   (`#, merchant (recipient), destination, collection, fee, courier, note, status`) and
   works out the fee from memory.
3. **Routing and dispatch.** The dispatcher groups shipments into routes of 8–9 deliveries
   over 2–3 pickups and dispatches them by WhatsApp. Routes are released as they fill so
   couriers cycle back.
4. **Execution.** Couriers send proof-of-delivery photos by WhatsApp. When there is time,
   the dispatcher tells the merchant. Merchants and recipients have no visibility in
   between — **the owner's main pain point.**
5. **Status.** Always "Entregado". Exceptions are almost never recorded (67 notes in about
   19,600 rows); the real first-attempt rate is unknown.
6. **End of day — courier cash-up** (§8.1). Couriers hand over cash and report transfers.
   Balances are written as free text ("X debe 20.000").
7. **Consolidation.** The owner copies every day into the ledger sheet, splitting
   "merchant (recipient)" into two columns and adding the receivable state.
8. **Periodic.** Merchant statements, receivables follow-up, COD remittances (§8.3), and
   courier payouts (§8.4).

## 8. Money flows

### 8.1 Courier cash-up

Formula at the foot of the daily sheets. **Confirmed:**

```text
cash to hand over = Σ COD collections − Σ transfers to company − Σ transfers to merchant − Σ disbursements
```

A courier paid daily keeps that day's pay from the cash and hands over the difference.
**Confirmed** (interview).

### 8.2 Disbursements

- Couriers pay carrier freight on the merchant's behalf ("se pagó 26.000", "se pagó
  25.000 cohex"): 344 notes, median COP 26,000, middle half COP 18,000–30,000.
- They also sometimes pay for a package the merchant could not pay by transfer.
- Disbursements reduce the courier's cash-up and are recovered through the merchant
  statement. **Confirmed.** Today they live only in free-text notes.

### 8.3 Merchant statements, receivables, and remittances

- The statement lists date, merchant, recipient, destination, COD collection, and fee;
  the total is `Σ collections − Σ fees`. **Confirmed.**
  - Positive: an account payable (collections to remit).
  - Negative: an account receivable.
- Receivable states per shipment. **Confirmed**: `unbilled → billed → settled` and
  `remittance_pending → settled`.
- Merchants on account (most notably Amy Tecnology) accumulate unbilled fees and are
  billed periodically. At the end of the data, 872 shipments (COP 11.1 M in fees) were
  unbilled. **Confirmed.**
- COD remittances go out by bank or Nequi transfer. The ledger stores merchants' account
  numbers; the system MUST NOT (Constitution IX, quote). **Confirmed.**

### 8.4 Courier payouts

- **Commission couriers earn 70 % of the fee of each shipment they complete.** Formula
  `=SUM(fees)*70%` in the courier settlement sheet; consistent across every payout
  period. **Confirmed.**
- **Fixed-pay couriers** earn COP 300,000–380,000 a week (one or two people at a time).
  **Confirmed.**
- Couriers are paid **daily** (confirmed 2026-09-30); the weekly payout table is the
  historical practice. Daily pay is consistent with contractors, so the term is courier
  payout ("liquidación de mensajeros"), not "nómina". **Inferred** from the answer
  "se paga por día".
- Cash advances are deducted at payout; a recurring COP 18,000 deduction appears for
  several couriers. Its meaning is **Open**.

## 9. Legacy artifact map

| Workbook / sheet | Purpose today | Replaced by | Phase |
| --- | --- | --- | --- |
| Daily sheets (636 tabs, Jun 2024 → Aug 2026) | Registration, routing, status, cash-up | Shipment registration, dispatch board, courier app | 1 |
| Ledger sheet (DIARIO) | Consolidated history | Shipment history and search (single database); optional migration | 1 |
| LQ MENSAJERO | Courier settlement with 70 % commission | Courier cash-up and payouts | 2 |
| NOMINA MENSAJEROS | Weekly payouts with advances (Jan 2025 → Aug 2026) | Courier payouts | 2 |
| REALACION CLIENTES | Merchant statement | Merchant statements | 2 |
| CARTERA | Receivables list | Accounts receivable and payable | 2 |
| CONSIGNACIONES | Merchants' bank accounts | Not replaced (out of scope by contract) | — |
| MENSAJEROS (hidden) | Courier list | Courier directory | 1 |
| CIERRE DIARIO, LIQUIDACION SEMANAL, Hoja1 | Owner's personal cash calculations; gift-basket prices | Out of scope | — |
| Anchetas (daily-sheet tabs) | Gift-basket batches | Depends on the anchetas decision | Open |

## 10. Data quality findings

These justify structured fields and shape the optional migration.

- **One free-text column carries six meanings.** "Medio de pago" has 1,049 distinct values
  mixing payment method, delivery window, package count, carrier, disbursement, and sales
  channel. The system splits them into typed fields.
- **Overloaded fields elsewhere:**
  - The merchant field embeds the recipient, merchant reference, and size
    ("merchant (recipient) REF SIZE").
  - "Partida" holds a pickup point for some merchants and the recipient for others.
- **Identity duplicates:**
  - 893 raw merchant names collapse to 676 after normalization.
  - 105 raw courier names collapse to 64 (alejo/alejandro, theo/theo martinez,
    tomas/thomas).
  - "cohex"/"cohexpress" is the company itself (shipments done by the business directly).
- **Status is not tracked.** It is always "Entregado", with typos; exceptions are invisible.
- **Destinations are neighborhoods or municipalities, not addresses**: 551 distinct values
  with spelling variants.
- **Fragile formulas.** Hard-coded sums (`=35500+15000`), totals that skip rows, wrong
  period titles, sheet names without years, and a workbook named "2027" holding 2024–2026
  data.

## 11. Scope reference

- **Phase 1 (quoted)**: shipment registration, dispatch, courier app with offline mode and
  proof of delivery, tracking page and grouped WhatsApp message.
- **Phase 1 additions (approved 2026-09-30 as scope changes)**: I-02, I-03, I-05, E-03
  payment method, E-04, C-03 (§12).
- **Phase 2 (not quoted)**: cash-up, reconciliation, payouts, statements, receivables.
- **Phase 3 (not quoted)**: native courier app (store-published) with real-time location
  sharing, automatic notifications. Phase 1 captures location only on each courier event.
- **Not contracted**: migration of the 20,490 historical shipments. The system starts with
  an empty history; merchants, couriers, and rate cards are created at go-live.

## 12. Manual-effort reduction catalog

Every manual activity found, with the improvement and its phase. Impact uses current
volume (~20 shipments a day, ~96 a week).

### Intake and registration

| ID | Manual today | Improvement | Impact | Phase |
| --- | --- | --- | --- | --- |
| I-01 | Retyping every WhatsApp request into the daily sheet | Keyboard-first registration form: merchant autocomplete, default pickup point, recent recipients, "duplicate shipment" | Every shipment | 1 |
| I-02 | Working out the fee from memory | Automatic fee from the rate card (zone, size, service level, merchant overrides); manual override requires a reason | Every shipment; no pricing errors | 1 (added) |
| I-03 | Registering Amy Tecnology's orders one by one (63 % of volume) | Bulk registration: paste or upload a list (CSV/Excel) | ~12 shipments a day | 1 (added) |
| I-04 | Free-text notes for window, size, count, reference | Typed fields with presets ("antes de las 5pm") | Every shipment; enables alerts and reports | 1 |
| I-05 | Typing neighborhoods with spelling variants | Neighborhood and municipality catalog with autocomplete, mapped to rate zones | Every shipment; required by I-02 | 1 (added) |
| I-06 | Same merchant or courier under several names | Directories with aliases and a single identity | Clean history and statements | 1 |
| I-07 | No shipment identifier | Tracking number per shipment | Disputes resolved by number | 1 |
| I-08 | Merchants depend on the dispatcher to register | Merchant self-service portal to create shipments | Removes retyping entirely | Future (after Phase 3) |

### Dispatch

| ID | Manual today | Improvement | Impact | Phase |
| --- | --- | --- | --- | --- |
| D-01 | Grouping shipments mentally into routes | Route builder that groups by pickup point and zone; drag to reorder | Every route | 1 |
| D-02 | Sending each courier their list by WhatsApp | Dispatch to the courier app in one action | Every route | 1 |
| D-03 | Asking couriers where they are | Live dispatch board: pending, in route, delivered, exceptions | All day | 1 |
| D-04 | Remembering delivery windows | Alert for shipments at risk of missing their window | ~8 % of shipments | 1 |
| D-05 | Reassigning by phone | Reassignment with reason and history | As needed | 1 |

### Execution

| ID | Manual today | Improvement | Impact | Phase |
| --- | --- | --- | --- | --- |
| E-01 | Proof photos scattered in WhatsApp chats | Proof of delivery in the app: photo, time, location, attached to the shipment | Every delivery; disputes settled instantly | 1 |
| E-02 | Status always "Entregado"; exceptions unrecorded | Exceptions with reason, reattempt, and return to sender | Real first-attempt rate | 1 |
| E-03 | COD collection and payment method reported at night | Courier records collection and payment method at the door, with a photo of the transfer receipt | Every COD shipment (~18 %) | 1 (payment method added) |
| E-04 | Disbursements as free-text notes | Courier records amount, carrier, and receipt photo | ~15 a week | 1 (added; capture); computation in Phase 2 |
| E-05 | Lost records when there is no signal | Offline mode with automatic sync | Zero data loss | 1 |

### Communication

| ID | Manual today | Improvement | Impact | Phase |
| --- | --- | --- | --- | --- |
| C-01 | Dispatcher replies "¿ya salió?" one by one | Tracking link per shipment | Every shipment | 1 |
| C-02 | Writing each notification by hand | Grouped WhatsApp message per merchant, sent in two taps | Every merchant, every day | 1 |
| C-03 | Merchants ask about all their shipments | Private per-merchant link listing today's shipments and statuses | Fewer questions from the top merchants | 1 (added) |
| C-04 | Notifications depend on the dispatcher | Automatic WhatsApp notifications (Business API) | Zero dispatcher effort | 3 |

### Records and consolidation

| ID | Manual today | Improvement | Impact | Phase |
| --- | --- | --- | --- | --- |
| K-01 | Owner copies every day from the daily sheet into the ledger sheet | Eliminated: one database, recorded once at the source | ~20 rows a day, every day | 1 |
| K-02 | Scrolling 20,000 rows to find a shipment | Search by tracking number, merchant, recipient, date | On demand | 1 |
| K-03 | Keeping "trazabilidad" copies in case of disputes | Automatic audit trail: who, when, where for every change | Always on | 1 |
| K-04 | A single spreadsheet file as the only record | Automatic backups and export to Excel/CSV at any time | Business continuity | 1 |

### Finance

| ID | Manual today | Improvement | Impact | Phase |
| --- | --- | --- | --- | --- |
| F-01 | Nightly cash-up by hand and notes like "X debe 20.000" | Automatic expected cash per courier; dispatcher confirms the amount received; differences become a courier balance | Every courier, every day | 2 |
| F-02 | Building each merchant statement by hand | Statements generated automatically with netting, shareable by WhatsApp or PDF/Excel | Every merchant, every period | 2 |
| F-03 | Changing receivable states by hand | States derived automatically; aging report; balance per merchant | Always current | 2 |
| F-04 | Tracking remittances from memory | Remittance register linked to statements | Every remittance | 2 |
| F-05 | Weekly payout table with hard-coded formulas | Automatic payouts: commission or fixed pay, minus advances and balances; payout slip per courier | Every courier, every week | 2 |
| F-06 | Advances noted inside formulas | Advance register | As needed | 2 |

### Management

| ID | Manual today | Improvement | Impact | Phase |
| --- | --- | --- | --- | --- |
| M-01 | No indicators | Volume, on-time rate, first-attempt rate, revenue, courier productivity, merchant concentration | Decisions based on data | 2 |
| M-02 | Rate changes lost in history | Fee frozen per shipment; rate card with effective dates | Correct historical reporting | 1 |

## 13. Decision log

Numbering follows the question list of 2026-09-30.

### Business decisions

| # | Decision | Resolution | Status |
| --- | --- | --- | --- |
| 1 | Rate card | Standard values in §6 confirmed; the owner edits them in the system with effective dates. Merchant rate cards supported. | Resolved |
| 2 | Package size | Informative only; no rate effect for now (§4.2). | Resolved |
| 3 | At-risk lead time | 45 minutes before the latest delivery time (§4.3). | Resolved (delegated) |
| 4 | Shipment kinds | Delivery, reverse pickup, carrier handoff, errand (§4.1). "Cohex" is the company itself. | Resolved |
| 5a | Exception reasons | Recipient absent, wrong address, rejected (§4.4). | Resolved |
| 5b | Next step after an exception | Dispatcher chooses per case: reattempt, reschedule, or return to sender (§4.4). | Resolved |
| 5c | Failed attempt billing | Who absorbs "la ida perdida": the merchant (fee charged) or the business? | **Open** (to verify) |
| 6 | Proof of delivery | Photo requested but skippable; received-by name always recorded; 12-month retention (§4.4). | Resolved |
| 7 | Roles | Owner (Santiago, full access), dispatcher (John, operations), courier. | Resolved |
| 8 | Tracking page | Courier's first name and phone while on the way, received-by name, support contact; no photo (§4.5). Recorded as a bounded exception in Constitution VII (v1.2.0); couriers' authorization required before go-live. | Resolved |
| 9 | WhatsApp message | To the merchant only (§4.5). | Resolved |
| 10 | Anchetas | Registered as ordinary deliveries; whose product they are is unknown and does not block Phase 1. | Deferred |
| 11 | Historical migration | Not contracted for now (§11). | Resolved |
| 12 | Brand | Product name Domy; company Cohex. Visual identity and UI design system are owned by the project owner (Samuel Calderón). | Resolved |
| 13 | Phase 1 additions | I-02, I-03, I-05, E-03, E-04, C-03 approved (§11). | Resolved |
| 14 | COP 18,000 payout deduction | Meaning unknown. | **Open** (Phase 2) |
| 15 | Courier pay frequency | Daily; term "liquidación de mensajeros" (§8.4). Employment status to be confirmed in Phase 2. | Resolved |

### Product decisions

| # | Decision | Resolution |
| --- | --- | --- |
| 16 | Courier sign-in | Email and password, recovery by email; session of at most 30 days, as the dispatcher's. Phone notification on dispatch and on every route change. |
| 17 | Dispatcher and owner sign-in | Email and password, recovery by email. |
| 18 | Route ordering | Manual drag-and-drop, grouped by pickup point and zone; no automatic optimization. |
| 19 | Addresses | Street address + neighborhood from the catalog + button to open Google Maps or Waze. |
| 20 | ETA on tracking | "N deliveries before yours" + delivery window. |
| 21 | Reassigning a picked-up shipment | Dispatcher only, with a reason. |
| 22 | Editing a shipment | Allowed until pickup; audited. |
| 23 | Events on behalf of a courier | Allowed to the dispatcher, marked "registrado por despacho". |
| 24 | UI design and prototypes | Material Design 3 over Tailwind CSS + shadcn/ui, defined in [design-system.md](design-system.md). Seed ink indigo `#2B3A8F`, Material Symbols Rounded, logo direction "route d" (artwork pending). Specs define behavior, plans apply the design system. |
| 33 | Courier location | Phase 1: captured on every courier event, never blocking. Real-time sharing belongs to the Phase 3 native app. |

### Technical decisions

| # | Decision | Resolution |
| --- | --- | --- |
| 25 | Cloud provider | DigitalOcean (Droplet + Spaces + snapshots), accounts in the client's name. |
| 26 | Transactional email | Resend (simplest setup, free tier covers the volume); AWS SES is the fallback. |
| 27 | Error monitoring | Sentry, free plan. |
| 28 | Backups | Daily snapshots + nightly PostgreSQL dump to object storage; restore tested before the pilot. |
| 29 | Photos | 1600 px JPEG, about 200 KB, compressed on the device. |
| 30 | Dispatch board refresh | Polling every 20–30 seconds. |
| 31 | Repository | Private GitHub + GitHub Actions for quality gates. |
| 32 | Environments | Local and production; the pilot runs in production. |

### Methodology decisions

| # | Decision | Resolution |
| --- | --- | --- |
| 34 | Phase 1 breakdown | 001 shipment registration and dispatch board, 002 routes and dispatch, 003 courier app, 004 tracking. |
| 35 | Order of work | Specify, clarify, plan, tasks, and analyze all four specs before implementing any (Spec Kit). |
