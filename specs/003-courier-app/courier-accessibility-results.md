# 003/T083 — Courier accessibility and short action paths

Date: 2026-10-21 (America/Bogota). This receipt records the local T083 browser and
focused web checks. The interaction design was aligned in `plan.md` and research R19
before the behavior change: the full delivery/exception review and explicit confirmation
remain, while the normal path removes a redundant screen transition. The design system's
existing 48 × 48 px and high-contrast requirements remain authoritative. No task checkbox,
shared status/DAG, API contract, database schema, or business rule changed in this slice.

## Requirement-to-test map

| Requirement | Evidence |
| --- | --- |
| FR-038: pickup, delivery, and exception within three taps from “Mi ruta” | `apps/web/tests/e2e/courier-accessibility.spec.ts` counts actual clicks on the route and its task sheet. Pickup is stop → confirm (2); ordinary delivery is stop → open the full delivery review → confirm (3); an exception is stop → choose one of the three explicit domain reasons, which opens its review → confirm (3). No field edit or photo is required for these normal paths; those optional actions can add taps. |
| WCAG 2.2 AA, 48 px targets, standard and high-contrast schemes at 360 × 800 | All three accessibility cases call the existing `assertCourierScreen` checks in both schemes. It runs axe and verifies target size/hit access without forced clicks. The browser suite also retains the existing Mi ruta, delivery, exception, tap-count, and focus/notification checks. |
| Pending and Mi Día while offline | New standard/high-contrast cases perform a real courier pickup after switching the browser context offline, then verify the actual pending record, tracking number, count, and Mi Día warning/pending total. |
| Correction controls remain available and labeled | New standard/high-contrast cases open delivery correction and exercise the proposed recipient, payment options, and optional photo control; the exception correction case checks each label from `exceptionReasons`, the selected reason, note, and optional photo control. These cases run the axe and target checks on the correction screens too. |

The test data is synthetic and uses the normal local browser fixtures, built application,
service worker, and real local API/database. The offline test leaves synchronization pending
to inspect the real local record; it does not mock a rendered screen or the database.

## RED evidence and aligned change

The retained real-browser RED for the original action path is documented in
`research.md` R19 and `.git/local-orchestration/t083-tap-count-red.log`: against the built
app and real API/PostgreSQL, both schemes completed the three actions but observed 2/4/5
taps instead of 2/3/3. The failure was limited to the tap-count assertions. The aligned
review layout now opens delivery directly into its complete, editable review and opens an
exception review only after the courier selects an explicit reason. Neither flow saves until
the courier confirms. Optional photo and correction remain available. The delivery and
exception review-to-correction transition also moves focus to the stable sheet before
removing the focused review button, preserving the existing T154 focus/notification
regression.

The root's post-change focused browser evidence is
`.git/local-orchestration/t083-root-active-surface.log` (6/6, including both schemes and
the tap counts); the retained focus correction evidence is
`.git/local-orchestration/t083-root-focus-scroll-correction.log`. The final full courier N1
runner passed **36/36** in 2.7 minutes, first attempt, with one worker and no retries:

```sh
env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm --filter @domy/web exec playwright test tests/e2e/courier-account-readiness.spec.ts tests/e2e/courier-action-taps.spec.ts tests/e2e/courier-accessibility.spec.ts tests/e2e/courier-day.spec.ts tests/e2e/courier-offline.spec.ts tests/e2e/courier-changes.spec.ts tests/e2e/courier-route.spec.ts tests/e2e/courier-exceptions.spec.ts tests/e2e/exception-decision.spec.ts
```

The captured output is `.git/local-orchestration/t083-courier-full-n1.log`. Playwright
screenshots, traces, and per-test artifacts are retained under
`.git/local-orchestration/t083-courier-full-n1-browser/`; `.last-run.json` records
`status: passed` and an empty `failedTests` list. Screens include standard/high-contrast
Mi ruta, full delivery review, exception reason/review, correction controls, online Mi Día
and Pending, and offline Pending/Mi Día. They use synthetic fixture data.

## N1 focused checks

The focused web unit run passed **5 files, 22 tests**:

```sh
SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/web exec vitest run src/routes/courier-stop.test.tsx src/features/courier/delivery-rules.test.ts src/features/courier/collection-fields.test.tsx src/features/courier/sync-status.test.ts src/features/courier/notice-list.test.tsx
```

These scoped checks also passed:

```sh
pnpm --filter @domy/web typecheck
pnpm exec eslint apps/web/tests/e2e/courier-accessibility.spec.ts --max-warnings 0
pnpm exec prettier --check apps/web/tests/e2e/courier-accessibility.spec.ts
git diff --check
```

The final 36-case Playwright command invokes the repository's global setup, which builds
and serves the real local application and service worker. Root independently reported the
global check pass in `.git/local-orchestration/n2-t083-final-check.log`; the integrated
N2 full-suite/E2E/build review remains with root.

## Limits

This evidence covers automated local Chromium at 360 × 800 px in standard and high-contrast
schemes. It does not claim physical Android/iOS acceptance, LAN reachability, or completion
of T087/T093 device and target validation. No retries, forced interactions, axe exclusions,
or increased test budgets were used.


## Root N2 approval — 2026-10-21

Root inspected the source, retained native browser diagnostics and screenshots, and
received an independent Luna/max source audit without blocking findings. Final
`pnpm check`, 1,281 unit/integration tests, 129 first-attempt E2E (7.6 minutes) and
`pnpm build` passed locally. Logs: `.git/local-orchestration/n2-t083-final-check.log`,
`n2-t083-test.log`, `n2-t083-e2e.log`, `n2-t083-build.log`. Final 459-file source
`3b51b24f3a7781b21c8e7fdeaf77a6843b9fd156a131204eba3f3d31674823fe` matched before/after browser/build checks.

The unit run preceded only the four additional E2E cases; exact reconstruction in
`n2-t083-unit-source-provenance.json` proves every other file was identical. No test
budget, assertion, axe rule or warning was suppressed. The browser interval
15:23:27–15:31:04 had zero native Sleep events. T083 is locally verified; phone
acceptance and T084 remain separate prerequisites.
