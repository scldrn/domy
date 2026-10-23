# Durable account client — 001/T132 executor receipt

2026-10-20 (America/Bogota), local shared branch `codex/local-readiness-orchestration`.
This is the frontend executor's evidence, not task closure. The orchestrator owns independent
Level 2 review, server evidence, integrated gates and canonical checkboxes.

## Behavior and boundaries

`apps/web/src/features/users/account-intents.ts` validates persisted actor, operation,
target, public input and UUID with strict Zod schemas. Short actor/target Web Locks protect
read/check/write; networking runs after releasing them. Matching tabs share the same UUID;
other pending operations or changed input cannot overwrite it. ACK deletes only its matching
identity. Malformed/unavailable storage blocks networking without deleting data. The only
error that releases an intent is HTTP 400 with the verified native admin code
`USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`; generic 400, 403, 401, 409, network errors, 5xx
and malformed ACKs retain it. A single predicate governs this and zero-ACK workflow release.

`account-workflow.ts` stores the public form, original account, fixed phase IDs, phase ACKs
and native created-user ID. Create→link and profile→role/link resume in valid role order,
skipping acknowledged phases. Fixed phase IDs cover a crash between API ACK and workflow
ACK persistence. Passwords remain memory-only; the complete shared creation schema validates
new forms and password re-entry before acquiring new metadata or networking. Invalid fresh
forms persist nothing; empty/invalid re-entry retains earlier pending work. Acknowledged
creation skips password re-entry for its remaining link phase.
Runtime-validated link ACKs must identify the intended courier/account (or null when unlinking).

The dialog restores pending public values on reopen/reload and reports partial failure.
Accounts retain explicit retry controls for uncertain ban/unban/session-ending operations,
even when refreshed account state would hide the original action. Different new mutations
stay blocked until recovery. Pending creations point to **Nueva cuenta**; edits point to
**Editar**. Query invalidation on every dialog outcome releases recovered controls without
reload. Cross-tab storage changes refresh recovery controls.

The authorized shared edits are an optional stable action UUID in `master-data/api.ts`
(preserving its inferred Hono response and default generation) and semantic error markup in
`master-data/form-dialog.tsx` (`div[role=alert] > ul > li`). No server implementation,
reviewer checklist, task checkbox, deployment or remote CI was modified by this executor.

## Retained RED evidence

All logs are local under `.git/local-orchestration/`; browser traces remain in ignored
private test output and must not be published (they may contain synthetic credentials).

- `t132-web-red.log`: 5 behavioral failures / 7 existing passes before durable intents.
- `t132-web-phases-red.log`: zero-ACK definite rollback failed to release workflow.
- `t132-web-lifecycle-red.log`: uncertain ban allowed an opposite operation, risking stale
  receipt reuse and a false later success. Actor/target coordination and recovery fix it.
- `t132-web-browser-first.log`: 16/18 passed; two actual axe `listitem` violations on
  error-state FormDialog markup. Assertions were retained and the markup corrected.
- `t132-web-cache-red.log`: successful link recovery left ordinary account controls disabled;
  the pending query now invalidates on every dialog outcome.
- `t132-web-link-ack-red.log`: 7 failures proved malformed/wrong/null link ACKs were accepted.
- `t132-web-validation-red.log`: 3 failures proved generic 400/403 release and missing local
  password validation could discard an earlier uncertain committed creation.
- `t132-web-fresh-validation-red.log`: two failures proved invalid fresh creation persisted
  workflow metadata and uncertain reload password failure was not guarded before acquisition.
  One shared domain-backed guard now runs before creating metadata, while acknowledged
  creation skips password re-entry.
- `t132-web-validation-import-failure.log`: a missing import during the predicate refactor,
  corrected before GREEN; not a product RED.

The intermediate five-browser run `t132-web-browser-final.log` had four passes and one
cross-tab fixture failure: its uniqueness assertion inspected the losing tab's unchanged
list cache. The symmetric assertion now checks the tab that actually completed, while
requiring both tabs to settle and both to pass axe. No request-order assumption remains.

## Local Level 1 verification

- Unit command: `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/web exec vitest run src/features/users/api.test.ts src/features/users/account-intents.test.ts src/features/users/account-workflow.test.ts` — **43/43 PASS**, three files, exit 0 (`t132-web-unit-final.log`).
- `pnpm --filter @domy/web typecheck` — exit 0 (`t132-web-typecheck.log`).
- Scoped ESLint with `--max-warnings 0` on users sources/tests, users route, the two shared
  master-data files and `tests/e2e/account-idempotency.spec.ts` — exit 0 (`t132-web-eslint.log`).
