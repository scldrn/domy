# Implementation Plan: Coherent Redesign of Every Web Interface

**Branch**: `006-ui-redesign` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-ui-redesign/spec.md`

## Summary

Every web screen moves to the language of the board proposal the owner approved (design
artifact version 9): pizarra surfaces, one lime accent, Archivo, the drawn wordmark,
sentence-first summaries, and the density rule "every hour on the page, the rest one click
away". The work starts with the design system document and the generated tokens (lime
replaces teal as the one accent; pizarra roles for dark blocks; state roles readable on
pizarra), then a shared shell and component set, then the board, then the other areas in
the owner's order, each screen proposed and approved before it is built (research R1–R13).
Behavior does not change. Four read-only additions are needed: each route's ordered stop
marks for the board's courier progress (R5), each board shipment's pending handover and the
"Por resolver" ranking as a domain rule (R6), and names instead of identifiers in the audit
log (R10).

## Technical Context

**Language/Version**: TypeScript 6 strict on Node 24 (server runs `.ts` directly), React 19 in the browser

**Primary Dependencies**: already installed only: Tailwind CSS 4, shadcn/ui (`base-nova`
on Base UI), TanStack Router and Query, Material Color Utilities (token generation),
vite-plugin-svgr, Material Symbols Rounded, Archivo variable font; Hono, Drizzle, Zod on the
server. No new dependency (R12).

**Storage**: PostgreSQL 18; no schema change or migration (data-model.md)

**Testing**: Vitest (domain rules, web units, server integration on real PostgreSQL via
Testcontainers), Playwright with axe (WCAG 2.2 AA) on every passing e2e test

**Target Platform**: panel on desktop browsers from 1024 px (readable to 360 px); courier app
on Android 10+ Chrome and iOS 16+ Safari, from 320 px; public pages any browser from 320 px

**Project Type**: web application in a pnpm workspace (`apps/web`, `apps/server`, `packages/domain`)

**Performance Goals**: courier route screen no slower than today on a low-end Android
(SC-008); web bundle grows at most 10 % (R12); board renders its first view from the data it
already loads plus one route summary request

**Constraints**: Content Security Policy allows bundled styles only (`style-src-elem 'self'`)
and inline style attributes (`style-src-attr 'unsafe-inline'`), so no `<style>` elements at
runtime (R11); offline courier app behavior untouched (Constitution II); public pages show
only the constitution's allowed data; every color from generated roles (FR-002)

**Scale/Scope**: 31 routes in `apps/web/src/routes.ts` grouped into 7 areas (spec "Screens
in scope"), about 30 screen proposals, 157 existing e2e tests that must stay green

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
| --- | --- | --- |
| I. Simplicity First | No new service or dependency; shadcn/Tailwind used directly; components only where a pattern repeats (R7) | Pass |
| II. Zero Data Loss in the Field | Courier outbox, sync, and offline shell untouched; offline e2e suite must stay green (FR-016) | Pass |
| III. Single Source of Truth | "Por resolver" ranking and stop-mark derivation are rules: they live in `packages/domain` (R5, R6) | Pass |
| IV. Transactional Integrity | No write path changes; the audit log only reads names (R10) | Pass |
| V. Type Safety | Additive response fields typed in domain and inferred through Hono RPC; theme choice read from storage validated with Zod (R3) | Pass |
| VI. Test-First | Failing tests first for the attention ranking, stop marks, audit names, the color-literal check, and the theme switch (R6, R8, R10) | Pass |
| VII. Effortless UX | `docs/design-system.md` updated and approved before any screen (FR-001); WCAG 2.2 AA in light and dark (R9); Spanish glossary terms | Pass, gated on the owner's approval of the document |
| VIII. Repository Order | English code, kebab-case files, components in `src/components/`, area code in `src/features/<area>/` | Pass |
| IX. Security & Privacy | Public pages' data unchanged; audit names shown to the owner only, as today | Pass |

Post-design re-check (after Phase 1): still Pass. The only contract changes are additive
read fields (contracts/), and no principle needs a Complexity Tracking entry.

## Project Structure

### Documentation (this feature)

```text
specs/006-ui-redesign/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R13
├── data-model.md        # Phase 1: tokens, proposal register, read additions
├── quickstart.md        # Phase 1: how to validate each slice
├── contracts/
│   ├── design-tokens.md # Color roles and their uses
│   ├── components.md    # Shared component contracts
│   ├── board-read.md    # RouteSummary.stopMarks and the attention list
│   └── audit-read.md    # Audit event display names
├── proposals.md         # Register of screen proposals and the owner's approvals
├── checklists/
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
docs/design-system.md                  # Updated first (FR-001)
scripts/generate-design-tokens.ts      # Lime accent, pizarra and on-pizarra state roles (R1, R2)
packages/domain/src/
├── attention.ts                       # "Por resolver" items and their order (R6)
├── route-stop-marks.ts                # Ordered marks of a route's stops (R5)
├── schemas/routes.ts                  # RouteSummary.stopMarks (additive)
└── schemas/search.ts                  # ShipmentSearchResult.counts (additive, «Historial»)
apps/server/src/
├── routes/routes.ts                   # /routes/board fills stopMarks
├── routes/shipments.ts                # /shipments/board fills pendingHandover
├── routes/audit-events.ts             # Display names (R10)
└── lib/                               # Name resolution for audit references, if shared
apps/web/src/
├── styles/tokens.css                  # Regenerated by `pnpm tokens`
├── styles/globals.css                 # Theme mapping, Tailwind theme
├── lib/theme.ts                       # Light/dark choice, remembered per computer (R3)
├── components/                        # Shared components (contracts/components.md)
├── routes/*.tsx                       # Screens, one slice at a time
└── features/<area>/                   # Area components and api.ts
apps/web/tests/e2e/                    # Existing suites plus theme, density, and identifier checks
```

**Structure Decision**: the existing workspace layout. Shared visual pieces go to
`apps/web/src/components/`, area pieces stay in `apps/web/src/features/<area>/`, rules go to
`packages/domain`. Nothing new at the top level.

## Delivery slices

Each slice is one short branch and pull request (Trunk-Based Development), mergeable on its
own, all gates green:

1. **Foundation** (US1): design-system document approved; tokens regenerated; theme switch;
   new shell (rail, top bar, search, wordmark); shared components. Every screen already looks
   coherent at the shell level.
2. **Board** (US1): read additions (stop marks, attention ranking); the board as approved.
3. **Daily operation** (US2): one slice per screen or pair of screens, each after its
   proposal is approved (new and bulk shipment; detail and edit; routes board and detail;
   history; notify).
4. **Courier app** (US3): shell, then route, stop, my day, pending.
5. **Public pages and sign-in** (US4).
6. **Master data and administration** (US5), including the audit log names.

Proposals run one step ahead of implementation: while a slice is built, the next screens are
proposed, so the owner's reviews do not block the work.

## Complexity Tracking

No violations; nothing to justify.
