# Courier endpoint role matrix — 003/T081

Executor N1 evidence only. Canonical task state and feature-wide convergence remain with
the orchestrator; this receipt does not close T081 or alter task/status checkboxes.

## Coverage

`apps/server/tests/role-permissions.test.ts` runs against the real Hono app, PostgreSQL and
S3Proxy. The endpoint matrix exercises anonymous, owner, dispatcher and linked-courier
sessions over the contracted methods, including courier records, photos, notices, push
configuration/subscriptions, handovers, owner-only account linking and settings. Allowed
matrix requests with `{}` check authorization ordering only; their status assertion excludes
401/403 and 5xx, and does not claim those incomplete payloads are valid operations.

Separate valid requests verify each courier sees their own route, a different linked courier
does not see it, owner/dispatcher can read a declared private photo, and an unrelated courier
cannot read or upload that photo. A linked courier can upload its declared photo. An unlinked
courier receives 403 for the route and push-config reads and for valid record, notice
acknowledgment, photo-upload, push-subscribe and push-remove requests. The test verifies no
record is inserted, a notice remains unacknowledged, a linked subscription remains intact,
and the declared photo remains unuploaded. A deactivated session receives 401 on all seven
`/api/courier/*` operations after an actual native owner ban. A wrong-courier photo read and
upload are refused without changing upload metadata.

Native admin mutations use the authenticated owner's explicit `X-Domy-Actor-Id` and Origin.
Missing, malformed and mismatched actor headers are sent without helper autofill; they return
400, 400 and 409 and leave the target user unchanged. A dispatcher attempt is refused, then
the owner ban succeeds and invalidates the target session. `PATCH /api/settings` succeeds for
the owner; a dispatcher receives 403 and the singleton settings row remains absent.

## N1 execution

The final focused integration run used the required real-database command with Sentry DSNs
blank:

```bash
SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm --filter @domy/server exec vitest run --project integration tests/role-permissions.test.ts tests/courier-contract.test.ts
```

`role-permissions.test.ts` contributes 87 tests within the combined run. Final result:
**2 files, 91/91 tests passed**, 8.44 seconds (`.git/local-orchestration/t081-t089-integration-n1-final-v4.log`).
The prior role-only baseline before the extension was 80/80 (3.42 seconds;
`.git/local-orchestration/t081-role-baseline.log`).

## Retained investigation runs

The failed attempts are preserved rather than reported as product regressions. The first
combined attempt had four test-side failures: the expected route count was wrong, a response
body helper consumed the error body twice, the on-behalf fixture omitted its required record
UUID, and a second test tried dispatching the same courier while its earlier route remained
active. Subsequent attempts exposed two stale test assumptions: the account-link path is
documented as a bold bullet rather than a table row, and a problem record does not create a
shipment status event. The fixture now uses a real pickup record to verify `onBehalf` on a
status event. An invalid `{}` request from an unlinked courier returned 400 at schema
validation before link authorization; the final matrix uses valid payloads for the relevant
mutation checks instead. These outcomes and corrections are retained in the attempt logs
`.git/local-orchestration/t081-t089-integration-n1.log`, `...repeat1.log`,
`...repeat2.log`, `...final-v2.log` and `...final-v3.log`.

Final static checks also pass: server typecheck, scoped ESLint with zero warnings, scoped
Prettier check and `git diff --check`. No application/server behavior was changed. Full
quality gates, independent review and canonical task closure remain outstanding.

## Root N2 approval — 2026-10-21 (America/Bogota)

Independent root source/contract review and all local gates pass on unchanged
456-file source SHA256 `dbb77ffd7d5b368d5a78bfa2e072e85eca3f3fc214e9779f5d454445a63c691e` (dirty tree, base94a7e24):

- `SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm check` — exit0.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm test --silent=false`
  — 1,281 tests:283 domain/677 server/321 web, no SDK warnings.
- `env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm test:e2e`
  —121/121, first attempt,6.3 minutes; includes compiled enabled/disabled reporters.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm build` — exit0.

Logs use `.git/local-orchestration/n2-courier-native-{check,test,e2e,build}.log`.
Before/after source inventories match exactly; browser interval11:24:02–11:30:20
had zero native Sleep events. Root capacity measurements:5 ms snapshot and215 ms
50-disbursement batch over 15 shipments (worst of 5), unchanged 500 ms/2 s limits.
All earlier test-side failures and the SDK-warning attempt remain preserved.
The native ignored-hook follow-up has its own real RED/4web+5server GREEN;
no warnings, assertions, retries, workloads or axe rules were suppressed.

Root approves the owning technical task locally after both QA levels. This does
not certify phone acceptance, provider delivery, deployment or release readiness.
