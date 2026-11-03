# Quickstart: Validating the Redesign

How to prove each slice works. Commands run from the repository root (see `CLAUDE.md`).

## Prerequisites

```bash
cp .env.example .env && pnpm install
docker compose up -d
pnpm db:migrate && pnpm db:seed
```

## Every slice

1. `pnpm tokens` and `pnpm icons` leave no diff (generated files are current).
2. `pnpm check`, `pnpm test`, `pnpm test:e2e`, `pnpm build` pass with zero warnings; no test
   removed (SC-007). Axe runs in light and dark, desktop and 390 px (SC-004, research R9).
3. The color-literal check and the identifier scan pass (SC-005, research R8).
4. Bundle size within +10 % of the baseline recorded in slice 1 (research R12).
5. Each changed screen matches its `approved` row in [proposals.md](proposals.md).

## Foundation slice

- `pnpm dev`, sign in as owner: rail, top bar, wordmark, and colors are the new ones on
  every panel screen; the theme switch changes light and dark and survives a reload; with no
  choice stored, the panel follows the computer.
- Keyboard only: focus is visible on every control in both themes.

## Board slice

- With the demo data (`apps/server/demo/`), at 1440×900: day sentence, stage counts, first
  five items to resolve, and every active courier visible without scrolling (SC-002); board
  at most two screen heights.
- Each "Por resolver" action does what the same action does today; dispatching a route
  from the courier list behaves as today (US1 scenarios 2–3).
- `pnpm --filter @domy/domain exec vitest run src/attention.test.ts src/route-stop-marks.test.ts`
- `pnpm --filter @domy/server exec vitest run tests/routes-board.test.ts`

## Courier slice

- `pnpm --filter @domy/web exec playwright test tests/e2e/courier-offline.spec.ts tests/e2e/courier-action-taps.spec.ts`
  stays green (FR-016); on a low-end Android, the route screen appears no slower than the
  recorded baseline (SC-008).

## Administration slice

- Change a client and a user, open "Auditoría": names, never identifiers (FR-020).
- `pnpm --filter @domy/server exec vitest run tests/audit-events.test.ts`
