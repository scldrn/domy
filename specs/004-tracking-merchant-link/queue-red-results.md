# Pending-stop queue RED — 004/T010

Date:2026-10-22, America/Bogota. Dirty local base94a7e24.
Foundation gate verified; R17 reverse-pickup eligibility clarified and rereviewed.

Executor and root each ran `pnpm --filter @domy/domain exec vitest run src/routes.test.ts`.
Both collected41 tests:33 existing pass,8 new intended assertion failures because the
checked optional export is absent. No import/collection/setup error. Root duration112ms.
The tests retain zero/one/many, shared-stop count-once, pending deliveries/returns,
out-of-order completed/failed work, pickup-only/errand exclusions, normal/carrier
anchors, reverse pending pickup and null after pickup, and missing/completed anchors.
All assertions must execute and pass under T014; absent-export RED does not prove
later business assertions independently pass. No production implementation was added.

Both levels scoped format/ESLint/domain types pass. Root reviewed the diff; only
packages/domain/src/routes.test.ts changed. Test SHA-256:
0ff6c13f3ebd4c644454fa2cae1876e8864af0e6152fbb07f6d2ed8f53a64d9d.
Logs: .git/local-orchestration/public-t010/routes-red.log and root-red.log,
plus independent root format/lint/type logs. T010 RED deliverable accepted;
T014 may implement the canonical helper. Catalog52/81(64%),29open.
