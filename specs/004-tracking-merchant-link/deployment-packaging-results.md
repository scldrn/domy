# Deployment packaging results (OP-01)

**Status (2026-10-23):** the local candidate image, fresh synthetic stack, explicit bucket
initialization and migrations, loopback HTTPS, proxy controls, privacy markers, and browser-facing
assets passed N1 and independent N2 verification. This remains a local synthetic rehearsal; it
does not close OP-01, rehearse a previous-image upgrade, or authorize production deployment.

## Current local verification

The candidate image is
`sha256:f9c052a29f8bcfea38678e25b4da0fe0cdb351b640f4fe1104d73b57770bd551`, built once from the
unchanged 537-file source manifest
`9604ca9689fc7e354f9f1245a424f72316b4b5ed041635f65c505403dabb32e2`. The image and quality-gate
evidence, including the local-only `linux/arm64` platform, are recorded in the [container
rehearsal receipt](deployment-container-results.md). That platform is evidence about this local
Docker Desktop host, not a production architecture choice.

The fresh `domy-op01-20261022` lab initialized its local S3Proxy bucket, applied the ten current
migrations, and passed the read-only schema/journal checks before app startup. N1 and N2 verified
healthy readiness, the exact candidate image, loopback-only Caddy bindings on `127.0.0.1:8446`
and `:8081`, unpublished app/database listeners, internal app/database networks, and no usable
app external default route. Strict-CA checks covered live/readiness, the built HTML and hashed
JavaScript, manifest, service worker, public pages/API, and anonymous private-photo denial.
The reviewed CSP directives and style hashes matched. The 61-request split was 60×404 then
429, the second edge client remained 404 with forged forwarding headers, malformed input returned
400, the controlled upstream failure returned 502, and marker scans found zero markers while
retaining useful app and Caddy request records.

Health endpoints and public pages had the required `no-store` behavior; tracking/client pages and
the unknown tracking API also returned `noindex`. The home HTML, hashed JavaScript, manifest, and
service worker had no `Cache-Control` header in the observed run. No immutable-cache policy is
claimed. N1 proof is `.git/local-orchestration/op01/lab-20261022/stage3-live-assets-proof-private.json`
(mode `0600`); independent root evidence is in the private `root-live-runtime-n2-private.json`
and `root-proxy-n2-private.json` files in that directory. All private evidence remains local and
contains no printed secret values.

Earlier static-only preparation, wrapper refusals, parser/build checks, and the first runtime
metadata-query failure are retained below as historical evidence. Their pre-run statements are
superseded by this current status; the original failures and partial resources were preserved.

## Implemented artifacts

- `Dockerfile` uses the cached Node 24 image by immutable digest, enables pnpm `12.8.1`,
  installs from the frozen lockfile, validates the canonical HTTPS build origin with the
  shared `publicOriginSchema`, sets matching `APP_URL` and `PUBLIC_BASE_URL` for the web build,
  passes disabled Better Auth telemetry and a blank server `SENTRY_DSN` to the build, and
  forwards optional public `VITE_SENTRY_DSN` to the web build and bakes that same value into
  the runtime environment, installs only the server's production dependency graph in the
  runtime stage, and runs Node as the non-root `node` user from `apps/server`. Compose pins
  runtime telemetry off. The image includes
  server migrations, the domain workspace source, and the built web bundle. Compose does not
  set the public browser DSN; the private app env file must omit it so the image's build-matched
  value remains effective. Compose maps `APP_URL` and `PUBLIC_BASE_URL` from one non-secret
  `DOMY_PUBLIC_ORIGIN` parameter, which is also the build's `PUBLIC_BASE_URL`. App env files
  omit those origin fields. Private server `SENTRY_DSN` remains in the app env file.
