# Local 004 isolated target — preflight and N1 run

Date: 2026-10-22 (America/Bogota). This receipt records the read-only preflight and dry-run,
followed by separately authorized N1 preparation, private build/seal, local serving, and
native verification of an isolated target. It does not claim phone-tested acceptance or
completion of G1, `004/T034`, production, or public internet use. The owner confirms that no
domain has been purchased and the available network is local only.

## Candidate and source baseline

| Item | Candidate |
| --- | --- |
| Run ID | `phone-20261022-public-a` |
| Current `en0` IPv4 | `10.12.117.118` |
| Application origin | `https://10.12.117.118:8444` |
| Application listener | `10.12.117.118:8444` |
| PostgreSQL container port | `127.0.0.1:15433` → `5432` |
| S3Proxy container port | `127.0.0.1:19101` → `80` |
| Compose project | `domy-phone-phone-20261022-public-a` |
| Private run directory | `.git/local-phone-target/phone-20261022-public-a/` (mode 0700; created by authorized prepare) |

The launcher SHA-256 is
`8d6736fc63a8da2c46bc76d311d97e19d255f4e55700a574bd3a82d1efc96506`; it matches the
reviewed source identity. The latest 004 technical baseline is the root-verified 523-file
snapshot `2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6`: `pnpm check`,
1566 unit/integration tests, 153/153 browser cases with zero retries, and `pnpm build` passed.
T033 documentation is separately verified. This receipt adds no product-source changes and
does not turn that technical baseline into an OP or release approval. See the
[release-readiness evidence](release-readiness-results.md) and
[T033 documentation evidence](public-go-live-documentation-results.md).

Feature 004's server configuration accepts `PUBLIC_BASE_URL`; in production it is required,
must use HTTPS, and must match `APP_URL`. Both use the shared bare-origin parser, which
rejects credentials, paths, query strings, and fragments and normalizes a trailing slash.
For this isolated candidate, the runtime and private Vite build use the same HTTPS origin
shown above. The current migration/schema provides database defaults
for merchant link codes and shipment tracking codes through `publicCodeDefault`; the local
seed omits those fields and uses those database defaults. No domain name, production host,
or courier-consent evidence is supplied by this LAN plan.

## Read-only preflight and dry-run

The preflight observed:

- `ipconfig getifaddr en0` returned `10.12.117.118`.
- `lsof -nP -iTCP:<port> -sTCP:LISTEN` returned no listeners for candidate ports 8444,
  15433, or 19101. Each `lsof` command exited 1 with empty output, which indicates no
  matching listener at the time of inspection; this does not reserve the ports.
- Docker context `desktop-linux` resolves to the local Unix socket
  `unix:///Users/sam/.docker/run/docker.sock`.
- The cached image digests were `postgres@sha256:74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336`
  and `andrewgaul/s3proxy@sha256:87662b2a5afcdfa5f478a1c61650bae4c87bbd15f6ff2823236bcfd66ef7fe04`.
- The existing `phone-20261021-e` PostgreSQL and S3Proxy containers remained healthy with
  IDs `e771c9ab2030` and `d1c57b95ee34`, bound only to loopback ports 15432 and 19100.
  Its app process PID 12004 still listens on `192.168.58.219:8443`. That address differs
  from the current `en0` address, so this receipt records the old target as retained and
  does not claim that it is reachable at the current address. No old private state or CA
  was read or reused, and no old process, container, or volume was modified.
- The complete Docker container identity/name/port listing, volume listing, and network
  listing were unchanged across the dry-run. The candidate private directory was absent
  afterward. Existing developer containers, all `phone-20261021-*` volumes, and networks
  were preserved.

The only launcher command executed was:

```sh
pnpm --filter @domy/server exec node scripts/local-phone-target.ts prepare \
  --run-id phone-20261022-public-a --host-ip 10.12.117.118 \
  --https-port 8444 --pg-port 15433 --s3-port 19101 --dry-run
```

It exited 0 and printed `Preparación validada: phone-20261022-public-a ·
https://10.12.117.118:8444 · sin escribir archivos ni crear recursos.` In the reviewed
source, the `--dry-run` branch returns before host-interface and Docker checks, cached-image
reads, listener probes, private-directory creation, secret generation, certificate creation,
Compose, migration, or seeding. Those read-only preflight checks above were run separately.
During this preflight phase, no `.env` was read or passed, and no `prepare` without
`--dry-run`, `serve`, `stop`, `verify --seal-build`, migration, seed, build, certificate
generation, trust-store change, or listener creation was run. The later separately authorized
operations are recorded below.