- Formatting is checked from repository root; final output in `t132-web-prettier.log`.
- `env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/web exec playwright test tests/e2e/account-idempotency.spec.ts tests/e2e/access.spec.ts` — **18/18 PASS**, 46.3 s, no retries (`t132-web-browser-second.log`). This includes the shared accessibility correction and cache recovery regression.
- After link-ACK validation and conservative rollback refinement: **5/5 PASS**, 20.3 s,
  no retries (`t132-web-browser-confirmed.log`). The last pre-acquisition validation change
  is followed by another fresh built five-case run in `t132-web-browser-guard-final.log`;
  its final result is **5/5 PASS**, 20.0 s, exit 0, no retries.

Playwright's existing global setup builds the real service worker/bundle, starts real
PostgreSQL/photo storage, migrates/seeds the API and uses existing role fixtures. Full axe
coverage remains enabled, including explicit scans of both concurrent tabs. No test limits,
retry policy, existing access assertions or accessibility checks were relaxed.

## Practical limits

A concurrent tab whose identical workflow already completed elsewhere may conservatively
ask to reopen rather than announce success; no tombstone or fabricated ACK is persisted.
Unknown/conflicting 4xx responses deliberately remain pending; only the proven native
email-conflict rejection can release zero-ACK work for correction. These tests cover the
built Chromium app locally, not Android/iPhone physical acceptance, an external pipeline
or deployment. No password, hash, fingerprint, cookie or session token enters browser
intent/workflow metadata. All four integrated quality gates and server/client convergence
remain the orchestrator's responsibility before T132 closes.

## Cross-tab actor binding follow-up

The client now sends the actor from the validated `AccountContext` as
`X-Domy-Actor-Id` for all six native admin account mutations. Courier-account linking sends the
same expected actor through Hono's request headers while preserving the link phase's fixed action
UUID in its JSON body. `authCall` still returns `unknown`, accepts optional headers, and validates
error envelopes; `actor_changed` maps to the server's Spanish recovery message. No session
preflight was added, so the server comparison remains authoritative at mutation time.

The browser regression keeps owner A's form and intent open, signs in as owner B in a second tab
through the real same-origin authentication endpoint, then submits from A's stale UI. It asserts
409 `actor_changed`, the explanatory alert, retained A metadata without a password, and no B-side
account effect. After signing A back in, the same creation UUID succeeds. Both pages retain full
axe scans. The pre-guard real-browser RED is recorded in
`.git/local-orchestration/actor-web-browser-red.log`: under cookie B, the stale A mutation returned
200 and produced one B-side account effect. The pre-guard observation and initial fixture setup
failures are retained in that log; only the observed 200/effect was product RED.

## Actor follow-up local verification

- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/web exec vitest run src/features/users/api.test.ts src/features/users/account-intents.test.ts src/features/users/account-workflow.test.ts src/features/auth/session.test.ts` — **62/62 PASS** (`actor-web-unit-final.log`).
- `pnpm --filter @domy/web typecheck` — exit 0 (`actor-web-typecheck-final.log`).
- Scoped ESLint with `--max-warnings 0` and scoped Prettier check over the changed web sources,
  tests and account E2E — exit 0 (`actor-web-eslint-post-e2e.log`,
  `actor-web-prettier-post-e2e.log`).
- The six-test actor/idempotency browser run passed **6/6** in 23.5 s
  (`actor-web-browser-focal-2.log`).
- `env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/web exec playwright test tests/e2e/account-idempotency.spec.ts tests/e2e/access.spec.ts` — **19/19 PASS** in 49.8 s, no retries (`actor-web-browser-final.log`). This covers all 13 access cases and six account-intent cases with the built service worker and full axe checks.

An initial full browser run exposed test-fixture issues, not product regressions: the test signed out
the shared seeded owner before switching to B, then attempted A recovery with a different fixture
password. After switching both tabs through actual browser sign-in without revoking A's session, a
focused run exposed only an incorrect expected heading after reload at `/usuarios`; that assertion
now checks the page's actual heading and verifies the restored actor ID. The final focused and full
runs above pass. These diagnostic failures do not replace or weaken the server-side actor guard.

## Integrated orchestrator acceptance — 2026-10-20

Root independently inspected the implementation, contracts and permanent regression
coverage, then ran the four complete local gates sequentially on frozen source
`7d4227587e1661a45cd8c0ea4b14ee0efabd0b0a2cfaecfe359d78b865544d1d`
(440 source/config/test files; base `94a7e2450ec2abae4192f7f864e34c4638f7c963`).
The before/after source fingerprints match.

- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm check`: exit 0.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm test`: exit 0; 1,215 tests
  (283 domain, 655 server, 277 web), including isolated capacity projects.
- `env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm test:e2e`: exit 0;
  106/106 first-attempt Chromium scenarios, 5.7 minutes, including full axe coverage.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm build`: exit 0.

Actual logs: `.git/local-orchestration/n2-batch2-actor-{check,test,e2e,build}.log`;
source inventories: `batch2-actor-candidate-{before,after}.json`. No gate warning or retry
was observed. Earlier failed/interrupted attempts remain historical evidence. Root
approved this task's local closure after both QA levels; this does not certify physical
Android/iPhone acceptance, provider configuration or production readiness.
