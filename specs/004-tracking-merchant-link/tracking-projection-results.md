# Public tracking projection — 004/T013

Date: 2026-10-22, America/Bogota. Dirty local base 94a7e24.

The pure projection constructs only approved public fields and validates the result
with one strict inferred Zod union. Nested support/window/courier objects reject
extra keys. Inputs select minimal model fields; no API type or business rule is
copied into the server or web. Money, phone, date, final-state and Bogotá helpers
reuse canonical domain definitions. No raw histories are projected.

Root review caught and corrected errand neighborhood disclosure, reverse-pickup
wording for off-route/office packages, and inconsistent legacy-time expiry. R18
artifacts now document the defensive provenance guard. After pickup, courier
contact uses actual current custody only. Expiry and delivered metadata share the
same verified instant; incomplete/reverted sources cannot fabricate metadata.

Both executor and root independently ran:

```bash
pnpm --filter @domy/domain exec vitest run src/public-tracking.test.ts src/routes.test.ts
pnpm --recursive typecheck
pnpm exec prettier --check packages/domain/src/public-tracking.ts packages/domain/src/schemas/public.ts packages/domain/src/public-tracking.test.ts packages/domain/src/index.ts
pnpm exec eslint packages/domain/src/public-tracking.ts packages/domain/src/schemas/public.ts packages/domain/src/public-tracking.test.ts packages/domain/src/index.ts --max-warnings 0
```

All pass: 118 tests (77 projection/schema + 41 queue), root duration 295 ms,
zero static errors/warnings. Original 72 projection cases and 41 route cases remain;
added regressions cover strict schemas, missing/reverted provenance, off-route
kind precedence and fallback expiry boundaries. First failures are retained under
`.git/local-orchestration/public-t013/`, alongside corrected and independent logs.

Final SHA-256:

- public-tracking.ts: b5cf0583b61673beedf6a4f7c98422b2320e419916811d4b798e9208eeb15f4b
- public-tracking.test.ts: 0d0143dbd43f85f5699c318c76c50ce88c54103e07a52602f27dec7ddc009b96
- schemas/public.ts: 4ecd418c9399a21a0d1d7a2bbba9398d7869a4c951510325acc7e9ab7418bbaf
- index.ts: bf8043044236bd53e24b68812f9ab8c744aeff59c58323143d698241aa05cef7

T013 accepted; T015 is unlocked. This is domain acceptance, not a completed
public tracking journey. Catalog 57/81 verified (70%), 24 open. No remote CI,
production deployment or physical acceptance.