Evidence is retained under
`.git/local-orchestration/public-lan-preparation/`, including the interface and listener
outputs, before/after Docker inventories and diffs, cached image digests, launcher hash,
candidate-directory check, and dry-run output.

## Scoped plan approved by Root N2

Root N2 approved the candidate and exact isolated resource boundary. The authorized
preparation used the run ID, current IP, and three ports in the dry-run command above with
only `--dry-run` removed. The launcher created this run's private directory and allowlisted
target files: `state.json`, `compose.yaml`, the explicit empty Compose interpolation file
`empty.env`, `postgres.env`, `s3proxy.env`, synthetic `phone-access.txt`, and a run-scoped
`tls/` directory. Its only database/storage containers are PostgreSQL 18 and S3Proxy 4.1.1,
using the cached image digests above, with new run-scoped volumes/network and the loopback-only
bindings listed in the table. A distinct run-scoped CA/leaf was generated for this candidate;
no OS or phone trust store was changed. The private `dist/` directory was created only for
the sealed web build.

The executed private web build command was:

```sh
APP_URL="https://10.12.117.118:8444" PUBLIC_BASE_URL="https://10.12.117.118:8444" \
SENTRY_DSN='' VITE_SENTRY_DSN='' BETTER_AUTH_TELEMETRY=false \
  pnpm --filter @domy/web exec node --input-type=module -e \
  'const {build}=await import("vite"); await build({envDir:false,build:{outDir:"../../.git/local-phone-target/phone-20261022-public-a/dist",emptyOutDir:true}});'
```

This exact build command exited 0. `envDir:false` prevented Vite from loading the repository
`.env`; the generated bundle was written only beneath this candidate's private directory.
The isolated PostgreSQL database received current migrations and only the launcher's
synthetic fixtures; omitted merchant/tracking codes came from the 004 database defaults.
The only Compose containers are
`domy-phone-phone-20261022-public-a-postgres-1` and
`domy-phone-phone-20261022-public-a-s3proxy-1`, with volumes
`domy-phone-phone-20261022-public-a-pgdata` and
`domy-phone-phone-20261022-public-a-s3data`, and network
`domy-phone-phone-20261022-public-a-network`. Each operation required a separate grant; the
recorded N1 operations below do not authorize any broader use.

## Separate recovery boundary

If a later rehearsal fails, recovery is limited to
`phone-20261022-public-a`: first identify the run-owned app process and Compose resources,
then use the launcher's ownership-checked stop path for that run. Preserve that candidate's
PostgreSQL and S3 data volumes and private evidence pending root review; do not prune or
delete them as part of an initial recovery. Keep PID 12004, the old e containers and volumes,
all developer resources, and the previous CA untouched. Do not copy old-target data or
credentials into the synthetic candidate. If `en0` changes before any new preparation, stop
and repeat preflight with the newly observed address rather than reusing the previous e
address or certificates.

The preflight and dry-run are only the first N1 stage. Root N2 operational verification of
the later operations remains pending. This receipt does not close `OP-release-evidence`, G1,
`004/T034`, physical 003 checks, or production approval.

## Root N2 preflight and scoped operation approval

Root independently confirmed current en0=10.12.117.118, opened and immediately
released each exact proposed socket (HTTPS8444, loopbackPG15433/S319101),
repeated the no-write dry-run successfully, and inspected the unchanged five
container identities/bindings. Root read the complete plan and launcher source,
including the early dry-run return, no-overwrite/resource ownership checks,
private configuration, current004 code defaults and existing production-origin
injection. The existing authorization covers safe isolated synthetic LAN work.

Root grants only the new run's actual prepare operation after a fresh immediate
IP/port/resource check, with local push disabled as planned. Build/seal/serve
remain pending a successful preparation and root follow-up. Failed attempts must
retain output/resources without blind retry or cleanup. No feature/operational
gate or physical acceptance closes through this operation approval.

## N1 authorized execution and native verification

