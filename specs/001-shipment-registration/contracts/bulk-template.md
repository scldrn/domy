# Bulk Registration Template Contract

Published template for FR-019. The dispatcher downloads it from the bulk registration
screen (`plantilla-envios.xlsx` and `plantilla-envios.csv`) or pastes rows copied from any
spreadsheet or chat with the same columns. The merchant is chosen on screen, not in the
file. The first row may be the header; it is detected by the column names and skipped.

## Columns (in order)

| # | Header (Spanish, exact) | Required | Accepted values | Maps to |
| --- | --- | --- | --- | --- |
| 1 | Tipo | No (default Entrega) | Entrega, Recogida inversa, Entrega a transportadora, Diligencia | `kind` |
| 2 | Fecha | No (default today) | `DD/MM/AAAA` | `serviceDate` |
| 3 | Destinatario | For Entrega and Recogida inversa | Text | `recipientName` |
| 4 | Teléfono | For Entrega and Recogida inversa | 10 digits; spaces and hyphens ignored | `recipientPhone` |
| 5 | Dirección | For Entrega and Recogida inversa | Text | `recipientAddress` |
| 6 | Barrio | For Entrega, Recogida inversa, and Entrega a transportadora (the handoff place: terminal, airport, or carrier office) | Catalog name or variant (fuzzy match, confirmed in preview) | `recipientNeighborhoodId` |
| 7 | Transportadora | For Entrega a transportadora | Carrier name | `carrierId` |
| 8 | Municipio destino | For Entrega a transportadora | Text | `destinationTown` |
| 9 | Diligencia | For Diligencia | Text | `errandDescription` |
| 10 | Modalidad | No (default Crédito del cliente) | Contraentrega, Flete al destinatario, Crédito del cliente | `paymentMode` |
| 11 | Valor a recaudar | For Contraentrega | Whole pesos; `$`, `.` and spaces ignored | `codAmount` |
| 12 | Franja | No | "antes de las 5pm", "después de las 2pm", "de 1 a 5pm", "en la mañana", "en la tarde" | `windowStart`, `windowEnd` |
| 13 | Nivel | No (default Estándar) | Estándar, Exprés | `serviceLevel` |
| 14 | Tamaño | No | Pequeño, Mediano, Grande, Extragrande | `packageSize` |
| 15 | Unidades | No | Whole number ≥ 1 | `packageCount` |
| 16 | Referencia | No | Text (e.g., "D-254") | `merchantReference` |
| 17 | Indicaciones | No | Text | `instructions` |
| 18 | Tarifa | For Diligencia; otherwise optional override | Whole pesos | `fee` (override) |
| 19 | Motivo tarifa | When Tarifa differs from the rate card, and for Diligencia | Text | `feeOverrideReason` |

Values are case-insensitive and accent-insensitive. The pickup point is the merchant's
default unless changed on screen for the whole batch.

## Export columns (FR-025)

The CSV/Excel export uses Spanish headers in this order: Guía, Fecha, Estado, Tipo, Cliente,
Referencia, Destinatario, Teléfono, Dirección, Barrio, Municipio, Zona, Transportadora,
Municipio destino, Diligencia, Modalidad, Valor a recaudar, Tarifa calculada, Tarifa, Motivo
tarifa, Nivel, Franja desde, Franja hasta, Tamaño, Unidades, Indicaciones, Registrado por,
Registrado el. Money is exported as plain integers; dates and times in Bogotá time.
