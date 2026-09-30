# Research: Courier App

Phase 0 of [plan.md](plan.md). The toolchain, monorepo layout, client–server contract,
authentication, testing strategy, and design system are fixed by
[feature 001's research](../001-shipment-registration/research.md); routes, stops, tasks,
custody, handovers, and exactly-once actions by
[feature 002's research](../002-routes-dispatch/research.md). Versions verified against the
npm registry on 2026-09-30.

## R1. Where the courier app lives

- **Decision**: the courier app is a set of routes of the existing web app (`apps/web`),
  under `/mensajero`, in `features/courier/`. After sign-in a courier lands there; owner and
  dispatcher land on the panel. It reuses the API client, the design tokens, and
  `packages/domain`.
- **Rationale**: the constitution ratifies "one PWA serving the dispatch panel, the courier
  app, and the tracking page"; no new package, build, or deployment (Principle I).
- **Alternatives considered**: a separate `apps/courier` (a second build and deploy for the
  same stack).

## R2. Installable app and app shell

- **Decision**: `vite-plugin-pwa` 1.3 (supports Vite 8) with the `injectManifest` strategy
  and a hand-written service worker `apps/web/src/sw.ts` that precaches the built app shell
  (`workbox-precaching` 7.4) and handles push notifications (R8). The web manifest names the
  app "Domy" with the icons of the design system. The service worker caches no API
  responses: all route data lives in IndexedDB (R3). After sign-in the app calls
  `navigator.storage.persist()` and, when not installed, shows how to install it.
- **Rationale**: FR-001, FR-022, SC-003. One source of offline data avoids two caches
  disagreeing. `injectManifest` is required because the service worker has its own code.
- **Alternatives considered**: `generateSW` (cannot hold the push handler); caching API
  responses in the service worker (stale route data outside our control); Serwist (same
  capability, less used with Vite).

## R3. Data on the phone

- **Decision**: IndexedDB through `idb` 8 (a typed promise wrapper of about 1 kB), one
  database with four stores:
  - `snapshot`: the last route state received from the server (one entry);
  - `outbox`: the courier's records not yet acknowledged by the server, in order;
  - `photos`: compressed photo blobs not yet uploaded;
  - `meta`: signed-in user id, clock offset, last synchronization time.

  What the courier sees is always `snapshot` with the `outbox` replayed on top by the same
  pure function the server uses (R5), so the result is visible at once and identical to
  what the server will compute.
- **Rationale**: Constitution II (persisted on the device before any network call; survives
  restarts) and III (one implementation of the rules). An outbox of records replayed over a
  server snapshot needs no merge logic: the server is the only authority, and the phone
  never edits the snapshot.
- **Alternatives considered**: Dexie 4 (larger, its query layer is not needed for four
  stores); `localStorage` (no blobs, size limits, synchronous); a local replica with
  two-way merge (far more machinery than an outbox).

## R4. Synchronization

- **Decision**: one loop in `apps/web/src/lib/offline/sync.ts`, run when the app opens, on
  the browser's `online` event, when the app becomes visible, and every 30 seconds while it
  is visible:
  1. send the outbox in order with `POST /api/courier/records` (at most 50 per request);
     each acknowledged record leaves the outbox;
  2. upload pending photos whose record was acknowledged (R6);
  3. fetch `GET /api/courier/route` and replace `snapshot`.

  A failed step stops the loop until the next trigger; nothing is removed from the phone
  before the server acknowledges it. A `401` keeps everything and asks the courier to sign
  in; the outbox is tied to the user id in `meta`, and the app refuses to sign in a
  different user while it is not empty.
- **Rationale**: FR-018–FR-022 and Constitution II (sync on open, on reconnection, and
  periodically). Sending records before fetching the snapshot guarantees the snapshot
  already includes them.
- **Alternatives considered**: the Background Sync API (not available in Safari, and
  unreliable on Android when the app is closed); WebSockets (a second channel for a
  one-minute freshness target).

## R5. Courier records and exactly-once

- **Decision**: every courier action is a **record** with an `id` generated on the phone,
  stored in a `courier_records` table whose primary key is that `id`. Inserting it and
  applying its effect happen in one transaction per record; a repeated `id` returns the
  stored outcome and does nothing else. The decision of what a record does is a pure
  function `resolveCourierRecord(shipment, record)` in `packages/domain`, returning
  `applied` (with the status, custody, and task changes), `duplicate`, or `not_applied`. The
  server executes that result; the phone uses the same function to replay its outbox (R3).
- **Rationale**: FR-019, FR-024–FR-026, Constitution II and III. The primary key gives
  exactly-once without an idempotency table; a record is stored even when it cannot be
  applied, so it is never lost.
- **Alternatives considered**: storing records only as `shipment_events` (no place for
  received-by name, amounts, photos, or a "not applied" outcome); one table per record kind
  (seven tables and seven idempotency checks for the same shape).

## R6. Photos

- **Decision**:
  - **Capture**: `<input type="file" accept="image/*" capture="environment">`, which opens
    the phone's camera without a camera permission flow of our own.
  - **Compression** on the phone with the platform (`createImageBitmap` and a canvas,
    longest side 1600 px, JPEG quality 0.8, about 200 KB; decision #29), no library.
  - **Upload**: `PUT /api/courier/photos/:id` with the image as the body, after its record
    was acknowledged; the server stores it in S3-compatible object storage with
    `@aws-sdk/client-s3` 3 and sets `uploaded_at`. The `id` is generated on the phone and
    declared in the record, so the server knows which photos to expect ("Foto pendiente").
  - **Viewing**: `GET /api/photos/:id` streams the object after a role check; the bucket is
    private and has no public URLs.
  - **Retention**: a lifecycle rule on the bucket deletes objects after 12 months; the panel
    shows "Foto eliminada por antigüedad" when an object is gone.
  - **Development and tests**: MinIO in `compose.yaml` and in Testcontainers.
- **Rationale**: FR-009, FR-023, FR-036, business master §4.4. Uploading through the server
  (about 20 photos a day of 200 KB) avoids presigned URLs and bucket CORS rules; the bucket
  lifecycle rule is retention without code.
- **Alternatives considered**: `getUserMedia` with a custom camera screen (permissions and
  device quirks for no gain); `browser-image-compression` (the platform does it in 20
  lines); presigned direct uploads (two more moving parts); photos in PostgreSQL (bloats
  backups).

## R7. Location and time

- **Decision**: while a stop is open the app keeps the last position from
  `navigator.geolocation.watchPosition`; saving a record attaches that position if it is at
  most 2 minutes old, otherwise none. Saving never waits for a position. Each sync request
  carries the phone's current time; the server computes the offset to its own clock and
  stores `occurred_at = device time + offset`, never later than `recorded_at`.
- **Rationale**: FR-015 (never blocking), FR-019 and EC-03 (wrong phone clock), decision
  #33.
- **Alternatives considered**: asking for a position at save time (blocks up to the
  timeout); trusting the phone clock (a wrong clock reorders custody).

## R8. Phone notifications

- **Decision**: Web Push with VAPID keys through `web-push` 3.6. The app asks for the
  permission once after sign-in and registers the subscription
  (`push_subscriptions` table). Every change that creates a notice for a courier (R9) sends
  a push after the transaction commits, without waiting for the result; a `404` or `410`
  from the push service deletes the subscription. The payload carries only the notice type
  and the route number; the service worker shows the Spanish text and opens `/mensajero`.
- **Rationale**: FR-040 (clarification Q1): an aid that never blocks the dispatcher. No
  third-party service: the browser vendors' push services are free.
- **Limits**: on iPhone it needs iOS 16.4 or later and the app installed on the home screen;
  elsewhere the notice in the app remains the reference.
- **Alternatives considered**: Firebase Cloud Messaging SDK (a vendor SDK for what the
  standard already does); WhatsApp messages to couriers (Business API, Phase 3).

## R9. Notices

- **Decision**: a `courier_notices` table written by one helper,
  `notifyCourier(tx, courierId, type, …)`, called inside the transaction of every dispatcher
  action that affects a courier (features 002 and 003). The snapshot returns the courier's
  unacknowledged notices; "Entendido" sends an acknowledgment that sets `acknowledged_at`
  only if it is empty. The dispatch board reads the count of unacknowledged notices per
  route and `couriers.last_synced_at`, updated on every snapshot request.
- **Rationale**: FR-027, FR-033. An explicit row per notice is simpler to query and to
  acknowledge than deriving notices from route and shipment events of several types.
- **Alternatives considered**: deriving notices from `route_events` with an "acknowledged up
  to" pointer (does not cover shipment-level changes such as a corrected record).

## R10. After an exception: custody, office, and routes

- **Decision**:
  - The courier keeps custody after an exception. A **new attempt** returns the shipment to
    `picked_up`; a **return** sets `shipments.return_decided` and keeps `exception` until
    the return stop is completed.
  - A held shipment can sit on no route (`route_id` null with status `picked_up`, or
    `exception` with `return_decided`). The unassigned list of feature 002 includes these,
    marked with their holder.
  - Adding a held shipment to a route reuses `addShipmentToStops`, extended in
    `packages/domain/src/routes.ts`: held by a courier → only a delivery or return stop,
    only on a route in progress, with a pending handover if the route is another courier's
    (the rules feature 002 already has for picked-up shipments); held by the office → a
    pickup stop at the office address first, on any route.
  - **Office**: `shipments.held_at_office` with `custody_courier_id` null; the office
    address is one row of `company_settings`. With a new attempt decided, an office-held
    shipment is `registered` and flows through feature 002 unchanged.
  - `stop_kind` gains `return`.
- **Rationale**: FR-029–FR-031, FR-041, clarification Q2. Status keeps meaning "what happened
  to the delivery" and custody "who has the package", so the lifecycle gains transitions
  but no new status.
- **Alternatives considered**: a new status "En devolución" (a ninth status for a state the
  pending return stop already expresses); returning every exception to `registered` (the
  next route would create a pickup at the merchant for a package the courier holds); the
  office modelled as a courier (pollutes the courier directory and payouts).

## R11. Flags

- **Decision**: the existing `shipment-flags` module computes the new flags from data the
  board query already joins: "Sin foto" (delivery record without proof photos), "Foto
  pendiente" (photo row without `uploaded_at`), "Recaudo diferente" (collected total ≠ COD
  amount), "Problema de recogida" (pending task with `problem_note`), "Por revisar"
  (`shipments.needs_review`). "Novedades por decidir" counts shipments in `exception`
  without `return_decided`.
- **Rationale**: FR-033, Constitution III (one place for flag rules).

## R12. Recording on behalf, corrections, and reverts

- **Decision**: the dispatcher's "record on behalf" sends the same record shape to a panel
  endpoint, which calls the same server function with `on_behalf = true`; nothing is
  duplicated. A correction updates the record's columns in place and writes a
  `record_corrected` shipment event with the old and new values (the pattern feature 001
  uses for shipment edits). A revert marks the record (`reverted_at`, `reverted_by`,
  `revert_reason`), applies the inverse transition from the shared lifecycle, and sets the
  task back to `pending` when its route is still in progress.
- **Rationale**: FR-034, FR-035, Constitution IV (nothing deleted; previous values in the
  append-only history).

## R13. Session on the phone

- **Decision**: Better Auth as in feature 001 (R5): fixed 30-day sessions. The snapshot
  returns `sessionExpiresAt`; the app warns from 2 days before. The courier app works on a
  loaded route with an expired session; only synchronization asks to sign in again.
  Sign-out is refused while the outbox is not empty and clears the IndexedDB database.
- **Rationale**: FR-003, FR-004 (clarification Q5).

## R14. Shortcuts

- **Decision**: plain links: `tel:` for calls, `https://wa.me/57{phone}` for WhatsApp,
  `https://www.google.com/maps/search/?api=1&query={address}` and
  `https://waze.com/ul?q={address}` for maps (decision #19).
- **Rationale**: FR-016 with the platform; they work offline as far as the target app does.

## R15. Testing

- **Decision**:
  - unit tests for `resolveCourierRecord`, the day summary, and the extended route and flag
    rules (domain, test-first);
  - unit tests for the outbox and sync loop with `fake-indexeddb` 6 and a fake fetch;
  - integration tests on real PostgreSQL and MinIO for record application, the conflict
    matrix, exactly-once, photos, decisions, corrections, and notices;
  - Playwright with a phone viewport, `context.setOffline(true)`, and a file chooser for
    the photo: the constitution's critical flows "complete a delivery with photo and COD
    collection" and "offline action then sync".
- **Rationale**: Constitution VI. Feature 002's test-only stand-in for courier actions is
  replaced by the real record function.

## R16. Cost

- **Decision**: object storage on DigitalOcean Spaces (about COP 20,000 a month), within
  the quoted infrastructure range; about 1.5 GB of photos a year.
- **Rationale**: constitution constraint on monthly cost; decision #25.
