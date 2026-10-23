# Implementation Plan: Tracking Page, Merchant Link, and WhatsApp Message

**Execution branch**: `codex/local-readiness-orchestration` | **Aligned**: 2026-10-21 | **Spec**: [spec.md](spec.md)

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
  FR-019, and FR-020.
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
| VII. Effortless UX | Spanish plain-language statuses; tracking page without login or installation, exposing only what the recipient already knows plus the bounded exception of Principle VII (v2.0.0 (the original bounded disclosure decision dates to v1.2.0)): the courier's first name and phone while on the way, and the received-by name; M3 design system; 320 px; WCAG 2.2 AA; two taps per merchant | ✅ |
| VIII. Absolute Repository Order | Files in the places feature 001 defined; new terms in the glossary | ✅ |
| IX. Security, Privacy & Data Ownership | 128-bit random codes, never the tracking number; merchant links replaceable; photos only through a valid merchant link; `noindex`, `no-store`, uniform `404`, rate limit; couriers' authorization to show their name and phone collected before go-live, as Principle VII requires | ✅ |

**Post-design re-check (after Phase 1)**: ✅ all principles hold. The design needs no new
table: notifications are shipment events plus two columns, and expiry is derived from the
event history. `/speckit-analyze` found that showing the courier's name and phone and the
received-by name went beyond Principle VII as written; the constitution was amended to
v2.0.0 (the original bounded disclosure decision dates to v1.2.0) with a bounded exception approved by the owner.

## Project Structure

### Documentation (this feature)

```text
specs/004-tracking-merchant-link/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── quickstart-results.md   # written by task T034 during validation
├── contracts/
│   └── http-api.md
├── checklists/
│   ├── requirements.md
│   └── public-pages.md
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
│   ├── merchant-notify-row.tsx
│   ├── api.ts                         # native inferred Hono queries/mutations
│   ├── notification-intents.ts        # validated per-action browser metadata
│   └── use-notification-sync.ts       # actor-scoped retry in the existing panel
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

| Addition | Why needed | Simpler alternative rejected |
| --- | --- | --- |
| Browser pending-notification intents (native localStorage, no service/dependency/table) | R8/T022 require the mark after a successful open/copy to survive navigation/reload and uncertain acknowledgment | In-memory mutation retries lose the action UUID on reload. Reusing the courier outbox mixes authenticated panel intents with courier records. One shared storage array risks cross-tab lost writes; one key per action avoids that without locks before the user-activation-sensitive popup |

This bounded pending-action queue adds no process, broker, cache or package.
Research R21 defines its write-before-action order and actor isolation. The normal
Spec Kit gate and independent analysis still apply before T022 implementation.

## Current execution alignment — 2026-10-21

Research R12–R16 supersede narrower historical descriptions above: explicit public
origin/build parity; stable existing-row migration; transport peer identity; bounded
limiting; bearer-path/audit secrecy; existing-worker exclusion; partial support edits;
nonempty actor-bound notification receipts; merchant-photo date window and carrier
allowlist. Development proceeds after owner-approved physical deferral, while 003
physical/final gates remain open for final delivery.

Delivery order is foundations → tracking → merchant portal/rotation → notification
UI. Shared files remain sequential; independent RED suites may be authored in parallel.
No new service/dependency is needed. Existing migration/seed/test paths must remain
compatible; run all four local gates before integrated closure. Reviewer-owned
checklists remain unchanged and are not implementation completion markers.

## Local public tracking performance measurement

SC-003 uses the built app and a fresh anonymous 390×844 Chromium context with
HTTP cache disabled, 250 ms latency, 1.5 Mbps download and 0.75 Mbps upload. Start
the host monotonic clock immediately before navigation; wait only for navigation
commit, then check the exact status heading's native CSS visibility on each browser
animation frame. Capture elapsed time immediately when that visibility wait
resolves, retain the independent exact-text Playwright visibility assertion, and
require captured elapsed <= 3000 ms. The budget includes navigation, transfers,
API response, rendering and the visibility result's IPC delivery. It excludes only
the separate assertion helper's exponential retry/backoff after readiness; that
backoff is not page loading. No cache warming, fake response or threshold increase.
Attach elapsed measurements and retain first-failure traces. SC-002 likewise
keeps its <=60000 ms update bound, including reactivation of an open expired link
after an effective delivery is reverted.

## OP-01 trusted proxy alignment (documentation only, 2026-10-22)

The existing direct native-peer rate-limit behavior remains the default. The
separate OP-01 opt-in is the single optional `DOMY_TRUSTED_PROXY_IP` validated as
an exact IPv4 or IPv6 literal (no CIDR or port); invalid configuration fails
validation. `index.ts` passes the value as optional `AppDeps.trustedProxyIp`.
Implement the pure `resolveClientAddress(nativePeer, trustedProxyIp,
canonicalHeader)` helper under `apps/server/src/lib/`, without a dependency or
changes to domain packages. It may accept `X-Domy-Client-IP` only when the
normalized native peer exactly equals the configured peer and the request carried
exactly one valid canonical-header IP. Normalize IPv4-mapped IPv6 for comparison
and output. Reject duplicate/comma-separated or malformed header values. Adapter
extraction must preserve raw header cardinality and reject duplicate fields rather
than silently selecting one value. On any rejection, fall back to the native peer
or `unknown`; with a malformed header from
the trusted proxy this intentionally shares the proxy's bounded in-memory
60-per-minute bucket. `Forwarded`, `X-Forwarded-For`, and `X-Real-IP` remain
ignored. Caddy overwrites, rather than appends or forwards, the canonical header.

OP-01's synthetic lab uses edge `172.31.253.0/29` (Caddy `.2`, clients `.3` and
`.4`), proxy/app `172.31.254.0/29` (Caddy `.2`, app `.3`), and internal DB
`172.31.252.0/29`. Keep the app and database unpublished; verify only the intended
Caddy endpoint is attached to the proxy/app network. The artifact plan owns the
local addresses and loopback test origin; they do not set production network or
host choices. Required verification preserves the current native-adapter forged
header test, adds pure helper/env/peer RED cases, and runs the actual Caddy path
with two distinct source addresses: client A's 61st request is 429 and client B
remains allowed. Also verify Caddy replaces a forged value, malformed and
multiple values fall back, an untrusted peer cannot choose a rate-limit identity,
the backend is not published, and privacy markers do not enter app or proxy logs.
This is a new OP-01 assurance item; it does not reopen verified feature tasks
without an observed regression. Runtime source and deployment artifacts remain
unimplemented by this documentation alignment.
