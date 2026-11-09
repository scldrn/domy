---

description: "Task list for the coherent redesign of every web interface"
---

# Tasks: Coherent Redesign of Every Web Interface

**Input**: Design documents from `specs/006-ui-redesign/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts), [quickstart.md](quickstart.md),
[proposals.md](proposals.md)

**Tests**: required where the constitution demands them (VI: business rules, read
projections, guards); plain rendering is exempt but every slice keeps the 157 e2e tests and
their axe checks green (SC-007).

**Approval gate**: a screen's implementation task may start only when its row in
[proposals.md](proposals.md) says `approved` (FR-003). A proposal task renders the screen as
a private design artifact beside its area's approved screens, in light, dark, and 390 px
where the screen is used on phones, asks the owner, and records the decision in
`proposals.md` and `OWNER-REQUESTS.md`. Every proposal includes the screen's empty, loading,
and error states (FR-014) and what changes for the dispatcher versus the owner (FR-015), and
every implementation keeps `access.spec.ts` green.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1–US5 from [spec.md](spec.md)

---

## Phase 1: Setup

**Purpose**: baselines and guards before anything changes

- [ ] T001 Record in `specs/006-ui-redesign/baselines.md` the step count of each daily flow today (register, bulk register, edit, create and dispatch a route, find a past shipment, notify; SC-006), the baseline sizes of `apps/web/dist` JavaScript and CSS after `pnpm build`, and the courier route screen's time to first content on a real low-end Android phone (Android 10+, Chrome, installed app, mid-signal 4G, median of 5 cold opens; research R12, SC-008); the phone measurement joins the pending physical tests
- [X] T002 [P] Write a failing-then-passing Vitest guard that fails on color literals (`#hex`, `rgb(`, `hsl(`, `oklch(`) in `apps/web/src/**` outside `styles/tokens.css`, in `apps/web/src/styles/color-literals.test.ts`; list today's offenders as the slice-by-slice cleanup set (research R8, SC-005) — Written on 2026-11-08 with the daily-operation slices merged: no file outside `tokens.css` held a literal, so the cleanup set starts and stays empty
- [X] T003 [P] Add an e2e helper that fails when a screen's visible text contains a UUID-shaped string, in `apps/web/tests/e2e/fixtures.ts`, run after each passing test like axe (research R8, SC-005) — Done on 2026-11-08 as `visibleIdentifiers`, on every role page and the signed-out page: the app showed no UUID; the only findings were test data that embedded whole UUIDs in names and emails (`account-idempotency.spec.ts`, `courier.ts`), now 8-character tags
- [X] T004 [P] Extend the axe fixture in `apps/web/tests/e2e/fixtures.ts` to also run with `data-scheme="dark"` on panel and public pages, at 390 px for courier and public pages, and at 1024 px and 360 px for panel pages, failing on horizontal page scroll at those widths (research R9, SC-004, FR-012) — Done on 2026-11-08 as `checkScreen`, on every role page and the signed-out page. It found the page scrolling sideways in two places, both fixed: absolutely positioned text in the data list's rows escaped its horizontal scroller and widened the board at 1024 px, so it and the other horizontal scrollers (filter bar, bulk preview tabs, phone destinations) are now `relative`; and a long email widened «Mi cuenta» at 360 px

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the design system, the tokens, the theme switch, the shell, and the shared
components. Every screen sits in the new shell when this phase merges.

