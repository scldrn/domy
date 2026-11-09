# Local runtime lifecycle and CSP plan (OP-01)

**Status:** root N2 lifecycle corrections and focused native verification are complete. Root
review and the four local quality gates remain. This document does not authorize
Caddy/container work, deployment, remote CI, phone scenarios, or task closure. The owner
deferred phone scenarios; no second restart of target B is in scope.

This slice defines the minimum runtime contract that the later local deployment artifacts
may rely on. It aligns with [OP-01](integral-execution-backlog.md#op-01--deployment-upgrade-and-recovery-runbook),
the [deployment artifact plan](local-deployment-artifact-plan.md#required-application-work-before-the-artifacts-can-pass-op-01),
the [deployment inventory](local-deployment-inventory.md), and Constitution Principles I,
V, VI, VIII, and IX. It is deliberately limited to the existing Node/Hono process, PostgreSQL
readiness, orderly SIGTERM handling, and the Hono CSP. It adds no service, database object,
dependency, business rule, proxy-trust policy, or provider behavior.

## Existing source and design constraints

`apps/server/src/index.ts` creates the PostgreSQL client and Hono app. The executable must
adapt `app.fetch` with `getRequestListener()` and pass it to Node's `createServer()` so the
retained handle has the exact native HTTP `Server` type. Do not use `serve()` here: its
`ServerType` union includes HTTP/2 servers without `closeAllConnections()`, which can leave a
drain waiting forever after its deadline. The installed adapter is `@hono/node-server` 2.1.3;
its `getRequestListener()` preserves Hono's Node request context, including the native socket
peer used by the trusted-proxy resolver. Node 24 supplies the HTTP close/drain primitives.
The installed `postgres` 3.4.9 client supports transaction-local
`statement_timeout` and bounded `db.$client.end({ timeout })` teardown. Use these existing
primitives directly; add no process manager or shutdown package.

`createApp()` already receives the database and applies Hono `secureHeaders()` to all
responses. Its CSP currently contains only `frame-ancestors 'none'`. The web app is a
same-origin Vite build: API and Better Auth calls use relative `/api` paths; the manifest,
service worker, scripts, CSS, and self-hosted font assets are served from the app origin.
Observed web requirements are:

| Source behavior | CSP consequence |
| --- | --- |
| The PWA manifest and classic service worker are emitted by `vite-plugin-pwa`; the worker is registered from a same-origin Vite chunk. | `manifest-src 'self'` and `worker-src 'self'`. |
| Courier photo and shipment-draft previews use `URL.createObjectURL()` and render local `blob:` images. | `img-src 'self' blob:`. No remote image host was found. |
| React components set runtime layout values through `style` attributes, including CSS custom properties and positions in the sidebar, toast, route stop list, and day ribbon. | Keep `style-src 'self'`; allow only `style-src-attr 'unsafe-inline'` for these observed attributes. Do not add script inline allowances. |
| CSS and Archivo fonts are bundled locally. | `style-src 'self'` and `font-src 'self'`. |
| Optional browser Sentry loads a bundled same-origin chunk and sends events to the DSN host. | If enabled, `connect-src` needs that one exact HTTPS origin. The server derives `browserReportingOrigin` from the existing public `VITE_SENTRY_DSN` configuration after strict validation. With browser Sentry disabled, allow only `'self'`. Do not use a wildcard or blanket `https:` source. |
| WhatsApp and Google Maps appear as user-followed links, not fetch, script, image, or frame requests. Web Push delivery is browser-managed and its application API calls remain same-origin. | These do not require external `connect-src`, `script-src`, or `img-src` entries. |

The inventory found no inline script requirement, `eval`, iframe, external font, or remote
image requirement. Keep `frame-ancestors 'none'` and `X-Frame-Options: DENY`.

## Proposed HTTP contract

Expose two unauthenticated `GET` routes under `/health`, with constant responses, no database
or infrastructure details, and `Cache-Control: no-store`. They do not include request IDs,
hostnames, version strings, dependency names, exception text, or credentials.

| Route | Success | Failure | Database work |
| --- | --- | --- | --- |
| `GET /health/live` | `200 {"status":"ok"}` while the process can serve the route. Liveness remains 200 during drain so a shutdown does not trigger a restart loop. | No dependency-derived failure state. | None. |
| `GET /health/ready` | `200 {"status":"ready"}` only when the runtime is not draining and a read-only `SELECT 1` completes within the approved 1,000 ms decision deadline. | `503 {"status":"unavailable"}` when draining, when PostgreSQL rejects/fails the probe, or when the decision deadline expires. The body is identical for all failure causes. | A read-only transaction on the existing `Db`, with `SET TRANSACTION READ ONLY`, transaction-local `statement_timeout = '750ms'`, then `SELECT 1`. |

Approved budgets are a 750 ms PostgreSQL statement timeout, a 1,000 ms readiness decision
deadline, and a 1,500 ms maximum native HTTP acceptance target, leaving 500 ms for network
and scheduling margin. Keep at most one readiness probe in flight per app runtime state:
requests arriving while it is pending share that promise, and every response observes its own
1,000 ms decision deadline. Retain the shared promise until the actual query settles, even if
all callers have timed out; this prevents a busy/unavailable pool from accumulating one queued
query per health poll. A timed-out response remains 503 even if the underlying query later
recovers; its transaction-local statement timeout limits work once PostgreSQL starts the
statement. These budgets and pending-query semantics are approved by root.

The readiness handler must check `draining` before starting a probe and again before returning
200. A signal arriving during the query therefore cannot leave the process advertised as
ready. Readiness does not inspect S3, mail, push, or Sentry: those are not required to answer
ordinary API requests and must not turn the liveness/readiness path into a provider health
fan-out. Health endpoints remain outside Better Auth and the public business API rate limiter.

## Proposed runtime handoff and shutdown sequence

Use one plain per-app runtime state object, created as a typed object literal in `index.ts`
for the process entrypoint and passed into `createApp` through optional `AppDeps.runtime`.
`createApp` uses a fresh typed object literal when callers omit that dependency, so existing
tests and app-only consumers keep working. Do not add a one-use initializer factory. Health
routes read the same state reference through Hono context. The state needs only `draining` plus
the single optional in-flight readiness promise. `runtime-lifecycle.ts` owns the SIGTERM
listener and mutates the same `draining` value; no second state store or lifecycle framework
is needed.

The planned ownership boundary is:

| File | Planned responsibility |
| --- | --- |
| `apps/server/src/lib/runtime-lifecycle.ts` | A small Node-specific SIGTERM registration accepting a native Node HTTP `Server`; it marks the supplied state draining immediately, memoizes one shutdown promise, stops accepting new HTTP connections, allows active requests to finish for a bounded grace, closes lingering connections at the deadline, and ends the existing PostgreSQL client with its built-in timeout. It logs only safe stage/outcome fields once per failed stage and never calls `process.exit()`. |
| `apps/server/src/routes/health.ts` | The two constant health routes and the bounded read-only database probe. The route reads the runtime state already present in `AppEnv`; it adds no route-specific authentication or business rules. |
| `apps/server/src/app.ts` | Add the runtime state to the existing `AppDeps`/request context, mount `/health`, and configure the one Hono CSP policy in the existing `secureHeaders()` middleware. Keep existing response privacy and framing headers. |
| `apps/server/src/index.ts` | Create the single runtime state, pass it into `createApp`, construct and retain `createServer(getRequestListener(app.fetch))`, then register the lifecycle handler with that server, the already-created `db`, and the existing logger. |

The approved minimal TypeScript contract (shape only, not a source patch) is:

```ts
export type RuntimeState = {
  draining: boolean;
  readinessProbe: Promise<void> | undefined;
};

registerGracefulShutdown({ server, db, runtime, logger });
```

`AppDeps.runtime` is optional so app-only use gets a fresh state per app; the executable
`index.ts` passes its explicit state to both the app and lifecycle handler. `AppEnv.Variables`
exposes that same reference to routes. `RuntimeState` should live in
`lib/runtime-lifecycle.ts` or a tiny shared runtime-types module only if that avoids a circular
import; do not create a second lifecycle abstraction. `health.ts` receives the existing typed
`Db` and the same state through normal Hono dependency/context wiring.
`registerGracefulShutdown` receives the retained Node `http.Server`, existing `Db`, shared
state, and existing Pino `Logger`; its approved timing constants stay local to the lifecycle
module. The probe promise resolves with no payload and rejects on database failure; the route
maps all failures to one response.

The first SIGTERM sets `draining` synchronously and starts shutdown once. Repeated SIGTERM
signals return to the same operation rather than starting duplicate close calls or invoking
Node's default immediate termination. The shutdown operation calls `server.close()` to stop
accepting connections, lets active requests finish, and uses the native HTTP server's
`closeAllConnections()` only after the drain deadline. The exact `http.Server` type makes this
operation available without an HTTP/2 fallback branch. There are no WebSocket routes today; if
one is added, its upgraded sockets need a separate explicit drain contract before release.

After the server has drained or the forced-close deadline has fired, call
`db.$client.end({ timeout: 2 })`. Do not close PostgreSQL before active request handlers have
finished. Use the approved 7-second HTTP drain and require the later production Compose
`stop_grace_period` to be at least 12 seconds, leaving time for database teardown and process
exit. Do not force exit: after the server and database handles close, Node should exit
naturally. If close fails, set a nonzero `process.exitCode` after recording a sanitized error;
never log the raw cause, request path/query, cookies, authorization values, or environment.
Reuse the existing `errorForLog()` sanitizer if an error needs diagnostic logging.

The proposed runtime type and function names are review aids, not a requirement to add an
abstraction layer. Prefer the smallest concrete shape that keeps health state and shutdown
state identical. This plan does not change `createDb()`, the database schema, route business
logic, error catalog, API client types, proxy address trust, or provider configuration.

## Proposed CSP policy

Configure one policy through the installed Hono `secureHeaders()` middleware. Do not add a
second policy in Caddy; the effective response must have one coherent CSP, because duplicate
policies are intersected by browsers. The candidate directives are:

| Directive | Candidate value | Evidence |
| --- | --- | --- |
| `default-src` | `'self'` | Same-origin application shell and APIs. |
| `base-uri` | `'self'` | The app has no external base URL requirement. |
| `object-src` | `'none'` | No object/embed usage found. |
| `frame-ancestors` | `'none'` | Preserve current anti-framing contract. |
| `script-src` / `script-src-elem` | `'self'` | Built Vite scripts, route chunks, and PWA registration are same-origin. |
| `script-src-attr` | `'none'` | No inline event handler requirement found. |
| `style-src` / `style-src-elem` | `'self'` | Stylesheets and font CSS are built assets. |
| `style-src-attr` | `'unsafe-inline'` | Narrow allowance for the enumerated React `style` props; remove only after replacing and testing those dynamic styles. |
| `img-src` | `'self' blob:` | Same-origin icons and locally previewed object URLs. |
| `font-src` | `'self'` | Self-hosted Archivo assets. |
| `connect-src` | `'self'` plus the exact validated browser Sentry origin only when configured | Relative API/Auth fetches; optional browser Sentry is the only external connection found. The server validates the existing public `VITE_SENTRY_DSN` value as an HTTPS DSN and passes only its exact origin as `browserReportingOrigin`; no new configuration variable or wildcard is introduced. |
| `worker-src` | `'self'` | Same-origin classic PWA service worker. |
| `manifest-src` | `'self'` | Same-origin web manifest. |
| `form-action` | `'self'` | Auth and application forms remain same-origin. |
| `frame-src` | `'none'` | No embedded-frame use found. |

Do not add `unsafe-eval`, `unsafe-inline` to script directives, wildcard hosts, `data:`
images, or broad external schemes. If browser testing finds another actual requirement,
record the source and propose the narrowest directive change for review instead of weakening
the policy globally.

## Causal RED and verification plan

The focused causal RED and GREEN evidence is recorded in the
[deployment lifecycle receipt](../../specs/004-tracking-merchant-link/deployment-lifecycle-results.md).
The cases below retain the broader validation intent. All PostgreSQL cases use the existing
Testcontainers PostgreSQL 18 fixture; no database mock may stand in for the probe. Native
HTTP cases use an ephemeral loopback listener and real `fetch`/Node HTTP requests, not only
`app.request()`.

| First test | Observed before implementation | Passing evidence required after implementation |
| --- | --- | --- |
| Health routes over the real Node listener with a healthy Testcontainers database. | Both routes are currently absent and return 404. | Liveness is 200 without a DB query; readiness is 200 after `SELECT 1`; responses are constant, no-store, unauthenticated, and contain no database details. |
| Readiness with an isolated real PostgreSQL outage and a saturated real client pool. | The route is absent; no bounded availability result exists. | Stop only a dedicated disposable Testcontainers instance used by the failure test. A real connection/query failure and a pool held by real `pg_sleep` work yield the same generic 503 within 1,000 ms and native HTTP completes within 1,500 ms. The response contains no database address, URL, password, driver message, or cause. Repeated checks share one outstanding probe retained until its query settles. |
| Liveness while PostgreSQL is unavailable, and readiness while the shared runtime is draining. | The routes and drain state do not exist. | Liveness remains 200 with the DB stopped; readiness is 503 before it queries during drain and remains 503 if drain starts during a probe. No business writes occur. |
| Graceful shutdown against a real native Node HTTP server with held in-flight requests and the real PostgreSQL fixture. | `index.ts` installs no SIGTERM handler; default process termination can interrupt the request. | First SIGTERM synchronously marks drain and stops new accepts. A new TCP connection is refused while an existing request is draining. A request under seven seconds completes before PostgreSQL closes; repeated SIGTERM is idempotent. A separate request longer than seven seconds is forcibly closed at the deadline before bounded DB teardown; the process exits naturally without `process.exit()`. Every child test has bounded waits and `try/finally` cleanup. |
| Health and lifecycle failure privacy with an isolated stopped PostgreSQL fixture. | No lifecycle/health failure contract exists to assert. | The real PostgreSQL connection failure returns generic 503. The response and captured logs contain no sentinel, URL, raw driver message, or cause. The body stays the same generic 503 and the safe status/stage is observable. |
| CSP over the native Node listener for shell, manifest, worker, public page, and API responses. | Current source emits only `frame-ancestors 'none'`; the required worker, manifest, and blob directives are absent. | Exactly one CSP header includes the approved directives, `frame-ancestors 'none'`, and no forbidden script source. Existing `Cache-Control`/`X-Robots-Tag` behavior remains intact for public pages. |
| Built-browser CSP exercise on the installed service worker and photo preview paths. | No complete policy currently covers worker, manifest, or blob previews. | The production build loads its shell, local font, manifest, classic worker, dynamic route chunks, same-origin API, and a `blob:` photo preview without CSP violations; inline handlers and eval remain blocked. |

For the outage case, stop only its test-owned disposable PostgreSQL fixture and close it in
`finally`; do not stop or modify any operational target. For the timeout case, occupy the
test client's actual PostgreSQL pool using bounded
`SELECT pg_sleep(...)` calls before requesting readiness over HTTP. Assert the response
deadline and then release/drain those queries in `finally`. Do not introduce a fake SQL client
or a test-only production route. The signal case should run in an isolated child process if
the test needs to deliver OS SIGTERM; do not send SIGTERM to the Vitest process. Use only
synthetic data and ephemeral loopback ports.

Implementation followed the root-reviewed causal RED cases test-first. Focused GREEN and
static checks are recorded in the receipt; root still needs to review the frozen source and
run all four local gates on one unchanged source identity:

1. `pnpm check`
2. `pnpm test` (real PostgreSQL integration suite included)
3. `pnpm test:e2e` (built Chromium/service-worker suite included; no retry-green substitute)
4. `pnpm build`

Root's N2 review identified lifecycle gaps, now addressed in the focused correction: startup
constructs a native Node HTTP server from Hono's request listener; each failed shutdown stage
is logged once; isolated child tests cover refusal of new connections, a normal request drain,
the forced-close deadline, and bounded cleanup; and readiness against a stopped disposable
PostgreSQL server returns the generic unavailable body. The correction and final source hashes
are recorded in the deployment lifecycle receipt. This source slice does not verify
built-browser CSP behavior. A later approved synthetic Caddy/runtime rehearsal must verify
effective response headers over TLS and coordinate its `stop_grace_period`; that deployment
exercise is separate. No remote CI, production service, physical phone, task closure, or
release claim follows from this plan.

## Implementation boundaries and remaining integration gate

Root approved the budgets, runtime-state contract, exact browser Sentry-origin handoff,
`style-src-attr 'unsafe-inline'` allowance, and one-policy CSP behavior. The correction
preserves the existing trusted-proxy and private-peer integration. N2 evidence and the final
source identity are recorded in the lifecycle receipt. Root's independent review and four
local gates remain; the later Caddy artifact plan still needs to avoid emitting a second CSP
policy and set Compose grace to at least 12 seconds.

No production deployment, phone test, remote CI, task closure, or release claim follows from
this source slice.

### Root checkpoint diagnosis — 2026-10-23

The first N2 checkpoint passed 9/10 tests; the existing normal-drain case used an unplanned
two-second post-response exit bound. A minimal native Node HTTP reproduction completed its
response at 233 ms but invoked the server-close callback at 3,239 ms because the connection
remained alive. The approved budget is seven seconds for HTTP drain plus two seconds for
database closure. The test now measures total shutdown, including keep-alive drain, against
the same 9,500 ms scheduling margin used by the forced-drain case. This corrects a harness
bound, not the runtime budget. The failed first checkpoint remains preserved privately; its
new forced-drain and stopped-DB cases passed.

After this correction, the exact focused command
`env -u NO_COLOR pnpm --filter @domy/server exec vitest run tests/runtime-health.test.ts tests/runtime-lifecycle.test.ts`
passed independently: 2 files, 10 tests, 13.72 seconds. Root's serialized combined run also
passed 18/18 across the 7 health, 3 lifecycle, and 8 public-protection tests. No four-gate,
container, Caddy, deployment, or phone claim follows from these focused checks.

### Follow-up CSP compatibility finding — 2026-10-23 (approved correction; focused browser verified)

A controlled built-browser RED applies the exact policy from the app's `/health/live` response
to the Vite preview document. The carrier Select opened and accepted keyboard selection; the
test failed its zero-CSP-violation assertion. After allowing the fixed Base UI and Sonner CSS
payloads, the preserved browser trace showed the remaining style violation's required hash was
the SHA-256 of an empty string. The installed Sonner 2.0.8 `__insertCSS()` implementation first
appends a new empty `<style>` element to `head`, then appends the fixed CSS text node. The browser
reports the transient empty element as blocked before accepting the subsequent fixed stylesheet.
Allowlisting only the empty-content hash permits no CSS bytes; it does not enable arbitrary
inline styles. The first attempt to set Zod's `jitless` flag from `main.tsx` also ran too late:
static imports evaluate their dependency modules before the entry module body. This separate
browser correction does not change lifecycle or business behavior.

Keep `script-src 'self'`, `script-src-elem 'self'`, and all other existing policy sources.
Add the two exact stylesheet payload hashes and the exact empty-content hash to `style-src-elem`.
Make `main.tsx` a small bootstrap that imports the web workspace's Zod 4.6.5 instance,
configures `z.config({ jitless: true })`, then dynamically imports the current app module as
`app.tsx`. This ensures the setting runs before app and domain modules evaluate schemas. Zod's
`allowsEval` capability probe calls `new Function`; its `jitless` setting skips that probe in
strict-CSP environments. The web and domain workspaces resolve Zod to the same installed
4.6.5 package. This is a web-only setting; Node-side Zod parsing retains its current behavior.
The installed `cn@0.4.0` runtime does not import Zod or validate its config with Zod.

The style hashes are:

| Package payload | UTF-8 bytes | Approved CSP source |
| --- | ---: | --- |
| Base UI 1.8.0 `styleDisableScrollbar.getElement()` content | 107 | `'sha256-kLmvWqfziFavKtqHqRsb90f006UAK2Dmd0It5Iz2KFA='` |
| Sonner 2.0.8 `__insertCSS()` content in `dist/index.mjs` | 14916 | `'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY='` |
| Transient empty `<style>` inserted before Sonner appends its fixed text node | 0 | `'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='` |

These exact sources are present in the app policy. The exposed `sonner/dist/styles.css` file has
different bytes from the CSS string the installed module injects, so its file hash is not a
substitute for the runtime payload hash. The empty-content hash was independently confirmed
against the preserved console event and Sonner's installed append-before-populate callsite. It
allows only a stylesheet with zero content. Future dependency drift that introduces a CSP
violation must be diagnosed from browser evidence before changing the policy again.

The GREEN regression must collect `securitypolicyviolation` directives from initial app load
through opening a real Select, require none, select an option with the keyboard, and verify the
popup's scrollbar behavior. The built Vite preview does not carry the Hono document CSP, so the
controlled test copies the exact policy from the app's `/health/live` response onto the preview
document response. This validates browser enforcement of the app policy and detects
dependency-payload drift; real Caddy/static-serving behavior remains pending a separate
approved runtime rehearsal.

The approved correction is implemented: `main.tsx` configures the web Zod instance before
dynamically importing the former app entry as `app.tsx`, and the server policy contains the two
fixed stylesheet hashes plus Sonner's zero-byte style hash. No `unsafe-eval` or
`style-src-elem 'unsafe-inline'` source was added. The single authorized focused Playwright
invocation reported `1 passed (12.5s)`, including zero CSP violations through keyboard Select
use and the scrollbar assertion. The captured runner state is `passed` with no failed tests;
the enclosing zsh log-capture wrapper then returned an error because it attempted to assign to
zsh's readonly `status` variable. The test was not rerun. Its private output is recorded under
`.git/local-orchestration/csp-styles-corrective-prebrowser/`. Root independently passed the same
browser regression. This browser test does not verify Caddy/static-serving behavior.

### Follow-up cold first-load performance finding — 2026-10-23

The complete local browser gate on source manifest `537` / SHA-256
`d99b3fce94e543fc9ba10bdf2168f20a7c99dba7e717dc165c70cbf07738330b` had one failure: SC005's
cold tracking-status visibility measured `3094.3105 ms` against the existing `3000 ms` budget;
the preceding baseline was `2847 ms`. The existing cold profile and all timing, accessibility,
and retry requirements remain unchanged. The preserved first-run trace shows the dynamic app
chunk (about 119 KB, 1.7 s) begins one request turn after the entry module; the tracking route
chunk follows it. The global stylesheet is also attached to the dynamically imported app.

The first bounded optimization moved the existing global stylesheet import into `main.tsx` and
added a build-only Vite `transformIndexHtml` post hook to preload the generated `src/app.tsx`
chunk. This uses the public HTML-transform bundle context and leaves Zod's dynamic execution
boundary intact. The one authorized focused browser run improved cold visibility to `3026.8 ms`
but still exceeded the `3000 ms` budget; the CSP-clean keyboard Select regression passed. The
preserved trace under `.git/local-orchestration/op01/preload-correction-n1/` shows entry JS and
CSS starting around 261 ms, the app chunk also starting around 261 ms and taking about 1487 ms,
but most of its static JS dependencies starting around 749–751 ms. The tracking route chunk
started around 2682 ms. This identifies the remaining delay: preloading only the dynamic app
chunk did not start its static dependency graph early.

The next bounded correction extends that same build-only hook to traverse the app chunk's
transitive static imports through public `OutputChunk.imports`, deduplicating chunks and emitting
module-preload links for the app chunk and each reachable static chunk. It excludes external,
missing, non-chunk, and dynamic-import targets. The hook still fails visibly if the expected app
chunk is missing, does not inspect private `viteMetadata`, edit generated output, or preload
dynamic route chunks. The global stylesheet remains in the bootstrap and the app chunk remains
dynamically executed only after Zod is configured for strict CSP. All timing budgets, browser
assertions, accessibility coverage, and retry settings remain unchanged. After scoped static
checks, the one authorized combined focused run passed both the cold-tracking and CSP-clean
Select regressions with retries disabled: cold status visibility measured `2839.7 ms` and the
Select test passed with no CSP violations. This focused result does not replace the full quality
gates or the root's independent review.
