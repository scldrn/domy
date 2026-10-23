# Production deployment artifact plan (OP-01)

**Status (2026-10-23):** the tracked artifacts have passed a local candidate build and a fresh
synthetic startup, migration, proxy, privacy, and live-assets rehearsal with independent N2
verification. The image is local `linux/arm64` evidence only. A historical-image upgrade remains
plan-only; no production deployment is authorized or claimed.

## Current verified local candidate

The candidate image is `sha256:f9c052a29f8bcfea38678e25b4da0fe0cdb351b640f4fe1104d73b57770bd551`.
It was built once from source manifest `9604ca9689fc7e354f9f1245a424f72316b4b5ed041635f65c505403dabb32e2`
after `pnpm check`, `pnpm test` (1610 tests), `pnpm test:e2e --retries=0` (154 passed), and
`pnpm build` passed. Cold tracking visibility was 2837.3 ms against the 3000 ms limit. See the
[container rehearsal receipt](../specs/004-tracking-merchant-link/deployment-container-results.md)
for image structure and source identity evidence.

The fresh synthetic lab initialized its local S3Proxy bucket, ran all ten current migrations,
and passed N1/N2 schema and readiness checks before and after application startup. Strict-CA
HTTPS verification confirmed loopback Caddy bindings, the built HTML/hashed JavaScript,
manifest, service worker, public pages and API, and anonymous private-photo denial. Two edge
clients verified the 60×404/61st×429 split and same 404 under forged forwarded headers;
malformed input returned 400, a controlled upstream failure returned 502, and marker scans
found zero markers while app/Caddy logs retained useful records. The exact reviewed CSP policy
passed; the earlier Base UI dynamic-style failure is resolved in the final local quality gates.
Observed `Cache-Control` was absent on the home HTML, hashed JavaScript, manifest, and service
worker; this plan makes no immutable-cache claim. Private N1/N2 evidence is under
`.git/local-orchestration/op01/lab-20261022/`; see the [packaging receipt](../specs/004-tracking-merchant-link/deployment-packaging-results.md)
for the proof filenames and boundaries.

These local results do not exercise a previous-release image upgrade, external provider access,
photo-object recovery, or production deployment. External infrastructure/provider selection,
purchase, and deployment are the project owner's responsibility. Production architecture and
image/platform pins remain unselected.