- [X] T005 Update `docs/design-system.md`: lime accent replacing teal (§3.1, §3.3), pizarra surfaces and on-pizarra state roles (§3.2), type scale and spacing of the board (§4, §5), components (§7, per `contracts/components.md`), patterns (§8: day sentence, stage counts, "Por resolver", courier progress, side panel), courier styling and theme switch (spec Clarifications); reconcile "One bold element per screen" with the board's pizarra blocks (checklist CHK014); state the rail's behavior at every window size class (checklist CHK039); record the date and the owner's approval (FR-001)
- [X] T006 Render the updated design system as a reference artifact (palette in three schemes with contrast values, type, components) and get the owner's approval of T005 before T007 (FR-001, FR-003)
- [X] T007 Write a failing unit test of the contrast pairs listed in `contracts/design-tokens.md` for light, dark, and high contrast in `apps/web/src/styles/tokens.test.ts` (the existing contrast test of the generated tokens, extended)
- [X] T008 Change `scripts/generate-design-tokens.ts`: accent `#C8F23C` unharmonized with roles `accent` (tone ≈ 90), `on-accent` (tone 10–15), `accent-strong` (tone ≈ 50 light, ≈ 80 dark); light `rail` at primary 10; `rail-line` primary 25; `rail-success`, `rail-warning`, `rail-error`, `rail-info`, `rail-tertiary` at tone 80; then `pnpm tokens` to regenerate `apps/web/src/styles/tokens.css` until T007 passes (research R1, R2)
- [X] T009 Map the new roles to Tailwind utilities and shadcn tokens (`--ring` to `accent-strong`) in `apps/web/src/styles/globals.css`
- [X] T010 [P] Write a failing test for the theme choice: `domy-theme` in localStorage accepts only `light` or `dark` (Zod), absent follows the computer, invalid values are ignored, in `apps/web/src/lib/theme.test.ts`
- [X] T011 Implement `apps/web/src/lib/theme.ts` and apply the stored choice as `data-scheme` before the first paint (a layout effect of the panel layout, so it leaves the courier app and public pages to their own rules; research R3, FR-011)
- [X] T012 [P] Build `ThemeSwitch` in `apps/web/src/components/theme-switch.tsx` (label states the target theme)
- [X] T013 [P] Build `TrackingNumber` and `Money` in `apps/web/src/components/tracking-number.tsx` and `apps/web/src/components/money.tsx`, and replace their ad hoc renderings found by search across `apps/web/src` — Built in slice `006-us1-board-screen` and used by the board and its side panel; the other screens adopt them in their own slices (US2–US5), since replacing them now would restyle screens their owner has not yet approved (FR-003)
- [X] T014 [P] Build `SummarySentence` in `apps/web/src/components/summary-sentence.tsx` and extend `PageHeader` in `apps/web/src/components/page-header.tsx` (title, sentence, one action, aside) per `contracts/components.md`
- [X] T015 [P] Build `DataList` in `apps/web/src/components/data-list.tsx`: grid rows, header row, two-line wrapping, bounded first page with "Ver los N", cards under 820 px
- [X] T016 [P] Build `FilterBar` in `apps/web/src/components/filter-bar.tsx` (status tabs, one alert chip, client and courier selects, "Quitar filtros")
- [X] T017 [P] Build `SidePanel` on shadcn `Sheet` in `apps/web/src/components/side-panel.tsx` (focus in on open, back to opener on close, Escape, sticky header)
- [X] T018 [P] Restyle `StateMark` (`apps/web/src/components/shipment-status-mark.tsx`, `apps/web/src/components/route-status-mark.tsx`), `EmptyState`, and `QueryState` to the updated design system, keeping their props — The board added `text-figure`, the stage and next-stop motion, and lime focus on pizarra (`on-rail`); the marks and states themselves are still to restyle; done on 2026-11-09: the marks read in semibold like the approved screens, `EmptyState` sits on a sheet with a larger title, and `QueryErrorAlert` follows the same pattern in the error tone with «Reintentar»
- [X] T019 Rebuild the panel shell in `apps/web/src/routes/panel-layout.tsx`: pizarra rail with the wordmark, grouped navigation, lime current page, collapsible to the symbol; top bar with global search, last-update status, `ThemeSwitch`, "Registro masivo", and the one lime "Nuevo envío" (approved with the board); below 768 px a row of destinations under the top bar. Done in slice `006-us1-shell` except the search's results list and the last-update status, which need the board's data and come with T030; 44 px panel controls come with the shared components (T013–T018); the rest done on 2026-11-09: from two characters the day's matching shipments open below the search, each a link to its detail (`features/board/global-search.tsx`, `board-search.ts`), Enter still takes the search to «Historial», and the board shows «Actualizado hace N s» with the lime pulse
- [X] T020 Remove the color literals the shell and shared components still carry, so T002 shrinks to the screens not yet redesigned; run every gate and compare sizes with `baselines.md` — 2026-11-08: none were left when T002 was written; gates run and sizes compared in `baselines.md`

**Checkpoint**: tokens, theme, shell, and components merged; every screen is in the new shell
and passes axe in both themes.

---

## Phase 3: User Story 1 - The dispatcher runs the day from the new board (Priority: P1) 🎯 MVP

**Goal**: the approved board (artifact version 9) on real data.

**Independent Test**: [spec.md](spec.md) US1; [quickstart.md](quickstart.md) "Board slice".

### Tests for User Story 1

