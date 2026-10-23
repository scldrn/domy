# Account intent idempotency — 001/T132

## Scope and current status

Local implementation checkpoint only. Server execution evidence below does not close
canonical T132: browser lifecycle/workflow coverage, independent orchestrator review,
and the four full local gates remain required. No commit, push, PR, remote workflow or
deployment was performed. Root owns task/backlog status markers.

## Design and analysis

Research R19, plan T132 alignment, HTTP authentication contract and account-action
receipt model were aligned before production changes and reviewed by the orchestrator.
Prerequisites T130/T131 (native transaction/guards) and T136 (native typed boundary)
were verified by the orchestrator before delegation. Read-only analysis and ignored
local command logs live under `.git/local-orchestration/`.

Every account mutation requires a client intent UUID, bound to the current owner,
operation, target and normalized public input. Receipts include successful no-ops;
changed-only audit and native writes commit atomically with them. Replays return the
original allowlisted success before target guards, preserve later changes and do not
replay cookies. Creation maps intent UUID to the native user UUID; no password or
credential derivative is stored or compared. Generated migration:
`apps/server/src/db/migrations/0008_purple_red_hulk.sql`.

Native Origin/CSRF checks execute before both new actions and receipt replay, using
Better Auth's public primitive and configured native context. Root and transaction auth
share the existing Pino logger through the supported native callback; level and fixed
diagnostic event remain, while raw native message/arguments cannot expose private
Origin/Referer URLs. Unexpected faults retain the existing sanitized Hono handler.

## RED evidence

- Original IV-19 ban A → unban B → late A fails against the prior implementation:
  `t132-red-iv19.log`; independently reconfirmed `t132-red-v2.log`.
- Strengthened permanent HTTP UUID/replay contracts fail 11/11 before implementation:
  `t132-contract-red.log`; domain UUID regression also fails (`t132-domain-red.log`).
- Cross-tab actor binding now has an actual PostgreSQL RED in
  `.git/local-orchestration/actor-server-red.log`: both focused server files ran 29 tests;
  25 passed and four failed on the missing behavior (native cookie/header mismatch,
  missing/malformed native actor header, and courier-link cookie/header mismatch). Existing
  successful native and link cases passed with explicit actor/UUID fixtures. The mismatch
  tests' post-status no-effect assertions are retained for the implementation run; this RED
  establishes only that the prior server returned 200 instead of the required refusal.
- A first security regression incorrectly expected native checks under Vitest's native
  test defaults and failed. Better Auth captures its environment at import time, and
  Vitest also sets `TEST=true`. The permanent probe launches Node 24 with explicit
  `NODE_ENV=production` and `TEST=''`; the parent environment and production policy are
  untouched. Input is stdin-only and output contains only declared status/boolean facts.
  No separate logging-disclosure RED is claimed: that risk was identified by inspection
  and covered by the production-boundary regression.

## Executor local validation

Commands run from the repository root with empty Sentry DSNs:

- `pnpm --filter @domy/domain exec vitest run src/schemas/account.test.ts` — 24 PASS.
- `pnpm --filter @domy/server exec vitest run tests/account-idempotency.test.ts` —
  14 PASS, 6.03 s, actual PostgreSQL 18. Covers ban/profile/role/unban A→B→A,
  concurrent duplicates, conflicting actor/operation/target/input, no-op audit behavior,
  native creation identity and safe payloads, self-revocation/relogin, changed and
  unchanged session-ending replays, audit/receipt rollback, active-owner revalidation,
  and native production Origin refusal for new/replayed actions (malicious origin,
  missing header and malicious Referer), without private diagnostics or consumed intents.


- Expanded adjacent suite: `pnpm --filter @domy/server exec vitest run
  tests/account-idempotency.test.ts tests/account-integrity.test.ts
  tests/auth-lockout-recovery.test.ts tests/auth-sessions.test.ts
  tests/courier-accounts.test.ts tests/role-permissions.test.ts` — 6 files / 159 tests
  PASS, 17.72 s (`t132-server-expanded.log`).
- After making stdin's stream boundary explicitly `unknown`→string, the isolated
  production Origin regression passes again (`t132-production-origin.log`). The earlier
  incorrect test-default security failures are preserved in focused investigation logs;
  they are not hidden by retries or removed assertions.
