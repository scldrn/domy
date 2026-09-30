# Implementation Plan: Routes and Dispatch

**Branch**: `002-routes-dispatch` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-routes-dispatch/spec.md`

## Summary

Let the dispatcher build routes from unassigned shipments, order their stops by dragging,
assign a courier, and dispatch; adjust routes before and after dispatch; reassign shipments
or whole routes with a reason, with confirmed handovers for packages already picked up;
cancel routes in preparation and undo mistaken dispatches; and follow every route of the day
on the dispatch board.

Technically, this feature adds routes, stops, tasks, handovers, and route events to the
database; route rules as pure functions in `packages/domain`; route endpoints with
exactly-once actions and optimistic concurrency; and a route builder with accessible drag
and drop in the web app. It builds on the foundation of
[feature 001](../001-shipment-registration/plan.md) (see [research.md](research.md)).

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node.js 24 LTS — as feature 001

**Primary Dependencies**: those of feature 001, plus `@dnd-kit/core` 6.3 and
`@dnd-kit/sortable` 10 in the web app (research R3)

**Storage**: PostgreSQL 18; new tables `routes`, `route_stops`, `route_tasks`, `handovers`,
`route_events`; new columns on `shipments` and `shipment_events`
([data-model.md](data-model.md))

**Testing**: Vitest 5 (unit; integration against real PostgreSQL via Testcontainers),
Playwright 1.63 (end to end) — as feature 001

**Target Platform**: as feature 001 (Linux server; dispatch panel in desktop browsers)

**Project Type**: Web application (monorepo: `apps/server`, `apps/web`, `packages/domain`)

**Performance Goals**: route progress and flags visible within 30 s (SC-003); a nine-shipment
route built and dispatched in under 2 minutes of user time (SC-001)

**Constraints**:
- One route in progress per courier, enforced by the database.
- Every mutation carries a client-generated `actionId`.
- No automatic route optimization.
- Spanish UI, WCAG 2.2 AA, including keyboard reordering of stops.

**Scale/Scope**: about 3–6 routes a day of 8–9 deliveries over 2–3 pickups; 5 user stories,
26 functional requirements, 3 screens (routes of the day, route builder and editor, route
detail)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Status |
| --- | --- | --- |
| I. Simplicity First | No new process or service. One new web dependency pair (dnd-kit), justified by keyboard and touch accessibility that the native API lacks. No route optimization. Rules are plain functions | ✅ |
| II. Zero Data Loss in the Field | Every mutation carries `actionId` and has exactly one effect (research R4); the same mechanism serves the courier app. Route events record `occurred_at` and `recorded_at` | ✅ |
| III. Single Source of Truth | Stop building, ordering rules, finish rule, and progress live in `packages/domain/src/routes.ts`, used by server and web. Shipment status changes go through the shared lifecycle, extended with this feature's transitions | ✅ |
| IV. Transactional Integrity & Traceability | Every route action changes routes, stops, shipments, and events in one transaction. Database enforces one route in progress per courier, one pending handover per shipment, and status/route consistency. Routes, completed tasks, and events are never deleted; pending tasks are edited with the change recorded (research R10) | ✅ |
| V. Type Safety at Every Boundary | Zod schemas for every request in `packages/domain`; Hono RPC types | ✅ |
| VI. Test-First Business Logic | Route rules and lifecycle transitions written test-first; integration tests on real PostgreSQL, including the concurrency and uniqueness rules; Playwright for "build and dispatch route", a constitution-named critical flow | ✅ |
| VII. Effortless UX | Spanish glossary terms, M3 components, drag and drop with full keyboard alternative, 48 dp targets | ✅ |
| VIII. Absolute Repository Order | Follows feature 001's structure: one schema file, one route file, one feature folder. New terms added to the glossary | ✅ |
| IX. Security, Privacy & Data Ownership | Owner and dispatcher only, checked on the server for every endpoint; no new personal data | ✅ |

**Post-design re-check (after Phase 1)**: ✅ all principles hold.
- The data model enforces the three invariants (one route in progress per courier, one
  active route per shipment, one pending handover per shipment) in the database.
- Custody changes only on a confirmed handover.
- Designing R4 showed that feature 001 applied Principle II's "every mutation carries a
  client-generated UUID" only to creations. Feature 001's spec, data model, contract, and
  tasks are aligned in this branch.

## Project Structure

### Documentation (this feature)

```text
specs/002-routes-dispatch/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

Files added or changed by this feature, inside the structure defined by feature 001:

```text
packages/domain/src/
├── routes.ts                         # buildStops, add/remove, moveStop, validateStopOrder, isRouteFinished, routeProgress
├── shipment-lifecycle.ts             # + transitions owned by this feature
└── schemas/
    └── routes.ts                     # request and response schemas

apps/server/src/
├── db/schema/
│   ├── routes.ts                     # routes, route_stops, route_tasks, handovers, route_events
│   └── shipments.ts                  # + route_id, custody_courier_id; shipment_events.route_id
├── db/migrations/                    # one new reviewed migration
├── routes/
│   ├── routes.ts                     # /api/routes/*
│   ├── handovers.ts                  # /api/handovers/*
│   └── shipments.ts                  # + unassigned, reassign; void and edit update the route
└── lib/
    └── action-id.ts                  # exactly-once helper shared by every mutation

apps/server/tests/                    # routes-*.test.ts, handovers.test.ts

apps/web/src/
├── routes.ts                         # + /rutas, /rutas/$routeId
├── routes/
│   ├── routes-board.tsx              # "Rutas": routes of the day, previous days, "Sin asignar"
│   └── route-detail.tsx              # builder, editor, and detail of one route
└── features/routes/
    ├── unassigned-list.tsx
    ├── stop-list.tsx                 # sortable stops (dnd-kit)
    ├── route-summary-card.tsx
    ├── courier-select.tsx
    ├── reassign-dialog.tsx
    ├── handover-badge.tsx
    └── route-history.tsx

apps/web/tests/e2e/                   # route-build-dispatch.spec.ts, route-adjust.spec.ts, route-reassign.spec.ts
```

**Structure Decision**: no new package or folder convention; this feature adds files to the
places feature 001 defined. The only new shared helper, `lib/action-id.ts`, exists because
every mutation of features 001–003 needs the same exactly-once check.

## Complexity Tracking

No constitution violations.

| Addition | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| `@dnd-kit/core` and `@dnd-kit/sortable` | FR-006 requires dragging and keyboard reordering with screen-reader support | Native HTML drag and drop has no keyboard or touch support; up/down buttons alone make ordering nine stops slow |
| Stops and tasks as two tables | A pickup stop groups several shipments that the courier confirms one by one | A single table cannot represent "one stop, several shipments, partially completed" without ambiguity |
