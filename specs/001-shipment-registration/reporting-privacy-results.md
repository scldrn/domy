# Native error-reporting privacy — 001/T152

## Scope and source

2026-10-20, local execution on `codex/local-readiness-orchestration`, based on
`94a7e2450ec2abae4192f7f864e34c4638f7c963`, with a shared dirty working tree.
Intent: FR-041, research R14, Constitution IX, finding IV-38 and canonical 001/T152.
The orchestrator aligned R14 and the plan before production changes. This receipt
describes local evidence; it does not close the task or certify external delivery.

## Design and analysis

Each application configures the installed Sentry 11.1.0 SDK directly through its
native options. `beforeSend` constructs a new event from permitted diagnostics;
it never spreads the input event. Request/transaction URLs, queries, headers,
bodies, users, contexts, tags, extra data, arbitrary messages, causes, fingerprints,
breadcrumbs, source context, local variables and attachment payloads are excluded.
Attachments are cleared from the native hint because they bypass event projection.
Caller-supplied event IDs and timestamps can also encode private values. Each outgoing
error receives a fresh native cryptographic UUID without hyphens, and its caller
timestamp is omitted. Therefore the ID returned by `captureException` is not a promised
correlation identifier for the delivered event; the application currently ignores that
return value. Permanent actual-native-capture tests inject hexadecimal and numeric
sentinels into these fields and check the complete envelope and generated ID format.

Server classification preserves T153's fixed labels and exact fixed SQLSTATE message,
or uses its native error-class projection for other exceptions. Project-relative
source positions are revalidated through the existing T153 filesystem bounds.
Labels bound disclosure and do not authenticate mutable exception provenance.
`reporting_site` fallback frames must never become original `source` frames.

Browser classification uses built-in exception instances. Only exact current
immutable module URLs yield numeric positions under the fixed `application.js`
filename. Other locations receive an explicitly labeled `reporting_site` fallback,
without invented fault positions. Other lazy chunks intentionally fall back.

The error-only policy disables default BrowserSession/ProcessSession integrations,
client reports, log/metric delivery and transaction events. Explicit zero tracing
sampling overrides Node's optional tracing environment variable. No replay/profiling
integration is installed. Native error integrations and ordinary error delivery stay
enabled. No new dependency, wrapper, schema, endpoint or T153 callback was introduced.
Removed SDK options (`sendDefaultPii`, `autoSessionTracking`, `enableLogs`) are not
invented or forced through casts; native types and actual envelopes are authoritative.

## Permanent RED and correction

Before production edits, all three permanent regressions were run against the
original native initialization options:

- Server: real HTTP listener, actual Hono application and disposable PostgreSQL
  `22P02` failure. Error delivery, DatabaseError, SQLSTATE and structural location
  assertions passed; complete-envelope privacy failed.
- Browser native SDK: actual error envelope contained runtime message/cause,
  breadcrumbs, scope and stack URL values; complete-envelope privacy failed.
- Compiled lazy browser: an actual global TypeError reached a loopback HTTP intake,
  but complete-envelope privacy failed. Disabled reporting passed.

Only boolean privacy assertions are printed. No envelope or runtime sentinel is
printed in test output. Local logs preserve these failures in
`.git/local-orchestration/t152-{server,web,browser}-red.log`. An initial server
listener-readiness setup failure and a browser test-intake interception setup failure
were corrected before recording the meaningful privacy REDs; these were fixture
defects, not unexplained intermittent production failures.

The orchestrator's preliminary review also identified fallback source promotion.
The correction keeps fallback labels distinct and adds a permanent contrasting
source/reporting-site regression. Native capture tests additionally cover rich
request metadata, attachments, mutable exception names, causes, source URLs,
allowed artifact locations, caller-selected IDs/timestamps, and no-DSN behavior.

## Local validation

Commands run from the repository root, with `SENTRY_DSN='' VITE_SENTRY_DSN=''` for
executables. Every configured test DSN uses an in-memory transport or loopback.

