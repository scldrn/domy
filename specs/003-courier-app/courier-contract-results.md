# Courier HTTP contract verification — 003/T089

Executor N1 evidence only. This receipt records the focused contract suite; it does not
close T089 or change task/status checkboxes. The tests call actual mounted Hono routes and
validate responses with strict Zod schemas; they do not mirror server types by hand.

## Inventory and response coverage

`apps/server/tests/courier-contract.test.ts` reads
`specs/003-courier-app/contracts/http-api.md` and compares the actual Hono route registry
in both directions. The 17 endpoint rows in the contract table are required to be unique and
registered. Of those, 13 belong to `/api/courier/*`, `/api/courier-records/*`, `/api/photos/*`
and `/api/settings`; the other four are the shipment record, exception-decision,
office-receipt and clear-review dispatch actions. The test checks both families against
registered routes, rejects undocumented registered routes in those families, and separately
verifies the owner-only `PUT /api/couriers/accounts/:userId` bullet and mounted method.

The contract's error table is compared exactly to the shared server error/status catalog.
Real requests exercise all six documented courier error codes and validate the exact JSON
body `{ error: { code, message } }`, including the documented custom `record_not_revertible`
message. Strict response schemas validate `CourierSnapshot`, courier record results and
`CourierRecord`, shipment detail and its courier additions/events, `RouteSummary`,
`RoutesBoard`, `UnassignedShipment`, route events, and `CompanySettings`. Fixtures verify
both courier-authored and dispatcher on-behalf records, including `onBehalf` shipment and
route events, and a real `record_reverted` event. The settings test checks the null initial
projection and populated update response.

## N1 execution

The final focused integration run used the actual PostgreSQL/Testcontainers and S3Proxy
fixtures with Sentry DSNs blank:

```bash
SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm --filter @domy/server exec vitest run --project integration tests/role-permissions.test.ts tests/courier-contract.test.ts
```

Final result: **2 files, 91/91 tests passed**, 8.44 seconds; the four contract cases are
included (`.git/local-orchestration/t081-t089-integration-n1-final-v4.log`). Final server
typecheck, scoped ESLint with zero warnings, scoped Prettier check and `git diff --check`
also pass. Earlier failed invocations are retained in the sibling attempt logs noted by
the role-matrix receipt; their causes were test fixture/expectation issues, not production
contract mismatches. No runtime contract or production source was changed. Full feature
gates, independent review and canonical task closure remain outstanding.

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
