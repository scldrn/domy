# Data Model: Courier App

Phase 1 of [plan.md](plan.md). Extends the data models of
[feature 001](../001-shipment-registration/data-model.md) and
[feature 002](../002-routes-dispatch/data-model.md) and follows their conventions
(snake_case plural tables, UUID keys, integer COP, `timestamptz` in UTC, `date` in
`America/Bogota`, append-only events).

## Enumerations

| Enum | Values | UI labels |
| --- | --- | --- |
| `courier_record_kind` | `pickup`, `delivery`, `exception`, `problem`, `return`, `disbursement`, `handover_confirmation` | Recogida, Entrega, Novedad, Problema de recogida, Devolución, Pago por cuenta del cliente, Traspaso recibido |
| `record_outcome` | `applied`, `duplicate`, `not_applied` | —, —, No aplicado |
| `exception_reason` | `recipient_absent`, `wrong_address`, `rejected` | Destinatario ausente, Dirección errada, Rechazado |
| `photo_kind` | `proof`, `transfer_receipt`, `disbursement_receipt`, `exception` | Prueba de entrega, Comprobante de transferencia, Comprobante de pago, Foto de la novedad |
| `notice_type` | `route_dispatched`, `shipment_added`, `shipment_removed`, `shipment_voided`, `stops_reordered`, `shipment_reassigned_in`, `shipment_reassigned_out`, `route_reassigned`, `dispatch_undone`, `handover_requested`, `handover_cancelled`, `exception_decided`, `office_received`, `record_corrected`, `record_reverted`, `record_not_applied` | Spanish text per type in `packages/domain` |

Added to feature 002's `stop_kind`: `return` ("Devolución").

Added to feature 001's `shipment_event_type`: `exception_decided`, `office_received`,
`record_corrected`, `record_reverted`, `review_cleared`.

## Tables

**`courier_records`** — one row per courier action, including those that could not be
applied (FR-024). Never deleted.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | Generated on the phone (or by the panel when recorded on behalf); primary key, which makes every record exactly-once (FR-019) |
| `shipment_id` | uuid → shipments | Not null |
| `kind` | `courier_record_kind` | Not null |
| `courier_id` | uuid → couriers | The courier who did it, or on whose behalf it was recorded |
| `author_user_id` | uuid → users | Who entered it |
| `on_behalf` | boolean | True when entered by the owner or dispatcher ("Registrado por despacho", FR-034) |
| `route_id` | uuid → routes | Route the courier was on, if any |
| `occurred_at` | timestamptz | Phone time corrected by the clock offset; `≤ recorded_at` (FR-019) |
| `recorded_at` | timestamptz | When the server stored it |
| `latitude`, `longitude` | numeric(9,6) | Optional (FR-015) |
| `location_accuracy_m` | integer | Optional |
| `outcome` | `record_outcome` | Not null |
| `received_by_name` | text | Required for `delivery` and `return`; 2–100 characters |
| `cash_amount`, `company_transfer_amount`, `merchant_transfer_amount` | integer | `≥ 0`, default 0; only for `delivery` (FR-010) |
| `exception_reason` | `exception_reason` | Required for `exception` |
| `note` | text | Up to 200 characters; required (5–200) for `problem`, and for a `delivery` whose collected total differs from the COD amount (FR-011, FR-014) |
| `disbursement_amount` | integer | Required and `> 0` for `disbursement` |
| `payee` | text | Required for `disbursement`: carrier or payee name |
| `reverted_at`, `reverted_by`, `revert_reason` | timestamptz, uuid → users, text | Set together when the dispatcher reverts the record (FR-035) |

- Checks enforce the kind-specific columns above.
- Index `(shipment_id, occurred_at)`; index `(courier_id, occurred_at)` for "Mi día".
- A **delivery attempt** (FR-032) is an applied record of kind `delivery` or `exception`
  that is not reverted.
- A correction updates `received_by_name`, the three amounts, `exception_reason`, `note`,
  `disbursement_amount`, or `payee` in place and writes a `record_corrected` shipment event with old and new values.