- `compose.production.yaml` pins PostgreSQL 18 and Caddy by digest and requires the candidate
  app image, host/origin/network parameters, and separate database, app, and migration env-file
  paths. PostgreSQL and the app listener have no published host ports. Only Caddy publishes
  HTTP/HTTPS; local binds can be set to loopback. The database network is internal, while the
  app/proxy bridge permits the app's configured provider egress. It uses named PostgreSQL and
  Caddy state, readiness-based app/Caddy ordering, explicit restarts, and a migration-only
  Compose profile. App startup does not run migrations. The health check uses the
  root-approved `/health/ready` contract. The candidate image's readiness endpoint and Compose
  health state passed in the synthetic lab; graceful-shutdown timing was not exercised here.
- `Caddyfile` keeps automatic HTTPS for the production hostname, disables the admin API,
  overwrites `X-Domy-Client-IP` from the connecting transport peer, and filters request,
  response-header, and structured error fields from access/runtime logs. A lab must explicitly
  point `DOMY_CADDYFILE` to a private override that enables `tls internal`; the tracked
  production file does not enable the local CA.
- `.dockerignore` no longer excludes Dockerfiles and excludes `.git`, env files, dependencies,
  generated outputs, logs, test artifacts, and raw discovery data.
- [`local-deployment-artifact-plan.md`](../../docs/local-deployment-artifact-plan.md) records
  the local network and validation boundaries.

