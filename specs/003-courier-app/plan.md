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

### Test resource policy — owner-approved T107 alignment (2026-10-15)

Keep the same `pnpm test` gate and real PostgreSQL fixtures. In
`apps/server/vitest.config.ts`, partition the existing test inventory into two native
Vitest projects: ordinary unit/integration files with their existing parallelism, followed
by capacity files (`tests/*-scale.test.ts` and `tests/routes-invariants.test.ts`) without
file-level parallelism and with an explicit later sequence group. Capacity files must not
compete with integration files or each other. Currently this selects three existing
files (route scale, search scale and route invariants); the courier-scale task has not
landed yet. Do not add a placeholder test file.

Rationale: the unchanged full suite reproduced distributed per-step latency and deadlines
under concurrent database workloads, whereas isolated invariants complete all 90 steps in
about two seconds. A full run also exceeded the existing one-second route-creation budget.
Vitest's failure/duration cache changes file ordering, so an isolated pass is not stability
evidence. The exact physical bottleneck is not proven; isolate capacity measurements from
unrelated test workload instead of relaxing production targets. Samuel explicitly approved
this execution-policy change after reviewing the diagnostics.

Compare collected tests before/after partitioning: no missing or duplicate file/case.
Keep the existing 120-second default hook limit, 30-second default test limit and explicit
per-file overrides, three seeds, 90 steps, performance thresholds, real authentication,
database constraints, internal concurrent
request tests and all assertions. No retries, skips or weaker timing budgets are added.
Retain bounded, non-sensitive invariant phase timings for future failures, then repeat
all four gates and scoped convergence; CI continues to invoke the same scripts.

## Constitution Check

### CI action runtime maintenance — owner-approved 2026-10-16

