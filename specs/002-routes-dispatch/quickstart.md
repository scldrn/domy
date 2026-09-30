# Quickstart: Routes and Dispatch

Validation guide for this feature. Data shapes are in [data-model.md](data-model.md) and
endpoints in [contracts/http-api.md](contracts/http-api.md). Setup and gates are those of
[feature 001's quickstart](../001-shipment-registration/quickstart.md).

## Prerequisites

- Feature 001 implemented and its quickstart passing
- The seed loaded (`pnpm db:seed`), with at least three couriers and merchants with pickup
  points

## Automated gates

```bash
pnpm check
pnpm test
pnpm test:e2e
```

## Manual validation scenarios

Scenarios that need a completed stop (marked ⚙) are validated by automated tests, which set
task statuses directly, until feature 003 provides the courier's and the dispatcher's
actions to complete stops.

| # | Story | Steps | Expected |
| --- | --- | --- | --- |
| 1 | US1 | Register nine shipments from three pickup points; open "Rutas"; select them under "Sin asignar"; create a route | "Ruta 1" is "En preparación" with three pickup stops and nine delivery stops; shipments are "Asignado" |
| 2 | US1 | Drag a delivery stop above its own pickup stop; repeat with the keyboard | Both refused with an explanation |
| 3 | US1 | Dispatch without a courier; then choose a courier and dispatch | First refused; then the route is "En curso" and its shipments "En ruta" |
| 4 | US1 | Build a second route for the same courier and dispatch it | Refused: the courier already has "Ruta 1" in progress; the system offers to add the shipments to it |
| 5 | US1 | Include a reverse pickup, a carrier handoff, and an errand in a route | Pickup at the recipient and delivery at the merchant; delivery at the handoff place; one errand stop |
| 6 | US2 | Open the board with two routes in progress and four shipments without a route | Both routes with courier, progress, "Valor a recaudar", flag counts; "Sin asignar: 4" |
| 7 | US2 ⚙ | Complete stops out of order | Progress counts completed stops; the pending stop keeps its position |
| 8 | US2 | Set the development clock to the next day (`DOMY_FAKE_NOW`) with a route still in progress | The route appears under "Rutas de días anteriores", still "En curso" |
| 9 | US3 | Add a registered shipment to a route in progress; remove another not yet picked up | The added one joins its pickup stop and becomes "En ruta"; the removed one returns to "Registrado" and its empty pickup stop disappears |
| 10 | US3 | Void a shipment that is on a route | It leaves the route and its stops are updated |
| 11 | US4 | Reassign a shipment "En ruta" to another courier's route without a reason, then with one | First refused; then it moves with both stops and the history shows both couriers and the reason |
| 12 | US4 ⚙ | Reassign a picked-up shipment; confirm the handover on the courier's behalf; repeat and cancel it | "Traspaso pendiente" with custody unchanged; after confirmation custody passes; after cancellation the stop returns to the first route |
| 13 | US4 | Reassign a whole route to a courier without a route in progress | Pending stops pass to the new courier |
| 14 | US5 | Cancel a route in preparation with a reason; try to cancel a route in progress | First: shipments "Registrado", route "Cancelada"; second: refused |
| 15 | US5 | Undo the dispatch of a route with nothing picked up ⚙ (and with a completed stop) | Returns to "En preparación" with shipments "Asignado"; refused once a stop is completed |
| 16 | All | Open the same route in two browsers and change it in both | The second change is refused with a message to review the latest version |
