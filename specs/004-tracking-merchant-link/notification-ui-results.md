# Notification UI verification — T022

## Presentation slice — 2026-10-22

T022 remains open. This receipt currently accepts only the controlled merchant row
and shipment-detail presentation; page, navigation, durable sync and full story gates
are pending. Prerequisites T019–T021 and R21 are verified in their linked receipts.

Executor N1 passed 358 web tests and scoped formatting, lint and types. Root reviewed
the complete row and shipment-detail diff. A discovered zero-selection action was
corrected: provided selected counts must be positive before copy/WhatsApp is enabled.
Inactive merchants cannot start sharing; already-ready marks retain their retry.
Prepared recovery does not claim notification success. Detail copying uses the
validated public origin and Spanish actionable feedback; notified time uses the
existing Bogotá formatter. No private actor identifier is rendered.

Root N2 passed:

- `env -u NO_COLOR pnpm --filter @domy/web exec vitest run --exclude 'src/features/notifications/*.test.ts'`: 358 tests, 41 files, 1.90s.
- `pnpm exec prettier --check apps/web/src/features/notifications/merchant-notify-row.tsx apps/web/src/features/shipments/shipment-detail.tsx`
- `pnpm exec eslint apps/web/src/features/notifications/merchant-notify-row.tsx apps/web/src/features/shipments/shipment-detail.tsx --max-warnings 0`
- `pnpm --filter @domy/web typecheck`

The exclusion isolates unfinished concurrent core tests; it is not full web/story
acceptance. Native copy/open/keyboard behavior remains subject to T019/T022 browser
verification. Logs: `.git/local-orchestration/notifications-t022-ui/`, including
executor follow-up logs and root `root-{unit,format,lint,types}.log`.

Dirty working tree, branch `codex/local-readiness-orchestration`, base `94a7e24`.
Accepted source SHA-256:

- `merchant-notify-row.tsx`: `ab7d7e2aeb275ba884bc7c9212f991ac7d1a69afeb006909e71dee1bf31c6fd`
- `shipment-detail.tsx`: `15731a7f54872450377aa0a39f1843f7c53fa3907861a1be09fffa322f0b3926`

No DB/build/E2E, publication or deployment occurred in this slice. Catalog remains
72/81 verified (89%); 9 tasks remain open.

A subsequent copy-only wording alignment uses “Debes agregar…” for the existing
T019 acceptance locator. Both levels passed scoped formatting/lint on the final
row. Executor repeated types encountered an unrelated concurrently authored
core-test exact-optional-property error; its failure log is retained. The earlier
358-test/type result predates this text-only adjustment; full integration must
repeat types with the completed core. No task marker changed.

## Durable core slice — 2026-10-22

Executor N1 and root N2 both passed full domain (424 tests,24 files), full web
(381 tests,44 files), scoped Prettier/ESLint and recursive types. Root source
review and separate read-only Luna/max review found no HIGH/CRITICAL defect.
Root N2 durations were965ms domain and2.81s web. All eight file hashes exactly
matched the executor's frozen source. Logs live under
`.git/local-orchestration/notifications-t022-core/`; initial RED, fixture/compiler/
lint failures and subsequent corrections are retained rather than overwritten.

The generic shared filter serves composition, selection and counts. Native Hono
RPC retains inferred types. Pending metadata is strict, canonical, actor-keyed,
PII-free and prepared synchronously. Only ready actions can POST after fresh
session verification; server-side actor headers protect the later session race.
Native locks re-read exact identities for phase transitions/discard/ACK. Corrupt
or unavailable storage preserves work and fails closed. Two tabs may replay the
same immutable UUID/payload; the verified server handles idempotency. Tests retain
prepared crash recovery, replacement-before-cleanup, late-discard/ready races,
corrupt actor/action metadata and server-success/local-ACK-failure retry.

The single panel hook responds to route changes, focus, reconnection, periodic
checks and cross-tab storage events. Successful sync invalidates affected list,
shipment and history queries. Actual panel mounting and native gesture caller
remain unimplemented at this checkpoint; final integration and browser gates
are still required. T022 remains unchecked; count stays72/81 (89%).

Core SHA-256 identities:

