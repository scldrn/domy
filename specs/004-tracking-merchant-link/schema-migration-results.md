# Additive public schema verification — 004/T004

Date: 2026-10-22, America/Bogota. Dirty local branch
`codex/local-readiness-orchestration`, base `94a7e2450ec2abae4192f7f864e34c4638f7c963`.

## Implementation and review

Generated `0009_tired_robbie_robertson.sql` adds public shipment/merchant codes,
notification author/time, link replacement time, support phone/company name and
notified/link_replaced enum values. PostgreSQL 18 native two-UUID SHA-256 truncated
128-bit base64url defaults populate each old row before unique/NOT NULL enforcement;
format, actor/time pairing, FK and settings checks remain enforced in the database.
No new extension, manual generated-DDL edits or historical-row updates were needed.
Ordinary Node crypto API generation remains T005. Matching domain enums and Spanish
labels compile; creation audit filtering excludes bearer fields.

## Executor verification (N1)

`pnpm db:generate` generated SQL/snapshot/journal. Scoped Prettier, ESLint and
server/domain/web types passed. Isolated PostgreSQL tests:

- `pnpm --filter @domy/server exec vitest run tests/secret-codes.test.ts`: 4/4 pass,
  final 3.67 seconds.
- `pnpm --filter @domy/server exec vitest run tests/migration-toolchain.test.ts`:
  2/2 pass, final 3.14 seconds.

The initial toolchain run failed its legacy full-row comparison because new additive
columns existed. Only newly added columns were excluded from the old-field projection;
full post-upgrade data snapshots now independently protect replay stability. Existing
old-field/schema/FK checks remain. All attempts are retained; filenames n2/n3 in the
executor logs denote executor attempts, not orchestrator review. A zsh reserved-variable
wrapper error after a successful first secret-code run is also disclosed.

## Orchestrator verification (N2)

Root inspected generated DDL, schema/domain/UI changes and audit paths, then independently
ran both Vitest files together: **6/6 passed in 6.01 seconds**, exit 0. Root scoped
Prettier/ESLint and server typecheck passed. Native nonempty 0008 upgrade and historical
0005 upgrade/replay plus fresh-generated/versioned schema equivalence are tested.
Review/logs: `.git/local-orchestration/public-t004/root-n2-*.log` and exact reviewed-file
SHA-256 manifest `root-reviewed-files.json`. Initial combined source snapshot was
c52ff53579129af5072d2f482321e202df49c3b45a37123c03d4ef99287fa673 (472 files);
other independent foundation files were being authored, so this is focused verification,
not a frozen full-repository gate. Those gates remain required for foundation integration.

## Decision and limits

T004 accepted locally by both levels. T005 and T008 may begin; other foundations and
all public stories remain open. No dev/LAN/production database migration, physical
acceptance, remote CI, publication or deployment occurred. Running LAN candidate still
contains its sealed earlier 003 build. Catalog: 47/81 verified (58%), 34 open.
