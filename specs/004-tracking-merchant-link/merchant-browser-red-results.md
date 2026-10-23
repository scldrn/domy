# Merchant browser RED — 004/T025

Date: 2026-10-22, America/Bogota. Dirty local base94a7e24.

```bash
env -u NO_COLOR pnpm --filter @domy/web exec playwright test tests/e2e/merchant-page.spec.ts --retries=0 --reporter=list
pnpm exec prettier --check apps/web/tests/e2e/merchant-page.spec.ts
pnpm exec eslint apps/web/tests/e2e/merchant-page.spec.ts --max-warnings 0
pnpm --recursive typecheck
```

Executor and root independently collect3 tests, all intended missing-feature RED
(exit1): generic public shell exists, but merchant name/current tracking content
does not. Root durations7.2/6.2/5.4s; no setup/import/fixture failures. Earlier
harness failures (ambiguous stop/card and exception review flow) remain archived;
they were corrected in the test without changing product behavior.

Real fixtures use registration, dispatch, courier pickup/delivery/exception,
private uploaded proof and unuploaded proof metadata. Generated bearer codes are
read through parameterized SELECT in the disposable E2E DB only; no operational
DB writes or product code-exposure endpoint. Unique tenants and finally-restored
clock/support settings isolate the cases.

The three scenarios specify anonymous list/totals/detail/photo and privacy at320px,
Bogotá date window and proof24-hour boundary, and real clipboard/cancel/confirmed
rotation with old/new isolation. Owner note decision is covered in UI/current and
attempt API assertions, with configured support links and explicit axe checks.
These later assertions are blocked by first missing-content failures and are NOT
claimed executed or passing. They must all pass during T028/T029 integration.

Root reviewed complete source/contract and corrected a latent duplicate-notice
strict locator. Executor's last browser run preceded only that blocked assertion
change; its static checks reran. Root browser run validates final source. Both
levels format/lint/types PASS; root reviewed the final source hash unchanged.

SHA-256:82d7d26c650f7f4c222d81a4c75c3076add32d001a353209f016f7f38e201b13.
Evidence:.git/local-orchestration/merchant-t025/: owner-n1-red.log,
owner-n1-red-artifacts/, root-owner-red.log, root-owner-red-artifacts/ and scoped
static logs. Predecision/harness failures remain separate and unmodified.

T025 RED accepted; product source freeze released for eligible T026.
Catalog62/81(77%),19open. No merchant implementation, physical acceptance,
remote CI or deployment is certified here.
