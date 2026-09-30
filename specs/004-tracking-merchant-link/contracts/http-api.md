# HTTP API Contract: Tracking Page, Merchant Link, and WhatsApp Message

Extends the contracts of features [001](../../001-shipment-registration/contracts/http-api.md),
[002](../../002-routes-dispatch/contracts/http-api.md), and
[003](../../003-courier-app/contracts/http-api.md) and follows their conventions.

## Public endpoints (no session)

Every response carries `Cache-Control: no-store` and `X-Robots-Tag: noindex`. Requests are
limited to 60 per minute per client address (`429 rate_limited`). An unknown, replaced, or
deactivated code always returns the same `404 link_not_found` with the message "Este enlace
no es válido".

| Method and path | Response |
| --- | --- |
| `GET /api/public/tracking/:code` | `PublicTracking` (data-model.md §Public tracking view) (FR-001–FR-014) |
| `GET /api/public/merchant/:code?date=YYYY-MM-DD` | `MerchantDay` = merchant name, date, shipments, totals, support; `date` defaults to today and must be within the last 30 days (`422 date_out_of_range`) (FR-018) |
| `GET /api/public/merchant/:code/shipments/:id` | `MerchantShipment` (FR-019); `404` if the shipment is not the merchant's |
| `GET /api/public/merchant/:code/photos/:photoId` | The image; `404` if the photo is not of the merchant's shipments or no longer exists (FR-019, FR-021) |

## Panel endpoints (roles: owner, dispatcher)

| Method and path | Request → Response |
| --- | --- |
| `GET /api/notifications?date=YYYY-MM-DD` | → `{ merchants: { merchantId, name, whatsappPhone, linkCode, shipments: { id, trackingNumber, trackingCode, recipientName, neighborhood, notifiedAt }[] }[] }` (FR-015) |
| `POST /api/notifications` | `{ actionId, shipmentIds }` → `204`; marks them notified (FR-017) |
| `POST /api/merchants/:id/replace-link` | `{ actionId }` → `Merchant` with the new `linkCode`; audited (FR-020) |

## Changes to earlier contracts

- **`GET /api/shipments/:id`**: gains `trackingCode`, `notifiedAt`, `notifiedBy` (FR-018).
- **`GET /api/merchants/:id`**: gains `linkCode` (FR-020).
- **`GET /api/settings`** and **`PATCH /api/settings`** (owner): gain `supportPhone` and
  `companyName` (FR-009).
- **Shipment creation** (single and bulk): the server generates `tracking_code`; the
  client never sends it.