| Command | Latest observed result |
| --- | --- |
| `pnpm --filter @domy/server exec vitest run tests/reporting-privacy.test.ts tests/log-redaction.test.ts` | 27 tests, 2 files PASS, 5.17 s |
| `pnpm --filter @domy/web exec vitest run src/lib/reporting-privacy.test.ts` | 3 tests PASS, 240 ms |
| `pnpm --filter @domy/web exec playwright test --config tests/playwright.reporting-privacy.config.ts` | 2 first-attempt Chromium tests PASS, 7.3 s |
| `pnpm --filter @domy/server typecheck` | PASS |
| `pnpm --filter @domy/web typecheck` | PASS |
| `pnpm exec eslint` on all eight owned TS/TSX files with `--max-warnings 0` | PASS |
| `pnpm exec prettier --check` on those same files | PASS |
| `pnpm check` | PASS |
| `git diff --check` | PASS |

The isolated browser configuration builds enabled and disabled application bundles
with `envDir:false` under ignored `apps/web/test-results/`, serves both locally and
captures full error envelopes in a real loopback intake. It runs the repository's
unmodified WCAG 2.2 AA accessibility helper. It does not reuse a development bundle,
disable assertions or replace SDK capture with a mock. The same spec remains part
of the normal browser suite.

Evidence logs: `.git/local-orchestration/t152-{server,web,browser}-green.log`,
`t152-{server-typecheck,typecheck,lint,format,check}.log`. These logs are local and
are not committed or remote CI records.

## Scoped convergence

Spec, plan, R14 and canonical task agree on the native SDK boundary. The change
introduces no domain, data-model, API-contract, transaction, offline or visual-design
change. All nine constitutional principles were rechecked; the protected existing
T150/T151/T153/T155 regressions remain in place. The local privacy scope has no known
unresolved design finding after the fallback and caller-metadata corrections. This
is a scoped assessment subject to orchestrator review, not global convergence.

## Remaining gates and limitations

Orchestrator review and fresh complete local test/e2e/build gates on the integrated
source remain required before task closure. Real Sentry account delivery, deployed
infrastructure, physical-device acceptance and production configuration are not
claimed. No external telemetry, GitHub workflow, publication or deployment occurred.
This bounded disclosure policy does not prove authenticity of caller-supplied
errors or source positions and does not promise that no unknown defect exists.

## Orchestrator verification — 2026-10-20

Decision: **verified locally and approved for dependency unlocking**. The orchestrator
inspected the implementation, native API/SDK contracts, negative checks, scope and
regressions; it identified and required the reporting-site correction before closure.
The final frozen source identity is
`0c356fec6fd3de1daf6df72b359664eff202ad7d88e752b5905f017046f92a6f`
(427 source/config/test files; base `94a7e24`, dirty local branch).

Independent local QA, all exit 0: `pnpm check`; `pnpm test` (282 domain + 631 server +
237 web = **1,150**); `env -u NO_COLOR pnpm test:e2e` (**100/100**, 6.3 minutes, no retries);
`pnpm build`. General commands used explicit empty `SENTRY_DSN` and `VITE_SENTRY_DSN`;
reporting tests captured only in memory/loopback. Logs: `.git/local-orchestration/n2-*.log`.
The final code fingerprint matched before/after verification; `git diff --check` passed.

The owning canonical task is now checked. This is local implementation verification,
not publication, remote CI, provider, physical-device or production acceptance.

## Native trace-lifecycle follow-up — 2026-10-21

After the prior integrated verification, the next full local test run (`--silent=false`)
exposed Sentry 11.1.0 warnings from `beforeSendTransaction` in both reporting configs.
The installed native `@sentry/core` options document confirms the default
`traceLifecycle: "stream"` ignores this deprecated option. Its native
`beforeSendSpan` callback must return a span, so it is not a discard hook. The design
remains error-only: keep explicit `tracesSampleRate: 0`, remove the ignored transaction
hook, and do not enable static tracing or add a span callback.

