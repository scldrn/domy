# Public layout and worker isolation — 004/T007

Date: 2026-10-22, America/Bogota. Local dirty branch
`codex/local-readiness-orchestration`, base `94a7e2450ec2abae4192f7f864e34c4638f7c963`.
Prerequisites T001/T003 verified. Public story data/projections remain future tasks.

## Reopened after independent audit

The earlier acceptance below is superseded for task closure: independent review
found TanStack case-insensitive/decoded public path aliases bypass the literal
SW guard. T007 is reopened; no current public-data disclosure is demonstrated.
Correction and alias regressions must pass before the task closes again.
Current catalog49/81 (60%),32 open.

## Implementation

Direct root virtual routes /seguimiento/$code and /cliente/$code load separate lazy
chunks. Shared presentational layout provides Domy header, optional configured
company/support actions, 48px targets and responsive 320px spacing. Unset phone
hides contact links; no example contact or fabricated shipment data is displayed.
Generic preview metadata is preserved. TanStack/Vite generated the route tree;
no generated file was hand-edited. Build emitted tracking, merchant-page and
public-layout chunks with headings confined to their respective route chunks.

Initial public entry skips service-worker registration. Existing workers exclude
both public prefixes from navigation fallback using the same boundary-safe predicate;
private neighboring URLs retain normal behavior. No unregister, cache deletion or
outbox deletion was introduced. There is currently no internal public-to-private
navigation link requiring additional SPA registration behavior.

## Double local QA

Executor first captured three meaningful RED failures: missing route content,
one fresh public registration attempt, and both controlled public navigations
served from the worker. Preserved outbox/cache controls passed. Root found and
corrected a test expectation that selected the first page heading after navigating
to the second page; assertions now check each corresponding route.

Executor GREEN: 3/3 Playwright, 14.3s; 13/13 pure predicates; web types and scoped
format/ESLint pass. Its server source overlapped the T006 investigation, so this
run alone was not accepted as final exact-source evidence. Terminal color-variable
warning was retained and classified, without changing product checks.

Root reviewed the source and independently ran:

`env -u NO_COLOR pnpm --filter @domy/web exec playwright test tests/e2e/public-pages.spec.ts --retries=0 --reporter=list`

**3/3 pass, first attempts, 13.3s**, no terminal color warning. Actual global setup
uses disposable PostgreSQL/S3, migrations/seed, built web/worker and native API.
Both anonymous pages pass axe at320px; fresh visitors never register the worker;
already-controlled navigations use network with the original controller, cached
assets and real IndexedDB pending record preserved. Root also ran focused13 unit
tests, web typecheck, scoped ESLint/Prettier and diff check; all pass.

Root source before/after identical:479 files SHA-256
`fca79157660c5afb63fc161d377307253eb135cf9941d570db6facffa9d7d90a`.
Logs/source manifests: `.git/local-orchestration/public-t007/`.

## Decision and limits

T007 accepted locally. These are foundation shells, not completed public shipment
or merchant stories. Full foundation integration gates and later physical/mobile
acceptance remain open. Running LAN target retains sealed003; no deployment or
remote CI occurred. Catalog49/81 verified (60%),32 open.

## Alias correction and final root acceptance

The independent P2 finding above is resolved. The predicate now decodes and
lowercases only the first segment and handles malformed segments safely. Workbox
uses its native match callback for same-origin navigations outside API/public paths;
no invalid regex/path workaround, cache clearing or worker unregister is used.
Canonical and uppercase/encoded tracking/merchant paths are covered in fresh and
already-controlled browsers; both preserve controller/outbox/cache state.

Executor captured9 failing alias unit cases before correction (23 passing), then
32/32 units and4/4 combined real-browser scenarios in18.4s. Root reviewed the
normalization/callback and independently verified final full quality gates on
unchanged481-file source c13b486c19aa4f472b400b3caf235bb1568c8136b04eca261c5455d6d115b80e:
check,1376 tests,133 first-attempt E2E (7.7min),build PASS. This supersedes the
reopening notice for closure. T007 accepted again; canonical count51/81(63%),
30open after concurrent T008 closure. Full foundation receipt below governs.