T127 follow-up (owner-authorized local investigation/correction, 2026-10-16):
CI 38994299786 at `af78fa6` passes all gates and 88 first-attempt e2e, but the exact
`pnpm/action-setup@v6` commit `0977fd99725f1db4007ccb2928dbb4e90d06cc86`
bootstraps pnpm 11.19.0 and sets `PNPM_HOME` to its own `node_modules/.bin` before
self-updating to the unchanged project pin 12.8.1. That directory necessarily has a
pnpm shim and triggers pnpm's legacy-layout detector. The log confirms successful
12.8.1 activation and frozen installation, not an application failure.
Sources: [exact installer](https://github.com/pnpm/action-setup/blob/0977fd99725f1db4007ccb2928dbb4e90d06cc86/src/install-pnpm/run.ts),
[upstream report #281](https://github.com/pnpm/action-setup/issues/281),
[official migration guidance](https://github.com/pnpm/action-setup#migrating-to-pnpmsetup).
Changing `dest` or setting `standalone` does not separate the bootstrap shim from
`PNPM_HOME` on Linux; a later `pnpm setup` cannot undo an already-emitted warning.
Do not suppress it or modify pinned project versions to match the bootstrap.

Use the maintained successor `pnpm/setup@v3`, verified at
`a0881977cd8ea73b1ed212236c99ca10dcc80cf4`, only to install pnpm: set `install: false`
and `node-version-file: false`. Its [manifest](https://github.com/pnpm/setup/blob/a0881977cd8ea73b1ed212236c99ca10dcc80cf4/action.yml)
declares Node 24 action runtime and these supported inputs; its native download is
verified against npm signatures/checksums without the npm/self-update bootstrap.
Keep `actions/setup-node@v7` as sole Node installer with `.nvmrc` and the existing
pnpm cache; no redundant runtime, dependency installation or cache step is added.
Preserve `packageManager`, lockfile, checkout, runner, commands and all test policies.
Run exact old/new action bundles in disposable Linux containers with copied public
project manifests, no host secrets/configuration, asserting pinned pnpm activation
and no automatic runtime/dependency installation. Capture the old warning before the
workflow edit; validate the corrected configuration and all four local gates afterward.
This is installer maintenance, not a new dependency or business requirement. Fresh
GitHub CI remains required after publication; local simulation cannot replace it.
Commit/push, merge and US7 are not authorized by this local correction approval.
T127 supersedes only T120's pnpm installer choice below; its other constraints remain.
Samuel subsequently authorized commit/push of T127 in PR #25 and latest-head CI review
with “Si” (2026-10-16). Merge and US7 remain separate decisions; final-head CI must pass.

T120 addresses the deprecation warnings observed in US5 PR #23's successful CI.
Upgrade only `pnpm/action-setup` from v4 to v6 (current release v6.1.0) and
`actions/setup-node` from v5 to v7 (current release v7.1.0) in `.github/workflows/ci.yml`.
Official manifests declare `node24` for both; pnpm v6.1.0 explicitly supports the
repository's pnpm 12. Keep `packageManager`, `.nvmrc`, pnpm cache inputs, action ordering,
lockfile and all quality commands unchanged. No registry/token inputs or removed auth
behavior are used here; setup-node's ESM migration is internal to the action.
Sources: [pnpm release](https://github.com/pnpm/action-setup/releases/tag/v6.1.0),
[setup-node release](https://github.com/actions/setup-node/releases/tag/v7.1.0).
The existing `ce55c7e` CI logs reproduce Node 20, `url.parse()` and `punycode` warnings.
Do not suppress warnings with environment flags or weaken tests. Validate formatting and
the complete latest-head CI, inspect its logs for the original warnings, then converge
this maintenance scope before squash merge. If a residual upstream warning requires a
disproportionate change and does not affect operation, document it under the owner's
explicit exception instead of changing the application. Merge is authorized only with
green latest-head CI; starting US6 remains outside this authorization.

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

T126 owner-authorized local investigation (2026-10-16): PR #25's CI 38991329783
at `06e606b` is green but has 85 first-attempt e2e passes and one retried keyboard
registration. The unchanged case also fails once in 20 local repetitions (19 pass).
A controlled real fee-quote request held through submission reproduces the missing
success message and shows the positive-fee validation error. Its captured page also
shows Amy Tecnology selected despite the test having awaited a visible Bullish Hype
option: `SearchCombobox` keeps previous query results and Base UI's Enter selects the
highlighted option, not an arbitrary visible match. Do not infer the historical CI's
exact interleaving: no trace artifact was uploaded there, and the first repetition
run's local artifacts were replaced by the next diagnostic run before inspection.

Keep this correction test-only in `apps/web/tests/e2e/register-shipment.spec.ts`.
Await the uniquely named desired option's native `data-highlighted` state before Enter,
then assert the selected merchant/neighborhood values and default pickup point. Await
the visible expected COP 13,000 fee before submitting, exercising feature 001's live
quote (FR-006 and US1/AC1). Preserve the original keyboard inputs, Tab traversal,
payment action, success toast, full axe scan and all existing deadlines/retries/workers.
Add a controlled delayed-quote variant using an explicit promise gate, released before
the fee-readiness assertion, never a sleep or a mocked successful response. Keep the
ordinary network variant too. A second controlled variant primes real unfiltered
merchant results and holds the `bullish` search until Amy remains highlighted while
Bullish is visible; release that response before awaiting the desired highlight.
With the original Enter behavior, the selected-value assertion fails with Amy instead
of Bullish. This regression guards the proven selection mechanism, not just the toast.
Prove the controlled cases fail before the correction,
repeat both cases and all four gates, and converge against Constitution VI/VII and
feature 001 FR-003/FR-005/FR-006/FR-038. No production, schema, dependency or CI policy change;
no publication, merge or US7 is authorized by this investigation approval.
Samuel subsequently authorized commit/push of the completed T126 correction in PR #25
and latest-head CI review with “Si” on 2026-10-16; merge and US7 remain separate decisions.

US6 owner-approved refinement (2026-10-16, option A): reversing an errand completion
must not apply the package's `delivered → picked_up` rule. A shared, contextual rule in
`packages/domain/src/shipment-lifecycle.ts` selects `dispatched` and the original errand
task only when the original record's route remains in progress with its recorded courier;
otherwise it selects `registered` off route. Both clear courier/office custody and keep
the service date. No generic route transition gains the right to reopen final shipments.
Align feature 001's lifecycle documentation, the 003 spec/data model/contract/research,
quickstart 19 and T072/T073/T075/T076. Write domain and real-PostgreSQL tests first,
including an in-progress route with another pending stop, a finished route, and an
original route now assigned to a different courier. The browser journey must demonstrate
reverting and completing an errand again while its route remains in progress, preserving
revert history, notifications, financial/attempt exclusion and all existing invariants.
Use existing tables, record route/courier attribution and native framework primitives;
no new dependency or schema change is implied by this clarification.

US6 safety clarification (2026-10-16, second option A): reject a package revert after a
subsequent dispatch decision or custody change, even when no newer record of kind
delivery/exception/return exists. Use `409 record_not_revertible` with an explanatory
Spanish message and no writes. Serialize with the existing route-before-shipment lock
order, inspect authoritative append-only operational events, and recognize accepted
action replays before state/history guards. Test office receipt, a new-attempt/return
decision, confirmed handover, concurrent operations and unchanged financial/history/
task/notice counts on refusal. This does not override the approved errand fallback.
Whole-route courier reassignment has its own route event but no per-shipment event for
completed stops. Include that event in the package safety guard; the owner-approved
errand fallback still applies. Regression tests cover delivery, exception and return.

US6 event traceability design: add internal nullable/indexed FK
`shipment_events.courier_record_id` to `courier_records.id` through a generated migration.
Populate it on the applied record's state event and on correction/revert receipts; do
not expose it as an edited user field or duplicate any API response type. This gives
exact target identity even when business/receipt timestamps tie. Use the existing
database-generated time-ordered event UUIDs, not the client's random record UUID, to
inspect subsequent operational events ([PostgreSQL 18 UUID functions](https://www.postgresql.org/docs/18/functions-uuid.html)).
For preexisting events without the link, accept only a unique match by record author,
times and result; reject ambiguity safely without modifying old events or guessing.
Test tied timestamps, legacy unique/ambiguous history, concurrency and late replays.
Corrections validate only the fields applicable to their record kind through shared
domain rules and the existing money/name/collection schemas. An accepted unchanged
correction still records its idempotency receipt but sends no false change notice;
hide only empty `record_corrected` receipts from the displayed shipment history, like
the existing empty audit receipts. Keep them stored. A replay returns the original
target's current projection, even after a subsequent correction/revert. T071–T076 cover
these existing idempotency/traceability obligations; this adds no service or dependency.

US6 scoped convergence T123/T124: restoring the original task to pending also writes a
route `record_reverted` event with author, reason, shipment and actual server timestamps.
Declare route-event values once in domain and consume them in Drizzle; generate the
additive enum migration. Keep the finished route unchanged and send just the existing
single revert notice. Shipment revert changes include only values that really changed;
the custody history labels restored responsibility as a reversion, not a physical pickup.

US6 scoped convergence T125: reuse the original record's Spanish field schemas for
correction errors. Form serialization preserves blank required fields (including a
problem's required note), omits only optional blank notes, and uses the same applicable
field list for rendering and submission. Add adjacent domain/web regressions and a
real correction-dialog validation assertion before closure.

T122 owner-authorized local investigation (2026-10-16): post-merge CI 38926371410
reports success with one retried native-notification test, not a clean run. Work on
`003-fix-push-validation` from merged `main` 63c5070. Start with bounded test-only
diagnostics for exact-origin service-worker registrations/versions, permission, native
push delivery and worker errors; retain actual notifications and built app behavior.
Use official browser/protocol documentation to interpret evidence, not assumptions.
Align the smallest fix here only after the cause is demonstrated. Do not relax any
deadline, retry/worker policy or title/body/privacy assertion; do not suppress failures
or switch to a synthetic notification implementation. Initially only local changes were
authorized; Samuel subsequently authorized commit/push/PR and latest-head CI review with
“Si” on 2026-10-16. Merge and US6 remain separate decisions.
If passive browser diagnostics cannot identify where the original handler exits, allow
temporary bounded stage logging inside the built worker (parse accepted/refused,
show requested/resolved/rejected by error name only). It must not replace native APIs,
change behavior or expose payloads, and must be removed before final verification.

T122 diagnosed correction: the local failure reproduces with an activated worker,
granted permission, a trusted push with the expected data, successful native display,
and a successful push completion, yet the original poll sees no notification. Chromium's
[dispatch implementation](https://github.com/chromium/chromium/blob/aebd501b19da83e6bb52814865a5fdfdac6248e3/content/browser/devtools/protocol/service_worker_handler.cc)
acknowledges the CDP command before delivery completes. Its
[notification read implementation](https://github.com/chromium/chromium/blob/aebd501b19da83e6bb52814865a5fdfdac6248e3/content/browser/notifications/platform_notification_context_impl.cc)
also prunes persisted notifications not yet reported by the display platform. Avoid
racing that query against unfinished delivery: observe the real CDP BackgroundService
[`Push event completed` with `Status: Success`](https://github.com/chromium/chromium/blob/aebd501b19da83e6bb52814865a5fdfdac6248e3/content/browser/push_messaging/push_messaging_router.cc), restricted to the app origin and worker
registration, before calling the actual `getNotifications()`. Both completion and the
unchanged title/body assertion must share the existing five-second poll, not sequential
deadlines. Match only the live exact-origin registration. Retain bounded registration,
version, permission, worker-error coordinates and push-success diagnostics on failure,
validated with Zod; never log arbitrary payloads, error text or recipient data. No
production change, new dependency, direct notification warm-up, synthetic push handler,
retry or timing-policy change is needed. Temporary worker/probe instrumentation is removed.
This addresses the locally reproduced symptom; the historical CI run has no retained
browser trace, so its exact interleaving cannot be reconstructed. Clean latest-head CI
is still required after separately authorized publication, before any merge.

T121 owner-authorized synchronization investigation (2026-10-16): reproduce overlapping
triggers against the real courier store and IndexedDB before changing production code.
The current single-flight guard returns the running promise and drops later triggers;
test a reconnect during an in-flight offline failure and a saved record after a sync
has already read its outbox. If confirmed, retain one coalesced follow-up pass in the
existing store, never parallel syncs or an autonomous retry loop. Pause/sign-out must
prevent queued passes and await active work; failures without a new trigger must stop.
Use no new dependency, timer, retry budget or service. Extend the real-browser handover
journey with a controlled failed transport overlap if reproducible, keeping its offline
reload, custody checks and 5-second final assertion. Distinguish a reproduced mechanism
from proof of the historical CI cause, since that run retained no trace artifacts.
Run focused repetitions and all gates before scoped convergence and clean latest-head CI.

US5 notification configuration (owner-approved alignment, 2026-10-15): expose
`GET /api/courier/push-config` through the existing courier role/link guard, returning
only `{ publicKey: string | null }`. Read the key from the server's validated VAPID
configuration; null means notifications are disabled in development. Never expose the
private key or subject. Define the response schema once in
`packages/domain/src/schemas/courier.ts` and retain Hono RPC inference. T061 tests both
configured/disabled responses and access isolation before T066 implements the endpoint.
T068 fetches it before subscribing; no web build-time variable, new dependency or migration.
Notification failure or absence must not affect notices, acknowledgments or route actions.

US5 security/convergence T113–T115: validate push destinations in the shared schema
before persistence, accepting only credential-free HTTPS on the standard port at browser
push services (FCM, Apple's `*.push.apple.com`, Mozilla's Autopush). This prevents the
authenticated API from becoming an arbitrary server-side request relay. Browser-vendor
references: [Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers),
[Mozilla](https://mozilla-services.github.io/autopush-rs/http.html),
[web-push/FCM example](https://github.com/web-push-libs/web-push#sendnotificationpushsubscription-payload-options).
Request-local notice ids are passed explicitly through existing transaction authors and
route-event orchestration, not through global state. After handlers finish, look up only
committed ids, including earlier committed records in a partially failed batch; rolled-back
ids produce no push. No new service, queue, migration or dependency. A delayed expired-
subscription response deletes only matching id and encryption keys, preserving renewal.

T117 convergence alignment: handover confirmation needs its own `handover_confirmed`
notice, not `shipment_updated` (which tells the courier to check an edited address).
Extend the shared notice enum/text once, generate and review the additive PostgreSQL
enum migration with `pnpm db:generate`, and apply it through normal deployment migrations.
This is the only additional US5 migration; it changes no existing rows or notice meanings.
T116 cancellation uses `addHeldShipmentToStops` and the immutable pickup-place projection
for decided returns, preserving a return task rather than silently creating a delivery.

T118/T119: unchanged stop ordering uses the existing unchanged-route transaction path
and preserves its version, so a later replay cannot overwrite a newer order. A phone's
single "Entendido" may cover more than the API's 200-id transport limit: split the shown
ids into uniquely keyed, schema-validated chunks and persist every chunk in one IndexedDB
transaction before syncing. A quota error rolls them all back. Keep the API limit and
acknowledge only notices that were shown, not changes arriving afterward.

T064 notification validation uses a fresh persistent profile in full Chromium's new
headless channel, not the reduced headless-shell or an incognito context. It grants the
real permission, leaves the app for about:blank, injects the standard push event via CDP
and reads actual `getNotifications()` title/body, without replacing the worker handler
or notification API. Profiles stay under ignored test-results and are closed after each
case. All other cases keep their existing browser setup, workers, deadlines and retries.

US4 review remediation (owner approval 2026-10-15): T053 explicitly reproduces concurrent
and late replays of both exception decisions before T056. Persist the accepted action
and its event/tasks/handovers transactionally; recognize it before current-state guards
and return the current shipment without undoing a later change. T054/T057 use the
existing `CompanySettings` projection for separate GET/PATCH contracts (200 responses,
both fields null before configuration, a resolved neighborhood after PATCH). Settings
replays return current values through the shared audit-receipt mechanism; do not add a
duplicate response type, dependency or migration.

T056's decision state and held-shipment routing eligibility live in
`packages/domain/src/shipment-lifecycle.ts`, with unit tests before implementation.
The attempts projection uses one pure `deliveryAttempts` selection in
`packages/domain/src/courier-records.ts`, tested there before the shipment detail consumes
it. Preserve already-built held-stop planning in `routes.ts`; no notices or US5 record
conflict behavior is added in this slice.

US4 office receipt (owner-approved remediation of FR-041): when a new attempt has
already put a courier-held package off route as `picked_up`, receipt changes it to
`registered` with office custody and the same service date. Declare this contextual
transition in `packages/domain/src/shipment-lifecycle.ts`; do not add a generic route
transition or allow route actions to remove a picked-up shipment. Extend that module's
unit tests before implementation, and T054's real-PostgreSQL tests before T057. Receipt
must reject a picked-up shipment still on a route, remember concurrent/late retries, and
write custody and its event transactionally. No migration or new dependency is needed.

US4 return actions (FR-030) reuse `problem-form.tsx` for a pending return and never show
the exception action or a collection form there. T055 covers office pickup and return
while offline; extend `apps/web/src/lib/offline/outbox.test.ts` before changing the
projection in `outbox.ts`, so office custody is replayed until the pickup and courier
custody afterward. These are existing FR-018/FR-030/FR-041 requirements, not US5 notices
or handover confirmation, which remain in their own story.

US3 board projection (owner approval 2026-10-14): each `BoardEntry` in
`packages/domain/src/schemas/board.ts` includes `returnDecided: boolean`, without extending
the unrelated search or unassigned projections. One pure selection rule in
`packages/domain/src/dispatch-board.ts` selects `exception` shipments whose return has not
been decided; the server uses it for `exceptionsToDecide`, and the web for the "Novedades
por decidir" section and its count. Preserve existing board filter/count semantics and
show each shipment in exactly one section. Test the shared rule before implementation in
`packages/domain/src/dispatch-board.test.ts` and the API projection in T048. Reuse the
existing `pickup_problem` record flag and record application rules. US4 decision endpoints
and actions remain outside this slice.

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