New permanent native tests attempt an actual browser/server `startSpan` with a private
span-name sentinel while capturing a useful `TypeError`. They assert one sanitized
error envelope, no span or transaction item, no sentinel, explicit zero sampling, and
absence of the ignored option. A `vi.spyOn(console, "warn")` call-through assertion
checks the real SDK warning without replacing `console.warn` or hiding output. The
existing complete-event privacy and disabled-DSN cases remain unchanged.

**RED before configuration correction**, with the ignored hook still present:

- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/web exec vitest run src/lib/reporting-privacy.test.ts --silent=false` — 3 passed, 1 failed at the native options assertion; SDK warning printed for each initialization.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm --filter @domy/server exec vitest run tests/reporting-privacy.test.ts --silent=false` — 4 passed, 1 failed at the native options assertion; SDK warning printed for each initialization. This suite used its real PostgreSQL fixture.

Logs: `.git/local-orchestration/t152-span-policy-red-web.log` and
`.git/local-orchestration/t152-span-policy-red-server.log`. Captured events and
synthetic sentinels were not printed.

To verify the permanent warning assertion, a second negative run temporarily restored
the old hook in both configs. The tests failed specifically because the native warning
was observed; the call-through spy left it visible in stderr. The temporary hook was
removed before the final GREEN run. Logs: `.git/local-orchestration/t152-span-policy-red-spy-web.log`
and `.git/local-orchestration/t152-span-policy-red-spy-server.log` (web 3/4 and server
4/5 passed; each focused case failed at the warning assertion).

**GREEN after removing only `beforeSendTransaction` from the native configs**:

- The same web command — 4/4 tests passed; no SDK warning.
- The same server command — 5/5 tests passed against real PostgreSQL; no SDK warning.
- Both new cases delivered only the sanitized error event after the native span attempt.

Logs: `.git/local-orchestration/t152-span-policy-green-web.log` and
`.git/local-orchestration/t152-span-policy-green-server.log`. Fresh focused N1 checks
also passed: web/server typecheck, ESLint on the four changed TypeScript files with
`--max-warnings 0`, Prettier on the changed TypeScript and three T152 documents, and
`git diff --check`. Their logs are `.git/local-orchestration/t152-span-policy-{web-typecheck,server-typecheck,eslint,prettier,diff-check}.log`.
This is focused N1 evidence only. Root's integrated N2 quality gates remain required
before T152 closure. No browser, build, full suite, external telemetry or remote
workflow ran in this follow-up.

## Root N2 approval — 2026-10-21 (America/Bogota)

Independent root source/contract review and all local gates pass on unchanged
456-file source SHA256 `dbb77ffd7d5b368d5a78bfa2e072e85eca3f3fc214e9779f5d454445a63c691e` (dirty tree, base94a7e24):

- `SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm check` — exit0.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm test --silent=false`
  — 1,281 tests:283 domain/677 server/321 web, no SDK warnings.
- `env -u NO_COLOR SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm test:e2e`
  —121/121, first attempt,6.3 minutes; includes compiled enabled/disabled reporters.
- `SENTRY_DSN='' VITE_SENTRY_DSN='' caffeinate -i -s pnpm build` — exit0.

Logs use `.git/local-orchestration/n2-courier-native-{check,test,e2e,build}.log`.
Before/after source inventories match exactly; browser interval11:24:02–11:30:20
had zero native Sleep events. Root capacity measurements:5 ms snapshot and215 ms
50-disbursement batch over 15 shipments (worst of 5), unchanged 500 ms/2 s limits.
All earlier test-side failures and the SDK-warning attempt remain preserved.
The native ignored-hook follow-up has its own real RED/4web+5server GREEN;
no warnings, assertions, retries, workloads or axe rules were suppressed.

Root approves the owning technical task locally after both QA levels. This does
not certify phone acceptance, provider delivery, deployment or release readiness.