- [X] T021 [P] [US1] Write failing tests for `routeStopMarks` in `packages/domain/src/route-stop-marks.test.ts`: "Length equals `totalStops`; `done` + `exception` marks equal `completedStops`", completed by completion time then pending in route order, draft routes all `pending`, returned counts as `done`
- [X] T022 [P] [US1] Write failing tests for `buildAttention` in `packages/domain/src/attention.test.ts`: order `exception_to_decide`, `late`, `pending_handover`, `at_risk`, `pickup_problem`, ties by window end; `fee_to_review` only for the owner; minor counts for `collection_differs`, `needs_review`, `no_photo`, `fee_to_review`; late and at-risk reuse the existing delivery-window rule
- [X] T023 [P] [US1] Write failing server tests: `/api/routes/board` returns `stopMarks` per route in `apps/server/tests/routes-board.test.ts`; `/api/shipments/board` returns `pendingHandover` (`null` unless a handover is `pending`) in `apps/server/tests/board.test.ts`

### Implementation for User Story 1

- [X] T024 [US1] Implement `packages/domain/src/route-stop-marks.ts`, export it from `packages/domain/src/index.ts`, add `stopMarks` to `RouteSummary` in `packages/domain/src/schemas/routes.ts` (T021 green)
- [X] T025 [US1] Implement `packages/domain/src/attention.ts`, export it, add `pendingHandover` to `BoardEntry` in `packages/domain/src/schemas/board.ts` (T022 green)
- [X] T026 [US1] Fill `stopMarks` in `loadRouteSummaries` in `apps/server/src/routes/routes.ts` and `pendingHandover` in the board query of `apps/server/src/routes/shipments.ts` (T023 green)
- [X] T027 [P] [US1] Build `StageCounts` in `apps/web/src/components/stage-counts.tsx` (progress bar, stage buttons with `aria-pressed`, filter and scroll to the list)
- [X] T028 [P] [US1] Build `AttentionList` in `apps/web/src/features/board/attention-list.tsx` (five rows, one action each, "Ver todos", "Además" line that filters the list)
- [X] T029 [P] [US1] Build the courier progress list in `apps/web/src/features/board/courier-progress.tsx` (stop track from `stopMarks`, next stop, one note, call, dispatch for routes in preparation, legend)
- [X] T030 [US1] Rebuild `apps/web/src/routes/dispatch-board.tsx` in the approved order (FR-018): hero with day sentence (`apps/web/src/features/board/day-sentence.ts`), date control (`day-stepper.tsx`), shortcuts to Rutas and Notificar with counts, `StageCounts`; then `AttentionList` beside courier progress; then the shipment list with `FilterBar` and `DataList`; retire `day-ribbon.tsx` and `board-section.tsx` if the approved board no longer uses them
- [X] T031 [US1] Open shipments from the board in `SidePanel` with their existing actions (decide exception, confirm or cancel handover, reassign, confirm fee, resolve review) reusing the dialogs in `apps/web/src/features/shipments/` (FR-019)
- [X] T032 [US1] Update `apps/web/tests/e2e/dispatch-board.spec.ts` and `apps/web/tests/e2e/exception-decision.spec.ts` to the new structure without weakening any assertion; add the above-the-fold check at 1440×900 and the two-screen-height bound (SC-002)
- [ ] T033 [US1] Mark the board `approved` → `implemented` in `proposals.md`, run every gate, and compare sizes with `baselines.md` — The board is implemented and every gate passes; the size comparison waits for `baselines.md`, which needs the physical measurement of T001

**Checkpoint**: MVP. The dispatcher runs the day from the new board.

---

## Phase 4: User Story 2 - Every daily-operation screen speaks the same language (Priority: P2)

**Goal**: new and bulk shipment, detail and edit, routes and route detail, history, notify.

**Independent Test**: [spec.md](spec.md) US2.

