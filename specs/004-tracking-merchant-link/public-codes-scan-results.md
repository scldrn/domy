# Public unknown-code scan — 004/T031

Date:2026-10-22, America/Bogota. Dirty local base94a7e24.

Executor and root independently ran:

```bash
pnpm --filter @domy/server exec vitest run tests/public-codes-scan.test.ts
pnpm exec prettier --check apps/server/tests/public-codes-scan.test.ts
pnpm exec eslint apps/server/tests/public-codes-scan.test.ts --max-warnings 0
pnpm --filter @domy/server typecheck
```

Both native first attempts pass2/2 tests: executor5.12s, root6.47s. All scoped
static/type checks pass. Source hash unchanged throughout root review/run.

Real PostgreSQL fixtures, actual registration and native Node loopback HTTP are
used.1000 cryptographically random distinct unissued codes generate2000 negative
lookups, one per tracking and merchant endpoint. Every response has identical404
link_not_found JSON and public cache/index headers. Each of40 windows sends25
codes to both endpoints plus4 real known-code positives (54requests, below60).
Legitimate tracking guide and merchant shipment membership are checked before and
after every batch. Only the existing monotonic test clock advances exactly60000ms;
no forged peer/forwarding header, whitelist or rate-limit disablement.

The separate test proves requests1–60 reach lookup,61 yields Spanish429 with
required headers, and the exact window boundary accepts lookup again. Thus429
is neither mistaken for a uniform404 nor bypassed to make the scan green.

Root inspected the whole source, strict response fingerprint, sample count,
known-code exclusion, cleanup and clock/limit boundaries. This statistical negative
scan is not entropy proof, production proxy validation, physical acceptance or a
replacement for T005's native128-bit generation evidence.

SHA-256:e2ae01ccbb21d5370025d60c277a51c4f045b9c5ad60f360ef31df9df7df1bdf.
Evidence:.git/local-orchestration/public-codes-t031/: n1-focused-first.log,
n1-evidence.md, root-native.log, root-format/lint/types.log. Executor fixed initial
formatting and a dead catch assignment before the first native run.

T031 accepted locally. Catalog65/81(80%),16open. T028/T029 remain in progress;
this focused pass is not final UI/story/full-source release acceptance.
