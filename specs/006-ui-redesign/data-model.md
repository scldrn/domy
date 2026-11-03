# Data Model: Coherent Redesign of Every Web Interface

No table, column, constraint, or migration changes. The feature adds generated design tokens,
a register of proposals, and four read-only projections of data the system already stores.

## Design tokens (generated)

Written by `scripts/generate-design-tokens.ts` to `apps/web/src/styles/tokens.css` for the
light, dark, and high-contrast schemes. Full list and uses in
[contracts/design-tokens.md](contracts/design-tokens.md).

| Group | Roles | Source |
| --- | --- | --- |
| Accent | `accent`, `on-accent`, `accent-strong` | Lime `#C8F23C` palette, unharmonized (R1) |
| Pizarra surfaces | `rail`, `rail-raised`, `rail-line`, `on-rail`, `on-rail-variant` | Primary and neutral palettes; light `rail` at primary 10 (R2) |
| States on pizarra | `rail-success`, `rail-warning`, `rail-error`, `rail-info`, `rail-tertiary` | Each state palette at tone 80 (R2) |
| Unchanged | M3 roles, `paper`, `sheet`, `sheet-alt`, state roles (`success`, `warning`, `info`, `error`, `tertiary`) | As today |

Validation: every role passes its contrast pair (text 4.5:1, large text and non-text 3:1)
in each scheme; checked by a unit test over the generated values.

## Theme choice (browser storage)

| Field | Values | Rule |
| --- | --- | --- |
| `domy-theme` (localStorage) | `light`, `dark`, absent | Absent follows the computer; any other value is ignored (Zod) |

Applied as `data-scheme` on `<html>` before the first render. The courier app's
high-contrast choice keeps its current storage.

## Screen proposal (register)

`specs/006-ui-redesign/proposals.md`, one row per screen:

| Field | Meaning |
| --- | --- |
| Screen | Spanish name and URL |
| Area | Panel shell, daily operation, master data, administration, courier, public, sign-in |
| Proposal | Artifact link and version |
| Status | `pending`, `changes requested`, `approved` |
| Decided | Date and the owner's words |

State transitions: `pending → changes requested → pending` (new version) or
`pending → approved`. Implementation of a screen starts only at `approved` (FR-003); a change
after approval returns it to `pending` (FR-004).

## RouteSummary.stopMarks (read projection)

Added to each route in `GET /api/routes/board` ([contracts/board-read.md](contracts/board-read.md)).

| Field | Type | Rule |
| --- | --- | --- |
| `stopMarks` | array | The route's stops: pickups and deliveries |
| `stopMarks[].kind` | `StopKind`: `pickup`, `delivery`, `errand`, `return` | The stop's kind |
| `stopMarks[].state` | `done` \| `exception` \| `pending` | `done` when picked up or delivered (returned counts as done); `exception` for an open delivery exception; otherwise `pending` |

Order: completed marks by completion time, then pending marks in route order. Derived by
`packages/domain/src/route-stop-marks.ts`; length equals the existing `totalStops`, and the
number of `done` plus `exception` marks equals `completedStops`.

## Attention item (domain projection)

Built in the browser from the board data by `packages/domain/src/attention.ts`.

| Field | Meaning |
| --- | --- |
| `kind` | `exception_to_decide`, `late`, `pending_handover`, `at_risk`, `pickup_problem` |
| `shipmentId`, `trackingNumber` | The shipment it concerns |
| `rank` | Order of `kind` as listed, then the delivery window's end |
| `action` | `decide`, `reassign`, `confirm_handover`, `assign`, `open` |

Minor flags (`cod_difference`, `to_review`, `photo_skipped`, `fee_to_review`) are counted, not
listed; `fee_to_review` only for the owner.

## BoardEntry.pendingHandover (read projection)

Added to each shipment in `GET /api/shipments/board`: the pending handover's couriers and
request time, or `null` ([contracts/board-read.md](contracts/board-read.md)). Read from the
existing handovers table; at most one pending handover per shipment, as today.

## Audit event display (read projection)

Added to `GET /api/audit-events` items ([contracts/audit-read.md](contracts/audit-read.md)):
`entityLabel` (name or tracking number) and `changeLabels`, the referenced records' names for
reference fields in `changes`. Identifiers stay in the payload but are never rendered.