The governing basis is [Constitution I](../.specify/memory/constitution.md) (one application
process, PostgreSQL, and object store; Docker Compose/Caddy on one VPS), [001 research
R16](../specs/001-shipment-registration/research.md#r16-local-development-and-ci) (production
packaging is prepared with the first release), and [OP-01](integral-execution-backlog.md#op-01-deployment-upgrade-and-recovery-runbook).
The [local recovery runbook](local-recovery-runbook.md) records demonstrated synthetic
restore evidence and limits. The [deployment inventory](local-deployment-inventory.md)
records the current source and artifact gaps.

## Minimum tracked artifact set

Prepare three reviewable artifacts after the release candidate and its plan/tasks are aligned:

| Artifact | Minimum behavior |
| --- | --- |
| `Dockerfile` | Root-context, multi-stage, frozen-lockfile build. Include the built web app, server TypeScript, migration SQL, workspace package links and only required runtime dependencies. Run the existing Node entrypoint from `apps/server`, as static asset lookup is relative to that working directory. Run as a non-root user. |
| `compose.production.yaml` | One app service, PostgreSQL, one explicit migration job, and Caddy. Publish only Caddy's HTTP/HTTPS ports. Keep PostgreSQL, the app listener, Adminer, and object storage unpublished. Use named persistent database/Caddy state, health ordering, pinned images, and explicit restart behavior. The S3-compatible photo service remains an external private provider; do not include development S3Proxy. |
| `Caddyfile` | Parameterized canonical host, HTTPS termination, and a single reverse-proxy route to the app. The app's backend port is reachable only on its private proxy/app network. Caddy must overwrite a canonical client-address header from its transport peer, not forward a client-supplied value. |

The [tracked development `compose.yaml`](../compose.yaml) is not a production base: it
publishes PostgreSQL, Adminer, and S3Proxy and has development credentials. The tracked
[`.dockerignore`](../.dockerignore) now allows the root Dockerfile while excluding `.git`,
`.env*` and env files, `node_modules`, generated target state, logs, test output, and raw
discovery. The Dockerfile copies only workspace package inputs needed for the build and only
server/domain sources plus the built web bundle into the runtime stage.

The current server has exact package versions and the repository pins `pnpm@12.8.1` with
Node.js 24. The cached Node base image observed for this task is
`node@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5`. The OP-02
restore used PostgreSQL 18 image
`postgres@sha256:74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336`.
These are local evidence, not an approved production image set. A read-only lookup of the
[official Docker Hub Caddy image](https://hub.docker.com/_/caddy/tags) on 2026-10-22 found
`library/caddy:2.11.7-alpine` at manifest digest
`sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f`. This is a pinned
candidate in the local Compose draft, not a production selection. Root prepared this exact
Caddy digest in the local cache for network-disabled configuration validation; this does not
verify the Node or PostgreSQL image cache or authorize a service start. Recheck selected
immutable digests and local cache before any later run. For local Compose operations, use
`--pull never` and verify the selected images are already cached.
For `docker build`, use digest-pinned `FROM` references and omit the boolean `--pull` flag,
which requests a newer base image. Confirm the locked package store/build inputs are available
before an offline build; stop if an unreviewed pull or dependency addition would be needed.
Do not add a floating image tag or dependency to make the build work.

The app uses `PUBLIC_BASE_URL` at web-build time, and production requires explicit matching
HTTPS `APP_URL` and `PUBLIC_BASE_URL` values. Compose sets both from the single non-secret
`DOMY_PUBLIC_ORIGIN` interpolation value; use that same value as the Docker build's
`PUBLIC_BASE_URL` argument. The Dockerfile validates this value with the shared
`publicOriginSchema`, requires its canonical result to be HTTPS, and sets both `APP_URL` and
`PUBLIC_BASE_URL` to that same origin for the build. Set `DOMY_CADDY_SITE` to that origin's
hostname. Changing the public origin requires a new web build. `VITE_SENTRY_DSN` is an
optional public browser value: pass the same value at build time and bake it into the runtime
image environment for build/runtime parity. The build stage disables Better Auth telemetry
and has a blank server `SENTRY_DSN`; Compose also keeps Better Auth telemetry disabled at
runtime. Do not provide server secrets as build arguments. Do not set `APP_URL`,
`PUBLIC_BASE_URL`, or `VITE_SENTRY_DSN` in a service env file; the app env file must omit them
so the reviewed interpolation/build values remain effective. Keep the separate server-only
`SENTRY_DSN` in the private app env file. Never pass credentials as Docker build arguments or
store them in the image.

## Network and proxy identity boundary

For the synthetic local lab only, root inspected current Docker networks and host routes and
selected these non-overlapping candidates: proxy/app `172.31.254.0/29` (Caddy
`172.31.254.2`, app `172.31.254.3`), internal DB `172.31.252.0/29`, and local edge clients
`172.31.253.0/29` (Caddy `172.31.253.2`, client A `.3`, client B `.4`). They did not overlap
the inspected `172.17`–`172.24` Docker networks or `192.168.58` host routes. Compose requires
explicit subnets and static addresses as parameters instead of applying these local values by
default. Recheck all networks/routes immediately before use; these addresses are not
production defaults.

Keep edge, proxy/app, and database networks separate. Caddy joins the edge and proxy/app
networks; the app joins proxy/app and an internal DB network; PostgreSQL and the one-shot
migrator join only the DB network. Do not publish the app or database ports. Bind the
synthetic Caddy lab to host loopback only: `127.0.0.1:8446` to Caddy HTTPS 443, with
`127.0.0.1:8081` to HTTP 80 only if redirect testing requires it. The local test origin is
`https://domy-op01.test:8446`, using Caddy's local internal CA; there is no public DNS, ACME
request, or production access. The client-A/B containers on the separate edge network allow
the real Caddy request to carry two distinct source addresses while the app port remains
unpublished.

This selected topology is only for the isolated synthetic lab. A production subnet, ports,
provider egress rules, public origin, and Caddy trust arrangement must be selected and checked
again for the actual host. App egress to mail, private object storage, push, and optional
monitoring providers remains a separate policy decision; an ordinary Docker bridge alone
does not prove restricted egress.

The server now keeps native-peer rate limiting as the direct-request default and accepts one
validated `X-Domy-Client-IP` value only when the native peer equals the exact configured
`DOMY_TRUSTED_PROXY_IP`. IPv4-mapped IPv6 peers are canonicalized; malformed or duplicate
values fall back to the native peer. Caddy replaces the canonical header from its transport
peer. Client `Forwarded`, `X-Forwarded-For`, and `X-Real-IP` values remain ignored. The focused
unit coverage and two-client real-Caddy verification passed; N2 independently confirmed the
same 404 under forged headers and that the edge clients cannot reach the app backend directly.

The local real-Caddy integration used two distinct edge-client addresses with the backend port
unpublished. Client A received 60 404s followed by a rate-limited 429; client B stayed allowed
with 404 while sending forged forwarding headers. The privacy probe verified 200/404/502 and
malformed-request 400 responses, and the marker scan found zero markers while preserving useful
status/latency records. These synthetic checks do not establish a production firewall or
provider-egress policy. Existing `app.request` tests alone do not prove native transport identity,
logging, or Caddy behavior.

The marker set must include an unmatched non-public path and client-supplied `X-Request-Id`.
The app generates correlation IDs server-side and logs registered route templates or a fixed
unmatched-route class, never the raw path. Provider failures are logged only through bounded
safe metadata; raw SDK error objects, error strings, request/response payloads, URLs, and
recipient values are excluded. Retain useful route class, status, duration, and the generated
correlation ID. Assert marker absence without printing sentinel values on failure.

## Historical pre-start synthetic lab preparation

This section preserves the design and checks from before the first local start. Its pre-run
statements are superseded by the completed lab evidence above.

The private OP-01 lab configuration is prepared under
`.git/local-orchestration/op01/lab-20261022/`; the directory is mode `0700` and every
configuration, secret, script, and marker file is mode `0600`. It is machine-local and excluded
from the Docker build context. A clone does not contain this profile. The one-time generator
uses the installed server `web-push` package to create a valid synthetic VAPID pair and calls
the production `parseEnv` schema with the exact lab origin and proxy address; validation passed.
The private files separate app, PostgreSQL, migrator, S3Proxy, and S3 initialization values.
They contain no client credentials or production provider configuration, and no values were
printed. A private Compose wrapper filters inherited `DOMY_*`, `COMPOSE_*`, and Docker endpoint
overrides, verifies the selected Docker context resolves to a local Unix endpoint without
printing its path, and fixes the project and Compose files. Its read-only preflight refuses a
candidate image or any project-prefixed/labeled container, network, or volume before a fresh
run. Run the resource preflight immediately before the first service creation; it is an
operator gate, not an implicit guard inside every `up`. The wrapper permits only quiet model
validation and the reviewed lab service/probe commands, and refuses explicit cleanup,
image pull/build, and replacement commands. Freshness is an operator gate: run the resource
preflight immediately before the first service creation and review recorded inventories before
continuing. A private failure log blocks another mutating wrapper call so a
failure cannot be silently retried on the same target.

The Compose project name is `domy-op01-20261022`. Its origin is
`https://domy-op01.test:8446`, with Caddy bound to `127.0.0.1:8446` and `127.0.0.1:8081`.
The candidate subnets are edge `172.31.253.0/29`, app/proxy `172.31.254.0/29`, and database
`172.31.252.0/29`; Caddy is `.2` on both edge and app/proxy, app is `.3` on app/proxy, and the
two isolated edge clients are `.3` and `.4`. The latest read-only check found no listener on
either host port, no `172.31` route, and no overlap with the inspected local Docker networks.
Recheck immediately before an authorized container operation because these observations do
not reserve resources.

The lab-only Compose override keeps the app/proxy network internal and uses an ordinary bridge
for the edge network; the production Compose database network is also internal. This follows
the local Docker Desktop evidence in the
[OP-02 receipt](../specs/004-tracking-merchant-link/local-database-restore-results.md#restore-b-attempt):
restore-a's internal-only network had a configured loopback port but no active published
binding, while restore-b's ordinary bridge produced the active binding. The app and migration
job attach only to internal networks, and PostgreSQL/S3Proxy attach only to the internal
database network, so they have no direct external bridge route. Caddy and the synthetic edge
clients attach to the ordinary edge
bridge and therefore have bridge egress; do not describe this lab as blanket egress-denied.
Caddy uses `tls internal` and a fixed local app upstream, with no ACME or provider request
configured. The active host binding and network reachability still require runtime verification.
The fake nonempty Resend key exists only because the current production mailer refuses to
initialize without a key; its `.invalid` sender and app's internal network attachments prevent
a direct provider request. Email and push delivery were not exercised, and the fresh database
began with no push subscriptions. S3Proxy used its cached pinned image and a project-specific
named volume, with no published port. Preparation itself made no DB, app, S3, mail, push, or
external request; the later local-only operations are recorded above.

The local Caddyfile enables `tls internal`, preserves the production log filters, routes a
test-only path to a closed loopback port for a real 502, and otherwise proxies to the app while
overwriting `X-Domy-Client-IP`. Persistent edge-client containers run only on the ordinary
edge bridge; their guarded probe covers the 61st-request split, forged forwarded headers,
normal/404/502/malformed marker cases, and a private log scanner. Every HTTP probe has a
three-second timeout, malformed traffic passes only on an actual HTTP 400, Docker log capture
is bounded to 15 seconds, and the flood reports its observed count of 404s. The scanner fails
on empty or unhelpful logs: it requires app request records for HTTP 200 and 404 with numeric
status and latency, plus a Caddy access record for the controlled HTTP 502 with numeric status
and duration. It reports booleans and counts only; raw logs remain private. Malformed input may
be rejected before an access record is produced. These probes have now run and passed under the
current evidence above. The ordinary edge bridge is the lab's published path; its egress is
enabled, while app/proxy and database networks remain internal. Caddy's local CA was copied only
to the private `root.crt` path for strict host and edge-client verification, and was not added to
system trust.

The sanitized wrapper's `config --quiet` passed for the production file plus the private lab
override. Node `--check` passed for the private Compose wrapper, S3 initializer, proxy probe,
marker scanner, and one-time generator.
The private Caddyfile was validated by the Caddy binary, and a read-only image inventory
confirmed the exact pinned Node, PostgreSQL, Caddy, and S3Proxy images were cached.
The Docker build copies each workspace used by `pnpm build`; the root `scripts/` directory is
used only by the separate `tokens` command, not by the recursive server/web build. None of
those checks preceded container creation; runtime results are recorded above.

## Runtime contracts and remaining OP-01 work

These requirements remain part of the deployment contract; local evidence below covers only
the synthetic host and scenario described above:

- Do not add a new `*_FILE` runtime feature for this deployment. Use operator-provisioned
  mode-`0600` service environment files outside tracked source and Docker build context; a
  private, non-secret Compose interpolation file may live under
  `.git/local-orchestration/op01/` because `.git` is excluded from the context. Compose reads
  separate app, database, and migration env files only for their respective services. Never
  print env contents or non-quiet rendered Compose config. Treat Docker daemon and host access
  as an authorized-administrator boundary because those administrators can inspect container
  configuration. Keep public origin and other non-secret parameters separately reviewable;
  never pass credentials as build arguments, image layers, labels, shell arguments, or logs.
- The approved lifecycle contract is `GET /health/live` returning a constant 200 without a
  database query, and `GET /health/ready` returning 200 after a database probe or a generic
  503, with `Cache-Control: no-store`. Bound the database probe to one second and listener
  startup to 1.5 seconds. SIGTERM drains requests for up to seven seconds, closes PostgreSQL
  within two more seconds, and exits; Compose must allow at least 12 seconds. The source health
  routes and shutdown implementation exist. Candidate live/readiness endpoints and Compose
  readiness passed; graceful-shutdown timing remains unverified. The Compose health check uses
  only `/health/ready`.
- Caddy and app logging use the reviewed privacy-safe design. Caddy removes the complete request
  object, response headers, and structured error field while retaining useful status/latency
  fields; the app logs route classes rather than raw bearer paths or request objects. On the
  synthetic run, the bounded normal, 404, controlled 502, and malformed-request cases produced
  zero marker occurrences while app and Caddy retained useful request records. Raw logs remain
  private. Caddy's fundamental `msg`, `ts`, `level`, and `logger` fields cannot be filtered, so
  retain marker coverage when changing log configuration or Caddy versions. See the official
  [Caddy global options](https://caddyserver.com/docs/caddyfile/options), [log directive](https://caddyserver.com/docs/caddyfile/directives/log), and
  [reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) references.
- Hono now supplies one complete CSP policy for the built same-origin app and API, including
  `frame-ancestors 'none'`, `worker-src 'self'`, `manifest-src 'self'`, and
  `img-src 'self' blob:`; Caddy does not add a second policy. An earlier browser check reported
  the Base UI select popup's dynamic style as blocked. That issue was
  resolved without weakening the policy or its assertion; the final four local quality gates
  and exact runtime CSP checks passed.
- The production app serves `../web/dist` relative to its process working directory, so the
  image must start from `apps/server` or change and test asset resolution explicitly. Keep
  migrations as a separately invoked one-shot `node src/db/migrate.ts` operation using an
  explicit database target. Do not run migrations automatically on each app start. The
  package's `db:migrate` script loads the checkout `.env` and is not the deployment command.
- The seed prints the first-owner credentials once. Keep initial-owner creation guarded as a
  separate manual operator action pending an approved private delivery procedure; do not add
  a new bootstrap feature or include `pnpm db:seed` in the generic Compose release sequence.
- No previous-release-image upgrade/restart was exercised. This remains plan-only; preserve and
  extend the PostgreSQL-backed prior-schema fixtures in
  [`migration-toolchain.test.ts`](../apps/server/tests/migration-toolchain.test.ts) (0005)
  and [`secret-codes.test.ts`](../apps/server/tests/secret-codes.test.ts) (nonempty 0008),
  then exercise a database with representative synthetic records under an identified prior
  app/schema image and the candidate image. Verify app start, login, reads/writes, history,
  migration replay, restart, and forward-fix/restore on a fresh clone. The existing fixtures
  exercise migration logic; they do not prove a prior release binary can run against the
  candidate schema or that the new image upgrades an installed deployment.

## Historical one-time local verification sequence (grant consumed)

The sequence below records the bounded local run completed on 2026-10-23. Its one-time grant is
consumed; do not replay it against the retained private resources. Any new rehearsal requires a
fresh target, inventory, review, and grant. Use a mode-`0600` private Compose interpolation file
outside tracked
source/build context, plus separately scoped mode-`0600` app/database/migration env files; the
interpolation file carries only non-secret values and paths to those scoped files. In the lab,
point `DOMY_CADDYFILE` at a private override derived from the tracked Caddyfile with `tls
internal` explicitly enabled. Never print env contents or put secrets in command arguments.
The local test origin and addresses below are selected synthetic-lab values, not production
settings. Keep the generated test CA private and do not install it into the host's system
trust store.

The final four local quality gates passed before this run. The private wrapper was used for every
Compose command. It strips inherited `DOMY_*`, `COMPOSE_*`, `DOCKER_HOST`, and `DOCKER_CONTEXT`
values and requires a local Unix Docker endpoint. Its fixed grant string below is retained as
historical evidence only; the reviewed one-time grant was required for each mutating operation.
The read-only preflight
checked the exact project prefix and Compose project labels on containers, networks, and volumes,
and confirmed the candidate tag was absent. It also rechecked cached image digests, network
overlap, and both loopback ports. The local candidate was built without Docker's `--pull` flag
with the inspected local builder and a literal blank browser DSN:

```sh
pnpm check
pnpm test
pnpm test:e2e --retries=0
pnpm build

LAB='.git/local-orchestration/op01/lab-20261022'
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- preflight-clean

docker --context desktop-linux buildx build --builder desktop-linux --load \
  --build-arg PUBLIC_BASE_URL=https://domy-op01.test:8446 \
  --build-arg VITE_SENTRY_DSN= \
  --tag domy:op01-candidate \
  --file Dockerfile .
```

The private profile and service env files were generated for the consumed run; do not regenerate,
replace, print, or source them into the shell. The Compose model was validated quietly, and the
resource preflight immediately before first creation found no project containers, networks, or
volumes. The wrapper saves requested command output and inventory only to new mode-`0600` files
under the private lab directory, never prints raw command output, and refuses `down`, `rm`,
`stop`, `restart`, `--rm`, `--force-recreate`, `pull`, or `build` Compose commands. It does not
implicitly guarantee that every `up` targets fresh resources; preflight and inventory review
are separate operator gates. The run recorded project-labeled container IDs, network IDs, and
volume names after each creation step. Root independently reviewed the DB/S3 inventory,
post-migration schema, and app/Caddy inventory before continuing. All partial resources and
first failures remain preserved; another target or attempt requires new review.

```sh
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- config --quiet
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- preflight-resources
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- up -d --pull never postgres s3proxy
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- inventory \
  --private-evidence="$LAB/postgres-s3proxy-inventory-private.json"
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- --profile lab-setup \
  run -T --pull never s3-bucket-init --private-evidence="$LAB/s3-init-private.log"
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- inventory \
  --private-evidence="$LAB/s3-init-inventory-private.json"
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- --profile migrate \
  run -T --pull never migrate --private-evidence="$LAB/migrate-private.log"
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- inventory \
  --private-evidence="$LAB/pre-app-inventory-private.json"
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- up -d --pull never app caddy
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- inventory \
  --private-evidence="$LAB/app-caddy-inventory-private.json"

node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- cp \
  caddy:/data/caddy/pki/authorities/local/root.crt "$LAB/root.crt"
curl --fail --silent --show-error --cacert "$LAB/root.crt" \
  --resolve 'domy-op01.test:8446:127.0.0.1' \
  'https://domy-op01.test:8446/health/ready'

node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- --profile proxy-test \
  up -d --pull never edge-client-a edge-client-b
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- --profile proxy-test \
  exec -T edge-client-a \
  node /op01/proxy-probe.mjs --execute \
  --grant=OP-01-local-lab-20261022-synthetic flood \
  --private-evidence="$LAB/flood-private.log"
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- --profile proxy-test \
  exec -T edge-client-b \
  node /op01/proxy-probe.mjs --execute \
  --grant=OP-01-local-lab-20261022-synthetic control \
  --private-evidence="$LAB/control-private.log"
node "$LAB/compose-safe.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic -- --profile proxy-test \
  exec -T edge-client-a \
  node /op01/proxy-probe.mjs --execute \
  --grant=OP-01-local-lab-20261022-synthetic privacy \
  --private-evidence="$LAB/privacy-private.log"
node "$LAB/scan-markers.mjs" --execute \
  --grant=OP-01-local-lab-20261022-synthetic
```

The readiness path returned 200 through the candidate image, and the Compose health state was
healthy. N1/N2 verified that only Caddy's loopback ports 8446 and 8081 were published, backend
and database listeners were unpublished, the app had no usable external default route, and
edge clients could not reach the app backend directly. The live-assets and proxy/privacy probes
verified CSP, actual cache headers, forged-header handling, the two-client/61st-request split,
and useful sanitized logs. Production network policy and provider reachability remain outside
this synthetic proof.

No historical-image/schema upgrade was run. A future rehearsal remains plan-only: first identify
an actual prior release image or define a bounded synthetic historical-schema fixture (the
repository snapshot at `94a7e24` has migrations 0000–0007), then prepare a fresh isolated database
and backup using the [OP-02 procedure](local-recovery-runbook.md#op-02-select-dump-restore-and-verify).
If a previous app is used, stop it before candidate migrations and keep it stopped through the
DDL; start only the candidate after successful migration. Do not leave an old binary serving
while unreviewed DDL runs without exact-version compatibility evidence. The current lab wrapper
refuses explicit image replacement, stop/recreate, and cleanup, so it cannot be reused. Any
upgrade-specific procedure needs separate review and a new target/grant.

Do not run this against a source, client-owned, or operational database. The pre-upgrade
backup must remain immutable; if migration or startup fails, stop and diagnose on another
clone. Do not downgrade schema or start an old binary against an unreviewed changed schema.
Record the exact Git/source, lock, schema, web build, app image, Node base, PostgreSQL, and
Caddy digests; command outcomes; elapsed time; sanitized first failures; and limitations.
Then update OP-01 receipts without marking a feature or gate complete by implication.

## Decisions still outside this local plan

The project owner is responsible for external production infrastructure/provider selection,
purchase, public origin, account access, approved secrets delivery, and actual deployment. This
plan makes no provider or account proposal and does not select a production platform or image
architecture. No VPS, domain, paid account, external CI, or production service was selected or
contacted here. The README's selected DigitalOcean Spaces provider still needs owner-supplied
credentials and private-access/lifecycle receipts. OP-02's RPO/RTO, retention, schedule, alerts,
and photo-object recovery remain open.

The app's normal provider traffic also means a three-container Compose diagram alone does
not define outbound network policy. Document and test the actual permitted destinations and
firewall boundary for mail, S3, Web Push, and optional monitoring before any live operation.
Physical Android/iPhone acceptance, existing installed-device compatibility, individual
courier disclosure consent, and public release sign-off remain separate gates.