**`record_photos`**

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | Generated on the phone; declared in the record, so the server knows it is expected |
| `record_id` | uuid → courier_records | Not null |
| `kind` | `photo_kind` | Not null |
| `storage_key` | text | Object key in the private bucket |
| `uploaded_at` | timestamptz | Null until the image arrives: "Foto pendiente" during the 24 hours after the record, then treated as missing (FR-023) |
| `byte_size` | integer | Set at upload; at most 1 MB |

At most three `proof` photos per record, enforced by the request schema (FR-009). Objects are
deleted by the bucket after 12 months; rows stay.

**`courier_notices`** (FR-027)

| Column | Type | Rules |
| --- | --- | --- |
| `courier_id` | uuid → couriers | Not null |
| `type` | `notice_type` | Not null |
| `route_id` | uuid → routes | Optional |
| `shipment_id` | uuid → shipments | Optional |
| `created_at` | timestamptz | Not null |
| `acknowledged_at` | timestamptz | Null until the courier taps "Entendido"; set once |

Index `(courier_id) WHERE acknowledged_at is null`.

**`push_subscriptions`** (FR-040): `user_id` → users, `endpoint` text unique, `p256dh` text,
`auth` text, `created_at`. Deleted when the push service reports the subscription gone or
the user signs out.

**`company_settings`** (single row, FR-041): `office_address` text, `office_neighborhood_id`
uuid → neighborhoods. Changes are written to `audit_events` (feature 001). Feature 004 adds
`support_phone` and `company_name`.

**Added to `shipments`**

| Column | Type | Rules |
| --- | --- | --- |
| `held_at_office` | boolean | Default false; the office holds the package (FR-041) |
| `return_decided` | boolean | Default false; a return to sender was decided and is not completed ("Devolución en curso") |
| `needs_review` | boolean | Default false; "Por revisar" (FR-025, FR-026) |

