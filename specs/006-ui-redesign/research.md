# Research: Coherent Redesign of Every Web Interface

Decisions for [plan.md](plan.md). Each one: what was chosen, why, and what was rejected.

## R1. Palette: lime replaces teal; the scheme stays generated

- **Decision**: keep Material Color Utilities generating every role from seed pizarra
  `#34495E`. Change the custom accent from verde azulado `#1F7A8C` to lime `#C8F23C`, kept
  unharmonized (as the accent is today). The accent palette gives three roles: `accent`
  (tone ≈ 90, the lime itself) for fills and marks; `on-accent` (tone 10–15) for text on it;
  `accent-strong` (tone ≈ 50, the proposal's `#7FA600`) for the focus outline and thin lines
  on light surfaces, where lime fails 3:1 against white. On pizarra and in dark theme, focus
  and marks use `accent` directly.
- **Rationale**: the owner chose "lime everywhere" (clarification Q1) with lime never as text
  on light surfaces; generation keeps every tone in harmony and keeps the rule "no hand-picked
  hex values" of design-system.md §3.1.
- **Alternatives**: hand-picked hex values copied from the proposal (rejected: breaks §3.1
  and drifts between themes); a new seed (rejected: pizarra stays the brand's seed and the
  logo's color).

## R2. Pizarra blocks and state colors on them

- **Decision**: the proposal's dark blocks (board hero, courier list, toasts) reuse the
  existing `rail` family, renamed in the document as **pizarra surfaces** (`rail`,
  `rail-raised`, `on-rail`, `on-rail-variant`), with the light-theme rail tone lowered from
  primary 20 to primary 10 to match the proposal (`#141F2A`). Add on-pizarra state roles
  (`rail-success`, `rail-warning`, `rail-error`, `rail-info`, `rail-tertiary`) from each
  palette at tone 80, the tones the proposal used on dark blocks, plus `rail-line` (primary 25)
  for dividers.
- **Rationale**: one family for every dark surface keeps the count of roles small; state
  colors at tone 40 are unreadable on pizarra.
- **Alternatives**: a separate "ink" family (rejected: duplicates rail); using dark-scheme
  roles inside light theme by scoping (rejected: harder to test and to read in code).

## R3. Theme switch

- **Decision**: the existing `data-scheme` attribute on `<html>` already selects `light`,
  `dark`, and `high-contrast`, and its absence follows the device. The panel's header switch
  writes the choice (`light` or `dark`) to `localStorage` under one key, validated with Zod on
  read; `main.tsx` applies it before the first render (no inline script, which the CSP
  forbids). A "follow the computer" state is the absence of the key. The courier app keeps
  its own high-contrast setting and otherwise follows the phone (clarification Q2).
- **Rationale**: no flash, since the app renders only after its bundle runs; no new mechanism.
- **Alternatives**: storing the choice in the account (rejected: the owner asked for "en ese
  computador"; needs a schema change).

## R4. Proposals per screen

- **Decision**: proposals are rendered as private design artifacts (the same format as the
  approved board), one page per screen, each shown beside the already approved screens of its
  area, in light, dark, and phone width where the screen is used on phones. Mock data mirrors
  the demo database. Every proposal and decision is recorded in
  [proposals.md](proposals.md) (screen, link, version, date, decision, owner's words) and the
  question is logged in `OWNER-REQUESTS.md`.
- **Rationale**: clarification Q3 (per screen); the owner judges coherence by seeing the
  screens together.
- **Alternatives**: screenshots of branches (rejected: forces implementation before approval).

## R5. Courier progress on the board

- **Decision**: add `stopMarks` to `RouteSummary` in the `/api/routes/board` response: the
  route's stops in completion order, each `{ kind: "pickup" | "delivery", state: "done" |
  "exception" | "pending" }`, derived by a domain function from data already loaded for the
  summary. The board joins it with the existing counts, last sync, late, at-risk, and pending
  handovers.
- **Rationale**: the summary already carries everything else; the marks need no new data,
  only a projection of stops the server already reads. Additive field, inferred by Hono RPC.
- **Alternatives**: one request per route detail (rejected: N requests every 30 s); a new
  board endpoint (rejected: duplicates `/routes/board`).

## R6. "Por resolver" as a domain rule

- **Decision**: `packages/domain/src/attention.ts` turns the board's shipments (with their
  record flags and a new additive `pendingHandover`, since the board does not carry handovers
  today) into ordered items: exceptions to decide, late, pending
  handovers, at risk, pickup problems; ties by delivery window end. Owner-only items (fee to
  review) are included only for the owner. The board shows the first five; "Además" counts
  the minor flags (different COD, to review, photo skipped, fee to review).
- **Rationale**: the order decides what the dispatcher acts on first; it is a business rule
  and must be tested first and defined once (Constitution III, VI).
- **Alternatives**: ordering inside the React component (rejected: untestable rule in UI).

## R7. Shared components

- **Decision**: extend the existing components and add only repeating patterns:
  `PageHeader` (title, sentence, one primary action), `SummarySentence`, `StageCounts`
  (counts plus progress bar, acting as filters), `AttentionList`, `StateMark` (shipment and
  route states, exists), `TrackingNumber`, `Money`, `DataList` (grid rows, sticky header,
  bounded first page, "Ver todos"), `FilterBar`, `SidePanel` (on shadcn `Sheet`), `EmptyState`
  (exists), `QueryState` (exists), `ThemeSwitch`, `Wordmark` (exists). Contracts in
  [contracts/components.md](contracts/components.md).
- **Rationale**: FR-005 requires one look per element; Constitution I forbids wrappers
  without a repeated need.
- **Alternatives**: a full component library rewrite (rejected: shadcn primitives already fit).

## R8. Color and identifier guards

- **Decision**: a Vitest check in `apps/web` fails on color literals (`#hex`, `rgb(`,
  `hsl(`, `oklch(`) in `apps/web/src/**` outside `styles/tokens.css`; an e2e helper scans the
  visible text of each visited screen for UUID-shaped strings.
- **Rationale**: SC-005 must be measured, not reviewed by eye.
- **Alternatives**: ESLint custom rule (rejected: more code than a test for the same check).

## R9. Accessibility in both themes

- **Decision**: the e2e fixture that runs axe after each passing test also runs it with
  `data-scheme="dark"` on panel and public pages, and at 390 px for the courier app and public
  pages. Target sizes: 24 px panel, 48 px courier (Constitution VII).
- **Rationale**: SC-004 covers both themes; most contrast regressions appear in dark.
- **Alternatives**: manual audits per slice (rejected: not repeatable).

## R10. Audit log names

- **Decision**: `/api/audit-events` adds `entityLabel` (the record's name, or the tracking
  number for shipments) and `changeLabels`, the names of the records that reference fields in
  `changes` point to (merchant, courier, carrier, neighborhood, user, rate zone), resolved in
  the same request; `changes` keeps its `[from, to]` shape.
  Raw identifiers stay in the response for links but are never rendered.
- **Rationale**: FR-020; the defect was found in the readiness audit.
- **Alternatives**: resolving names in the browser with extra requests (rejected: N requests,
  and users or deactivated records may not be listable).

## R11. CSP-compatible styling

- **Decision**: all styles come from bundled CSS (Tailwind classes and `globals.css`);
  computed sizes (progress bars, segment widths) use the `style` attribute, which the policy
  allows. No runtime `<style>` elements, no CSS-in-JS.
- **Rationale**: `style-src-elem 'self'` is enforced and tested (`csp-styles.spec.ts`).

## R12. Performance and size

- **Decision**: no new dependency; Archivo and Material Symbols are already bundled; the
  board adds one field to an existing request. The build's total JavaScript and CSS size is
  recorded before slice 1 and checked at each slice (at most +10 %). The courier route screen
  keeps its current data path.
- **Rationale**: SC-008 and Constitution I.

## R13. Slices and branches

- **Decision**: branches `006-us1-foundation`, `006-us1-board`, then one per screen or pair
  (`006-us2-new-shipment`, …), each with its proposal approved first; navigation and URLs do
  not change, so no slice needs hiding.
- **Rationale**: Trunk-Based Development; each slice is visible and safe on merge because the
  new shell and tokens apply to every screen at once.
