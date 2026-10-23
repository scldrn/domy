# Merchant projection RED — 004/T023

Date: 2026-10-22, America/Bogota. Local dirty base94a7e24.

The executor authored 14 merchant cases; root corrected incomplete UUID/code
fixtures and aligned the final source with the owner's explicit support-notice
decision. A separate Luna/max reviewer independently inspected and ran that source,
then root reviewed it and independently verified the same intended RED.

```bash
pnpm --filter @domy/domain exec vitest run src/public-tracking.test.ts src/routes.test.ts
pnpm exec prettier --check packages/domain/src/public-tracking.test.ts
pnpm exec eslint packages/domain/src/public-tracking.test.ts --max-warnings 0
pnpm --recursive typecheck
```

Both runs collect132 cases:14 intended failures and118 existing passes
(77 tracking/schema +41 routes). Reviewer232ms; root343ms. Exports for T026
are absent; no import, setup, collection or existing-regression failure. The
RangeError assertions are blocked by the absent-export guard; this receipt does
not claim that overflow handling or later schema assertions already executed.

Cases cover service-date cohort, voided exclusions, confirmed/unknown fees,
FR014 COD, effective collections, exact safe aggregate arithmetic, current
receiver/status provenance, proof availability boundary, corrected eligible
attempts and strict nested allowlists. UUID/output fixtures are valid and tracking
codes exactly22 base64url characters. MAX_SAFE_INTEGER source cases are defensive
invalid-source checks, not valid PostgreSQL int4 examples.

Owner selected a support notice instead of notes. Tests require the fixed notice
for sensitive and benign nonblank notes, null for absent/empty/whitespace notes,
literal-only nested schemas and unchanged inputs. No private sanitization inputs
are required. Final R19/spec/model/contract/task rereview has no HIGH/CRITICAL.

Scoped format/lint pass at both levels; root all-workspace strict types pass.
SHA-256:4a5bb3b526d210fc2eb4160eb1f49e60c02642e2f66516dc3567c82f91a55ee6.
Logs:.git/local-orchestration/merchant-t023/reviewer-owner-red.log,
root-owner-red.log, reviewer-prettier.log, reviewer-eslint.log,
root-owner-lint.log and root-owner-types.log. Original executor logs retained.

T023 RED accepted; T026 is eligible after browser source freeze is released.
Catalog61/81(75%),20open. This is test-first evidence, not merchant implementation,
physical acceptance, deployment or remote CI.
