# HTTP API Contract: Tracking Page, Merchant Link, and WhatsApp Message

Extends the contracts of features [001](../../001-shipment-registration/contracts/http-api.md),
[002](../../002-routes-dispatch/contracts/http-api.md), and
[003](../../003-courier-app/contracts/http-api.md) and follows their conventions.

## Public endpoints (no session)

Every response carries `Cache-Control: no-store` and `X-Robots-Tag: noindex`. Requests are
limited to 60 per minute per client address (`429 rate_limited`). An unknown code, or a replaced/deactivated merchant code, always returns the same `404 link_not_found` with the message "Este enlace
no es válido".

| Method and path | Response |
| --- | --- |
| `GET /api/public/tracking/:code` | `PublicTracking` (data-model.md §Public tracking view) (FR-001–FR-014) |
| `GET /api/public/merchant/:code?date=YYYY-MM-DD` | `MerchantDay` (`merchantDayView`); date defaults to today and must be within the last 30 Bogotá service days (`422 date_out_of_range`) (FR-019) |
| `GET /api/public/merchant/:code/shipments/:id` | `MerchantShipment` (`merchantShipmentView`, FR-020); `404` if the code is invalid/inactive/replaced, the shipment is not the merchant's, or its service date is outside the same 30-day window |
| `GET /api/public/merchant/:code/photos/:photoId` | The image; `404` if the code is invalid/inactive/replaced, the photo is not proof on the shipment's effective current delivery/return record within the same 30-day Bogotá service-date window, or its object no longer exists (FR-020, FR-022) |

## Panel endpoints (roles: owner, dispatcher)

| Method and path | Request → Response |
| --- | --- |
| `GET /api/notifications?date=YYYY-MM-DD` | → `{ merchants: { merchantId, name, whatsappPhone, linkCode, isActive, shipments: { id, trackingNumber, trackingCode, recipientName, neighborhood, status, notifiedAt }[] }[] }`; a date after today in Bogotá → `422 notification_date_in_future` (FR-015) |
| `POST /api/notifications` | `{ actionId, shipmentIds }` → `204`; nonempty distinct IDs, atomic actor/operation/sorted-ID-set-bound receipt, same replay has no effect, conflicting replay returns `409`; marks them notified; voided shipments are never listed (FR-016, FR-017) |
| `POST /api/merchants/:id/replace-link` | `{ actionId }` → `Merchant` with the new `linkCode`; audited (FR-021) |

### Notification composition inputs

The list retains inactive merchants with work and exposes their existing
`isActive: boolean`. Opening/copying a notification is disabled for an inactive
merchant, following the merchant-link control: activate it before sharing its
otherwise invalid private link. The mark POST may still record/retry a message
opened/copied before deactivation; it is a historical fact, not a new share.

Each listed shipment includes the existing domain `ShipmentStatus` as `status`.
This non-sensitive field lets the shared composer enforce voided exclusion itself.
`composeMerchantMessage(merchant, shipments, baseUrl, includeNotified = false)`
excludes voided entries in both modes, excludes already-notified entries by default,
and includes them only for the explicit all-date option. The compact threshold
applies after filtering:20 entries stay detailed;21 or more use count and merchant
link. No filtering rule is duplicated in the web UI.

### Panel intent binding

The web replacement control always sends `X-Domy-Actor-Id` with the actor captured
when its stable action UUID was created. When present, the server validates this
UUID header against the authenticated actor before replay or mutation; mismatch
returns `actor_changed` without effect. The header remains optional for existing
authenticated API callers, preserving T027's contract. The UI also refuses to retry
an intent under another route actor and retains its UUID after uncertain failure.
This closes the browser cookie-switch race without changing other account APIs.

The notification control follows the same captured-actor rule for
`POST /api/notifications`: new web intents always send `X-Domy-Actor-Id`; an
omitted header remains valid for existing authenticated callers. A supplied
malformed UUID follows the existing `invalid_request` validation; a different
authenticated actor gets `409 actor_changed`. Both are rejected before receipt
lookup or effects. Notification replay canonicalizes UUID case and compares the
sorted shipment-ID set; a receipt for another shipment-event operation conflicts.

## Changes to earlier contracts

- **`GET /api/shipments/:id`**: gains `trackingCode: string`, `notifiedAt: string | null`
  (UTC ISO instant) and `notifiedBy: string | null` (actor UUID, no name), on
  `ShipmentDetail` only; shipment lists/summaries retain their existing shapes (FR-018).
