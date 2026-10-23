# Anonymous tracking browser RED — 004/T012

Date: 2026-10-22, America/Bogota. Local dirty base 94a7e24.

Executor and orchestrator independently ran:

```bash
env -u NO_COLOR pnpm --filter @domy/web exec playwright test tests/e2e/tracking-page.spec.ts --retries=0 --reporter=list
```

Both corrected runs collected five tests and failed at the intended missing public
status/invalid-link UI assertions. There were no fixture, database, build or collection
failures. These are accepted RED deliverables, not passing tracking acceptance.
Later refresh, privacy, expiry, rate-limit and weak-network assertions remain to be
executed successfully under T016. The 3-second budget and 60-second refresh bound
remain unchanged; the weak-network test uses a cold anonymous mobile context,
1.5 Mbps/250 ms throttling and a monotonic clock.

Fixtures register shipments and use actual operational endpoints in disposable
PostgreSQL. A parameterized read obtains only the fixture's generated tracking code;
the ignored database-connection fixture is exclusive-written with mode 0600 and
removed on teardown. No product API or LAN fixtures were changed for this seam.
Root review corrected the support assertion to retain both phone and WhatsApp,
while excluding courier contact. Original failing runs remain available.

Both levels pass scoped Prettier, ESLint and web type checking. Root reviewed both
source files and independently replayed the corrected RED. SHA-256:

- tracking-page.spec.ts: a9ba93245cfa29b2bd547b9040675e1f96d2f4664ce29c2e39ac53cd4793be70
- global-setup.ts: 75d2eab8842b188cfc9d4a38cac32040b13cde88bdfc1917f167ae0ec56fa673

Logs: `.git/local-orchestration/public-t012/`, especially
`n1-red-corrected.log`, `root-red-corrected.log`, and root-final static logs.
T012 is verified. T016 remains blocked on independently verified T015.
Catalog: 56/81 verified (69%), 25 open. No remote CI or deployment.