- [X] T034 [US2] Propose "Nuevo envío" and "Editar envío" beside the board and record the decision (FR-003)
- [X] T035 [US2] Implement the approved form in `apps/web/src/routes/shipment-new.tsx`, `apps/web/src/routes/shipment-edit.tsx`, and `apps/web/src/features/shipments/*` fields; keep keyboard order and field errors (US2 scenario 1); `register-shipment.spec.ts`, `edit-void-shipment.spec.ts`, and the form-draft specs green
- [X] T036 [US2] Propose "Registro masivo" and record the decision
- [X] T037 [US2] Implement it in `apps/web/src/routes/shipment-bulk.tsx` and `apps/web/src/features/bulk/`; `bulk-registration.spec.ts` green
- [X] T038 [US2] Propose "Detalle de envío" and record the decision
- [X] T039 [US2] Implement it in `apps/web/src/routes/shipment-detail.tsx` and its sections, sharing the board's `SidePanel` content where the proposal shows the same sections
- [X] T040 [US2] Propose "Rutas" and "Detalle de ruta" and record the decision
- [X] T041 [US2] Implement them in `apps/web/src/routes/routes-board.tsx`, `apps/web/src/routes/route-detail.tsx`, and `apps/web/src/features/routes/*`; route-build, adjust, cancel, reassign, concurrent-edit, and routes-board specs green (US2 scenario 2)
- [X] T042 [US2] Propose "Historial" and record the decision
- [X] T043 [US2] Implement it in `apps/web/src/routes/history.tsx` and `apps/web/src/features/history/`; `history-search.spec.ts` green
- [X] T044 [US2] Propose "Notificar clientes" and record the decision
- [X] T045 [US2] Implement it in `apps/web/src/routes/notify-merchants.tsx` and `apps/web/src/features/notifications/`; notify specs green
- [X] T046 [US2] Remove the daily-operation screens from T002's offender set; run every gate; compare sizes — 2026-11-08: the set is empty; every gate passed locally (CI saved for the end at the owner's request); JS + CSS +7.4 % (`baselines.md`)

**Checkpoint**: daily operation complete in the new language.

---

## Phase 5: User Story 3 - The courier app feels like the same product (Priority: P3)

**Goal**: same brand and states, light surfaces, pizarra header and navigation bar, lime
primary action, high contrast kept (clarification Q2).

**Independent Test**: [spec.md](spec.md) US3; [quickstart.md](quickstart.md) "Courier slice".

- [X] T047 [US3] Propose the courier shell, "Mi ruta", and "Parada" at 360 px in light, dark, and high contrast, and record the decision
- [X] T048 [US3] Implement the shell in `apps/web/src/routes/courier-layout.tsx` and `apps/web/src/features/courier/scheme.ts` (pizarra header and navigation bar, 48 px targets, high contrast kept)
- [X] T049 [US3] Implement "Mi ruta" and "Parada" in `apps/web/src/routes/courier-route.tsx`, `apps/web/src/routes/courier-stop.tsx`, and the forms in `apps/web/src/features/courier/`; primary actions within 3 taps (FR-016); `courier-route`, `courier-action-taps`, `courier-exceptions`, `courier-offline`, `records-on-behalf` specs and `courier-stop.test.tsx` green
- [X] T050 [US3] Propose "Mi día" and "Pendientes" and record the decision
- [X] T051 [US3] Implement them in `apps/web/src/routes/courier-day.tsx` and `apps/web/src/routes/courier-pending.tsx` with the sync states of `apps/web/src/features/courier/sync-status.ts`; `courier-day.spec.ts` green
- [ ] T052 [US3] Measure the route screen against `baselines.md` (SC-008); remove the courier screens from T002's offender set; run every gate

**Checkpoint**: couriers see the same product, built for the street.

---

## Phase 6: User Story 4 - Public pages and sign-in (Priority: P4)

**Goal**: tracking, merchant link, and sign-in screens with the same care.

**Independent Test**: [spec.md](spec.md) US4.

- [X] T053 [US4] Propose "Seguimiento" and "Enlace del cliente" at 320 px and desktop in light and dark, and record the decision
- [X] T054 [US4] Implement them in `apps/web/src/routes/tracking.tsx`, `apps/web/src/routes/merchant-page.tsx`, and `apps/web/src/features/public/*`, adding no field beyond the constitution's allowance (FR-017); tracking, merchant-page, public-pages, and public-accessibility specs green, including the 3-second cold-start check
- [X] T055 [US4] Propose "Ingresar", "Recuperar", "Restablecer" and the courier waiting page, and record the decision
- [X] T056 [US4] Implement them in `apps/web/src/routes/sign-in.tsx`, `apps/web/src/routes/recover.tsx`, `apps/web/src/routes/reset-password.tsx`, and `apps/web/src/features/auth/auth-card.tsx`; access and account specs green — Done on 2026-11-09: `AuthCard` and `AuthNotice` as approved, the show/hide button in the password fields, the lockout as its own notice, «Revisa tu correo» and «Tu contraseña se actualizó» as results, and the courier waiting page for an account never linked (the server answers `403 courier_not_linked`; an account unlinked after working keeps the app and its pending work)
- [X] T057 [US4] Remove these screens from T002's offender set; run every gate — The offender set was already empty (T002); every gate passes