Checks: `held_at_office ⇒ custody_courier_id is null`; `return_decided ⇒ status in
('exception', 'returned')`. Feature 002's check "`status in ('assigned', 'dispatched') ⇒
route_id is not null`" is unchanged: a shipment `picked_up`, or `exception` with
`return_decided`, may have `route_id` null while it waits off route (FR-031).

**Added to `route_tasks`**: `problem_note` text (5–200 characters), set by a `problem`
record and cleared when the task is completed; the flag disappears with the task when the
shipment leaves the route (FR-014).

**Changed in `handovers`** (feature 002): `from_route_id` becomes optional, for a package
held off route or picked up after the dispatcher changed the route (FR-025, FR-029); a
handover may be requested for a shipment `picked_up`, or `exception` with `return_decided`.

**Added to `couriers`**: `last_synced_at` timestamptz, updated on every snapshot request
(FR-033).

## What each record does

`resolveCourierRecord(shipment, record)` in `packages/domain/src/courier-records.ts`. "On
the author's route" means the shipment has a pending task of that kind on a route in
progress of the record's courier.

| Kind | Applied when | Effect | Otherwise |
| --- | --- | --- | --- |
| `pickup` | `dispatched` with a pending pickup task on the author's route | `picked_up`; custody to the courier; task completed | see next rows |
| `pickup` | held at the office with a pending pickup task on the author's route | custody to the courier, `held_at_office` false; `dispatched → picked_up`, or stays `exception` when a return is decided | |
| `pickup` | `registered`, `assigned`, or `dispatched` and **not** on the author's route (FR-025) | `picked_up`; custody to the courier; `needs_review`. On another courier's route in progress: its pickup task completed and a pending handover to that courier; on a route in preparation: removed from it; then, or on no route: off route | `duplicate` if already picked up by this courier; else `not_applied` |
| `delivery` | the courier holds custody and status is `picked_up`; or an errand `dispatched` | `delivered`; custody ends; delivery task completed; collection stored. If the pending task was on another route: that task removed, pending handover cancelled, `needs_review` | `duplicate` if already delivered by this courier; else `not_applied` |
| `exception` | the courier holds custody and status is `picked_up` | `exception`; delivery task `failed`; custody unchanged | `duplicate` / `not_applied` as above |
| `return` | the courier holds custody, status `exception`, `return_decided` | `returned`; custody ends; return task completed; `return_decided` false | `duplicate` / `not_applied` |
| `problem` | a pending pickup, errand, or return task on the author's route | `problem_note` set; no status change | `not_applied` |
| `disbursement` | the shipment is not `voided` | stored; `needs_review` if the shipment is not on the author's route | `not_applied` |
| `handover_confirmation` | a pending handover to this courier | handover `confirmed`; custody to the courier; task unblocked (feature 002) | `duplicate` if already confirmed to this courier; else `not_applied` |

Every `not_applied` outcome sets `needs_review` and creates a `record_not_applied` notice;
`duplicate` does neither (FR-024, FR-026). After any applied record the route status is
recalculated (feature 002, `lib/route-status.ts`).

## Shipment lifecycle: transitions owned by this feature

These rows replace the rows marked "003" in feature 001's lifecycle table
(`packages/domain/src/shipment-lifecycle.ts`).

| From | To | Trigger |
| --- | --- | --- |
| `dispatched` | `picked_up` | Pickup record |
| `registered`, `assigned` | `picked_up` | Pickup record that arrives after the dispatcher changed the route (FR-025) |
| `picked_up` | `delivered` | Delivery record |
| `dispatched` | `delivered` | Errand completed |
| `picked_up` | `exception` | Exception record |
| `exception` | `picked_up` | New attempt decided while a courier holds the package; or exception reverted |
| `exception` | `registered` | New attempt decided while the office holds the package |
| `exception` | `returned` | Return record |
| `exception` (return decided) | `picked_up` | Return changed to a new attempt before the return stop is completed (FR-029) |
| `delivered` | `picked_up` | Delivery reverted by the owner or dispatcher |
| `returned` | `exception` | Return reverted (with `return_decided` true again) |

## Custody

The holder of a package is `custody_courier_id` (a courier) or `held_at_office` (the
office), never both; neither before pickup and after delivery or return.

| Event | Holder after |
| --- | --- |
| Pickup record | The courier |
| Handover confirmed (feature 002) | The receiving courier |
| "Recibido en oficina" (FR-041) | The office |
| Pickup record at the office | The courier |
| Delivery or return record | Nobody |

Custody history (SC-007): applied `pickup`, `delivery`, and `return` records, confirmed
handovers, and `office_received` events, ordered by `occurred_at`.

## Derived values

- **Unassigned** (extends feature 002): shipments `registered`; plus `picked_up` with
  `route_id` null; plus `exception` with `return_decided` and `route_id` null. Each held one
  carries its holder ("En custodia de {courier}" or "En oficina").
- **Exceptions to decide**: `status = 'exception'` and not `return_decided`.
- **Flags** (research R11): "Sin foto", "Foto pendiente", "Recaudo diferente", "Problema de
  recogida", "Por revisar".
- **Collected total**: `cash_amount + company_transfer_amount + merchant_transfer_amount`.
- **Day summary** (FR-037), `packages/domain/src/day-summary.ts`: returned inside the
  snapshot for today, so "Mi día" works without signal. Pending stops are counted from the
  route, not from records. The rest is computed over the courier's applied,
  not reverted records of the date (Bogotá): counts by kind, the three collection totals,
  total disbursements, and cash to hand over = cash collected − disbursements.

## Data on the phone (IndexedDB, research R3)

| Store | Content | Removed |
| --- | --- | --- |
| `snapshot` | Last response of `GET /api/courier/route` | Replaced at every sync; cleared at sign-out |
| `outbox` | Items not yet acknowledged, in order, of two types: a **record** (its input and `occurredAt`) and a **notice acknowledgment** (`actionId`, notice ids, `occurredAt`). Records are sent first, then acknowledgments | When the server acknowledges each |
| `photos` | Compressed images with their `id` and record `id` | When the upload is acknowledged |
| `meta` | User id, clock offset, last synchronization time | At sign-out |

A finished route is absent from the next snapshot, so its personal data leaves the phone at
that sync (FR-023). A `401` received before the `sessionExpiresAt` of the stored snapshot means access was
withdrawn (deactivation or sessions ended): it clears `snapshot` and keeps `outbox`
readable. A `401` after that time means the session expired: everything is kept (FR-003,
FR-004).
