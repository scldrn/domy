# HTTP API Contract: Shipment Registration and Dispatch Board

JSON over HTTPS under `/api`, served by the Hono server and consumed through Hono's typed RPC
client. Request and response schemas are Zod schemas exported from `packages/domain`
(`schemas/*`); this document names them rather than duplicating them. Field names in JSON
are `camelCase`.

## Conventions

- **Authentication**: session cookie issued by Better Auth (`/api/auth/*`). Every endpoint
  below requires a signed-in, non-banned user; the role column lists who may call it.
- **Money**: integer COP. **Instants**: ISO 8601 UTC. **Dates**: `YYYY-MM-DD` (Bogotá).
- **Errors**: every non-2xx response has the body
  `{ "error": { "code": string, "message": string, "fields"?: Record<string, string> } }`.
  `message` and `fields` values are Spanish, ready to show to the user.

| Status | `code` | When |
| --- | --- | --- |
| 400 | `invalid_request` | Schema validation failed (`fields` lists each problem) |
| 401 | `unauthenticated` | No valid session |
| 403 | `forbidden` | Role not allowed |
| 404 | `not_found` | Unknown id or tracking number |
| 409 | `version_conflict` | Stale `version` on update (FR-018) |
| 409 | `invalid_transition` | Lifecycle forbids the change (e.g., edit after pickup) |
| 409 | `duplicate_alias` | Alias already identifies another record (FR-027) |
| 409 | `last_owner` | Deactivating or demoting the last active owner (FR-032) |
| 422 | `confirmation_required` | Fee above COP 100.000 or COD amount above COP 2.000.000 sent without `confirmed: true` (FR-037) |
| 423 | `account_locked` | Sign-in during lockout; includes `retryAt` (FR-033) |

## Authentication (Better Auth)

| Method and path | Role | Purpose |
| --- | --- | --- |
| `POST /api/auth/sign-in/email` | Public | Sign in (lockout hook, research R5) |
| `POST /api/auth/sign-out` | Any | Sign out |
| `POST /api/auth/request-password-reset` | Public | Send the single-use reset link (60 minutes); same response whether or not the email exists |
| `POST /api/auth/reset-password` | Public | Set a new password with the token; ends the user's sessions and lifts the lock |
| `POST /api/auth/change-password` | Any | Change own password |
| `GET /api/auth/get-session` | Any | Current user and role |
| `POST /api/auth/admin/create-user` | Owner | Create an account with a role |
| `POST /api/auth/admin/update-user` | Owner | Edit name and email |
| `POST /api/auth/admin/set-role` | Owner | Change role (`409 last_owner`) |
| `POST /api/auth/admin/ban-user` / `unban-user` | Owner | Deactivate / reactivate (ends sessions) |
| `POST /api/auth/admin/revoke-user-sessions` | Owner | End all sessions of a user (FR-033a) |
| `GET /api/auth/admin/list-users` | Owner | List accounts |

## Shipments

| Method and path | Role | Request → Response |
| --- | --- | --- |
| `POST /api/shipments/fee-quote` | Owner, dispatcher | `FeeQuoteInput` (merchant, kind, neighborhood, service level) → `{ calculatedFee: number \| null, rateZone, needsManualFee: boolean }` |
| `POST /api/shipments` | Owner, dispatcher | `ShipmentCreateInput` → `201 Shipment` |
| `GET /api/shipments/board?date=YYYY-MM-DD&status&merchantId&courierId&rateZoneId&flag` | Owner, dispatcher | → `DispatchBoard` = `{ date, serverTime, counts: Record<ShipmentStatus, number>, shipments: BoardShipment[], pendingFromPreviousDays: BoardShipment[] }` |
| `GET /api/shipments/search?q&from&to&status&merchantId&neighborhoodId&cursor` | Owner, dispatcher | → `{ items: ShipmentSummary[], nextCursor: string \| null }`, newest first |
| `GET /api/shipments/export?format=csv\|xlsx&…search params` | Owner | → file download with Spanish headers (FR-025) |
| `GET /api/shipments/:trackingNumber` | Owner, dispatcher | → `ShipmentDetail` = `Shipment` + `events: ShipmentEvent[]` |
| `PATCH /api/shipments/:id` | Owner, dispatcher | `ShipmentUpdateInput` (changed fields + `version`) → `Shipment`; `409 version_conflict` or `409 invalid_transition` |
| `POST /api/shipments/:id/void` | Owner, dispatcher | `{ reason: string, version: number }` → `Shipment` (`status: "voided"`) |
| `POST /api/shipments/:id/confirm-fee` | Owner | `{ fee: number, version: number }` → `Shipment` with `feeNeedsReview: false` (FR-035) |
| `GET /api/shipments/duplicates?merchantId&serviceDate&merchantReference&recipientPhone` | Owner, dispatcher | → `{ trackingNumbers: string[] }`; matches the reference or, without one, the phone (FR-013) |