After that approval, the run was prepared once with no `.env` input and local push disabled.
The launcher reported exit 0. The private state records phase `running`, host
`10.12.117.118`, ports HTTPS 8444 / PostgreSQL 15433 / S3Proxy 19101, four synthetic
accounts, `localPush:false`, and build digest
`e5ada0e75b34a13666db1148c8cb66cd5f3903a0a8dda6db057260e558bf2d11`. The source, schema,
and lock digests remain respectively
`a708ba74689f8d6a0c9948e7d10f7e39d2c25974c30adb796246b68bc7919e28`,
`44c18a4b09d70a6988a18a12b01f970a9bd8e673aaf682a600e954f0370b3a07`, and
`50f41517a321ef8cb3b6e005e9672ea08703ae302585e8d87ea7864c7ef5b718`.

The successful prepare invocation was:

```sh
env SENTRY_DSN= VITE_SENTRY_DSN= BETTER_AUTH_TELEMETRY=false BETTER_AUTH_TELEMETRY_DEBUG=false \
  pnpm --filter @domy/server exec node scripts/local-phone-target.ts prepare \
  --run-id phone-20261022-public-a --host-ip 10.12.117.118 \
  --https-port 8444 --pg-port 15433 --s3-port 19101
```

The private Vite build exited 0 with `envDir:false`, `APP_URL` and `PUBLIC_BASE_URL` both set
to `https://10.12.117.118:8444`, and empty Sentry DSNs. The separate
`verify --seal-build --run-id phone-20261022-public-a` command exited 0 before serving. A
detached Node process started successfully (wrapper exit 0): PID 41028, PPID 1,
no TTY, title `domy-local-phone-target:phone-20261022-public-a`, and the process fingerprint
`1c5f0acdaa48b9cadaf32f9d401cf00ae91f3c6489ebfed87671a3122957d7e5` matched the launcher
state. It listens at `10.12.117.118:8444`. The preserved old PID 12004
remained a separate detached process listening at `192.168.58.219:8443`; its process and the
five prior container identities/bindings were unchanged. The candidate PostgreSQL and
S3Proxy remain bound only to `127.0.0.1:15433` and `127.0.0.1:19101`.

The new containers were healthy after verification: PostgreSQL ID `0c299b8f24f8` on
`127.0.0.1:15433` and S3Proxy ID `3a6d8fb00784` on `127.0.0.1:19101`. The five preserved
containers were the two old target containers and three existing developer containers; their
IDs/names/bindings match the pre-prepare inventory. A first detached-wrapper attempt exited
before spawning because it resolved the relative state path from the filtered-package working
directory; that failure is retained. The root-authorized corrected wrapper resolved state and
log paths from the repository root, used the absolute launcher path and `apps/server` cwd,
spawned detached, and opened its output log with mode 0600.

The one authorized native `verify --run-id phone-20261022-public-a` exited 0 in 12.16 seconds.
It validated the candidate TLS certificate against its run-scoped CA and IP SAN, the HTML and
all linked built assets, manifest and service worker, authentication origin protections,
secure cookies and owner/dispatcher/courier role boundaries, synthetic merchant/settings and
courier-route access, and private-photo upload/read with anonymous-read denial and `no-store`.
One synthetic sign-in hit Better Auth's configured rate limit; the verifier
accepted its bounded `X-Retry-After` value and made its single 10-second retry before passing.
This is a reported retry, not a first-attempt pass. No phone browser, phone trust-store change,
courier push delivery, email, domain, external provider, or public-internet test was performed.

The native verifier command was:

```sh
env SENTRY_DSN= VITE_SENTRY_DSN= BETTER_AUTH_TELEMETRY=false BETTER_AUTH_TELEMETRY_DEBUG=false \
  pnpm --filter @domy/server exec node scripts/local-phone-target.ts verify \
  --run-id phone-20261022-public-a
```

The private evidence includes `prepare-real-first.log`, `private-build.log`, `seal-build.log`,
`detached-serve-start-corrected.log`, `served-node.log`, and `native-verify-first.log`, along
with safe filtered state, process/listener, and container summaries. Logs use mode 0600. The
candidate remains running for root's independent N2 review. No stop, cleanup, extra
verification, feature-gate change, or deployment was performed.

## Root N2 acceptance — local preparation verified

Root repeated the native verifier independently:exit0, with one explicit bounded
Better Auth429/10-second retry. Output:root-native-verify-first.log. The native
photo check uses a four-byte synthetic JPEG transport placeholder; it does not
prove a physical camera/photo display, effective delivered merchant proof or
provider lifecycle.

