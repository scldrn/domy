# Merchant projection implementation — 004/T026

Date:2026-10-22, America/Bogota. Dirty local base94a7e24.

Implemented merchant day/detail projections and strict shared schemas with bounded
inputs, explicit field allowlists, service-date totals, unknown-fee suppression,
nonfinal positive COD, current effective collections/receiver/proof/attempts, and
owner-selected support notices instead of note text. No private redaction inputs,
storage lookup, balance or history exposure. Canonical addCop, isFinal,
deliveryAttempts, money/aggregateMoney, support/window and exact reason labels
are shared; the existing 24-hour predicate is extracted without changing semantics
for domain flags or server record views.

Executor and root independently ran the full domain suite:21 files,410/410 PASS.
Root final duration510ms. Both scoped Prettier/ESLint and recursive strict types
pass. Root additionally ran real-PG server board/courier-contract/exceptions:
30/30 PASS,12.83s. The server/helper diff remained identical after this native run;
subsequent corrections were confined to projection/schema/test files and root
repeated domain/static checks on the final source.

```bash
pnpm --filter @domy/domain exec vitest run
pnpm --filter @domy/server exec vitest run tests/board.test.ts tests/courier-contract.test.ts tests/courier-exceptions.test.ts
pnpm exec prettier --check packages/domain/src/public-tracking.ts packages/domain/src/public-tracking.test.ts packages/domain/src/schemas/public.ts packages/domain/src/shipment-flags.ts apps/server/src/lib/record-views.ts
pnpm exec eslint packages/domain/src/public-tracking.ts packages/domain/src/public-tracking.test.ts packages/domain/src/schemas/public.ts packages/domain/src/shipment-flags.ts apps/server/src/lib/record-views.ts --max-warnings 0
pnpm --recursive typecheck
```

Root review caught overly broad field-money schemas and redundant support/window
schemas. A permanent regression first demonstrated both fee/COD int4 overflow
acceptance; the final code uses money for those fields, aggregateMoney for sums,
and copies support fields explicitly. Exact reason-label types remain literal
unions. Original RED logs are preserved, not replaced by passing attempts.
Independent read-only review also confirms unchanged exact24h helper behavior.

Final SHA-256:

- packages/domain/src/public-tracking.ts: e994c22f2badc39fd7eada3e343d1ac9e82965331437f1038c63e364a503aa9f
- packages/domain/src/schemas/public.ts: 9eeae36ff3a78b065fa20cd790a2ac6f31f4bb1580ca5344ae64686cf332eccf
- packages/domain/src/public-tracking.test.ts: 16b125f0db68c7d1f9ddf36a07e27e5ff1e915e2d5fbc34d7384c85779d2ba19
- packages/domain/src/shipment-flags.ts: 4d72b1b4f950e7e4705a9ad029e1fb786c71923a6bddae7305aebd9956bbd7d0
- apps/server/src/lib/record-views.ts: a98be2de2bbeae485b044a70d708b550fce6306e0e7862f288eb960c4761d60d

Evidence:.git/local-orchestration/merchant-t026/, including followup-int4-red*,
followup final checks and root-final-domain/format/lint/types plus root-native-photo.
T026 accepted locally; catalog63/81(78%),18open. T027 now eligible.
Merchant endpoints/UI and full story gates remain pending. No release, remote CI,
physical acceptance or operational target mutation.
