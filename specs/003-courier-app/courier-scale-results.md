# T091 — Courier busy-day performance results

## Fixture and method

`apps/server/tests/courier-scale.test.ts` reproduces feature 002's `routes-scale.test.ts`
workload with the native courier API: 100,000 delivered historical shipments, 800 current
registered shipments, 40 routes with 15 shipments each, 30 dispatched routes, 200
unassigned shipments, and 1,200 route tasks. Fixture assertions fail if those counts drift.

The test warms the native `GET /api/courier/route`, then measures five 15-shipment
snapshots and requires every response to remain below 500 ms. It then sends five real
50-record disbursement requests over the route's 15 shipments and requires all 250 unique
records to be applied; each request must finish below 2 seconds. The recorded timing is the
worst observed run for each operation. The file is selected by the existing `capacity` project, which preserves
`fileParallelism: false` and `sequence.groupOrder: 1`; no seed, workload, or budget was
changed in `routes-scale.test.ts` or the invariant suite.

## N1 execution

The required isolated command is:

```bash
SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm --filter @domy/server exec vitest run --project capacity tests/courier-scale.test.ts
```

**N1 result:** PASS — 1 test file, 2 tests, 10.94 s total suite duration. The isolated run
started at 11:00:08 local time on 2026-10-21. Both operations completed under their asserted
budgets. The first pass's console output hid individual timings. An authorized isolated
capture rerun with `--silent=false` also passed (2 tests, 8.53 s, started at 11:01:06 local
time) and reported the worst of five measured operations: 5 ms for the 15-shipment snapshot
and 236 ms for a 50-record disbursement batch. No fixture, workload, or budget changed
between runs.

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
