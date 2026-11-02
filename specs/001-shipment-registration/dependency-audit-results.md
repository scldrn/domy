# Development dependency audit — 001/T129

## Scope and state

Investigation on 2026-10-20 (America/Bogota), Node 24.21.0, pnpm 12.8.1.
Workspace branch: `codex/local-readiness-orchestration`, baseline
`94a7e2450ec2abae4192f7f864e34c4638f7c963`; working tree contains concurrent
uncommitted slices. State: scoped source-map/esbuild correction implemented and focused-local verified,
**not closed**. The 2026-10-20 repeated audit now reports a separate Vite advisory
(see final section). No remote CI, publication, production access, audit suppression, or
additional direct package. One explicitly reviewed scoped override is now adopted.

The approved task and plan retain Drizzle ORM 0.45 / Kit 0.31. This report preserves the historical investigation and records the subsequent
compatibility decision and actual lockfile adoption. No business behavior or contract changes
are proposed; Constitution I–IX remain applicable, with existing gates retained.

## Historical initial evidence

| Local command | Exit | Result/log under `.git/local-orchestration/` |
| --- | --- | --- |
| `pnpm audit --json` | 1 | One high and one moderate advisory; `t129-audit-all-before.log` |
| `pnpm audit --prod --json` | 0 | No reported production advisory; `t129-audit-prod-before.log` |
| `pnpm audit --dev --json` | 1 | Same two advisories; `t129-audit-dev-before.log` |
| `pnpm -r why source-map-js esbuild @esbuild-kit/esm-loader @esbuild-kit/core-utils` | 0 | Actual paths; `t129-paths-before.log` |
| `pnpm view drizzle-kit dist-tags dependencies --json` | 0 | Latest stable remains 0.31.11; `t129-upstream-drizzle.log` |

Audit totals: 982 dependencies (all), 280 (production). These are registry audit results,
not proof that every dependency is secure or that the installed development graph is absent
from a future deployment image.

## Advisory disposition and compatible proposal

### source-map-js 1.2.1 — high, corrected to 1.2.2

The installed paths run through PostCSS 8.5.28 and `@tailwindcss/node` 4.3.3. Both declare
`source-map-js: ^1.2.1`; patched 1.2.2 satisfies their existing ranges. Native lock resolution
can therefore update this leaf without a manifest, override, or extra direct dependency.

RED: an isolated Node child parsed a wholly synthetic indexed map with section line
`2 ** 40`, then called `SourceNode.fromStringWithSourceMap`. Version 1.2.1 failed to finish
within 1500ms and was terminated by its parent (`ETIMEDOUT`, `SIGTERM`), as recorded in
`t129-source-map-red.log`; the parent exited 0 because the expected failure reproduced.
No HTTP input path into this library was demonstrated; this proves the installed library
mechanism, not a production exploit. Source-map handling occurs in development/build tools.

The orchestrator approved the compatible leaf correction. pnpm 12 rejected the proposed
`--depth Infinity` (exit 2); the numeric `--depth 999` update succeeded (exit 0).
It also normalized an unrelated domain Vitest importer and removed two peer snapshots.
The orchestrator reviewed and rejected that churn; those unrelated hunks were restored
from HEAD. Only pnpm-generated 1.2.2 metadata, two references and the snapshot name remain
(5 insertions / 5 deletions). No hash was invented. Complete generated and final diffs are
`t129-lock-generated.diff` and `t129-lock-final.diff`.

### esbuild 0.18.20 — historical finding, subsequently corrected

Actual path: Kit 0.31.11 → `@esbuild-kit/esm-loader` 2.6.5 →
`@esbuild-kit/core-utils` 3.3.2 → esbuild 0.18.20. Kit also has patched esbuild 0.25.12;
other tooling uses 0.28.2. Neither removes the older separate transitive copy.

The advisory concerns esbuild's HTTP `serve` feature and permissive CORS. Inspection of the
installed core-utils runtime found `transform`/`transformSync` use, with no `serve`/`context`
call; repository app code has no esbuild server call. This narrows demonstrated exposure,
but does not remove the vulnerable package or authorize a risk exception. README's
production instructions use frozen install without `--prod`, so development classification
does not prove this package is absent from a deployment filesystem.

