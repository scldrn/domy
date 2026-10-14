# Quickstart: Courier App

Validation guide for this feature. Data shapes are in [data-model.md](data-model.md) and
endpoints in [contracts/http-api.md](contracts/http-api.md). Setup and gates are those of
[feature 001's quickstart](../001-shipment-registration/quickstart.md).

## Prerequisites

- Features 001 and 002 implemented and their quickstarts passing
- `docker compose up -d` also starts S3Proxy (object storage for photos, research R6)
- `.env` with the storage and notification keys listed in `.env.example`
  (`pnpm dlx web-push generate-vapid-keys` prints a new key pair)
- The seed loaded, with at least two courier users and the office address set
- A phone on the same network, or Chrome's device toolbar with "Offline" in the Network tab

## Automated gates

```bash
pnpm check
pnpm test
pnpm test:e2e
```

## Manual validation scenarios

"Offline" means airplane mode on the phone, or "Offline" in the browser's developer tools.

| # | Story | Steps | Expected |
| --- | --- | --- | --- |
| 1 | US1 | Sign in as a courier on a phone; install the app from the browser | The app opens on "Mi ruta"; without a dispatched route it says none has been dispatched |
| 2 | US1 | Dispatch a route of two pickups and four deliveries to that courier; open the app | Stops in the dispatcher's order with shipments, windows, and COD amounts; first pending stop highlighted |
| 3 | US1 | Confirm two of three shipments at a pickup stop | Both "Recogido"; the stop stays pending |
| 4 | US1 | Deliver a shipment without COD amount, taking a photo; deliver another skipping the photo | Both "Entregado" with received-by name, time, and location; the second flagged "Sin foto" on the board |
| 5 | US1 | Deliver a shipment with COD amount 85.000: split 50.000 cash and 35.000 transfer to the company with a receipt photo | Collection stored by payment method; the board shows no "Recaudo diferente" |
| 6 | US1 | Deliver collecting 80.000 of 85.000 | A note is required; flagged "Recaudo diferente" |
| 7 | US1 | Try to deliver a shipment not yet picked up; use the call, WhatsApp, and map shortcuts | The app asks to confirm the pickup first; each shortcut opens its app |
| 8 | US2 | Go offline; reopen the app; record a pickup, a delivery with photo and collection, and an exception; restart the phone | The route opens; each result shows at once; "3 pendientes por sincronizar" survives the restart |
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
| 19 | US6 | From the panel, record a delivery on a courier's behalf with an earlier time; correct a collected amount; revert a delivery | "Registrado por despacho"; the history keeps the previous amount; the shipment is "Recogido" again with its stop pending |
| 20 | US7 | Record deliveries with 100.000 cash, 50.000 to the company, 30.000 to the merchant, and a disbursement of 12.000; open "Mi día" | The four amounts and "Efectivo por entregar: $ 88.000", including records still pending |
| 21 | All | Let the session expire (`DOMY_FAKE_NOW` + 31 days) with a route loaded and a pending record | The route stays usable; after signing in again the record is sent |
