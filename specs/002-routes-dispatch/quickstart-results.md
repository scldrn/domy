# Quickstart Results: Routes and Dispatch

**Date**: 2026-10-13 · **Branch**: `002-polish` · **Tasks**: T052–T061

Every manual validation scenario of [quickstart.md](quickstart.md) is automated: as an
end-to-end test (Playwright against real PostgreSQL 18, the API in test mode with a controlled
clock), or, for the scenarios marked ⚙ that need a stop completed by the courier app (feature
003), as an integration test that sets the task directly. Every end-to-end test also checks
the screen it ends on against WCAG 2.2 AA (axe). On top of the scenarios, the owner asked on
2026-10-13 for a full pass of unit, integration, API, contract, end-to-end, performance,
security, usability, and interface testing; its results follow the scenarios.

## Scenarios

| # | Story | Result | Automated by |
| --- | --- | --- | --- |
| 1 | US1 | Pass | `route-build-dispatch.spec.ts` › builds, orders, and dispatches a route (scenarios 1–4) |
| 2 | US1 | Pass | same test: a delivery dragged or moved with the keyboard above its pickup is refused |
| 3 | US1 | Pass | same test: dispatching without a courier is refused, then dispatched |
| 4 | US1 | Pass | same test: a second route in progress for the courier is refused, with a link to the first |
| 5 | US1 | Pass | `route-build-dispatch.spec.ts` › places reverse pickups, carrier handoffs, and errands |
| 6 | US2 | Pass | `routes-board.spec.ts` › shows the routes of the day with courier, progress, amount, and flags |
| 7 | US2 ⚙ | Pass | `routes-board.test.ts` › counts completed stops whatever their position |
| 8 | US2 | Pass | `routes-board.spec.ts` › lists yesterday's route still in progress under its own section |
| 9 | US3 | Pass | `route-adjust.spec.ts` › adds a registered shipment to a route in progress and removes another |
| 10 | US3 | Pass | `route-adjust.spec.ts` › takes a voided shipment off its route |
| 11 | US4 | Pass | `route-reassign.spec.ts` › reassigns a shipment on the way to another courier's route, only with a reason |
| 12 | US4 ⚙ | Pass | `handovers.test.ts` › confirms on the courier's behalf; cancels; replaces a pending handover |
| 13 | US4 | Pass | `route-reassign.spec.ts` › reassigns a whole route to a courier without a route in progress |
| 14 | US5 | Pass | `route-cancel-undo.spec.ts` › cancels a route in preparation; a route in progress is refused |
| 15 | US5 | Pass | `route-cancel-undo.spec.ts` › undoes the dispatch; ⚙ the refusal after a completed stop: `routes-cancel-undo.test.ts` |
| 16 | All | Pass | `route-concurrent-edit.spec.ts` › refuses the second of two changes to the same route and shows the latest version |

## Success criteria

- **SC-001**: the route of scenario 1 (nine shipments, three pickup points) is built,
  ordered, assigned, and dispatched in the end-to-end test in about 6 seconds of scripted
  work; the 2 minutes with a real dispatcher are measured at the owner's acceptance.
- **SC-002**: `routes-invariants.test.ts` runs three seeded sequences of 90 random actions by
  two dispatchers, with the courier app's pickups and deliveries in between, and checks after
  every step that each shipment not final is unassigned or on exactly one open route, with
  its status, tasks, custody, and handovers consistent.
- **SC-003**: a route dispatched in another browser appears on the board after one poll (20
  seconds), under the 30-second limit (`routes-board.spec.ts`).
- **SC-004**: reassigning a shipment takes one dialog with two fields; timed with a real
  dispatcher at the owner's acceptance.
- **SC-005**: `custody-history.test.ts` follows a package from pickup through a confirmed
  handover to delivery with no gap; the shipment's "Custodia del paquete" shows it.
- **SC-006**: measured with the dispatcher at the owner's acceptance.

## Test inventory

