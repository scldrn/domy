# Quickstart: Courier App

Validation guide for this feature. Data shapes are in [data-model.md](data-model.md) and
endpoints in [contracts/http-api.md](contracts/http-api.md). Setup and gates are those of
[feature 001's quickstart](../001-shipment-registration/quickstart.md).

## Prerequisites

- Features 001 and 002 implemented and their quickstarts passing
- For ordinary development, `docker compose up -d` starts S3Proxy (object storage for
  photos, research R6); configure that environment from `.env.example`. Development without
  VAPID keys has no phone push. For the pinned key-generation command and unchanged
  production requirements, see the [README production instructions](../../README.md#production).
- The ordinary development seed loaded, with at least two courier users and the office
  address set
- For an isolated LAN rehearsal, wait for the approved target/QA window and use the
  launcher's private, per-run configuration and synthetic credentials. Do not create a
  `.env` for that target or copy production secrets into it. Local push is disabled by
  default; its explicit opt-in generates per-run local keys and is not evidence of
  production push delivery. See the [local deployment inventory](../../docs/archive/local-deployment-inventory.md).
- A phone on the same network, or Chrome's device toolbar with "Offline" in the Network tab

### Manual acceptance preparation

An initial smoke check is a setup check only; it does not replace any of the 21 scenarios
below or complete T087/T093. Use a separate disposable shipment for it so it cannot consume
the route or records needed by the acceptance run. The launcher's synthetic starting data
contains one linked courier, one unlinked account, one route and one shipment. Before the
full run, prepare and verify the additional courier accounts, routes and multiple shipments
needed by scenarios such as the two-pickup/four-delivery route and the two-courier handover.
Record any scenario that cannot be prepared as blocked rather than treating the smoke check
as a pass.

## Automated gates

T131's regression in `courier-offline.spec.ts` retains the ordinary 503 recovery
journey and additionally holds a real successful session response across an observed
native offline/reconnect event. Cached route/stop/delivery navigation must finish
before releasing that old response; records then synchronize and the route completes.
Run it with the built service worker and real PostgreSQL/storage, not a mock session.
The shared auth unit cases verify cancellation, fresh retry, listener cleanup and
authoritative refusal without changing session expiry or mutation behavior.

```bash
pnpm check
pnpm test
pnpm test:e2e
pnpm build
```

T107's owner-approved server runner policy executes ordinary integration tests with their
usual parallelism, then capacity files and route invariants separately without file-level
competition. `pnpm test` and CI still collect every case; deadlines, performance thresholds,
all three invariant seeds and their 90 steps are unchanged. Do not use an isolated pass
or cached ordering as a substitute for the complete gate.

US3's automated slice covers scenario 11 and completes scenario 8's exception journey in
`apps/web/tests/e2e/courier-exceptions.spec.ts`, using the built service worker, actual
PostgreSQL and private photo storage. The board projects `returnDecided` and uses one
domain rule for the undecided-exception list/count; no US4 decision action is built here.
This does not replace the physical Android/iPhone validation in T087/T093.

US4's automated slice in `apps/web/tests/e2e/exception-decision.spec.ts` exercises
scenarios 12–13, including return problems, office custody, offline office pickup/return,
reopening, exactly-once synchronization, and the next day's office pickup/delivery.
It also checks settings acknowledgment/retry identifiers and the decision dialog at
390 px. Keep a return's original COD distinct from collection: a return collects zero,
including when the original COD exceeds the delivery-confirmation threshold. Final gate
results and remaining convergence work are recorded in `docs/status.md`; automated
viewport checks do not replace physical-device validation.

## Manual validation scenarios

US7's automated `courier-day.spec.ts` covers scenario 20 with a real server baseline,
offline transfers and disbursement, reopening through the service worker, exactly-once
synchronization and corrected totals after dispatch edits. It also checks a dated zero
summary without a route, high contrast at 360 px, and financial rows scrolled above fixed
navigation at 360/390 px. Domain/outbox tests cover Bogotá midnight and clock correction;
PostgreSQL tests cover reverts and courier isolation. These are automated checks, not
physical T087/T093 completion or a Phase 2 cash-up.

US5's automated journeys in `courier-changes.spec.ts` cover 14–18, offline acknowledgment
and receiving confirmation, review clearing, and an actual worker notification after
leaving the app. The notification case uses a fresh full-Chromium persistent test profile
because headless-shell denies the real permission; it retains exact notification/privacy
assertions and does not mock the handler or notification API. Physical notifications on
Android and installed iPhone remain part of T087/T093. Apply normal migrations, including
US5's additive `handover_confirmed` notice enum migration, before deploying the new server.

T122 synchronizes that native check with the browser's successful push-completion event
for the exact app origin and service-worker registration. Completion and the unchanged
notification assertion share the original five-second limit. Do not poll native
`getNotifications()` during unfinished display: Chromium can prune entries it does not
yet consider visible. Failure diagnostics are bounded and exclude payloads and recipient
data; the production worker and native notification API remain untouched.

"Offline" means airplane mode on the phone, or "Offline" in the browser's developer tools.

For US6, also report a package exception, receive it at the office, then attempt to
revert that earlier exception. The panel must explain the conflict; office custody,
the record, subsequent history and all route tasks remain unchanged (FR-035).

| # | Story | Steps | Expected |
| --- | --- | --- | --- |
| 1 | US1 | Sign in as a courier on a phone; install the app from the browser | The app opens on "Mi ruta"; without a dispatched route it says none has been dispatched |
| 2 | US1 | Dispatch a route of two pickups and four deliveries to that courier; open the app | Stops in the dispatcher's order with shipments, windows, and COD amounts; first pending stop highlighted |
| 3 | US1 | Confirm two of three shipments at a pickup stop | Both "Recogido"; the stop stays pending |
| 4 | US1 | Deliver a shipment without COD amount, taking a photo; deliver another skipping the photo | Both "Entregado" with received-by name, time, and location; the second flagged "Sin foto" on the board |
| 5 | US1 | Deliver a shipment with COD amount 85.000: split 50.000 cash and 35.000 transfer to the company with a receipt photo | Collection stored by payment method; the board shows no "Recaudo diferente" |
| 6 | US1 | Deliver collecting 80.000 of 85.000 | A note is required; flagged "Recaudo diferente" |
| 7 | US1 | Try to deliver a shipment not yet picked up; use the call, WhatsApp, and map shortcuts | The app asks to confirm the pickup first; each shortcut opens its app |
| 8 | US2, then US3 | Go offline; reopen the app; record a pickup and a delivery with photo and collection; restart the phone. After US3 adds its form, repeat with an exception too | The route opens; each result shows at once; "2 pendientes por sincronizar" survives the restart in US2; with the exception too, "3 pendientes por sincronizar" in US3 |
| 9 | US2 | Go back online without touching the app | Within a minute the counter is zero; the board shows each record once, with the time it happened and the time it was received |
| 10 | US2 | With pending records, try to sign out | Refused with an explanation |
| 11 | US3 | Report "Destinatario ausente" on a delivery; report a problem on a pickup | The first is "Novedad" under "Novedades por decidir"; the second keeps its status, flagged "Problema de recogida" |
| 12 | US4 | Decide "Nuevo intento" on the same route and deliver it; decide "Devolver al remitente" for another and complete the return stop | First "Entregado" with two attempts in its history; second "Devuelto" |
| 13 | US4 | Reschedule a shipment in "Novedad" for tomorrow; then record "Recibido en oficina"; tomorrow add it to a route | "Recogido", off route, "En custodia de {courier}"; then "En oficina" and "Registrado"; the route gets a pickup stop at the office |
| 14 | US5 | With the app open, add a shipment, remove another, reorder, and edit a recipient's address from the panel; then close the app and add one more | Notices appear within a minute and stay until "Entendido"; with the app closed the phone shows a notification; the board shows the last synchronization and unacknowledged changes |
| 15 | US5 | Reassign a picked-up shipment to a second courier; confirm "Recibí el paquete" on that courier's phone | "Traspaso pendiente" until confirmed; then custody passes and the stop can be completed |
| 16 | US5 | Put courier A offline; A confirms a pickup; the dispatcher removes that shipment from A's route; A goes online | The shipment is "Recogido" in A's custody, off route, flagged "Por revisar" |
| 17 | US5 | Put A offline; A delivers a picked-up shipment; the dispatcher reassigns it to B; A goes online | "Entregado" by A; the handover is cancelled; B's stop disappears with a notice |
| 18 | US5 | Sign in as A on two phones; record the same delivery on both while one is offline; bring it online | The second record is ignored without a flag; one delivery in the history |
| 19 | US6 | From the panel, record a delivery on a courier's behalf with an earlier time; correct a collected amount; revert a package delivery. Also revert an errand while its original route is still in progress with the same courier, and after it finishes or changes courier | "Registrado por despacho"; the history keeps the previous amount; the package is "Recogido" again with its stop pending. The errand returns to "En ruta" with its stop pending only on that eligible original route; otherwise "Registrado", unassigned. No errand custody is created |
| 20 | US7 | Record deliveries with 100.000 cash, 50.000 to the company, 30.000 to the merchant, and a disbursement of 12.000; open "Mi día" | The four amounts and "Efectivo por entregar: $ 88.000", including records still pending |
| 21 | All | Let the actual authentication session expire with a route loaded and a pending record. Automated tests control Better Auth's process clock separately, and exercise the phone with an expired-session `401` carrying the server time | The route stays usable; after signing in again as the same courier the record is sent. `DOMY_FAKE_NOW` alone changes business time, not Better Auth's clock |