- **`GET /api/shipments/export`**: gains the column "Notificado" with the time (Constitution IX).
- **`GET /api/merchants/:id`**: gains `linkCode` (FR-021).
- **`GET /api/settings`** (owner, dispatcher): gains `supportPhone` and `companyName`
  for the existing office read and notification support reminder (FR-009).
- **`PATCH /api/settings`** (owner only): updates those fields under the existing
  partial-update, validation, idempotency and audit rules (FR-009, R16).
- **Shipment creation** (single and bulk): the server generates `tracking_code`; the
  client never sends it.

## Boundary alignment (2026-10-21)

- Production PUBLIC_BASE_URL is an explicit HTTPS origin; development/test may use
  APP_URL as fallback. Production APP_URL must have the same canonical origin.
  Build/runtime and dynamic rehearsal/E2E origins must agree.
  No userinfo/path/query/hash; only the validated public value reaches a Vite define.
- Native transport peer identity is authoritative; arbitrary forwarded headers never
  choose rate-limit identity. Proxy trust requires a separately verified peer/topology.
- All public responses, including errors/photos/web documents, retain no-store/noindex.
  Public bearer route segments are redacted in request/error logs and reporting.
- Deactivated merchants lose merchant access; their shipment tracking links remain
  valid under FR-010/FR-022. Unknown/replaced/inactive merchant access stays uniform.
- PublicTracking includes carrierName/destinationTown for every non-expired carrier
  handoff status. No additional recipient identity/address or internal history escapes.
- Settings owner PATCH accepts partial updates. Omitted fields are preserved; support
  phone accepts null to clear; companyName is nonempty, default Cohex. Existing office
  pair validation, existing accepted-action semantics and audit receipts remain
  enforced. Link replacement binds replay to actor/merchant/operation and never rotates
  again for the same accepted action; no bearer code is copied into audit changes.

## Public projection clarification (2026-10-22)

Kind-specific FR-008 happy-path status text takes precedence over its matching
FR-005 generic row; exception/return/void wording remains explicit. Any received-by
disclosure is sourced only from the effective delivery record, never the shipment's
intended recipient name. Reverted history cannot supply a current receiver/final time.
The queue helper receives shipment kind to distinguish pickup/delivery anchors; the
projection gates active-route/status eligibility and omits unavailable counts. Reverse
pickups qualify only while dispatched before pickup; after pickup they expose no
queue even if a delivery task remains (FR-006/FR-008, R17).

## PublicTracking wire shape (R18, 2026-10-22)

The domain Zod schema introduced by T013 is the implementation source of truth;
T009/T011 tests use this agreed shape without defining duplicate product API types.
The full variant has `expired: false`, `merchantName`, `trackingNumber`, `kind`,
`serviceDate`, `window`, `support` and `statusText`. Contextual keys are omitted
when their model conditions do not apply. No shipment ID, bearer code or internal
history is returned.

| Value | Shape/source |
| --- | --- |
| `support` | `{ phone: string \| null, companyName: string }`, from configured support settings; unset phone remains null |
| `window` | null when both bounds are absent; otherwise `{ start: string \| null, end: string \| null }`, UTC ISO bounds from windowStart/windowEnd |
| `neighborhood` | recipient neighborhood name or null for non-carrier kinds; no address/ID; omitted for carrier handoff |
| `carrierName`, `destinationTown` | strings for every non-expired carrier-handoff status; omitted for other kinds |
| `courier` | `{ firstName: string, phone: string }` only under FR-007, no internal ID |
| `deliveriesBefore` | nonnegative integer only under FR-006/R17 with an available pending anchor |
| `amountToPay` | integer COP only under FR-014 |
| `reasonText` | approved Spanish public reason only under FR-005 |
| `deliveredAt` | UTC ISO instant from the effective delivery event/record; displayed in Bogotá |
| `deliveredTo` | effective received-by name or null for non-carrier delivery (errand null); carrier descriptor `{carrierName} para {destinationTown}`, never intended recipient or carrier employee identity |

Both delivered keys occur only when delivered. Kind-specific statusText still
follows R17; derived received-by metadata does not replace that wording. The expired
variant is exactly `{ expired: true, support }`, without any shipment metadata.