**Checkpoint**: everything outside the panel carries the brand.

---

## Phase 7: User Story 5 - Master data and administration (Priority: P5)

**Goal**: same patterns; the audit log shows names.

**Independent Test**: [spec.md](spec.md) US5.

### Tests for User Story 5

- [X] T058 [P] [US5] Write failing server tests for `entityLabel` and `changeLabels` in `apps/server/tests/audit-events.test.ts`: reference fields (merchant, courier, carrier, neighborhood, user, rate zone) resolve to names, deactivated records keep their name, an unresolved reference reads `Registro eliminado`, `changes` keeps its `[from, to]` shape (contracts/audit-read.md)
- [ ] T059 [P] [US5] Write a failing web test that the audit log renders labels and never an identifier in `apps/web/src/routes/audit-log.test.tsx` and `apps/web/src/features/master-data/audit-formatting.test.ts`

### Implementation for User Story 5

- [X] T060 [US5] Add `entityLabel` and `changeLabels` to `AuditEvent` in `packages/domain/src/schemas/master-data.ts` and resolve them in `apps/server/src/routes/audit-events.ts` (T058 green)
- [ ] T061 [US5] Propose "Clientes" and the client detail, and record the decision
- [ ] T062 [US5] Implement them in `apps/web/src/routes/merchants.tsx`, `apps/web/src/routes/merchant-detail.tsx`, and `apps/web/src/features/master-data/merchants/`
- [ ] T063 [US5] Propose "Mensajeros", "Transportadoras", "Barrios", and "Tarifario" (one proposal each, shown together), and record each decision
- [ ] T064 [US5] Implement them in `apps/web/src/routes/couriers.tsx`, `carriers.tsx`, `neighborhoods.tsx`, `rate-card.tsx`, `apps/web/src/features/master-data/directory-page.tsx`, and their feature folders; `master-data.spec.ts` green
- [ ] T065 [US5] Propose "Configuración", "Usuarios", "Auditoría", and "Mi cuenta", and record each decision
- [ ] T066 [US5] Implement them in `apps/web/src/routes/settings.tsx`, `users.tsx`, `audit-log.tsx` (using `changeLabels`; T059 green), and `account.tsx`; company-settings and account specs green
- [ ] T067 [US5] Remove these screens from T002's offender set, which must now be empty; run every gate

**Checkpoint**: every screen redesigned.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T068 Final coherence review: render every screen together for the owner and record the sign-off of the whole set in `proposals.md` (SC-001)
- [ ] T069 [P] Timed walkthrough of SC-003 (the dispatcher, on the demo data, 5 trials, from opening the board to pressing the first item's action; median under 10 s) and step counts of SC-006 against the step counts recorded in T001, recorded in `specs/006-ui-redesign/acceptance-results.md`
- [ ] T070 [P] Update `CLAUDE.md` (Architecture, `apps/web`) and `docs/status.md` with the new components and the theme switch
- [ ] T071 Delete components and styles left unused by the redesign (Constitution VIII), confirm sizes against `baselines.md`, and run every gate

---

## Dependencies & Execution Order

- **Setup (T001–T004)** → **Foundational (T005–T020)**: T006 (owner approval) gates T007 onward.
- **US1 (T021–T033)** depends on Foundational. It is the MVP.
- **US2–US5** depend on Foundational and are independent of each other; they follow the
  order of FR-021.
- Inside each story: proposal → approval → implementation → its e2e specs → gate run.
- Proposals run one step ahead: while a screen is built, the next one is proposed.

## Parallel Opportunities

- T002, T003, T004 together; T010 and T012–T018 together after T009.
- US1: T021, T022, T023 together; then T027, T028, T029 together after T024–T026.
- US5: T058 and T059 together; master-data and administration screens after their approvals.

## Implementation Strategy

1. Setup and Foundational, merged as slice `006-us1-foundation`: the whole product moves to
   the new shell and tokens at once.
2. US1 as slice `006-us1-board`: the MVP to show Santiago Marín.
3. Then one slice per screen or pair in the owner's order, each after its approval.
4. Every slice: one branch, one pull request, all gates green, the owner's approval before merge.
