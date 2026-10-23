# Native API code generation — 004/T005

Date: 2026-10-22, America/Bogota. Dirty local branch
`codex/local-readiness-orchestration`, base `94a7e2450ec2abae4192f7f864e34c4638f7c963`.
Prerequisite T004 and original T002 RED verified by root.

## Implementation and review

A native Node randomBytes(16).toString("base64url") function supplies 128-bit
22-character unpadded bearer codes. Shared transactional insertion handles both
single and bulk shipments; bulk previews do not mint codes. Merchants generate
inside auditedCreate after the existing-ID check. ID-conflict replay discards
uncommitted candidates and retains the accepted code. Existing tracking-number
collision retries/transactions and creation events are preserved. Shipment bearer
codes are excluded explicitly from created-event changes; central merchant audit
filtering excludes its code. No client-selected code, logging or edit rotation.
DB defaults remain as migration/seed/direct-insert compatibility fallback.

## Double verification

Executor: native generator unit, focused format/ESLint/server types and four
PostgreSQL integration files **52/52 pass,8.76s**. A new causal test uses a separate
freshly migrated disposable database, drops both SQL code defaults and proves real
single/bulk/merchant creation still generates codes. Existing constraints, concurrent
replays, unchanged edits, audit privacy and populated upgrade/replay assertions remain.

Root reviewed implementation and the causal fixture, then independently ran:

`pnpm --filter @domy/server exec vitest run src/lib/secret-code.test.ts tests/secret-codes.test.ts tests/shipments-create.test.ts tests/bulk.test.ts tests/merchants.test.ts`

**53/53 pass, five files,9.98s,exit0**. Independent scoped Prettier/ESLint and server
typecheck pass. Logs and exact reviewed-file SHA-256 manifest are retained under
`.git/local-orchestration/public-t005/`. Original feature RED remains in the T002
receipt; new causal fixture distinguishes Node generation from the SQL fallback.
The executor fixed one missing test-helper import before its native DB run.

## Decision and limits

T005 accepted locally. Settings T008 and the complete foundation integration gates
remain open; no public data story, physical acceptance or provider proof is implied.
No dev/LAN/production database was changed and no remote CI/deployment was performed.
Catalog50/81 verified (62%),31 open.