- Server typecheck, scoped ESLint (`--max-warnings 0`), scoped root Prettier check and
  `git diff --check` — PASS. All generated migration files retain generator formatting.

Files include the account domain schema/test, account receipt schema/export/generated
migration, transaction auth route, native auth factory logger wiring (app/seed/test setup),
HTTP regression suite and production probe, and explicit UUIDs in adjacent HTTP/E2E
fixtures. Browser source files and canonical task/status checkboxes are owned separately.

## Independent orchestrator server checkpoint

Root reviewed the generated migration, receipt schema, native auth logger configuration,
transaction/replay ordering, runtime success projection, strict domain inputs and retained
fixture assertions. Root also inspected the production child probe and confirmed the
stdin-only credential boundary, native Origin checks and bounded safe output.

Independent local commands with empty Sentry DSNs:

- The same six-file account/session/role integration suite: **159/159 PASS**, exit 0,
  15.88s (`n2-t132-server-focused.log`).
- `pnpm --filter @domy/server typecheck`: exit 0 (`n2-t132-server-types.log`).
- `pnpm --filter @domy/server exec vitest run tests/log-redaction.test.ts tests/reporting-privacy.test.ts`:
  **27/27 PASS**, exit 0, 3.38s (`n2-t132-privacy-adjacent.log`).
- Current-journal tooling verification independently passes fresh DDL and historical
  upgrade/replay including migration 0008; see the T129 receipt.

These results verify the server sub-slice; they do not close T132 or unlock its dependent
tasks. Browser recovery, the newly identified cross-operation pending-intent sequence,
and full integrated local gates remain required.

## Confirmed native refusal and browser release policy

The later actual-PostgreSQL regression confirms creation with an already-used email
returns native `400` / `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`, preserves every existing
user and writes neither receipt nor audit. The same failed intent UUID can subsequently
create exactly one user with corrected public input, producing one receipt and audit.
`pnpm --filter @domy/server exec vitest run tests/account-idempotency.test.ts` now passes
15/15 in 6.93 s (`t132-server-native-refusal.log`); scoped ESLint and server typecheck pass.
No production server change was needed for this additional proof.

This is specific evidence for the native duplicate-email refusal after receipt lookup;
it does not establish that arbitrary 4xx responses prove no prior committed intent.
In particular, wrapper validation of a malformed retry can fail before receipt lookup
following an earlier lost success acknowledgment. Client policy must preserve that
uncertainty and only release an intent for an explicitly proven native rollback code.

## Cross-tab actor binding — local server verification

The current server guard requires the saved session actor UUID on all six native owner
account mutations and on the courier-account link endpoint. Native handlers compare it
with the cookie-authenticated active owner after Origin/CSRF validation and before receipt
lookup inside the existing transaction. The courier link compares its authenticated
request user before `auditedChange`. Missing or malformed headers return `400
invalid_request`; a mismatch returns `409 actor_changed` with the recovery instruction to
reopen the original account. Neither error exposes actor identifiers.

Actual PostgreSQL validation after the production guard:

- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/server exec vitest run
  tests/account-idempotency.test.ts tests/account-integrity.test.ts tests/users.test.ts
  tests/auth-lockout-recovery.test.ts tests/auth-sessions.test.ts
  tests/courier-accounts.test.ts tests/role-permissions.test.ts tests/audit-events.test.ts
  tests/log-redaction.test.ts tests/reporting-privacy.test.ts` — **10 files / 199 tests
  PASS**, 23.67 s, actual output `.git/local-orchestration/actor-server-n1.log`.
- Server TypeScript check, scoped server/fixture ESLint (`--max-warnings 0`), scoped
  Prettier check and `git diff --check` — PASS.

The original server RED is recorded above; the separate real-browser pre-fix reproduction
is recorded at `.git/local-orchestration/actor-web-browser-red.log`. Final local browser
verification after the guard:

- Focused account-idempotency flow: **6/6 PASS**, 23.5 s,
  `.git/local-orchestration/actor-web-browser-focal-2.log`.
- Combined access and account-idempotency flows, including axe scans: **19/19 PASS**,
  49.8 s, `.git/local-orchestration/actor-web-browser-final.log`.

These checks do not close T132; independent orchestrator review and the four full local
gates remain required.

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