- Domain helper: `55dca2a3562bffcf9c5c3a4c24b73e51b1ea0bca8ba2a0085664b349412412a4`
- Domain tests: `19baaf461f971f55529c06d0021732a27e056ffe4b53d9c3532f12fb0461df4c`
- API: `d8dc9232882c1193879d4fe335cde21c74a0d9f22b4b0948c201559cfbf81fbb`
- API tests: `04ac4595b5370c8eff061426964ee9f55612b4d49a43bb0ac53c1400596ff9f7`
- Intent store: `1c826f4aef279d2ab118fbf4835f41b2923cfaa3405d823ff83882ff290ef7f4`
- Intent tests: `e46bd602c6f2a6e3285014dd0d558e05c5b66364af7f2944f236e9646a929047`
- Sync: `9b31493ba25f1f58f878978cb4f72bba887ce1bbef03e6e4d3bfacd05ed3d5a8`
- Sync tests: `09c3fc2e3ed53cdc4d7aeff3c25d3a9c06369810eff7c875f63c1de5e110cacf`

## Additional recovery browser RED — 2026-10-22

Before page implementation, root authored `notification-recovery.spec.ts` and ran
`env -u NO_COLOR pnpm --filter @domy/web exec playwright test tests/e2e/notification-recovery.spec.ts --retries=0`.
All four cases created valid native API fixtures and failed only at the intended
missing notification heading (5.5/5.3/5.3/5.3s). Later failure/recovery assertions
were not reached and are not claimed passing. Source mutation/build was held
through this run. First output and traces are retained under
`notifications-t022-core/root-recovery-red.log` and
`root-recovery-red-artifacts/` in the local orchestration directory.

Cases retain actual browser storage denial, blocked popup, denied clipboard and
prepared metadata surviving reload without an automatic POST; an explicit later
copy must use a fresh identity and retire only the superseded prepared action.
Two harness-only lint issues were subsequently corrected (native-method capture
and a void-expression callback), with final scoped ESLint passing. Integration
N1/N2 must execute all later assertions on the final source.

## Reopened core review edge — in progress

Root subsequently found that invalidation after the whole batch skips earlier
successful marks when a later mark fails, and that a second tab's ACK-removal
storage event refreshed only pending metadata. Stale server-backed rows could
therefore offer sharing again. The executor reproduced the first mechanism with
a causal two-intent RED (`followup-invalidation-red.log`); the bounded fix and
repeated N1/N2 are required before dependent assembly resumes. A fifth browser
case requires a genuinely already-open second tab to refresh after ACK without
focus, reload or the30-second interval. Previous accepted hashes above describe
the pre-follow-up slice only; T022 is still open.

The follow-up is now independently verified: causal batch and ACK-failure RED
logs retained; N1 and root N2 full424domain/382web plus scoped static/recursive
types all pass. Root web2.72s. Per-success invalidation runs before ACK and before
the next intent; actor-key storage events refresh actor-specific lists and shared
detail/history views. Root reviewed unchanged interfaces and exact new hashes:
`use-notification-sync.ts`23191a91b335c7c9517ff0848621e11515bbf55b5e1916e03739ee366f0d8f3d;
its test80962f60f41e8faff76384141ca60abda13320af1eec69ea9360e7d24c8e8e70.
Dependent assembly is released. Actual second-tab browser coverage still remains
pending; no other slice/task marker is closed by this verification.

## Integration browser N1 — first attempt

The generated route, panel navigation, one panel sync hook, persistent recovery
banner and page now build and pass executor scoped static/recursive types.
Executor's first native eight-case run passed7 and failed1 (23.8s). All five new
recovery cases,21-shipment compact copy and lost-ACK navigation/reload passed.
The main WhatsApp case stopped before sharing because a substring card selector
matched both `Comercio T019 …` and `Otro comercio T019 …`. First output/traces
are preserved at notifications-t022-integration/n1-browser-first.log and
n1-browser-first-artifacts/. This was a fixture-selector ambiguity, not success
of the later WhatsApp assertions.

Root corrected the helper to the article's exact accessible name, retaining all
counts/content checks. An earlier unscoped Notificado visibility assertion was
also aligned to the exact detail term; its precise Bogotá timestamp assertion
remains. Current T019 SHA-2560286b40fb488ca1dde4318e4f3f5a43990d4a84526ecbbc12623148e24842c71.
Repeated native N1/N2 and full story gates remain pending. No runtime source was
changed for the selector correction.

## Integration focused acceptance — 2026-10-22

