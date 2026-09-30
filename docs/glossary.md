# Glossary

Single source for business vocabulary (Constitution, Principle VIII). Every concept has
exactly one English name used in code, database, and developer documentation, and exactly
one Spanish name shown to users.

- **English (code)**: the name in identifiers, tables, and developer docs.
- **Spanish (UI)**: the professional courier-industry term shown to users.
- **Legacy term**: how the business says it today in conversation and spreadsheets. Kept
  only to recognize it in interviews and in the historical data; never shown in the UI.

## Actors and roles

| English (code) | Spanish (UI) | Legacy term | Definition |
| --- | --- | --- | --- |
| product | Domy | — | The system. Name shown to users. |
| company | Cohex | Cohex, Cohexpress | The courier business itself (Santiago Marín's company). |
| owner | Propietario | Responsable del negocio, dueño, Santiago | Owns the business. Full access, including finance and users. |
| dispatcher | Coordinador de despacho | Coordinador logístico, administrador, John | Runs daily operations: registers shipments, builds and dispatches routes, handles exceptions. |
| courier | Mensajero | Mensajero, domiciliario | Picks up and delivers shipments. |
| merchant | Cliente | Cliente | Business or person that hires the service and is billed for it. |
| recipient | Destinatario | Cliente del cliente | Person who receives the shipment. |
| carrier | Transportadora | Transportadora, flota | Third party that carries shipments beyond the metropolitan area: intercity bus companies at the terminals and national couriers. |

## Shipments

| English (code) | Spanish (UI) | Legacy term | Definition |
| --- | --- | --- | --- |
| shipment | Envío | Servicio | Unit of work registered, tracked, and billed: one shipment kind moving from an origin to a destination. |
| tracking number | Número de guía | — | Short unique code of a shipment, shown to merchants and recipients. |
| shipment kind | Tipo de envío | — | Delivery, reverse pickup, carrier handoff, or errand. |
| delivery | Entrega | Entrega | Standard kind: pickup point → recipient. |
| reverse pickup | Recogida inversa (logística inversa) | Devolución | Kind that brings a product from a recipient back to the merchant. |
| carrier handoff | Entrega a transportadora | Terminal, "se envía por Coonorte" | Kind whose destination is a bus terminal or carrier office; usually includes a disbursement for the shipping cost. |
| handoff place | Punto de entrega a transportadora | Terminal, oficina | Catalog place where a carrier handoff is delivered: bus terminal, airport, or carrier office. It gives the rate zone. |
| errand | Diligencia | Compra, consignación | Kind that is not a package movement: buying an item, making a bank deposit. |
| merchant reference | Referencia del cliente | "D-254", pedido | The merchant's own order identifier, used to match statements. |
| package size | Tamaño | Pequeño, mediano, grande | Small, medium, large, extra large. May affect the rate. |
| package count | Unidades | Bolsas, cajas | Number of pieces in one shipment. |
| delivery window | Franja de entrega | Compromiso de hora, "antes de las 5pm" | Optional earliest and latest delivery time committed to the merchant. |
| service level | Nivel de servicio | Turbo, urgente | Standard or express. Express costs more. |
| instructions | Indicaciones | Indicaciones | Free text for the courier about the delivery. |
| voided | Anulado | — | Shipment cancelled before completion. **Never "cancelado"**: in this business "cancelado" means paid. |

## Places

| English (code) | Spanish (UI) | Legacy term | Definition |
| --- | --- | --- | --- |
| pickup point | Punto de recogida | Partida, origen | Where shipments are collected. A merchant can have several; one is the default. |
| delivery address | Dirección de entrega | Destino | Street address plus neighborhood and municipality. |
| neighborhood | Barrio | Destino | Neighborhood within a municipality. |
| municipality | Municipio | Destino | Medellín, Bello, Itagüí, Envigado, Sabaneta, La Estrella, Copacabana, Caldas, Girardota… |
| rate zone | Zona tarifaria | — | Group of neighborhoods or municipalities sharing a rate. |

## Dispatch and execution

| English (code) | Spanish (UI) | Legacy term | Definition |
| --- | --- | --- | --- |
| route | Ruta | Ruta | Ordered stops assigned to one courier. Typically 8–9 deliveries over 2–3 pickups. |
| stop | Parada | — | A place in a route with one or more tasks (pick up N shipments, deliver one). |
| dispatch | Despachar | Asignar, "evacuar servicios" | Assigning a route to a courier and releasing it to the courier's phone. |
| route number | Número de ruta | — | Number that identifies a route within its service date ("Ruta 3"). |
| route status | Estado de la ruta | — | En preparación (draft), En curso (dispatched), Finalizada (finished), Cancelada (cancelled). |
| unassigned | Sin asignar | — | Registered shipments that are not on any route. |
| reassignment | Reasignación | — | Moving a shipment or a whole route to another courier, with a reason. |
| custody | Custodia | "Quién lo tenía" | Which courier is responsible for a shipment at each moment. |
| handover | Traspaso | — | Transfer of a picked-up shipment from one courier to another; pending ("Traspaso pendiente") until the receiving courier confirms receipt. |
| dispatch board | Tablero de despacho | Planilla | Live view of the day: pending, in route, delivered, exceptions, at-risk windows. |
| delivery attempt | Intento de entrega | — | One visit to deliver. A shipment can have several. |
| delivery exception | Novedad | Novedad | Event that prevents a normal delivery: recipient absent, wrong address, rejected, and others to be confirmed. |
| reattempt | Reintento | — | New delivery attempt after an exception. |
| return to sender | Devolución al remitente | — | Bringing an undeliverable shipment back to the merchant. |
| proof of delivery | Prueba de entrega | Evidencia, foto | Photo (requested, skippable), received-by name, time, and location captured at delivery. |
| received-by name | Recibido por | Quien recibe | Name of the person who physically received the shipment. Defaults to the recipient. |
| at risk | En riesgo | — | Not delivered and less than 45 minutes before the latest delivery time. |
| late | Atrasado | — | Not delivered after the latest delivery time. |
| pending from previous days | Pendientes de días anteriores | — | Shipments with an earlier service date that are not delivered, returned, or voided; shown on today's dispatch board. |
| audit event | Historial de cambios | Trazabilidad | Immutable record of who changed what and when, for shipments and for master data. |
| tracking page | Página de seguimiento | — | Public page, opened by link, with the shipment's status. |

## Money

| English (code) | Spanish (UI) | Legacy term | Definition |
| --- | --- | --- | --- |
| fee | Tarifa | Valor del servicio, domicilio | Price of a shipment, charged to the merchant. Integer COP, frozen at registration. |
| rate card | Tarifario | — | Rate per rate zone plus the express surcharge; standard plus merchant-specific overrides. |
| express surcharge | Recargo exprés | Turbo, urgente | Fixed amount added to the zone rate for express service level. |
| effective date | Vigencia | — | Calendar day from which a rate card entry applies. |
| fee review | Tarifa por revisar | — | Mark on a shipment saved with a manual fee because no rate existed; the owner confirms or corrects it. |
| COD amount | Valor a recaudar | Recaudo | Amount the merchant instructs the courier to collect at the door. Zero when nothing is collected. |
| COD collection | Recaudo | Recaudo | Money actually received from the recipient. |
| payment mode | Modalidad de pago | Contraentrega, solo entrega, prepagado | Preset that fills the COD amount: cash on delivery, recipient pays fee, merchant account. |
| cash on delivery | Contraentrega | Contraentrega | Recipient pays the merchant's amount at the door. |
| recipient pays fee | Flete al destinatario | Solo entrega, "me pagan el domicilio" | Recipient pays only the fee. |
| merchant account | Crédito del cliente | Prepagado, "después me lo cancela" | Nothing collected at the door; fee billed to the merchant later. |
| payment method | Medio de pago | Medio de pago | How the recipient paid the collection: cash, transfer to the company, transfer to the merchant. |
| disbursement | Pago por cuenta del cliente | "Se pagó" | Money a courier pays on the merchant's behalf (carrier freight, a package). Reimbursable. |
| courier cash-up | Cierre de caja del mensajero | Liquidación diaria | End-of-day calculation of the cash a courier must hand over. |
| reconciliation | Conciliación | Conciliación | Matching what the system recorded against what the courier handed over. |
| merchant statement | Estado de cuenta | Relación de cliente | Merchant's shipments, collections, fees, and disbursements for a period, with the net balance. |
| netting | Cruce de cuentas | Neteo, cruce | Offsetting collections owed to a merchant against fees and disbursements the merchant owes. |
| COD remittance | Giro de recaudo | Consignación al cliente | Transfer of net collections to the merchant. |
| accounts receivable | Cuentas por cobrar | Cartera ("servicios", "esperando pago") | Money merchants owe the business. |
| accounts payable | Cuentas por pagar | Cartera ("pendiente al cliente") | Money the business owes merchants. |
| courier payout | Liquidación de mensajeros | Nómina | Periodic payment to couriers. "Nómina" implies an employment contract; use it only if couriers are employees. |
| commission | Comisión | "El 70 %" | Courier's share of each shipment's fee (70 % today). |
| fixed pay | Pago fijo | — | Flat periodic amount for couriers not paid by commission. |
| cash advance | Anticipo | Préstamo | Money given to a courier before payout, deducted at payout. |

## Receivable states

| English (code) | Spanish (UI) | Legacy value | Meaning |
| --- | --- | --- | --- |
| unbilled | Por facturar | servicios | Fee earned, not yet on a statement. |
| billed | En cobro | esperando pago | Statement sent; waiting for payment. |
| remittance_pending | Recaudo por girar | pendiente al cliente | Collections owed to the merchant, not yet transferred. |
| settled | Pagado | cancelado | Closed. |

## Indicators

| English (code) | Spanish (UI) | Definition |
| --- | --- | --- |
| on-time rate | Cumplimiento de franja | Share of shipments with a delivery window delivered inside it. |
| first-attempt rate | Efectividad en primera visita | Share of shipments delivered on the first attempt. |
| exception rate | Tasa de novedades | Share of shipments with at least one exception. |

## Legacy artifacts

| English | Spanish | Definition |
| --- | --- | --- |
| master ledger | Archivo madre | Owner's workbook `FORMATO ENTREGAS ACTUALIZADO 2027.xlsx`. |
| ledger sheet | Hoja DIARIO | Consolidated list of every shipment since May 2024. |
| daily sheet | Planilla | Dispatcher's workbook `Liquidacion diaria 2027.xlsx`, one tab per day. |
