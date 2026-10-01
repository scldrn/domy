# Quickstart: Shipment Registration and Dispatch Board

Validation guide proving this feature works end to end. Data shapes are in
[data-model.md](data-model.md); endpoints in [contracts/http-api.md](contracts/http-api.md);
bulk columns in [contracts/bulk-template.md](contracts/bulk-template.md).

## Prerequisites

- Node.js 24 LTS and pnpm 12 (`corepack enable pnpm`)
- Docker (PostgreSQL for development and Testcontainers for integration tests)
- A copy of `.env.example` as `.env` with local values

## Setup

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The seed creates an owner account (credentials printed once in the terminal), the rate
zones, the standard rate card (§6 of the business master) with a standard express
surcharge, Amy Tecnology's rate card, the initial neighborhood catalog with variants, and
sample merchants, couriers, and carriers.

## Automated gates

```bash
pnpm check
pnpm test
pnpm test:e2e
```

All three must pass with zero warnings (Constitution, quality gates).

## Manual validation scenarios

| # | Story | Steps | Expected |
| --- | --- | --- | --- |
| 1 | US1 | Sign in as the owner, register a delivery for "Bullish Hype" to a Medellín neighborhood with "Crédito del cliente" | Fee $ 13.000, COD $ 0, status "Registrado", tracking number `XXXX-XXXX`, event "Creado" in history |
| 2 | US1 | Register a delivery for "Amy Tecnology" to Itagüí | Fee $ 10.700 (merchant rate card) |
| 3 | US1 | Register with "Flete al destinatario", then with "Contraentrega" and no amount | COD equals fee; the second cannot be saved and the field explains why |
| 4 | US1 | Register an errand | Fee field empty and required with a reason; not marked for review |
| 5 | US2 | Register one shipment "En la tarde" for today; set the development clock to 19:16 (`DOMY_FAKE_NOW`) | Board flags it "En riesgo" with 44 minutes left; at 20:01 "Atrasado" |
| 6 | US2 | Leave a shipment from yesterday undelivered; open today's board | Listed under "Pendientes de días anteriores" with its original date |
| 7 | US2 | Keep the board open in two browsers; register in one | The other shows it within 30 seconds without reloading |
| 8 | US3 | Edit the COD amount of a registered shipment; void another with a reason | Both changes appear in history with author, time, old and new values; the voided one stays searchable |
| 9 | US3 | Open the same shipment in two tabs, save in both | The second save is refused with "Este envío cambió; revisa la versión más reciente" |
| 10 | US4 | Paste 20 rows of the template for Amy Tecnology, with 2 invalid rows and "copàcabana" | Preview proposes "Copacabana"; after fixing, 20 shipments are created |
| 11 | US5 | Search by a recipient phone; export as Excel | Matching shipments, newest first; the file opens with Spanish headers |
| 12 | US6 | Add a standard rate effective tomorrow | Today's registrations use the current rate; tomorrow's (fake clock) the new one |
| 13 | US7 | Create a dispatcher and a courier; sign in as each | Dispatcher: panel with the rate card read-only (FR-031) and without users. Courier: no access to the panel |
| 14 | US7 | Fail sign-in 5 times | Password sign-in locked for 15 minutes; message says when to retry |
| 15 | US1 | Register an express delivery to Medellín; register a carrier handoff to "Terminal del Norte" | Fee $ 17.500 (13.000 + 4.500); handoff fee from the terminal's rate zone, carrier and town required |
| 16 | US6 | As dispatcher, add a neighborhood; then try to change another neighborhood's rate zone | Added and listed for the owner's review; the zone change is not available |
| 17 | US7 | As the only owner, try to deactivate yourself | Refused: one active owner is always required |

`DOMY_FAKE_NOW` is honored only when `NODE_ENV` is `development` or `test`.