Delivered statusText contains the specified Bogotá time; deliveredAt separately
carries its date/instant. The page must render the delivery date visibly with the
shared display formatter (FR-005). No additional date phrase is required inside
the statusText string itself.

State/kind examples: reverse registered/assigned/dispatched uses “Recogeremos el
paquete en tu dirección”; errand registered/assigned is “Programada”, dispatched
(and any inherited picked_up state) is “En curso”, delivered is “Realizada”.
Reprogrammed date text uses the actual serviceDate in Spanish long format.
At exactly effectiveFinalOccurredAt+7days the link remains full; it expires when
now is strictly later (R18).

## Merchant wire shapes

`MerchantDay` is the output of `merchantDayView`; `MerchantShipment` is the output of
`merchantShipmentView`. The domain's strict Zod schemas are the response allowlist.
All nested objects are strict; all monetary values are safe-integer COP values and
all counts are nonnegative integers.

```ts
type MerchantSupport = { phone: string | null; companyName: string };
// Null when both window bounds are absent.
type MerchantWindow = { start: string | null; end: string | null } | null;

type MerchantShipmentSummary = {
  // Shipment UUID used only for this merchant's detail endpoint.
  id: string;
  trackingNumber: string;
  kind: ShipmentKind;
  status: ShipmentStatus;
  serviceDate: string; // YYYY-MM-DD
  merchantReference: string | null;
  recipientName: string | null;
  neighborhood: string | null;
  window: MerchantWindow; // UTC ISO instants
  fee: number | null; // COP; null while feeToConfirm
  feeToConfirm: boolean;
  codAmount: number; // COP
  trackingLink: string; // PUBLIC_BASE_URL + "/seguimiento/{trackingCode}"
};

type MerchantDayTotals = {
  byStatus: Record<ShipmentStatus, number>; // non-voided row counts, voided is always 0
  confirmedFees: number; // COP
  feeToConfirmCount: number;
  codToCollect: number; // COP
  collectedByMethod: {
    cash: number;
    companyTransfer: number;
    merchantTransfer: number;
  };
};

type MerchantDay = {
  merchantName: string;
  date: string; // YYYY-MM-DD
  support: MerchantSupport;
  shipments: MerchantShipmentSummary[];
  totals: MerchantDayTotals;
};

type MerchantAttempt = {
  kind: "delivery" | "exception";
  occurredAt: string; // UTC ISO instant
  reason: string | null; // FR-005 exceptionReasonText mapping
  note: string | null;
};

type MerchantShipment = MerchantShipmentSummary & {
  // Current status occurredAt in UTC ISO; null if current provenance is incomplete.
  statusAt: string | null;
  receivedByName: string | null;
  collected: {
    cash: number;
    companyTransfer: number;
    merchantTransfer: number;
    total: number;
  };
  photos: { id: string; status: "pending" | "uploaded" | "unavailable" }[];
  exception?: {
    reason: string | null; // FR-005 exceptionReasonText mapping
    note: string | null;
    attempts: MerchantAttempt[];
  };
};
```

The list includes voided shipment rows, but `byStatus` counts only non-voided rows
(with canonical `registered`, `assigned`, `dispatched`, `picked_up`, `delivered`,
`exception`, `returned`, and zero `voided` keys); every aggregate excludes voided
shipments. A fee under review is returned only as `fee: null, feeToConfirm: true`,
never its provisional COP amount. `confirmedFees` sums non-voided confirmed fees and
`feeToConfirmCount` counts non-voided fees awaiting confirmation. `codToCollect` sums
positive COD on non-final shipments exactly as FR-014 defines it; no collection
subtraction or balance/netting is performed. `collectedByMethod` uses only each cohort
shipment's effective current applied, non-reverted delivery record and is grouped by
shipment `serviceDate`, not record day.

`trackingLink` is the absolute URL constructed from the validated public origin and
the existing tracking route; the raw bearer `trackingCode` is never a response field.
The list never includes receiver, photos, exception notes, or attempts. Detail's
`receivedByName` comes only from the effective current delivery record when delivered
or return record when returned. `collected` comes only from the effective current
delivery record; otherwise its values are zero. No intended-recipient or reverted
record fallback is allowed.