Registry latest stable Kit 0.31.11 still declares the legacy loader. Kit 1.0.0-rc.4 removes
it, but changes major/prerelease tooling and migration compatibility; it is not an approved
drop-in correction for this task. The initial investigation rejected an untested forced override, audit suppression,
or adding tsx solely to alter resolution. The later bounded compatibility investigation
below supplied the evidence for the specifically scoped adoption. Publisher metadata confirms both legacy
packages remain their latest versions and are deprecated in favor of tsx; core-utils requires
`esbuild: ~0.18.20`, which excludes the patched minor. Kit 0.31.10 retains the same loader,
so a one-patch rollback is not a resolution. At this historical stage no demonstrated compatible resolution or approved exception
existed. The later comparative laboratory and isolated migration verification established
the adopted bounded resolution; no risk exception was used.

## Primary upstream sources

Checked 2026-10-20:

- [source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), updated
  2026-10-05: versions before 1.2.2 are affected.
- [Native source-map-js correction](https://github.com/7rulnik/source-map-js/commit/cf76580):
  validates section offsets and limits work on generated lines.
- [esbuild maintainer advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99):
  patched in 0.25.0; HTTP serving is the affected capability.
- [Drizzle Kit stable release](https://github.com/drizzle-team/drizzle-orm/releases/tag/drizzle-kit%400.31.11).
  Current version/range comparisons also use publisher npm registry metadata via `pnpm view`.

## Historical source-map-only correction verification

| Local verification after correction | Exit | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | `t129-frozen-install.log`; resolution skipped, two cached packages added |
| Bounded synthetic source-map child probe | 0 | `t129-source-map-green.log`; 1.2.2 immediately rejects the oversized offset, 29ms including process startup |
| `pnpm -r why source-map-js` | 0 | `t129-paths-after.log`; one resolved version, 1.2.2 |
| `pnpm audit --json` / `--dev --json` | 1 / 1 | `t129-audit-{all,dev}-after.log`; high 0, moderate 1 (esbuild) |
| `pnpm audit --prod --json` | 0 | `t129-audit-prod-after.log`; no reported production findings |
| Disposable migration generation | 0 | `t129-migration-generate.log`; 29 tables, no schema changes |
| `diff -qr apps/server/src/db/migrations .git/local-orchestration/t129-migrations` | 0 | Original migration files preserved byte-for-byte |
| `pnpm check` | 1 | `t129-check.log`; Prettier found three in-progress T152 files; subsequent lint/types did not run |

Migration command after copying existing generated migrations to the disposable directory:

```sh
pnpm --filter @domy/server exec drizzle-kit generate --dialect postgresql \
  --schema './src/db/schema/*.ts' \
  --out ../../.git/local-orchestration/t129-migrations --casing snake_case
```

Frozen install emitted seven registry request-duration warnings during supply-chain
verification; they were preserved, not suppressed. This is not a zero-warning installation
claim. No production DB was contacted and no secrets or environment file were read.

The first static gate ran while the reporting agent was writing its tests. Its formatting
findings were `apps/server/tests/reporting-privacy.test.ts`,
`apps/web/src/lib/reporting-privacy.test.ts`, and
`apps/web/tests/e2e/reporting-privacy.spec.ts`; this task did not edit those files.

At the source-map-only stage manifests were unchanged and esbuild remained unresolved.
These intermediate audit results are superseded by the adoption evidence below.
Production-only audit success and narrowed serve exposure were never treated as closure.

## Follow-up: scoped esbuild compatibility laboratory

The orchestrator first approved isolated compatibility research; after its own
comparative verification it approved the exact scoped adoption described below. A demonstrated, version-scoped resolution differs from the prohibited blind
override. Candidate scope under investigation is exactly
`@esbuild-kit/core-utils@3.3.2>esbuild` → `0.25.12` (already used directly by Kit).
This crosses the publisher's declared `~0.18.20` range; no publisher compatibility
guarantee is implied. The isolated laboratory itself did not change active manifests, lockfile or node_modules,
and did not start a DB. The later adoption did change the workspace override and lockfile.

Runtime inspection finds only `transform`, `transformSync`, and `version` property accesses
on core-utils' esbuild import. Its options retain corresponding installed API declarations
in both versions: target, loader, sourcemap, minifyWhitespace, keepNames, sourcefile,
format, define, banner and footer. `version` participates in the transform cache key.
Installed Kit `bin.cjs` and `api.js` contain no legacy-loader/core-utils module reference;
the latter explicitly registers `tsx/cjs/api`. That is narrower than a universal statement
about every optional Kit command.

The lab copies the native core-utils/esm-loader packages into private directories under
`.git/local-orchestration/t129-loader-lab/`, linking their existing dependencies to baseline
esbuild 0.18.20 or candidate 0.25.12. Assertions verify the actual loaded version. No
package in the active installation is patched or relinked. Command:

```sh
node .git/local-orchestration/t129-loader-lab/run.mjs
```

Final comparative run exit 0 (`t129-loader-lab.log`):

- Per version: 27 transform checks across all 11 repository schema files, Drizzle config,
  and `.ts`/`.mts`/`.cts` fixtures; 26 source-map assertions; two invalid-TS rejections with
  source filename and line checks.
- Native loader bootstrap uses Node 24 `register`, a tsconfig path alias, explicit TS
  imports, dynamic import, `import.meta.url`, malformed module import and the actual schema
  barrel. Both produce identical metadata for all 29 tables (column types/default flags,
  indexes, foreign keys, checks and unique constraints).
- API-produced source maps correctly map a generated synthetic throw back to original
  source line 3 in both versions. The `.cts` import-meta diagnostic is emitted in both
  versions and retained; this fixture does not establish working CJS import-meta semantics.

**Preserved negative result:** native legacy-loader runtime stack restoration on Node 24
does **not** report the original throw line in the baseline. It reports generated line 1
instead of line 3, including with `--enable-source-maps`. The candidate has the same
limitation. The strict original-location assertion remains in
`strict-source-map-red.mjs`, with failed outputs in `t129-loader-lab-attempt3.log` and
`t129-loader-lab-attempt4.log`. The final equality probe measures the same generated line
for both versions; it is not presented as passing original-stack restoration.

The initial lab setup also failed resolving a non-exported `get-tsconfig/package.json`
subpath (attempt 1); resolving its public entry fixed the harness. A later measurement
regex escaping mistake is preserved in attempt 5. These are harness failures, not evidence
of an application regression. The laboratory does not prove arbitrary transformation
equivalence: esbuild has documented behavior changes across minors; see its
[publisher changelog](https://github.com/evanw/esbuild/blob/v0.25.12/CHANGELOG.md).

## Adopted bounded resolution and permanent verification

The orchestrator reviewed the lab and independently repeated it in
`n2-t129-loader-lab.log`. The adopted workspace override is exactly
`"@esbuild-kit/core-utils@3.3.2>esbuild": "0.25.12"`. It intentionally crosses the
publisher's `~0.18.20` range and establishes compatibility only for the inspected APIs,
fixtures and actual repository tooling. It is not an upstream compatibility guarantee.
Drizzle ORM 0.45.3 / Kit 0.31.11 remain pinned; no RC, direct dependency, suppression or
business contract change was introduced. pnpm generated the resolution metadata and
removed the now-unreferenced esbuild 0.18.20 platform packages. The exact generated diff
is `t129-esbuild-lock-generated.diff`; the final diff is
`t129-esbuild-lock-final.diff`.

Permanent `apps/server/tests/migration-toolchain.test.ts` tests actual PostgreSQL 18 DDL:
fresh Kit generation must match the versioned journal's columns, enums, indexes and
constraints; repeated generation/migration must make no change. The upgrade case starts
at 0005, inserts synthetic linked owner/merchant/shipment/history/route data, migrates to
the current journal, compares preserved rows/schema and journal replay, and verifies the
new courier-record FK refuses a dangling reference. The current journal is read dynamically;
the final repeat below covers 0000–0007, not an uncreated future migration. Disposable
output is relative to the server because Kit does not support this absolute-output usage.
Generated versioned migration files are never edited by the harness.

| Adopted resolution verification | Exit | Actual evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | `t129-esbuild-frozen-install.log`; 944 policy entries, resolution skipped, 13.4s, no warnings |
| Adopted source-map probe | 0 | `t129-source-map-adopted.log`; oversized offset rejected |
| Adopted comparative loader probe | 0 | `t129-loader-lab-adopted.log`; bounded parity described above |
| `pnpm --filter @domy/server exec vitest run tests/migration-toolchain.test.ts` | 0 | `t129-migration-v2.log`; 2/2 tests, 1 file, 3.16s; fresh PG18 and 0005→0007 upgrade/replay |
| `pnpm --filter @domy/server typecheck` | 0 | Repeated in resumed N1; strict compiler passed |
| `pnpm exec eslint apps/server/tests/migration-toolchain.test.ts --max-warnings 0` | 0 | Repeated in resumed N1; no warnings/output |
| `pnpm exec prettier --check pnpm-workspace.yaml apps/server/tests/migration-toolchain.test.ts` | 0 | Repeated in resumed N1; both matched |
| Earlier `pnpm check` | 1 | `t129-check-final.log`; only concurrent T132 RED test formatting, no unrelated edit made |

The earlier adoption audits (`t129-audit-{all,dev,prod}-final.log`) all exited 0 with no
advisories (all: 959 dependencies). The repeated registry audit below supersedes that
snapshot. No installation was repeated merely to reproduce already-recorded success.

## New registry advisory discovered during resumed N1

On 2026-10-20 a fresh audit reported
[GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), updated the same
day: Vite 8.3.1 falls in affected 8.3.0–8.3.2; the patched same-minor release is 8.3.3.
The upstream issue concerns Windows command argument escaping in launch-editor and
requires attacker-controlled file/environment circumstances. This narrows applicability
but is not a resolution or approved exception. The macOS local run does not validate
Windows exploitability. No Windows payload was executed.

| Latest local command | Exit | Result |
| --- | --- | --- |
| `pnpm audit --json` | 1 | `t129-audit-all-v2.log`; 959 dependencies, 1 moderate Vite advisory, zero high/critical |
| `pnpm audit --dev --json` | 1 | `t129-audit-dev-v2.log`; 652 dependencies, same advisory |
| `pnpm audit --prod --json` | 0 | `t129-audit-prod-v2.log`; 280 dependencies, no advisory |

The source-map/esbuild findings no longer appear. T129 remains unchecked pending the
Vite resolution, reviewed pnpm lock normalization, integrated four local gates and
orchestrator N2 approval. Future 0008 migration work must be revalidated after it exists;
no result for that source is claimed here. No production DB, secret file or remote CI
was accessed.

## Adopted same-minor Vite patch — resumed executor evidence

Research R1 was aligned before changing the manifest on 2026-10-20. The exact web pin is
now **8.3.3**, the patched release listed in the primary
[GHSA-698v-4r3x-3vcv advisory](https://github.com/advisories/GHSA-698v-4r3x-3vcv).
The native targeted web update alone left vulnerable 8.3.1 paths under server/domain
Vitest. After orchestrator approval, native recursive transitive resolution removed those
paths as well; no Vite dependency was added to root/server/domain manifests.

| Local command | Exit | Evidence under `.git/local-orchestration/` |
| --- | --- | --- |
| `pnpm --filter @domy/web update vite@8.3.3 --save-exact` | 0 | `t129-vite-update.log`; 9.2s, four existing deprecated-subdependency warnings |
| `pnpm --recursive update vite@8.3.3 --depth 999` | 0 | `t129-vite-transitive-update.log`; 6.1s, same four deprecation warnings |
| `pnpm install --frozen-lockfile` | 0 | `t129-vite-frozen-install.log`; 23ms, resolution skipped, no warnings |
| `pnpm audit --json` | 0 | `t129-vite-audit-all.log`; 959 dependencies, zero advisories at every severity |
| `pnpm audit --dev --json` | 0 | `t129-vite-audit-dev.log`; 652 dependencies, zero advisories |
| `pnpm audit --prod --json` | 0 | `t129-vite-audit-prod.log`; 280 dependencies, zero advisories |
| `pnpm exec prettier --check apps/web/package.json pnpm-lock.yaml` | 0 | `t129-vite-prettier.log` |

Package-version inventory comparison against the pre-Vite lockfile removes only
`vite@8.3.1` and adds only `vite@8.3.3`; all remaining differences are associated peer
snapshot normalization. This includes the explicitly approved unchanged domain Vitest
5.0.3 importer normalization. The lockfile has no remaining `vite@8.3.1` references.
`source-map-js` 1.2.2, the scoped esbuild 0.25.12 override, Drizzle ORM 0.45.3 and Kit
0.31.11 remain unchanged. No hand-edited integrity values or new override were introduced.
Before/after and generated diffs are retained as `t129-vite-{before-lock,web-only-lock}.yaml`,
`t129-vite-{generated,final}.diff`; `t129-vite-package-delta.log` records the package inventory.
Audit exit codes/counts are captured in `t129-vite-audit-summary.json`.

There is no executable source in this sub-slice requiring ESLint; the manifest/lockfile
are formatted by Prettier. `eslint --no-warn-ignored ... --max-warnings 0` exits 0 because
these non-source files are outside its configured scope. Web typecheck and the integrated
four gates are pending the concurrent T132 contract implementation. No database, build,
browser test or global check was launched during this dependency-update window. These
registry snapshots establish corrected resolution, not universal dependency security or
Windows exploit reproduction. T129 remains unchecked pending independent N2 and integrated
verification; earlier deprecation warnings are retained without a zero-warning claim.

## Independent orchestrator checkpoint

Root inspected the manifest, scoped override and complete lockfile package-identity delta.
The web's only direct version change is Vite 8.3.1 → 8.3.3; vulnerable old resolutions are
absent, with no new direct package. Independent `pnpm audit --json` exited 0, reporting
959 total dependencies and zero advisories (`n2-t129-vite-audit.json`).

Root independently ran
`SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/server exec vitest run tests/migration-toolchain.test.ts`:
2/2 PASS, exit 0, 2.98s (`n2-t129-current-migration.log`). This repeat includes the
generated account-receipt migration 0008 in the current journal, fresh DDL equivalence
and historical upgrade/data preservation; it supersedes the earlier 0007-only snapshot.
The comparative loader laboratory was independently repeated earlier as recorded above.
Integrated check/test/e2e/build on the resulting T132 browser/server candidate remain
required before T129 closure; no current full-gate result is inferred from focused tests.

## Integrated orchestrator acceptance — 2026-10-20

Root independently inspected the implementation, contracts and permanent regression
coverage, then ran the four complete local gates sequentially on frozen source
`7d4227587e1661a45cd8c0ea4b14ee0efabd0b0a2cfaecfe359d78b865544d1d`
(440 source/config/test files; base `94a7e2450ec2abae4192f7f864e34c4638f7c963`).
The before/after source fingerprints match.

- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm check`: exit 0.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm test`: exit 0; 1,215 tests
  (283 domain, 655 server, 277 web), including isolated capacity projects.
- `env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm test:e2e`: exit 0;
  106/106 first-attempt Chromium scenarios, 5.7 minutes, including full axe coverage.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm build`: exit 0.

Actual logs: `.git/local-orchestration/n2-batch2-actor-{check,test,e2e,build}.log`;
source inventories: `batch2-actor-candidate-{before,after}.json`. No gate warning or retry
was observed. Earlier failed/interrupted attempts remain historical evidence. Root
approved this task's local closure after both QA levels; this does not certify physical
Android/iPhone acceptance, provider configuration or production readiness.

## Production-readiness audit — 2026-11-02 (T157)

`pnpm audit --prod` failed on `main` `683bad1` with `better-auth` 1.7.6 (critical, high and low)
and `seroval` 1.6.8 (two moderate). Domy's auth configuration has no Magic Link, OAuth or OAuth
Proxy and stores no rate-limit records in the database, so by each advisory's own conditions the
`better-auth` ones do not apply; they are patched anyway.

`better-auth` stays at the first patched version. On 1.7.10, 1.7.14 and 1.7.15,
`tests/account-integrity.test.ts` fails two cases: the rollback when native session deletion fails,
and the check that raw SQL and credential parameters never reach the native logger.

Remaining after the fix, proposed as accepted risk and pending the owner's confirmation: `glob` and `minimatch`
(moderate) reach production only through `@sentry/bundler-plugins`, which `src/index.ts` does not
load, and upgrading `@sentry/node` to 11.10.0 does not remove them; `deepmerge` (low) is
development-only and has no patched version.
