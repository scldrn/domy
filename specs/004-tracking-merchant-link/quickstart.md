# Quickstart: Tracking Page, Merchant Link, and WhatsApp Message

Validation guide for this feature. Data shapes are in [data-model.md](data-model.md) and
endpoints in [contracts/http-api.md](contracts/http-api.md). Setup and gates are those of
[feature 001's quickstart](../001-shipment-registration/quickstart.md).

## Prerequisites

- Features 001–003 implemented and their quickstarts passing
- `PUBLIC_BASE_URL` in `.env` (the address recipients open)
- The support phone set in "Configuración"

## Automated gates

```bash
pnpm check
pnpm test
pnpm test:e2e
```

## Manual validation scenarios

Open public links in a private window, and on a phone with mobile data.

| # | Story | Steps | Expected |
| --- | --- | --- | --- |
| 1 | US1 | Open the tracking link of a registered shipment | "Recibimos tu envío", merchant, tracking number, date, window; no courier |
| 2 | US1 | Dispatch its route; open again | "Tu envío va a ser recogido", courier's first name with call and WhatsApp buttons |
| 3 | US1 | Pick it up with two deliveries before it in the route | "En camino", "2 entregas antes de la tuya", "Valor a pagar al recibir" if it has a COD amount |
| 4 | US1 | Keep the page open and deliver it from the courier app | Within a minute: "Entregado a {name} a las {time}"; no courier phone, no amount |
| 5 | US1 | Report an exception on another shipment; open its link | "No pudimos entregar tu envío" with the reason in plain words and the support contact |
| 6 | US1 | Set the clock 8 days after a delivery (`DOMY_FAKE_NOW`); open its link | Only "Este enlace venció" and the support contact |
| 7 | US1 | Open a made-up link; then request 61 links in a minute | "Este enlace no es válido"; then a limit message |
| 8 | US1 | Paste a tracking link in a WhatsApp chat | The preview shows only "Domy" |
| 9 | US2 | Register shipments for two merchants; open "Notificar clientes"; tap "Enviar por WhatsApp" for one | WhatsApp opens on the merchant's number with the message; the merchant shows "Notificado" |
| 10 | US2 | Register one more shipment for that merchant | "1 envío sin notificar"; the next message lists only it |
| 11 | US2 | A merchant without WhatsApp number; a merchant with 21 shipments | "Copiar mensaje" only, with a prompt to add the number; the long message gives the count and the merchant link |
| 12 | US3 | Open a merchant's private link | Today's shipments with statuses, fees, COD amounts, and totals; a delivered one shows the received-by name and the photo |
| 13 | US3 | Choose yesterday; then a date 31 days ago | Yesterday's shipments; the older date is refused |
| 14 | US3 | Replace the merchant's link from its page in the panel; open the old link | "Este enlace no es válido"; the new link works |
