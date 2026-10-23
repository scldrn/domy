# Courier account-link readiness — 003/T135 executor receipt

2026-10-20 (America/Bogota), local shared branch `codex/local-readiness-orchestration`.
This receipt records executor evidence for T135; root owns independent review, integrated
quality gates and canonical task closure. No task checkbox, shared backlog or status record
was closed by this change.

## Behavior

`AccountDialog` refreshes the unfiltered courier collection when it opens. The UI distinguishes
an unknown link (`undefined`) from a loaded unlinked account (`null`), blocks courier-affecting
saves until the read succeeds, and offers a Spanish retry after failure. It keeps the current
relationship visible if its courier has since become inactive, while omitting other inactive
couriers as new choices. The submit handler checks readiness before invoking T132's persisted
workflow. An unchanged relationship skips the link phase; explicit unlink and relink continue
to use the existing persisted action UUIDs. No `account-workflow.ts` or `account-intents.ts`
behavior was changed.

## Retained RED evidence

- Unit RED: `pnpm --filter @domy/web exec vitest run
  src/features/users/account-dialog.test.ts` exited 1 with 1/3 passing. The two failures
  showed that an unknown courier list was collapsed to unlinked and that the query still
  filtered out inactive couriers. The inactive relationship lookup passed.
- Real held-GET browser RED: `env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter
  @domy/web exec playwright test tests/e2e/courier-account-readiness.spec.ts -g 'does not
  unlink'` exited 1. With real PostgreSQL and a real owner session, the test created and linked
  a courier account, held the browser's real courier-list GET while Edit opened, released its
  200 response, then saved without changing the form. The final real courier list showed the
  courier's `account` as absent rather than the account UUID. Its dialog axe scan passed before
  the effect assertion. The retained private output is
  `.git/local-orchestration/account-web-held-get-red.log`.

## Local Level 1 evidence

- `pnpm --filter @domy/web exec vitest run src/features/users/account-dialog.test.ts src/features/users/account-intents.test.ts src/features/users/account-workflow.test.ts` — **32/32 PASS**, three files.
- `pnpm exec eslint apps/web/src/features/users/account-dialog.tsx apps/web/src/features/users/account-dialog.test.ts apps/web/tests/e2e/courier-account-readiness.spec.ts --max-warnings 0` — exit 0.
- `pnpm exec prettier --check apps/web/src/features/users/account-dialog.tsx apps/web/src/features/users/account-dialog.test.ts apps/web/tests/e2e/courier-account-readiness.spec.ts specs/003-courier-app/plan.md specs/003-courier-app/research.md specs/003-courier-app/contracts/http-api.md` — exit 0.
- `git diff --check -- apps/web/src/features/users/account-dialog.tsx specs/003-courier-app/plan.md specs/003-courier-app/research.md specs/003-courier-app/contracts/http-api.md` — exit 0. New T135 files pass the scoped Prettier check above.
- `env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/web exec vite build` — exit 0; client bundle and service worker generated.
- `env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/web exec playwright test tests/e2e/courier-account-readiness.spec.ts tests/e2e/account-idempotency.spec.ts tests/e2e/access.spec.ts` — **22/22 PASS** on the first attempt in 1.1 minutes, one Chromium worker. This includes all 3 readiness scenarios, the existing 6 idempotency/recovery scenarios, and all 13 access scenarios with axe coverage. The real browser scenarios preserve an inactive existing relationship, exercise an explicit unlink and relink, and abort courier-list requests before a real retry; no database mocks, Playwright retries, forced clicks, or axe suppressions were used.

The Playwright global setup rebuilds the web app and service worker after its real PostgreSQL
setup. The T137 executor confirmed its shared source edits were frozen before the direct Vite
build and made no edits before the setup build completed. The browser suite then ran against
that immutable bundle. Its output is retained privately at
`.git/local-orchestration/account-link-readiness-green.log`; browser traces remain in ignored
test output and are not published.

The existing actor-idempotency cases still cover create response loss and reload, a lost link
ACK after create, storage failure, matching pending tabs, ban recovery and the actor-change
case. T135 did not duplicate or weaken these cases.

## Integrated checks and limits

`pnpm --filter @domy/web typecheck` remains pending integrated convergence. The latest shared
tree run failed only in T137 shipment sources: a `useFormDraft` merchant type mismatch in
`src/features/shipments/shipment-form.tsx`, plus missing `toast` and a discriminated-input
type mismatch in `src/routes/shipment-bulk.tsx`. An earlier shared-tree attempt also observed
intermediate missing helper exports in `src/features/shipments/use-form-draft.test.ts`; those
exports were subsequently added by T137. These files are outside T135 ownership and were not
changed here. Root owns the final typecheck and four integrated gates after T137 converges.
After T137 resumed source work, a full-tree `git diff --check` also reported a trailing blank
line at `src/routes/shipment-bulk.tsx:400`; the scoped T135 diff check remains clean.

The browser coverage validates the built local Chromium app against PostgreSQL, not physical
Android/iPhone behavior or production hosting. A transport failure is represented by aborting
the real browser request in Playwright; retry and subsequent success use the actual endpoint.

## Root N2 checkpoint — 2026-10-21

The shared web typecheck subsequently passed. Root independently ran the complete
`pnpm check` and `pnpm test`: both passed, including 1,241 tests (283 domain,
655 server, 303 web). Source SHA256 was
`515869a0580da7cee5ca25474f800a12da94b6d6a76edcb90cb7ca950a8b43ff`
before and after the full browser run. The first static attempt's unnecessary
merchant assertion was removed and independently validated before this candidate.

Full browser N2 passed 120/121 cases in 6.8 minutes with no retries. The remaining
T137 ACK-rotation case found a real hit-test obstruction: 51 duplicate tracking
numbers and storage alerts make the sticky footer obscure form fields. Preserve
`n2-drafts-links-e2e.log` and the trace in
`.git/local-orchestration/n2-drafts-links-attempt1-browser/`. A causal regression
and layout correction are underway; final build and successful integrated N2 remain
pending. Neither task is closed by this checkpoint.

## Root acceptance — 2026-10-21 (America/Bogota)

Executor N1 and independent root source review/local N2 approve this task. The
repaired 450-file source stayed identical before and after all gates: SHA256
`1e348e85e314145433fedeb4d027245bcac36c386cd10f67fa80dff273389dbd` (dirty tree, base `94a7e24`). Full `pnpm check`,
`pnpm test` (283 domain + 655 server + 303 web = 1,241),
`env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm test:e2e`
(121/121, first attempt, 6.2 minutes), and `pnpm build` all exit 0.
Logs: `.git/local-orchestration/n2-drafts-links-repaired-{check,test,build}.log`
and `n2-drafts-links-awake-e2e.log`. The awake browser interval was
06:05:35–06:11:49, with zero native Sleep events. Failed attempts remain recorded
above and in the local ledger; no retries, budget changes or axe suppressions.
The deterministic 50+ duplicate RED/repair/GREEN retained all warning contents,
recovery controls and identity assertions. This closes the owning technical task
locally; physical Android/iPhone acceptance and release remain separate obligations.