The pinned base references are Node
`node@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5`, PostgreSQL
`postgres:18@sha256:74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336`, and Caddy
`caddy:2.11.7-alpine@sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f`.
The Caddy digest came from a read-only lookup of the
[official Caddy image tags](https://hub.docker.com/_/caddy/tags) dated 2026-10-22. Root prepared
the exact Caddy digest in the local cache for isolated configuration validation. A read-only
image inventory on 2026-10-23 confirmed the exact Node, PostgreSQL, Caddy, and lab-only S3Proxy
images are cached. The S3Proxy reference is
`andrewgaul/s3proxy:4.1.1@sha256:87662b2a5afcdfa5f478a1c61650bae4c87bbd15f6ff2823236bcfd66ef7fe04`;
it is used only by the private synthetic lab override and is not a production dependency. These
local candidates do not select production images.

## Historical static-only preparation

This section records checks made before the candidate build and lab run. Pre-run statements
below that runtime work was pending are superseded by the current verification above.

The artifacts were reviewed for single-origin wiring, service-scoped env files, private app
and database networks, unpublished backend/database ports, explicit migration invocation,
non-root app execution, pinned base images, log filtering, and private lab CA override.
Compose health depends on the root-approved `GET /health/ready` contract. Health routes and
graceful shutdown now exist in server source; this batch did not validate them through the
candidate image. The approved shutdown contract drains for up to seven seconds and closes
PostgreSQL within two more; the Compose grace period is 30 seconds. BuildKit's Dockerfile
`--check` passed after the multiline `RUN` was made Dockerfile-lexer-safe. Caddy `validate`
passed using the exact pinned image with `--pull=never`, `--network none`, no published ports,
and a read-only Caddyfile bind. The first BuildKit check flagged `BETTER_AUTH_TELEMETRY` names
in Dockerfile `ENV` as potential secrets; the settings now appear as build-command environment
values and Compose app environment values, and the subsequent check passed. These checks
validated Dockerfile parsing/lints and Caddy configuration adaptation only at that stage. Private local
output and exit records are under `.git/local-orchestration/op01/`. A private lab profile now
exists under `.git/local-orchestration/op01/lab-20261022/` with a `0700` directory and `0600`
files. Its production-shaped app environment passed the existing `parseEnv` schema with a
generated synthetic VAPID keypair; no secret values were emitted. Its Compose file combines the
tracked production file with a private override that keeps app/proxy and database networks
internal and uses an ordinary bridge for the edge, a private `tls internal` Caddyfile, local
S3Proxy bucket preparation, two edge-client probes, and a private marker-log scanner. This
edge choice follows the OP-02 Docker Desktop evidence: restore-a's internal-only network had a
configured loopback port but no active binding, while restore-b's ordinary bridge published
the active loopback port. The app stays on internal networks with no direct external bridge
route; Caddy and synthetic edge clients gain bridge egress, so the lab is not blanket
egress-isolated. The Caddy override has a fixed local app upstream and `tls internal` with no
ACME/provider request configured; its ordinary bridge still permits egress. Later runtime
binding and reachability results are in the current verification above.
Before the edge-network correction, the fixed private Compose wrapper's `config --quiet` passed
for the then-current model even when its
caller supplied conflicting inherited `DOMY_*`, `COMPOSE_*`, `DOCKER_HOST`, and
`DOCKER_CONTEXT` values; those overrides were removed before the Docker CLI call. Docker
metadata reported context `desktop-linux` with a local Unix endpoint, and the read-only
preflight reported the candidate image absent and no project-prefixed or project-labeled
container, network, or volume. The wrapper reports the context name and local-endpoint boolean,
never the endpoint path. Node `--check` passed for the private wrapper, generator, and probes.
Root independently reviewed the wrapper, HTTP probes, and log scanner, and repeated
`preflight-clean` plus `config --quiet` with conflicting `DOMY_HTTP_BIND`,
`COMPOSE_PROJECT_NAME`, `DOCKER_HOST`, and `DOCKER_CONTEXT` values. Both passed: the selected
context was the local Unix `desktop-linux` context, the lab project resources and candidate tag
were absent, and Compose emitted no rendered configuration. The private output records are
`.git/local-orchestration/op01/lab-20261022/root-preflight.log` and
`.git/local-orchestration/op01/lab-20261022/root-compose-config.log` (mode `0600`). These remain
static/preflight evidence for the earlier all-internal edge model. After switching only the private edge network to an ordinary
bridge, the updated wrapper `config --quiet` passed (exit 0) despite conflicting inherited
`DOMY_HTTP_BIND`, `COMPOSE_PROJECT_NAME`, `DOCKER_HOST`, and `DOCKER_CONTEXT` values. Its private
output is `.git/local-orchestration/op01/lab-20261022/root-edge-bridge-config-private.log`
(mode `0600`). A fresh read-only resource preflight selected the local Unix `desktop-linux`
context and found no project containers, networks, or volumes. This was a pre-creation snapshot;
the later started stack and runtime checks are recorded above. The private Caddyfile was then
binary-validated. Probe review
requires bounded HTTP requests, an actual HTTP 400 for malformed input, observed 404 counts,
and bounded log capture; at that point no probe had run. The scanner now fails on empty/unhelpful logs and
requires app request records for HTTP 200 and 404 with numeric status/latency plus a Caddy
access record for the controlled 502 with numeric status/duration. It reports only counts and
booleans; raw captured logs remain private. A malformed request may be rejected before Caddy
emits an access record. The later marker checks passed for the reviewed cases; Caddy's
fundamental message field still cannot be filtered.

At the time of this static-only batch, no image build, service start, migration, database or S3
request, or app/Caddy HTTP request had run. Those local gaps were later addressed as described
above. No provider/DNS/ACME request, remote CI, or production operation was made. The lab subnets
and public origin remain synthetic parameters, not production defaults.

The 2026-10-23 execution history preserves wrapper guard refusals before Docker operations and
an initial metadata-query failure when Caddy and one-shot jobs lacked a `Health` field. A local
summary parser also initially read the wrong nested health field. These evidence-handling
failures were preserved; corrected metadata validation used the already captured inspection and
did not restart or recreate services. They are not application failures.

## Remaining local and production boundaries

The previous-image/schema upgrade, restart behavior, provider photo-object recovery, and
production network policy remain unverified. The historical-image upgrade is plan-only and was
not run. External production infrastructure, provider selection/purchase, and deployment are the
project owner's responsibility and remain outside this local receipt. Preserve historical first
failures and partial resources; do not clean up or replay the consumed private lab grant as a
retry.