Detail `statusAt` follows [research R19](../research.md#r19-merchant-day-and-shipment-detail-contract):
prefer the effective current applied/non-reverted state-establishing record;
otherwise use the latest appended event that actually changes/restores the current
status (`fromStatus !== toStatus`, including qualifying `record_reverted` events).
Same-status administrative events do not reset it. `registeredAt` applies only
to the initial registered state, not later restorations; incomplete provenance is
null, never `updatedAt`.

Detail photos are only proof-kind photo IDs on the effective current delivery/return
record. Unuploaded metadata is `pending` for less than 24 hours after the record's
`recordedAt`, then `unavailable`; uploaded metadata is `uploaded`, even though the
retained object may already be gone. The photo endpoint determines object absence by
streaming and returns 404; the client replaces a failed image with the unavailable
message. Reuse the existing pending-photo threshold in `shipment-flags.ts` and
`record-views.ts`, extracting a shared helper if needed; do not add a third 24-hour
threshold. No storage key or public photo URL is returned.

Only current `exception` status includes the `exception` object. Its reason/note are
from the current corrected record; attempts contain every applied, non-reverted
delivery/exception record, with only kind, occurred time, the existing FR-005
`exceptionReasonText` and note. Do not add competing public reason wording.
Unapplied/reverted attempts and historical correction snapshots are excluded; attempt
rows expose no record ID, courier/author identity, phone, location, collection, or photo.

## R18 incomplete legacy provenance guard

For a delivered row with incomplete legacy provenance, never fabricate a delivery
instant or reuse a reverted record. Emit deliveredAt/deliveredTo together only
when a valid effective final event or qualifying applied, non-reverted delivery
record supplies the instant. Otherwise omit both metadata keys and use safe
untimed wording: “Entregado” or “Entregado al remitente”; carrier destination and
“Realizada” remain kind-specific. An absent final instant cannot start a guessed
expiry deadline. This defensive case does not alter normal, fully sourced FR-005
wording or authorize any additional identity disclosure.

The EC-04 off-route/office guard precedes happy-path wording for package kinds,
including reverse pickup: picked-up packages without an in-progress route, or held
at the office, read “Reprogramado para {serviceDate}” and expose no courier or
queue. FR-008 does not label an off-route package as on its way. For delivered
legacy rows, the same verified effective instant is used for delivery metadata
and expiry; a qualifying non-reverted applied delivery record can supply that
instant when its event instant is unavailable.

## R19 merchant note notice

Owner decision (2026-10-22): replace notes with a contact-support notice. The
current-exception `note` and every included attempt's `note` are either null
(source null, empty, or whitespace-only) or the exact literal
`Para conocer más detalles, contacta con soporte.` (any other source text).
This applies equally to sensitive and benign notes. No original text is returned.
Strict nested schemas accept only this literal or null; reason labels and attempt
eligibility remain unchanged. Keep stored notes unchanged and do not log inputs.
No phones, addresses, courier directory, or other private redaction inputs are
needed or loaded for this projection. See [research R19](../research.md#r19-merchant-day-and-shipment-detail-contract).

## OP-01 public rate-limit transport identity (2026-10-22)

There is no request or response schema change. In direct mode, public rate limits
continue to use the native Node transport peer and ignore all forwarding headers.
OP-01 may explicitly configure one optional `DOMY_TRUSTED_PROXY_IP` exact IPv4 or
IPv6 address (no CIDR, port, or list); an unset value leaves direct mode unchanged,
and invalid configuration is rejected rather than enabling trust. The server
passes the validated value through optional `AppDeps.trustedProxyIp` to the pure
`resolveClientAddress(nativePeer, trustedProxyIp, canonicalHeader)` helper.

Only an exact normalized match between the native peer and configured proxy may
use `X-Domy-Client-IP`, and only if the header contains exactly one valid IP.
The adapter must preserve header cardinality and reject duplicate raw fields (a
comma-folded value is invalid too).
Normalize IPv4-mapped IPv6 addresses for peer comparison and resulting identity.
Malformed, repeated, comma-separated, or non-IP canonical-header values fall back
to the normalized native peer, or `unknown` when it is unavailable/invalid. When
that fallback peer is the trusted proxy, clients may share its 60-per-minute
in-memory bucket and receive 429 together. `Forwarded`, `X-Forwarded-For`, and
`X-Real-IP` never determine identity. The reverse proxy must replace the canonical
header using its client transport address. This transport-only opt-in must be
bounded by OP-01's verified isolated network topology and real-proxy tests; it is not a
general forwarding-header trust rule. See [research R22](../research.md#r22-opt-in-trusted-proxy-identity-for-op-01-2026-10-22).
