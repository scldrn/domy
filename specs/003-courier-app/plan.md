# Implementation Plan: Courier App

**Branches**: short-lived, one per slice ([tasks.md](tasks.md), Delivery under Trunk-Based
Development) | **Date**: 2026-09-30, aligned with feature 002 as built on 2026-10-14 |
**Spec**: [spec.md](spec.md)

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
- Web: `vite-plugin-pwa` 1.3.0 (development) with `workbox-precaching`, `workbox-routing`, and
  `workbox-window` 7.4.1 (service worker and manifest), `idb` 8.0.4 (IndexedDB).
- Server: `@aws-sdk/client-s3` 3 (photo storage), `web-push` 3.6.7 (phone notifications).
- Tests: `fake-indexeddb` 6.2.5.
- Exact versions are pinned when T001 adds them (verified 2026-10-14, research R17).

**Storage**: PostgreSQL 18 (new tables `courier_records`, `record_photos`,
`courier_notices`, `push_subscriptions`, `company_settings`; new columns on `shipments`,
`route_tasks`, `couriers`); S3-compatible object storage for photos (DigitalOcean Spaces;
S3Proxy in development and tests, research R6); IndexedDB on the phone
([data-model.md](data-model.md))

**Testing**: Vitest 5 (unit; integration against real PostgreSQL and S3Proxy via
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
42 functional requirements; 4 courier screens and about 6 panel additions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Status |
| --- | --- | --- |
| I. Simplicity First | No new process, package, or service of our own: the courier app is a section of `apps/web`; photos upload through the existing server; retention is a bucket rule; notifications use the browsers' push services. Camera, compression, location, and shortcuts use the platform, not libraries | ✅ |
| II. Zero Data Loss in the Field | Records are written to IndexedDB before any request and survive restarts; each has a phone-generated `id` that is the primary key on the server (exactly one effect); `occurred_at` and `recorded_at` are both stored; sync runs on open, on reconnection, and every 30 s; the pending count and list are always visible; photos are compressed on the phone. A record is stored even when it cannot be applied | ✅ |
| III. Single Source of Truth | `resolveCourierRecord`, the day summary, the extended route rules, flags, and lifecycle live in `packages/domain`; the phone replays its outbox with the same function the server executes | ✅ |
| IV. Transactional Integrity & Traceability | One transaction per record: the record, shipment and task changes, route status, events, and notices. Records, photos rows, and notices are never deleted; corrections and reverts keep previous values in the append-only history. Database checks for custody holder and kind-specific columns | ✅ |
| V. Type Safety at Every Boundary | Zod union for records in `packages/domain`, used by the phone before saving and by the server on receipt; IndexedDB stores typed through `idb` | ✅ |
| VI. Test-First Business Logic | Record rules, the conflict matrix, and the day summary written test-first; integration tests on real PostgreSQL and S3Proxy; outbox tests with `fake-indexeddb`; Playwright for "complete a delivery with photo and COD collection" and "offline action then sync", both named by the constitution | ✅ |
| VII. Effortless UX | Spanish glossary terms; M3 courier patterns from the design system (navigation bar, bottom sheets, connectivity banner, sync badge, high contrast); 48 px targets; pickup, delivery, and exception within 3 taps of the route screen; Android 10+ and iOS 16+ | ✅ |
| VIII. Absolute Repository Order | Files in the places feature 001 defined; new terms in the glossary; features 001 and 002 documents aligned (research R17); every slice on its own short-lived branch (constitution 2.0.0) | ✅ |
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
├── quickstart-results.md   # written by task T087 during validation
├── contracts/
│   └── http-api.md
├── checklists/
│   ├── requirements.md
│   └── courier-rules.md
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
│   └── directories.ts                # + couriers.last_synced_at
├── db/migrations/                    # one new reviewed migration
├── routes/
│   ├── courier.ts                    # /api/courier/*
│   ├── courier-records.ts            # correct, revert
│   ├── photos.ts                     # GET /api/photos/:id
│   ├── settings.ts                   # /api/settings
│   ├── export.ts                     # + courier-records, routes, handovers
│   ├── shipments.ts                  # + records on behalf, exception decision, office receipt, clear review
│   └── routes.ts                     # + held shipments, notices on every change
└── lib/
    ├── courier-records.ts            # stores and applies one record in a transaction
    ├── notices.ts                    # notifyCourier: notice row + phone notification
    ├── push.ts                       # web-push client
    └── storage.ts                    # S3 client: put, get

apps/server/tests/                    # courier-*.test.ts (including courier-contract, courier-security, courier-scale), exception-decision.test.ts, office-receipt.test.ts, records-*.test.ts, photos.test.ts, setup/storage.ts

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
│   ├── courier-store.ts              # shared view, identity, and synchronization triggers
│   ├── sync-status.ts                # tested warning boundaries and count wording
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

apps/web/tests/e2e/                   # courier-*.spec.ts, exception-decision.spec.ts, records-on-behalf.spec.ts
compose.yaml                          # + S3Proxy (research R6)
.env.example                          # + S3_*, VAPID_*
apps/web/public/icons/                # provisional app icons (design-system.md §11)
apps/web/scripts/generate-app-icons.ts  # renders them (pnpm icons)
apps/web/tests/e2e/global-setup.ts    # + S3Proxy container, storage and test notification keys
```

**Structure Decision**: no new package or folder convention. The only new folder is
`apps/web/src/lib/offline/`, because the offline machinery is shared by every courier
screen.

## Cross-feature alignment

US2 delivery scope (owner approval 2026-10-14): technical outbox and synchronization tests
cover all record kinds; its phone journey covers pickups and deliveries. US3 adds the
exception form (T051) and completes the exception step of offline quickstart scenario 8
(T049). This preserves the feature's full offline requirement without claiming an unbuilt
screen in US2. The end-to-end environment must serve the built app for T043, so its real
service worker is active; the existing end-to-end suite uses that same environment.

US2 follows identity through `lib/offline/db.ts`, `outbox.ts`, `sync.ts`, the courier store,
the courier layout's session guard, and `features/auth/session.ts`. Ownership is established
before saving or sending, including sign-in and sign-out. Records and photos belonging to
another account cannot be taken over. Sync commits acknowledged outbox removals with the
refreshed snapshot, preserving the locally replayed result if the refresh fails. The
existing triggers stay in the shared courier store. Session refusal is classified using
the server's response time (or the stored clock offset) and the known expiry; a withdrawn
session clears the route snapshot but keeps pending actions. No new service is needed.

The shared auth consumer is covered by `features/auth/session.test.ts`; both courier and
panel layouts handle its guarded sign-out errors. A temporary server failure preserves the
cached route rather than pretending that the account was withdrawn. A `403` explicitly
withdraws access; an expired `401` does not. Unknown or unreadable local ownership blocks
account changes with storage guidance, without deleting pending work.

Stored items and transport responses are validated at their boundaries (Constitution V).
The snapshot's shared types are derived from its Zod schemas in
`packages/domain/src/schemas/courier.ts`, rather than copied into the phone's sync code.

Features 001 and 002 already carry the alignment below in their documents and code (the
shared lifecycle has this feature's transitions, `handovers.from_route_id` accepts null, the
002 spec lists what this feature extends). What feature 002 built after this plan was
written, and how this feature follows it, is in [research R17](research.md): custody
changes in the shipment history, `on_behalf` on events, the 1 MB body limit, handovers
without an origin route, and the notices for `join` and shipment edits.

- Feature 001 data model: the lifecycle rows owned by 003 are replaced by the transitions in
  [data-model.md](data-model.md).
- Feature 002 spec and data model: a note that "Sin asignar" also lists held shipments, that
  held shipments join routes under the rules for picked-up shipments, that `stop_kind`
  gains `return`, that a handover may start from a courier without a route, and that routes
  and handovers are exported by this feature (FR-042); the items its Assumptions deferred to this feature are marked as defined
  here.
- Feature 002's test-only stand-in for courier actions (its task T012) is replaced by the
  real record function in this feature's tasks.

## Complexity Tracking

No constitution violations.

Account-link and master data idempotency (FR-002, Constitution II, T095–T097) use the
existing audit event's unique `client_event_id`, including an empty-change receipt for an
accepted request that already matches the current values. No new table, migration, or
dependency is needed. The receipt is written inside the edit transaction; concurrent
retries roll back on the existing unique constraint, and the endpoint returns the current
state.
`lib/master-data.ts`'s `auditedChange` owns these receipts and audit writes for both normal
edits and account links affecting several couriers. The link callback returns the changed
couriers and their old/new account ids, or no changes; its fallback receipt identifies the
target courier or the unlinked user. `GET /api/audit-events` excludes empty and null changes
before pagination, while retaining the receipts in the database (feature 001 FR-036).

| Addition | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| `vite-plugin-pwa` and a service worker | FR-001, FR-022: the app must open without signal and be installable | Without a service worker a closed app cannot open offline |
| `idb` | Constitution II: records and photos persisted on the phone | Raw IndexedDB is callback-based and untyped; `localStorage` cannot hold photos |
| `@aws-sdk/client-s3`, and S3Proxy for development and tests | Ratified stack: S3-compatible storage for photos | Photos in PostgreSQL bloat backups; the local disk of one VPS has no retention rule or redundancy; MinIO no longer publishes images (research R6) |
| `apps/web/scripts/generate-app-icons.ts` (`pnpm icons`) | FR-001: an installable app needs PNG icons in several sizes | Drawing each size by hand repeats the work when the logo arrives; an SVG rasterizer cannot draw the wordmark without its font |
| `web-push` | FR-040 (clarified): notification with the app closed | Polling cannot reach a closed app |
| `courier_notices` table | FR-027: per-notice acknowledgment shown to the dispatcher | Deriving notices from two event tables misses shipment-level changes |
