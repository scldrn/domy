# Implementation Plan: Tracking Page, Merchant Link, and WhatsApp Message

**Branch**: `004-tracking-merchant-link` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-tracking-merchant-link/spec.md`

## Summary

Give recipients a public tracking page per shipment and merchants a private page with their
shipments of the day, both opened by link without signing in; and give the dispatcher
"Notificar clientes", which opens WhatsApp on each merchant's number with the day's tracking
links already written.

Technically, both pages are lazy-loaded routes of the existing web app backed by read-only
public endpoints. What they may show is decided by two pure functions in `packages/domain`,
so no field can leak by accident. Links carry 128-bit random codes; public endpoints are
rate-limited, not cached, and not indexed. The WhatsApp message is composed in the browser
and sent by the dispatcher; nothing is sent automatically (see [research.md](research.md)).

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24 LTS — as feature 001

**Primary Dependencies**: those of features 001–003; no new dependency

**Storage**: PostgreSQL 18 — new columns on `shipments`, `merchants`, and `company_settings`
([data-model.md](data-model.md)); photos read from the object storage of feature 003

**Testing**: Vitest 5 (unit; integration against real PostgreSQL via Testcontainers),
Playwright 1.63 (end to end, including a throttled mobile network) — as feature 001

**Target Platform**: public pages in any current phone or desktop browser, from 320 px wide,
without installation

**Project Type**: Web application (monorepo: `apps/server`, `apps/web`, `packages/domain`)

**Performance Goals**: tracking page readable within 3 s on a slow mobile connection
(SC-003); status changes visible within 1 minute (SC-002); every merchant notified in under
2 minutes (SC-001)

**Constraints**:
- Public pages are read-only and expose only the fields of spec FR-003–FR-008, FR-014,
  FR-018, and FR-019.
- Codes are unguessable; invalid codes always get the same answer.
- No automatic messages (Phase 3).

**Scale/Scope**: about 20–40 tracking links and 10–20 merchant messages a day; 3 user
stories, 24 functional requirements; 3 screens (tracking page, merchant page, "Notificar
clientes") and 3 panel additions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Status |
| --- | --- | --- |
| I. Simplicity First | No new dependency, table, service, or process. Public pages are routes of the same web app; rate limiting is an in-memory counter in the one server process; link previews are safe by construction (static `index.html`) | ✅ |
| II. Zero Data Loss in the Field | No field action in this feature. The notification mark carries an `actionId` and is retried; public endpoints are read-only | ✅ |
| III. Single Source of Truth | Public status texts, the tracking view, the merchant view, "entregas antes de la tuya", and the message text live in `packages/domain` | ✅ |
| IV. Transactional Integrity & Traceability | Notifications write shipment events; replacing a merchant link writes an audit event; nothing is deleted | ✅ |
| V. Type Safety at Every Boundary | Zod schemas for public responses and panel requests in `packages/domain`; public endpoints serialize only the domain views | ✅ |
| VI. Test-First Business Logic | The views and the message are written test-first, with every status and kind; integration tests for isolation, expiry, uniform `404`, rate limit, and headers; Playwright for the constitution-named critical flow "public tracking page", including a slow network | ✅ |
| VII. Effortless UX | Spanish plain-language statuses; tracking page without login or installation, exposing only what the recipient already knows plus what the owner approved (decision #8); M3 design system; 320 px; WCAG 2.2 AA; two taps per merchant | ✅ |
| VIII. Absolute Repository Order | Files in the places feature 001 defined; new terms in the glossary | ✅ |
| IX. Security, Privacy & Data Ownership | 128-bit random codes, never the tracking number; merchant links replaceable; photos only through a valid merchant link; `noindex`, `no-store`, uniform `404`, rate limit; couriers' authorization to show their name and phone noted for go-live | ✅ |

**Post-design re-check (after Phase 1)**: ✅ all principles hold. The design needs no new
table: notifications are shipment events plus two columns, and expiry is derived from the
event history.

## Project Structure

### Documentation (this feature)

```text
specs/004-tracking-merchant-link/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── quickstart-results.md   # written during validation (tasks)
├── contracts/
│   └── http-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

Files added or changed by this feature, inside the structure defined by feature 001:

```text
packages/domain/src/
├── public-tracking.ts                # publicTrackingView, merchantShipmentView, public status and reason texts
├── merchant-message.ts               # composeMerchantMessage
├── routes.ts                         # + deliveriesBefore
└── schemas/
    ├── public.ts                     # PublicTracking, MerchantDay, MerchantShipment
    └── notifications.ts              # notification list and request

apps/server/src/
├── env.ts                            # + PUBLIC_BASE_URL
├── app.ts                            # + noindex header on public web routes
├── db/schema/
│   ├── shipments.ts                  # + tracking_code, notified_at, notified_by
│   ├── directories.ts                # + merchants.link_code, link_replaced_at
│   └── settings.ts                   # + support_phone, company_name
├── db/migrations/                    # one new reviewed migration
├── routes/
│   ├── public.ts                     # /api/public/*
│   ├── notifications.ts              # /api/notifications
│   ├── merchants.ts                  # + replace-link, linkCode
│   ├── shipments.ts                  # + tracking_code at creation, detail fields
│   ├── bulk.ts                       # + tracking_code at creation
│   └── settings.ts                   # + support contact
└── lib/
    ├── secret-code.ts                # 128-bit base64url code
    └── rate-limit.ts                 # fixed window per client address

apps/server/tests/                    # public-*.test.ts, notifications.test.ts, merchant-link.test.ts

apps/web/src/
├── main.tsx                          # service worker not registered on public routes
├── routes.ts                         # + /seguimiento/$code, /cliente/$code, /notificar
├── routes/
│   ├── tracking.tsx                  # public tracking page (lazy)
│   ├── merchant-page.tsx             # public merchant page (lazy)
│   └── notify-merchants.tsx          # "Notificar clientes"
├── features/public/
│   ├── public-layout.tsx             # Domy header, support contact
│   ├── tracking-status.tsx
│   ├── merchant-shipment-list.tsx
│   └── merchant-shipment-detail.tsx
├── features/notifications/
│   └── merchant-notify-row.tsx
├── features/shipments/shipment-detail.tsx        # + "Copiar enlace de seguimiento", notified
└── features/master-data/merchants/               # + copy and replace the merchant link

apps/web/tests/e2e/                   # tracking-page.spec.ts, notify-merchants.spec.ts, merchant-page.spec.ts
```

**Structure Decision**: no new package or folder convention; `features/public/` holds the
components that only the public pages use.

## Cross-feature alignment

Made in this branch:

- Feature 001 data model: `shipments.tracking_code` and `merchants.link_code` are noted as
  added by this feature; shipment creation generates the code.
- Feature 003 data model: `company_settings` gains the support contact.

## Complexity Tracking

No constitution violations and no additions that need justification.
