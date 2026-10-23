# T137 Form draft recovery evidence

## Scope

`001/T137` validates shipment, edit, and bulk drafts at the browser storage boundary. Valid
legacy values remain recoverable. Malformed or unknown data stays available as a local copy
until the user explicitly discards it. Exact create, edit, and bulk requests are stored before
network activity and retained after uncertain outcomes. A generic `invalid_request` does not
clear a pending UUID automatically; replacing a rejected intent requires downloading its exact
copy, reviewing shipment history, and explicitly preparing a fresh persisted intent.

The design and browser-storage contract are aligned in R20 of `plan.md`, `research.md`, and
`contracts/http-api.md`. No server schema, endpoint, or migration change is part of T137.

## RED evidence

Pre-fix browser runs reproduced these failures:

- `.git/local-orchestration/draft-red-browser-final.log`: the valid-JSON wrong-shape draft did
  not reach local recovery; malformed data had no recovery action; after a lost bulk ACK, the
  second request used different batch/row IDs, both requests returned `201`, and two matching
  rows existed.
- `.git/local-orchestration/draft-red-single-repeat.log`: after the first shipment request
  committed with `201` and its response was lost, reload followed by a changed form produced a
  second `200` with the same UUID but a different payload. The original reference existed once
  and the changed reference did not exist. This showed the UI could receive a replay ACK for data
  it had not submitted.
- `.git/local-orchestration/draft-red-single.log` is an earlier setup attempt that received a
  connection error before proving the changed-payload replay behavior; it is preserved but is not
  counted as RED evidence.

## Implemented behavior

- Zod validates the storage envelope and incomplete shipment form shapes before mounting form
  consumers. Unknown or malformed raw values are preserved for local recovery and never logged.
- Legacy merchant options and synthetic edit view-model IDs remain readable. Stale unsent edit
  drafts require review and an explicit reload; pending updates keep their saved `baseVersion`.
- Pending single mutations are tied to the visible form, route, target, and identity through the
  existing form mappers. The exact request is stored before sending and remains read-only until a
  validated ACK permits a durable draft rotation.
- Bulk drafts store exact batch and row IDs plus remaining source rows. ACKs are checked against
  the ordered pending identities before the remaining rows are restored.
- Storage read/write failures preserve values and block network mutations until the relevant
  recovery or save action succeeds. For `invalid_request`, the exact pending request remains
  locked until the user downloads it, reviews history, and confirms a fresh intent.

## Local verification

Focused unit tests passed: four Vitest files, 26 tests. `pnpm --filter @domy/web typecheck`,
scoped ESLint with `--max-warnings 0`, scoped Prettier check, and `git diff --check` passed on the
frozen source.

The integrated browser command ran 29 tests with the global setup build and real PostgreSQL:

```sh
env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/web exec playwright test tests/e2e/form-draft-recovery.spec.ts tests/e2e/form-draft-ack-rotation.spec.ts tests/e2e/form-draft-rejection-recovery.spec.ts tests/e2e/register-shipment.spec.ts tests/e2e/edit-void-shipment.spec.ts tests/e2e/bulk-registration.spec.ts
```

The first integrated attempt passed 27/29; the two new rejection checks had stale assertions
about the review screen and an omitted bulk service date. The second integrated attempt passed
28/29: bulk rejection and all existing recovery, rotation, registration, edit, and bulk tests
passed. The remaining single-rejection failure expected the form controls to disappear; the
actual UI correctly keeps them visible and disabled while the pending request is under review.
The spec was corrected to assert visible disabled controls, preserved field values, the exact
pending snapshot, and one request before explicit review.

After that correction, the single-rejection browser test passed 1/1 in its own fresh run with
global setup. The recorded N1 result is therefore **28/29 integrated plus 1/1 corrected focal**;
this is not a claim that one integrated invocation passed 29/29. The exact logs remain in
`.git/local-orchestration/form-draft-n1-final-attempt1.log`,
`.git/local-orchestration/form-draft-n1-final-attempt2.log`, and
`.git/local-orchestration/form-draft-rejection-single-final.log`.

Full root N2 verification remains pending before T137 can be closed.

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