| Kind | Where | What it covers |
| --- | --- | --- |
| Unit, domain | `packages/domain/src/*.test.ts` (145) | Route rules, stop order, progress, finish and undo rules, Spanish messages of every schema |
| Unit, web | `apps/web/src/**/*.test.ts(x)` (116) | Histories rendered to HTML (labels, links, "Registrado por despacho", markup kept as text), route state marks, the reason rule |
| Integration and API | `apps/server/tests/*.test.ts` (283 with feature 001) | Every endpoint against real PostgreSQL, exactly once and concurrency |
| Contract | `routes-contract.test.ts` | Every endpoint of `contracts/http-api.md` registered and every route endpoint documented; every error code with its status; every body with exactly the documented shape |
| Security | `routes-security.test.ts`, `role-permissions.test.ts` | Hostile identifiers and bodies, cross-site form posts, oversized lists and bodies, fields outside the schema, forged versions, markup in reasons, protective headers, the session cookie; each role on every endpoint |
| Performance | `routes-scale.test.ts` | The budget of research R13 on a busy day over 100,000 earlier shipments |
| Property | `routes-invariants.test.ts` | SC-002, FR-020, and FR-021 under random sequences |
| End to end | `apps/web/tests/e2e/` (57) | Every quickstart scenario, keyboard reordering, concurrent edits, and an axe check of every screen it ends on |
| Accessibility | `accessibility.spec.ts` | Every panel screen, including "Rutas", and every route screen with its five dialogs at 390, 600, 1024, 1280, and 1440 px, light and dark, without sideways scrolling |

Performance on the development laptop, slowest of five runs (budget: 500 ms per read, 1 s
per action): routes board 20 ms, "Sin asignar" 7 ms, route detail 5 ms, shipment detail
4 ms, 20 panels polling the board at once 214 ms, creating a route of 15 shipments 22 ms,
ordering it 15 ms, dispatching it 12 ms.

## Usability and interface review (T061)

Method: a scripted walk through the whole workflow, from registering a shipment (feature 001)
through every route action, captured screen by screen (41 captures) at 1440, 1024, and
390 px, light and dark; the same screens with the keyboard only; each screen checked
against `docs/design-system.md` and Nielsen's ten usability heuristics. Findings, most
severe first, each fixed test-first where it was behavior:

| # | Finding | Kind | Resolution |
| --- | --- | --- | --- |
| 1 | After a first "Registrar envío" with empty fields, filling them and saving again did nothing and said nothing: a mark left on the pickup point, disabled at the time, blocked every later save (feature 001) | Usability, high | Fixed: each save starts from clean marks and the domain schema validates again (`register-shipment.spec.ts`) |
| 2 | A body that was not valid JSON answered `500` | Security | Fixed: `400 invalid_request` (research R13) |
| 3 | No limit on request bodies or shipment lists, and no protective headers | Security | Fixed: 1 MB bodies, 200 shipments per request, secure headers that forbid framing and sniffing (research R13) |
| 4 | Setting the courier a route already has, sent twice with the same action, was refused the second time as a version conflict (FR-020) | Integrity | Fixed: an action that changes nothing keeps the version |
| 5 | Zod's own messages in English could reach a user ("Too small: expected array…") | Language | Fixed: Zod's messages in Spanish; screens keep their own |
| 6 | A handover confirmed by dispatch was not marked "Registrado por despacho" (FR-025, design-system.md §8) | Design rule | Fixed: events record `on_behalf`; the mark shows in the route history, the custody history, and the shipment's history |
| 7 | When another dispatcher took a selected shipment first, it stayed in the selection, so every retry failed again (FR-021) | Usability | Fixed: the selection keeps only shipments still "Sin asignar" (`route-concurrent-edit.spec.ts`) |
| 8 | Deactivating a courier with open routes stacked "desactivado" over the warning, hiding it | Usability | Fixed: one warning notice says both |
| 9 | Tracking numbers in the route history were plain text, not links in the label style (design-system.md §8) | Design rule | Fixed |
| 10 | The board's "now" line crossed the sentence "Ningún envío con franja." (feature 001) | Interface | Fixed: the sentence sits above the line |
| 11 | "Rutas" was missing from the accessibility sweep; route screens and dialogs were not checked in dark mode or on a phone; scenario 16 had no end-to-end test | Coverage | Fixed |

Checked and kept as they are:

- The date field shows the browser's own format (dd/mm/aaaa in a Spanish browser; the test
  browser is English).
- On a phone, confirmation dialogs center their text, as feature 001's dialogs do.
- "Nueva ruta" stays visible with nothing to choose; its sentence says what to do.
- A cancelled route keeps its summary at zero next to the reason.

Heuristics, in short: state is always visible (state marks, notices, progress); the words
are the glossary's; every action can be corrected (undo a dispatch, cancel a handover,
"Volver" in every confirmation); refusals say what happened and what to do; one filled
primary action per screen ("Despachar", "Registrar envío"); keyboard reordering, focus rings
in the accent color, and 48 px targets everywhere, including the compact actions of a stop.

## Go-live checklist

- [ ] SC-001, SC-004, and SC-006 timed with the dispatcher during the owner's acceptance.
- [ ] A content security policy for scripts and styles, tested against the built app on the
      production host (research R13).