Root's additional CA-validated HTTPS probes pass first attempt without retries
(root-public-verify.mjs/root-public-verify-first.log):

- Anonymous tracking, merchant day and merchant shipment detail:200, strict
  shared-domain schema and no-store/noindex headers.
- Public tracking/merchant HTML shells:200, no-store/noindex.
- Notifications:dispatcher200/strict domain schema; anonymous401.
- Unknown tracking code:404 with the exact uniform invalid-link response.

The probe reads code references through authenticated APIs and logs no bearer
code, cookies, credential or response body. It changes no shipment/notification
state. The native verifier's intentional synthetic private-photo upload is
separate. Root verified state/key/access-file modes0600, detached PID41028
(PPID1, PGID41028, noTTY), the exact8444 listener and retained old PID12004.
The build remains e5ada0e75b34a13666db1148c8cb66cd5f3903a0a8dda6db057260e558bf2d11;
the final523-file source manifest still matches2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6.

Current local review origin:https://10.12.117.118:8444. Synthetic account details
and the new public CA remain in the private run directory. The earlier192.168
URL/CA belong to the retained003 candidate; do not confuse their identities.
No trust store was modified. Device reachability, OS/install/camera/push, actual
mobile-data/WhatsApp preview, provider/restore/individual-consent and final
acceptance remain unverified. OP-release-evidence stays in progress, G1 pending,
and the catalog remains76/81(94%),five physical/final tasks open.

## Direct browser review — owner requested, 2026-10-22

The owner asked the agent to perform the review instead of operating the phones.
The agent used the in-app browser on the same synthetic004 LAN candidate.
This is a desktop-browser walkthrough, not Android/iPhone or mobile-data proof.

- Signed in as synthetic dispatcher; inspected the dispatch board and shipment
  detail. One dispatched shipment has COP50000 to collect and COP13000 fee.
- Used **Copiar mensaje** from **Notificar clientes**. The UI changed from one
  unnotified shipment to **Notificado**. Root independently read the shipment
  through the authenticated API afterward:the notification timestamp is present,
  notifiedBy matches the original dispatcher and status remains dispatched.
  Output:browser-notification-persisted.log. No external WhatsApp message sent.
- Viewed public tracking:pickup-pending status, date/neighborhood, amount and
  synthetic courier first-name/contact actions. Viewed merchant totals, shipment
  detail and return-to-list. After signing out of dispatcher, reloaded merchant
  and followed **Abrir seguimiento** successfully without a login gate.
- Changed the merchant date to yesterday using actual native day-segment
  keyboard navigation:empty state and zero totals; restored today and recovered
  the shipment and totals.
- Signed in as synthetic courier: **Mi ruta** shows0/2completed stops,
  **Pendientes** reports no pending records/photos, **Mi día** shows0collections
  and2pending stops. No pickup/delivery/exception/camera action was recorded.
  The browser is left on **Mi ruta**.

Control limitations were retained rather than treated as product failures:
initial navigation reported ERR_CERT_AUTHORITY_INVALID, while the subsequent
visible state was already the login page; the agent did not bypass an
interstitial or change a trust store. The virtual clipboard exposed no data
despite the application's copy confirmation; copying the message was verified
through UI acknowledgement and persisted notification, not a read-back of its
text. Initial automated date fill changed the displayed input without updating
the list; real native keyboard interaction then changed the date and list
correctly. The native date-picker popup did not open through the control tool.
No claim is made that these tool limitations prove a production defect.

Synthetic public URLs used for opening the public page were obtained through
the existing CA-validated authenticated API and kept in a mode0600 private
artifact; no bearer URL is recorded here. Browser screenshots live under
`.git/local-orchestration/public-lan-preparation/`:browser-notification-confirmed,
browser-public-tracking, browser-public-merchant, browser-courier-route,
browser-courier-pending and browser-courier-day (all.png). The file initially
named browser-certificate-warning.png actually captures the later login page.

No runtime/build/test source changed:523-file SHA remains2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6.
Catalog76/81(94%); G1, physical003/T093/T087/T088,004/T034 and finalT035 remain
open. This review supplies no physical camera/PWA/push, real external WhatsApp
preview, mobile-data or production/provider/consent evidence.