- `q` matches tracking number (normalized, research R6), merchant reference, merchant name or
  alias, recipient name (trigram), and recipient phone (digits only).
- `serverTime` lets the client correct its clock for flags (research R9).
- `flag` accepts `at_risk`, `late`, and `fee_review`.
- `ShipmentUpdateInput` never contains `trackingNumber`, `merchantId`, or `kind` (FR-015).

## Bulk registration

| Method and path | Role | Request → Response |
| --- | --- | --- |
| `POST /api/bulk/preview` | Owner, dispatcher | `{ merchantId, rows: string[][] }` (≤ 200 rows, columns per [bulk-template.md](bulk-template.md)) → `{ rows: BulkPreviewRow[] }`, each with parsed values, `calculatedFee`, `neighborhoodMatch { id, name, similarity } \| null`, `duplicateOf: string[]`, `errors: Record<string, string>`, `status: "ready" \| "needs_confirmation" \| "invalid"` |
| `POST /api/bulk/confirm` | Owner, dispatcher | `{ merchantId, rows: ShipmentCreateInput[] }` (only confirmed rows) → `201 { batchId, created: { row: number, trackingNumber: string }[] }`; all rows are created or none, and a failure returns `400` with the failing rows (FR-020) |

## Master data

| Method and path | Role | Purpose |
| --- | --- | --- |
| `GET /api/merchants?q&active` · `POST` · `PATCH /:id` | Owner, dispatcher | Merchants with aliases (FR-026, FR-027) |
| `GET /api/merchants/:id/pickup-points` · `POST` · `PATCH /api/pickup-points/:id` | Owner, dispatcher | Pickup points; setting `isDefault` clears the previous default |
| `GET /api/merchants/:id/recipients?q` | Owner, dispatcher | Recipient suggestions from past shipments (FR-004) |
| `GET /api/couriers?q&active` · `POST` · `PATCH /:id` | Owner, dispatcher | Couriers with aliases |
| `GET /api/carriers?q&active` · `POST` · `PATCH /:id` | Owner, dispatcher | Carriers |
| `GET /api/neighborhoods?q&municipalityId&kind&needsReview` · `POST` · `PATCH /:id` | Owner, dispatcher | Catalog search (fuzzy, research R7), add with an existing rate zone, edit name and variants. `rateZoneId` in `PATCH` and `needsReview: false` are owner-only (FR-026, FR-036) |
| `GET /api/municipalities` · `GET /api/rate-zones` | Owner, dispatcher | Read lists |
| `POST /api/rate-zones` · `PATCH /:id` | Owner | Manage rate zones (FR-028) |
| `GET /api/rate-card?merchantId&at` | Owner, dispatcher | Rate card in force at an instant (dispatcher: read-only) |
| `GET /api/rate-card/history?merchantId` · `POST /api/rate-card/entries` | Owner | Full history; add an entry with `effectiveFrom` as a date (append-only; latest added wins on the same date) |
| `GET /api/audit-events?entityType&entityId&cursor` | Owner | History of master data and user changes (FR-036) |

There are no `DELETE` endpoints: records are deactivated through `PATCH { isActive: false }`
(FR-017, FR-029).