Executor N1 rerun passed all8 native cases20.9s after only the exact-card helper
correction. Root independent N2 passed all8 cases21.9s. Both commands used
`env -u NO_COLOR pnpm --filter @domy/web exec playwright test tests/e2e/notify-merchants.spec.ts tests/e2e/notification-recovery.spec.ts --retries=0`.
First failure and both success artifacts are retained in the integration logs.

Root reviewed the entire page and panel diff: synchronous validated metadata
persistence precedes the native popup/clipboard call; no await/session/network
blocks user activation. Only external success promotes ready; failure removes
only the exact prepared action. Captured immutable selection/actor/UUID drives
retries. The hook mounts once in the office panel; date-only recovery links and
same-tab snapshot refresh retain prepared/ready guidance across navigation.
Office roles are inherited from the verified panel guard. Shared eligibility
serves counts,IDs and composition; inactive/empty selection is disabled by the
controlled row. Non-API errors use fixed Spanish recovery copy. Vite generated
the route tree; no hand edits, new dependency or private data in pending storage.

Real browser checks now pass: same-tap WhatsApp with its response gated, actual
tracking/merchant links, new-only/all-date selection,21-item compact copy, missing
phone copy-only, detail tracking copy/Bogotá time, committed lost-ACK same-UUID
replay, blocked storage/popup/clipboard no marks, prepared reload/manual repeat,
and unfocused second-tab ACK refresh. Axe assertions remain unchanged and pass.
External WhatsApp is intercepted in tests; this is not physical-app acceptance.

Root's522-file manifests before and after focused N2 are identical:
670aaf595ae54d7f31c4b8f7e949f96ac6bcf1148802dac3f18b494ae9b002dd.
Full check/test/E2E/build are running or pending; T022 remains unchecked until
all pass. Catalog remains72/81(89%),9open.

## Full story gates — first integrated attempt

Root full check passed and full test passed1561 (424domain/755server/382web;
server144.54s). Thus the earlier T021 full-server stale-test failures are now
resolved in a single full server run. Native full150-case browser command then
found an existing role-access selector `name: "Clientes"` matching both the
master-data link and the new `Notificar clientes` link. Root inspected its trace
and snapshot, preserving the first output/artifacts before any repeat. The run
was intentionally interrupted for correction:18PASS/1FAIL/1interrupted/130notrun,
2.1min; it is not a completed passing suite. Playwright received SIGINT and
finished native teardown before mutation/relaunch.

Root added `exact: true` to that one link selector, preserving the required
visibility assertion and actual role boundaries. A search found no other same
ambiguous Clients link selector. Scoped formatting/lint pass; no product or unit
source changed. All522 files were unchanged through the interrupted run
(670aaf59). The new full source identity after this sole test edit is
edc9e6f1852eedc908f9f2fa4374f49e3bd96c50b327e4a41fb1a06b6bcaff47.
Full check/browser are being repeated on that identity; full final gates remain
required. Original failure and interruption artifacts stay under
root-full-browser-first-artifacts/; no retry-green claim replaces them.

## Final browser and build gates — 2026-10-22

Root final full native browser command passed150/150 in9.4min, retries0.
The cold weak-network visibility measurement was2860.6ms (budget3000ms); no
budget, waits, retry or scanner exclusions were weakened. Full first failure and
interruption remain archived, with the exact selector correction documented above.
Root final `pnpm check` and `pnpm build` passed; build emitted the native PWA worker
without warnings. Before/after full browser and after build522-file manifests
all match edc9e6f1852eedc908f9f2fa4374f49e3bd96c50b327e4a41fb1a06b6bcaff47.

Although the earlier full1561-test run passed on identical unit/runtime inputs,
root is repeating `pnpm test` after the final browser-only locator change so all
four final commands reference the same full manifest. Task closure awaits that
last command. Logs: root-check-final.log, root-full-browser-second.log,
root-build-final.log and root-full-test-final.log; successful browser metadata
is archived separately. No remote CI, physical acceptance or deployment occurred.

## T022 closure — verified local

Final `pnpm test` passed1561 (424domain507ms;755server177.51s;382web2.08s),
exit0. Together with final full check,150-case native E2E9.4min/retries0 and
final build, all four gates pass on the identical522-file full manifest edc9e6f1
recorded above. Root final-before/final-after manifests are exactly equal.
T022 is now checked after executor verification and independent root audit.
Catalog73/81(90%),8open. T030 role/read-only matrix and T032 accessibility are
now eligible in parallel; documentation follows their verification. Deferred003
and004 physical/final/provider obligations remain open. No deployment/publication.
