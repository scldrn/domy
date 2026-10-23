# T090 — Courier security and payload results

## Scope

`apps/server/tests/courier-security.test.ts` exercises the real Hono app against
Testcontainers PostgreSQL 18 and S3Proxy 4.1.1 with synthetic records, recipients, and
push credentials. It checks authorization and refusal behavior without printing request
bodies, credentials, or recipient data. No runtime, schema, or endpoint change is part of
T090.

| Requirement | Regression evidence |
| --- | --- |
| A courier sees only their route, off-route custody, notices, day summary, and photos | One two-courier scenario compares route IDs and tasks, held shipment IDs, route notices, distinct collection totals, and photo download authorization. |
| Push payload has no recipient data | The same scenario captures a real post-commit push call and asserts the exact payload contains only notice type and route number. |
| Record actor comes from the authenticated session | A forged `courierId`, `authorUserId`, and `onBehalf` are sent with a valid record; PostgreSQL row and shipment event must use the signed-in courier and user. |
| More than 50 records have no effects | A valid 51-record request must return `400 invalid_request`; shipment state/version, records, events, and notices are compared before and after. |
| Malformed record has no effects | A valid batch envelope with an invalid `occurredAt` must return `400 invalid_request` with the same effect comparison. |
| Request over 1 MB has no effects | A valid record plus padding beyond 1 MiB must return `413 payload_too_large` with the same effect comparison. |
| Future phone time is clamped | PostgreSQL `occurred_at` and `recorded_at` are both asserted against the controlled receipt clock. |
| Photo cannot arrive before its declared record | The authenticated courier's unknown photo UUID receives `404`; no photo metadata or S3 write is produced. |
| Deactivated courier session is refused immediately | A linked courier first reads their snapshot, the owner deactivates that user, and the same cookie's next snapshot request must return `401`. |

Existing complementary evidence remains in `apps/server/tests/photos.test.ts` (S3 round-trip,
photo size/media limits, another courier's upload/download refusal, private cache headers,
retention and work-lifecycle access), `apps/server/tests/auth-sessions.test.ts` (deactivation
and session revocation), and `apps/server/tests/courier-notices.test.ts` (exact private push
payload, commit ordering, and transport failure behavior). These cases remain in their
existing files and are not replaced by the T090 matrix.

## N1 execution

The required isolated command is:

```bash
SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm --filter @domy/server exec vitest run --project integration tests/courier-security.test.ts
```

**Result:** PASS — 1 test file, 8 tests, 10.26 s total suite duration. The run started at
10:59:54 local time on 2026-10-21 and used the isolated command above. No request bodies,
credentials, or recipient data were printed.

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
