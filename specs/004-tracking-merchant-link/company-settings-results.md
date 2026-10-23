# Support and company settings — 004/T008

Date: 2026-10-22, America/Bogota. Dirty local branch
`codex/local-readiness-orchestration`, base `94a7e2450ec2abae4192f7f864e34c4638f7c963`.
Prerequisite T004 verified. Status: verified locally by both levels; physical/release gates remain open.

## Behavior and source review

Owner PATCH accepts independent support phone/company name changes and preserves
all omitted values. Explicit null clears support phone; the canonical shared phone
schema validates ten digits. Company name is trimmed/nonempty and defaults to Cohex.
Office updates still require their address/neighborhood pair; the existing singleton
transaction, audit events, accepted no-op receipts and concurrent replay behavior
remain. An empty GET returns defaults without creating a row. Dispatcher reads remain
allowed; only owner writes and couriers are denied.

The settings page has separate office and support forms. Saving support does not
require office inputs or send them. Empty phone sends null. The Hono RPC response and
shared CompanySettings type agree; existing exact response-shape assertions were
extended, preserving their old office/role assertions. No migration changed in T008.

## Test-first and executor QA (N1)

Before implementation, domain suite29 pass/7 intended failures and native PG suite
1 pass/4 intended failures reproduced missing partial/default/support behavior.
Root independently reproduced the PG RED:4 failures/1 pass,3.72s; no setup or
collection failure. Original logs retained under .git/local-orchestration/public-t008/.

Final executor checks:36/36 domain tests,114/114 PostgreSQL tests (12.15s), scoped
Prettier/ESLint and domain/server/web types pass. Root required canonical phone-schema
reuse instead of a duplicated regex; exact canonical Spanish error assertions remain.

The shared N1 browser run passed4/4 in18.4s, including the real seeded owner/backend
settings scenario. It proves phone/name persistence after reload, PATCH omission of
both office fields, explicit-null clearing, unchanged office and original contact
restoration. There are no mocked API routes or fabricated front-end persistence.
The empty-office case is proved through native PG API tests; the E2E seed has a
configured office. The author independently reviewed the shared browser output.

## Root focused QA (N2)

`pnpm --filter @domy/server exec vitest run tests/company-settings.test.ts tests/office-receipt.test.ts tests/role-permissions.test.ts tests/courier-contract.test.ts`

**114/114 pass,12.28s**, plus36/36 domain tests, independent server types and scoped
Prettier/ESLint pass. Exact reviewed-file hashes: public-t008/root-reviewed-files.json.
Final root check/test/e2e/build all pass on unchanged481-file source
`c13b486c19aa4f472b400b3caf235bb1568c8136b04eca261c5455d6d115b80e`:1376 tests,
133 first-attempt E2E (7.7min), full check and build. This includes the actual
settings browser case and all historical regressions. Root accepts T008 and the
foundation integration gate. Catalog51/81(63%),30 open after T007 reacceptance.

## Limits

The actual LAN target still serves its older sealed003 build. Public data projections,
mobile acceptance, production configuration/consent and deployment remain separate
work. No dev/LAN/production data migration or remote CI occurred.
