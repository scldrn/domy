# Notification domain verification — 004/T020

Date: 2026-10-22, America/Bogota. T017 RED was independently verified first.

`composeMerchantMessage` derives its minimal inputs from the shared notification
schemas. It preserves eligible input order, uses the existing tracking-number
formatter and validated public origin, excludes voided shipments in every mode,
excludes notified shipments by default, and supports explicit all-date inclusion.
Only more than20 eligible entries become a compact count and merchant link.
Nullable display fields have Spanish fallbacks. Compact text makes no claim that
the requested service date is today. The function has no clock or network access.

Strict schemas export `notificationListQuery`, `notificationShipmentSchema`,
`notificationMerchantSchema`, `notificationListSchema` and `notificationMarkInput`,
with inferred types. The query delegates date validity to the existing calendar
schema and supplies an actionable contextual message. Batch IDs must be valid,
nonempty and distinct even across UUID casing. Callers still canonicalize UUIDs
when binding replay sets; the schema does not rewrite returned IDs.

Executor preserved meaningful REDs: missing exports, case-equivalent duplicate
UUIDs, incorrect “para hoy” wording, and the cryptic existing “Inválido fecha ISO”
message. The previous date error was already Spanish; the improvement removes
jargon and adds an action. Null display/empty eligible input and special characters/
invalid public-origin regressions are also retained.

Executor N1 and root N2 both pass the full24-file/422-test domain suite, scoped
Prettier/zero-warning ESLint and recursive workspace typecheck. Root independently
reviewed filters, threshold, null handling, origin validation and strict schemas.
Own domain run took480ms. All five owned-file hashes stayed identical through QA.

```bash
env -u NO_COLOR pnpm --filter @domy/domain exec vitest run
pnpm exec prettier --check packages/domain/src/merchant-message.ts packages/domain/src/merchant-message.test.ts packages/domain/src/schemas/notifications.ts packages/domain/src/schemas/notifications.test.ts packages/domain/src/index.ts
pnpm exec eslint packages/domain/src/merchant-message.ts packages/domain/src/merchant-message.test.ts packages/domain/src/schemas/notifications.ts packages/domain/src/schemas/notifications.test.ts packages/domain/src/index.ts --max-warnings 0
pnpm --recursive typecheck
```

Final SHA-256:

- helper: `570944d7367dfc4262cf634e215e9905a7937ecc1f00818c7a67b7f0b418f887`
- schemas: `f457cbd382d97ee5e71490d6522adffab4e0839651af3948b5a812a44fb7ac56`
- composer tests: `12e1e888f58aebe16640fb19b731fb85f2ecf22f418ccb1251bbfb2ca3131678`
- schema tests: `a55dfb68495e911645f0bf33d0a2d4f63bc88c0d5ff82313c40f1bf3dc090cee`
- index: `3df292f0c86ad8b97512ec80ddb56381f5e53d42d6af797a3122e279450510d4`

Logs: `.git/local-orchestration/notifications-t020/`. T020 accepted; T021 is
eligible after the active browser RED source freeze. Notification APIs/UI and
full story gates remain pending. No database, browser or deployment result is
inferred from this domain verification.
