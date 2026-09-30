# Implementation Plan: Courier App

**Branch**: `003-courier-app` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-courier-app/spec.md`

## Summary

Give couriers an installable app that works without signal: they see their route, confirm
pickups, record deliveries with received-by name, photo, and collection by payment method,
report exceptions and problems, confirm handovers, acknowledge the dispatcher's changes, and
see their day. Give the dispatcher what closes the loop: decisions after an exception (new
attempt, return to sender, receipt at the office), recording on a courier's behalf,
corrections and reverts, and the new flags on the dispatch board.

Technically, the courier app is a section of the existing web app. Every courier action is a
**record** with a phone-generated identifier, saved in IndexedDB before anything is sent and
applied on the server exactly once by one pure function shared with the phone. Photos go to
private S3-compatible storage; phone notifications use Web Push. It builds on the
foundations of features [001](../001-shipment-registration/plan.md) and
[002](../002-routes-dispatch/plan.md) (see [research.md](research.md)).

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24 LTS — as feature 001

**Primary Dependencies**: those of features 001 and 002, plus:
- Web: `vite-plugin-pwa` 1.3 with `workbox-precaching` 7.4 (service worker and manifest),
  `idb` 8 (IndexedDB).
- Server: `@aws-sdk/client-s3` 3 (photo storage), `web-push` 3.6 (phone notifications).
- Tests: `fake-indexeddb` 6.

**Storage**: PostgreSQL 18 (new tables `courier_records`, `record_photos`,
`courier_notices`, `push_subscriptions`, `company_settings`; new columns on `shipments`,
`route_tasks`, `couriers`); S3-compatible object storage for photos (DigitalOcean Spaces;
MinIO in development and tests); IndexedDB on the phone ([data-model.md](data-model.md))

**Testing**: Vitest 5 (unit; integration against real PostgreSQL and MinIO via
Testcontainers), Playwright 1.63 with a phone viewport and offline mode — as feature 001

**Target Platform**: Linux server as feature 001; courier app on Android 10+ with Chrome and
iOS 16+ Safari installed to the home screen (constitution, Principle VII)

**Project Type**: Web application (monorepo: `apps/server`, `apps/web`, `packages/domain`)

**Performance Goals**: a loaded route opens offline in under 3 s (SC-003); records and
changes visible to the other side within 1 minute with signal (SC-004); a delivery recorded
in under 30 s of user time (SC-002)

**Constraints**:
- Every record persisted on the phone before any network call; exactly one effect.
- A photo, a location, or a notification never blocks a record or a dispatcher action.
- The API stays client-agnostic: a future native app sends the same records.
- Photos about 200 KB, private bucket, 12-month retention.
- Monthly infrastructure within the quoted range (object storage about COP 20,000).

**Scale/Scope**: 4–6 couriers, about 20–40 shipments and 20–40 photos a day; 7 user stories,
41 functional requirements; 4 courier screens and about 6 panel additions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Status |
| --- | --- | --- |
| I. Simplicity First | No new process, package, or service of our own: the courier app is a section of `apps/web`; photos upload through the existing server; retention is a bucket rule; notifications use the browsers' push services. Camera, compression, location, and shortcuts use the platform, not libraries | ✅ |
| II. Zero Data Loss in the Field | Records are written to IndexedDB before any request and survive restarts; each has a phone-generated `id` that is the primary key on the server (exactly one effect); `occurred_at` and `recorded_at` are both stored; sync runs on open, on reconnection, and every 30 s; the pending count and list are always visible; photos are compressed on the phone. A record is stored even when it cannot be applied | ✅ |
| III. Single Source of Truth | `resolveCourierRecord`, the day summary, the extended route rules, flags, and lifecycle live in `packages/domain`; the phone replays its outbox with the same function the server executes | ✅ |
| IV. Transactional Integrity & Traceability | One transaction per record: the record, shipment and task changes, route status, events, and notices. Records, photos rows, and notices are never deleted; corrections and reverts keep previous values in the append-only history. Database checks for custody holder and kind-specific columns | ✅ |
| V. Type Safety at Every Boundary | Zod union for records in `packages/domain`, used by the phone before saving and by the server on receipt; IndexedDB stores typed through `idb` | ✅ |
| VI. Test-First Business Logic | Record rules, the conflict matrix, and the day summary written test-first; integration tests on real PostgreSQL and MinIO; outbox tests with `fake-indexeddb`; Playwright for "complete a delivery with photo and COD collection" and "offline action then sync", both named by the constitution | ✅ |
| VII. Effortless UX | Spanish glossary terms; M3 courier patterns from the design system (navigation bar, bottom sheets, connectivity banner, sync badge, high contrast); 48 px targets; pickup, delivery, and exception within 3 taps of the route screen; Android 10+ and iOS 16+ | ✅ |
| VIII. Absolute Repository Order | Files in the places feature 001 defined; new terms in the glossary; features 001 and 002 documents aligned in this branch | ✅ |
| IX. Security, Privacy & Data Ownership | Couriers reach only `/api/courier/*` and their own photos, checked on the server; private bucket with no public URLs; notification payloads without personal data; route data cleared from the phone at sign-out and when a route finishes; keys from validated environment variables | ✅ |

**Post-design re-check (after Phase 1)**: ✅ all principles hold.
- The data model needs no new shipment status: status says what happened to the delivery,
  custody says who holds the package (a courier or the office).
- Designing the deactivation case showed that a deactivated courier cannot authenticate to
  send pending records. The spec (FR-003, EC-06) now says so: they stay readable on the
  phone and the dispatcher records them on the courier's behalf.
- Phone notifications on iOS need version 16.4 or later; the constitution requires the app
  to work on iOS 16+, which it does, since notifications are an aid (FR-040).

## Project Structure

### Documentation (this feature)

```text
specs/003-courier-app/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
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
├── courier-records.ts                # resolveCourierRecord, record and notice labels
├── day-summary.ts                    # collected total, cash to hand over, day summary
├── routes.ts                         # + return stop, held shipments, office pickup
├── shipment-lifecycle.ts             # + transitions owned by this feature
├── shipment-flags.ts                 # + the five new flags
└── schemas/
    └── courier.ts                    # CourierRecordInput union, snapshot, summary, decisions

apps/server/src/
├── env.ts                            # + storage and notification keys
├── db/schema/
│   ├── courier-records.ts            # courier_records, record_photos, courier_notices, push_subscriptions
│   ├── settings.ts                   # company_settings
│   ├── shipments.ts                  # + held_at_office, return_decided, needs_review
│   ├── routes.ts                     # + stop kind return, route_tasks.problem_note
│   └── couriers.ts                   # + last_synced_at
├── db/migrations/                    # one new reviewed migration
├── routes/
│   ├── courier.ts                    # /api/courier/*
│   ├── courier-records.ts            # correct, revert
│   ├── photos.ts                     # GET /api/photos/:id
│   ├── settings.ts                   # /api/settings
│   ├── shipments.ts                  # + records on behalf, exception decision, office receipt, clear review
│   └── routes.ts                     # + held shipments, notices on every change
└── lib/
    ├── courier-records.ts            # stores and applies one record in a transaction
    ├── notices.ts                    # notifyCourier: notice row + phone notification
    ├── push.ts                       # web-push client
    └── storage.ts                    # S3 client: put, get

apps/server/tests/                    # courier-*.test.ts, exception-decision.test.ts, photos.test.ts, setup/storage.ts

apps/web/src/
├── sw.ts                             # service worker: app shell precache, notifications
├── routes.ts                         # + /mensajero, /mensajero/parada/$stopId, /mensajero/mi-dia, /mensajero/pendientes, /configuracion
├── routes/
│   ├── courier-layout.tsx            # navigation bar, connectivity banner, sync badge
│   ├── courier-route.tsx             # "Mi ruta": stops, notices, packages to hand over
│   ├── courier-stop.tsx              # one stop: tasks, shortcuts, actions
│   ├── courier-day.tsx               # "Mi día"
│   ├── courier-pending.tsx           # pending records, sign-out
│   └── settings.tsx                  # office address (owner)
├── features/courier/
│   ├── delivery-form.tsx             # received-by, photos, collection, confirmation
│   ├── collection-fields.tsx
│   ├── exception-form.tsx
│   ├── problem-form.tsx
│   ├── disbursement-form.tsx
│   ├── photo-input.tsx
│   ├── notice-list.tsx
│   └── install-hint.tsx
├── features/shipments/
│   ├── shipment-records.tsx          # proof, collection, attempts, records not applied
│   ├── record-on-behalf-dialog.tsx
│   ├── exception-decision-dialog.tsx
│   └── correct-record-dialog.tsx
├── features/board/                   # + new flags, "Novedades por decidir"
├── features/routes/                  # + last sync, unacknowledged changes, held shipments
└── lib/offline/
    ├── db.ts                         # IndexedDB stores
    ├── outbox.ts                     # save a record, replay over the snapshot
    ├── sync.ts                       # the sync loop
    ├── photos.ts                     # compression
    ├── location.ts                   # last known position
    └── push.ts                       # permission and subscription

apps/web/tests/e2e/                   # courier-route.spec.ts, courier-offline.spec.ts, courier-exceptions.spec.ts, courier-changes.spec.ts
compose.yaml                          # + MinIO
.env.example                          # + S3_*, VAPID_*
```

**Structure Decision**: no new package or folder convention. The only new folder is
`apps/web/src/lib/offline/`, because the offline machinery is shared by every courier
screen.

## Cross-feature alignment

Made in this branch, so features 001 and 002 stay consistent with this one:

- Feature 001 data model: the lifecycle rows owned by 003 are replaced by the transitions in
  [data-model.md](data-model.md).
- Feature 002 spec and data model: a note that "Sin asignar" also lists held shipments, that
  held shipments join routes under the rules for picked-up shipments, and that `stop_kind`
  gains `return`; the items its Assumptions deferred to this feature are marked as defined
  here.
- Feature 002's test-only stand-in for courier actions (its task T012) is replaced by the
  real record function in this feature's tasks.

## Complexity Tracking

No constitution violations.

| Addition | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| `vite-plugin-pwa` and a service worker | FR-001, FR-022: the app must open without signal and be installable | Without a service worker a closed app cannot open offline |
| `idb` | Constitution II: records and photos persisted on the phone | Raw IndexedDB is callback-based and untyped; `localStorage` cannot hold photos |
| `@aws-sdk/client-s3` and MinIO for development | Ratified stack: S3-compatible storage for photos | Photos in PostgreSQL bloat backups; the local disk of one VPS has no retention rule or redundancy |
| `web-push` | FR-040 (clarified): notification with the app closed | Polling cannot reach a closed app |
| `courier_notices` table | FR-027: per-notice acknowledgment shown to the dispatcher | Deriving notices from two event tables misses shipment-level changes |
