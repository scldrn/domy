# Local Deployment Inventory

## Current follow-up — 2026-10-23

The inventory below records the original 2026-10-20 inspection. Since then, the
candidate has passed all four local gates, image build and independent structural
verification, fresh installation/migrations, actual Caddy HTTPS, proxy isolation,
CSP/live assets and privacy checks. See the
[container receipt](../../specs/004-tracking-merchant-link/deployment-container-results.md)
and [engineering handoff](../engineering-handoff.md). Earlier isolated LAN, database
recovery and app-restart receipts retain their own dated scope.

These results supersede the historical absence findings below. Historical-image
upgrade remains planned/unrun; physical acceptance and actual provider/production
requirements are not certified. Infrastructure selection/purchase and public
deployment belong to the owner, as clarified on 2026-10-23.

## Scope and evidence boundary

Read-only OP-01/OP-04 preparation, 2026-10-20 (America/Bogota), on
`codex/local-readiness-orchestration`, baseline
`94a7e2450ec2abae4192f7f864e34c4638f7c963`. The working tree includes concurrent
uncommitted engineering slices; this is not a release identity or completed rehearsal.
Only this inventory was created for this subtask. No deployment, container provisioning,
migration, backup, account/provider operation, or remote workflow was executed.
The operational requirements and G0 prerequisites remain in the
[execution backlog](integral-execution-backlog.md). No OP or feature task is closed here.

## Existing artifacts and demonstrated gaps

| Area | Existing source | Gap or consequence |
| --- | --- | --- |
| Runtime | [server entry](../../apps/server/src/index.ts), [package scripts](../../apps/server/package.json), [constitution](../../.specify/memory/constitution.md) | One Node 24 process serves Hono and built web assets. No tracked Dockerfile or production application image recipe was found. |
| Local services | [compose.yaml](../../compose.yaml) | Development PostgreSQL 18, Adminer and filesystem S3Proxy only; no application, Caddy, TLS, healthcheck or production topology. |
| Build | [root scripts](../../package.json), [web configuration](../../apps/web/vite.config.ts), [TypeScript settings](../../tsconfig.base.json) | Web builds to `apps/web/dist`; server/domain remain TypeScript source. Packaging must retain source, workspace dependencies and Node native type stripping. |
| Configuration | [.env.example](../../.env.example), [environment parser](../../apps/server/src/env.ts), [mailer](../../apps/server/src/lib/email.ts) | Example values are development placeholders. No target-specific reviewed secret injection, approved HTTPS origin or provider receipt was established by this read. |
| Database | [migrator](../../apps/server/src/db/migrate.ts), [versioned migrations](../../apps/server/src/db/migrations), [seed](../../apps/server/src/db/seed/index.ts) | No deployment upgrade/restore script or immutable release/schema manifest was found. Migration success does not demonstrate restored application correctness. |
| Recovery | [OP-02 requirements](integral-execution-backlog.md#op-02--backup-and-demonstrated-restore) | No tracked backup scheduler, recovery runbook, retention configuration, measured restore receipt or agreed RPO/RTO was found. |
| Proxy and health | [application wiring](../../apps/server/src/app.ts), [auth configuration](../../apps/server/src/auth.ts), [entry point](../../apps/server/src/index.ts) | No tracked Caddyfile, explicit trusted-forwarder policy, dedicated health/readiness route, dependency readiness probe or coordinated graceful-shutdown handler was found in these sources. |

Inventory used repository file listing and targeted source searches; it did not inspect
external machines, ignored secret files or customer discovery data. An absent tracked
artifact is not proof that an external operator has never configured that capability.

## Current commands and working-directory constraints

The [README production sequence](../../README.md#production) is:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
cd apps/server
NODE_ENV=production node --env-file=../../.env src/index.ts
```

These are existing instructions, **not commands executed by this inventory**. In particular,
`pnpm db:migrate` and `pnpm db:seed` load the repository `.env`; do not use them for an
isolated rehearsal without resolving that target explicitly. The seed can print the initial
owner password once, so its output is sensitive even when its input is synthetic.

The server entry passes `webDist: "../web/dist"`; static serving is relative to process
working directory. Starting from `apps/server` is therefore material. Starting the root's
`src/index.ts` equivalent without an appropriate cwd would not preserve the asset path.
The migrator locates SQL relative to its own module, independently of cwd. `pnpm build`
does not compile a runnable server JavaScript bundle.

For a later authorized rehearsal with a verified disposable loopback database, the existing
migrator can avoid auto-loading `.env` by invoking its Node entry directly:

```sh
# DOMY_REHEARSAL_DATABASE_URL must identify the new disposable local database.
DATABASE_URL="$DOMY_REHEARSAL_DATABASE_URL" \
  pnpm --filter @domy/server exec node src/db/migrate.ts
```

That command writes its selected database. It must remain pending until an isolated target
and candidate are reviewed; no database URL value or credential belongs in the receipt.

## Exposure, browser security and offline behavior

- Development Compose publishes PostgreSQL `5432`, Adminer `8080`, and S3Proxy `9100`
  without loopback host restrictions. It must not be reused as a public production topology.
  Vite's development proxy forwards `/api` to API port `3000` by default. Production uses
  the same-origin Node process; the entry sets a port, not an explicit bind hostname.
  A future isolated topology must restrict internal services and expose only reviewed web
  entry points. Ratified production Caddy/TLS is currently a packaging gap.
- [Hono middleware](../../apps/server/src/app.ts) sets security headers, a 1 MB API body limit,
  `X-Frame-Options: DENY`, referrer policy and a CSP containing `frame-ancestors 'none'`.
  This is not a complete script/connect/worker CSP design. Forwarded host/protocol/address
  handling, spoofed headers, HTTPS cookies, auth redirects and proxy-origin behavior require
  explicit topology review and real response checks; current source alone is not proof.
- [Photo responses](../../apps/server/src/routes/photos.ts) explicitly use private,
  no-cache/no-store headers. Application-wide HTML/API cache rules, fingerprinted asset
  policy, worker update headers and future public no-store/noindex behavior were not
  established by an explicit policy in application wiring. Feature 004's public behavior
  must be implemented and verified under its own prerequisites.
- [Vite PWA](../../apps/web/vite.config.ts) builds a classic worker and manifest;
  [browser startup](../../apps/web/src/main.tsx) registers it in production.
  [The worker](../../apps/web/src/sw.ts) precaches the shell, excludes `/api/` navigation,
  and does not runtime-cache API responses. Courier data remains in
  [IndexedDB](../../apps/web/src/lib/offline/db.ts). Rehearse update, waiting-worker behavior,
  restart/reconnect and queued work preservation on an existing installed client. A desktop
  localhost test does not establish real Android/iPhone HTTPS installation or push behavior.
- Production configuration requires private storage and all VAPID values in the parser;
  the mailer additionally rejects a missing recovery API key. Storage provisioning and its
  12-month lifecycle are external requirements: [the storage client](../../apps/server/src/lib/storage.ts)
  does not install a provider retention policy. Sentry is optional, and browser configuration
  is build-time. Enable actual reporting only after T152 and relevant privacy gates pass.
  Never copy real secrets into browser `VITE_*` variables.

## Proposed isolated rehearsal sequence — not executed

1. After candidate prerequisites pass, review a local-only deployment design with separate
   container/network/volume identities, explicitly bound loopback test ports, synthetic
   accounts/data and no operational database or bucket reference. Record source tree,
   lockfile, image digest, schema journal and operator. Do not infer a release hash from
   a dirty branch. Do not create manifests before that design/candidate review.
2. Fresh installation: create a new disposable PostgreSQL 18 and isolated transient S3
   service; existing [database setup](../../apps/server/tests/setup/database.ts),
   [storage setup](../../apps/server/tests/setup/storage.ts) and
   [browser setup](../../apps/web/tests/e2e/global-setup.ts) show proven harness patterns.
   Use explicit environment injection and a controlled synthetic fixture plan. Exercise the
   built same-origin app and worker; test-mode mail outbox is not provider deliverability.
3. Upgrade: select an identified prior compatible source/schema, create representative safe
   records there, take a backup, and apply the candidate's actual migrations to a cloned
   disposable database. Compare identities, event/record relationships, financial examples,
   login and reads/writes before/after. Existing tests that migrate an empty DB do not prove
   this historical upgrade path.
4. Recovery: use PostgreSQL 18 `pg_dump`/`pg_restore` inside the isolated container boundary;
   restore the selected dump into a **second new** disposable database. Record elapsed time,
   backup timestamp, counts/invariants, auth and representative application flows. Preserve
   the source database and volumes. Design forward-fix/restore before upgrading; an old
   binary is not automatically compatible with a newer schema. Keep photo-object backup
   and missing/expired-photo behavior separate from database recovery.
5. Capture exact commands, statuses, source/schema/build identities and limitations.
   Re-run local `pnpm check`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` on the integrated
   candidate. Only then review G0 against all its prerequisites. A reachable phone test
   requires separately approved HTTPS target/access and provider configuration; this local
   inventory supplies neither authorization nor physical acceptance.

## Inputs still requiring an owner or operator decision

### Later owner clarification — local phone target

Samuel explicitly authorized opening the web app on the local network and will execute
the Android/iPhone scenarios himself. This resolves who operates the phones and permits
preparing that isolated local target; no repeat permission request is needed for it.
After verified code prerequisites, reviewed launcher source and a reviewed T084 draft,
an isolated synthetic target may be rehearsed locally to verify the documentation. Only
G0 completion (including T084 and OP-test-target) permits offering the URL and checklist
for physical phone acceptance. Expose only the compiled HTTPS test application; preserve
existing development services and use separate disposable data/services.

Installation/offline and push acceptance need HTTPS trusted on both devices. A local CA
may be generated for the test target without modifying the operating system trust store;
phone trust installation is a user-operated step. Do not present an ignored certificate
warning or HTTP-only visual check as successful PWA acceptance. Exact local addressing,
certificate setup and readiness checks remain preparation work, not physical evidence.
Production hosting, provider accounts, real email deliverability and consent remain
separate obligations; local-network authorization does not close them.

[OP-01–OP-04](integral-execution-backlog.md#11-operational-work-and-owner-acceptance) and
[OWNER-REQUESTS.md](../../OWNER-REQUESTS.md) retain the decision sources:

- Exact environment, public origin, authorized operator, target access and scope; client
  ownership of infrastructure/data/export accounts; actual recurring cost within the
  quoted COP 60,000–130,000 monthly range or separate approval.
- Agreed RPO/RTO, backup retention/access/failure notification, incident ownership and
  actual object recovery policy. No objectives or provider capabilities are inferred here.
- Recovery sender/domain, private bucket/lifecycle, stable VAPID identity, real inbox and
  installed-device push receipts. Local emulation cannot close provider obligations.
- Amy Tecnology tariff confirmation; Caldas/Girardota tariffs or the approved manual-fee
  path; operational directories, support contacts and company identity. The office address
  is already approved and seeded; it is not a new unanswered request.
- Each courier's recorded consent before real public first-name/phone disclosure, final
  logo artwork or explicit continued provisional identity, and whether operational data
  exists before migration/backfill scope is considered. No raw customer data was read.

## Inventory verification

Validation is limited to local source inspection, relative-link/path checks and
`git diff --check`; this is not runtime, migration, restore, provider, device or deployment
evidence. Future operational evidence must identify its actual candidate and target.


## Proposed LAN phone target — preparation only, not executed

The orchestrator reviewed this design on 2026-10-20. It remains a proposal until G0's
automated prerequisites and isolated-target verification pass. At the initial inventory,
no launcher, certificate, container, volume, listener or trust-store change was created;
the later source-only preparation is recorded below.
Samuel's local-network authorization and role as phone operator above remain applicable.

### Verified local capabilities and scope

Read-only inventory found Node 24.21.0, pnpm 12.8.1, Docker Compose 5.6.0 and LibreSSL
3.3.6; cached images include PostgreSQL 18 and S3Proxy 4.1.1. Caddy and mkcert were not
found on PATH, and repository certificate filenames were not found. The installed
`@hono/node-server` API accepts native `node:https.createServer`, TLS `serverOptions`
and an explicit hostname. Therefore this controlled fixture can serve compiled web/API
through one native HTTPS Node listener without adding a proxy or dependency. This does
not replace the ratified Caddy production topology or validate production packaging.

At inventory time, en0/default-route IPv4 was `10.12.117.118`; ports 8443, 15432 and
19100 had no observed listeners. These are observations, not reservations or phone
reachability evidence. Re-read the interface/IP and port state immediately before
certificate generation and serving. A changed IP requires matching SAN/origin changes;
never assume static addressing, bypass certificate errors or alter OS trust/firewall.

### Launcher preparation and technical gate

Root scheduling refinement, 2026-10-21: source-only preparation is now verified by
`OP-target-source-reviewed`; resource QA is the separate `OP-test-target` node. The
previous veto on any target run until T084 completion created a cycle with T084's
required isolated configuration rehearsal. It is superseded as follows: all G0 code
prerequisites, the exact launcher source and a concrete T084 draft must be root-reviewed
before reserving the serialized resource/build/listener QA slot. Only then may the isolated
synthetic target be rehearsed to finish T084. This does not unlock G0: both T084 and
OP-test-target must pass both QA levels before offering the URL for phone acceptance.
No production/provider operations or OS trust/firewall changes are authorized by this
scheduling correction. Resource rehearsal observations and failures are recorded below.

The reviewed `apps/server/scripts/local-phone-target.ts` implements
`prepare`, `serve`, `verify` and `stop` using existing native dependencies. Private
per-run state, generated Compose/configuration, certificates and optional isolated build
would live in `.git/local-phone-target/<run-id>/`, with directories 0700 and private
files/keys 0600. Generate a fresh run ID; reject stale resources and invalid/path-traversal
IDs. Validate persisted state with Zod and restrict any stop operation to exact recorded
PIDs/container identities and matching project/run labels. Preserve all existing services.

- Provision a new Compose project/network and separate PostgreSQL/S3 volumes, using
  cached images with `--pull never`. Publish PG/S3 only on `127.0.0.1` at reviewed unused
  ports; expose only the compiled application's HTTPS port on the current LAN interface.
  Do not run the existing Compose file or modify Docker daemon configuration.
- Use `runMigrations` with the explicit disposable URL. Create synthetic accounts,
  catalog, merchant, courier, office and current-day route/shipment fixtures; avoid the
  operational seed and its real-business names/address. No `.env` auto-loading or raw
  discovery input. Keep generated synthetic credentials in private state, not command logs.
- Run native `createApp`/`createAuth` with `NODE_ENV=production` and `TEST=''` established
  before imports, an HTTPS `baseUrl` matching the current LAN origin, private storage and
  the built app/worker. The fixture injects local-only mail handling and `push: null`;
  it does not invoke the production entry point with fabricated provider credentials.
  Root and transactional auth retain their actual secure-cookie/Origin/CSRF behavior.
- Set server/browser Sentry DSNs empty, `BETTER_AUTH_TELEMETRY=false` and
  `BETTER_AUTH_TELEMETRY_DEBUG=false`. Both telemetry environment names were verified
  in the installed native package. Do not configure external email/push/monitoring services.

### Planned commands and TLS

The commands below are templates for the future launcher, **not executions**. Substitute
one new validated run ID and the freshly observed LAN IPv4; the launcher must inject
only reviewed configuration and never load the repository `.env`.

```sh
pnpm --filter @domy/server exec node scripts/local-phone-target.ts prepare \
  --run-id <new-run-id> --host-ip <current-ip> \
  --https-port 8443 --pg-port 15432 --s3-port 19100
# For the eventual phone push scenarios, also pass --enable-local-push to prepare.

# Build in a serialized window; envDir:false prevents Vite's root .env auto-read.
APP_URL="https://<current-ip>:8443" PUBLIC_BASE_URL="https://<current-ip>:8443" \
SENTRY_DSN='' VITE_SENTRY_DSN='' BETTER_AUTH_TELEMETRY=false \
  pnpm --filter @domy/web exec node --input-type=module -e \
  'const {build}=await import("vite"); await build({envDir:false,build:{outDir:"../../.git/local-phone-target/<new-run-id>/dist",emptyOutDir:true}});'

# Seal the exact private bundle before serve; serve refuses an unsealed build.
pnpm --filter @domy/server exec node scripts/local-phone-target.ts verify \
  --run-id <new-run-id> --seal-build

NODE_ENV=production TEST='' SENTRY_DSN='' BETTER_AUTH_TELEMETRY=false \
  BETTER_AUTH_TELEMETRY_DEBUG=false \
  pnpm --filter @domy/server exec node scripts/local-phone-target.ts serve \
  --run-id <new-run-id>
pnpm --filter @domy/server exec node scripts/local-phone-target.ts verify --run-id <new-run-id>
pnpm --filter @domy/server exec node scripts/local-phone-target.ts stop --run-id <new-run-id>
```

Prepare would generate its private manifest and empty explicit Compose environment file,
then invoke `docker compose --env-file <private>/empty.env -p <exact-project>
-f <private>/compose.yaml up -d --pull never --wait --wait-timeout 90`. This avoids implicit repository `.env`
interpolation. Generated configuration must bind PG/S3 only to loopback and mount only
new, explicitly named synthetic-data volumes. Stop preserves volumes unless separately
approved cleanup identifies these exact resources.

From the private TLS directory, with explicit generated configurations and umask 077:

```sh
openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 14 \
  -keyout ca-key.pem -out ca.crt -config ca.cnf -extensions v3_ca
openssl req -new -newkey rsa:2048 -nodes -sha256 \
  -keyout server-key.pem -out server.csr -config server.cnf
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca-key.pem -CAcreateserial \
  -out server.crt -days 7 -sha256 -extfile server.cnf -extensions v3_server
openssl x509 -in ca.crt -outform DER -out domy-phone-ca.cer
openssl verify -CAfile ca.crt -purpose sslserver server.crt
```

The installed LibreSSL 3.3.6 does not support `-verify_ip`. The OpenSSL command above
checks the chain and server purpose only; it does not prove the URL host matches the
certificate. The launcher uses `X509Certificate.checkIP` and then connects to the current
LAN IP with the explicit CA and normal HTTPS hostname/IP verification enabled.

CA extensions require CA=true/pathlen:0 and keyCertSign/cRLSign. The leaf requires
CA=false, digitalSignature/keyEncipherment, serverAuth and SANs for the current LAN IP,
127.0.0.1 and localhost. Only the public CA certificate is delivered to Samuel for manual
phone import/trust, for example by local file transfer. Never deliver CA/server private
keys, change the computer trust store, or count a warning bypass as PWA acceptance.

### Verification before offering the application URL

Require the integrated four local gates and exact source/lockfile/schema/build identities.
The isolated target verifier must additionally check certificate chain, validity and IP SAN
using an explicit CA with normal TLS verification; expected HTML/assets/manifest/worker;
HTTPS login and Secure/HttpOnly/SameSite cookies; native invalid/missing Origin refusal;
role restrictions; private photo upload/read; synthetic catalog/route readiness; and Docker
port bindings/labels. No additional API/Vite web entry may be published. Graceful shutdown
must close only this server and its DB connection. Existing build/route generation still
requires the orchestrator's serialized build window.

Only after these checks and manual phone trust preparation should the current LAN URL
be offered. Wi-Fi client isolation, VPN/routing and host firewall can still block phones;
actual access must be demonstrated. Compiled-worker integration gates are supporting
local evidence, not physical queue/sync acceptance. Installation, offline/reopen/restart,
queued actions/photos, reconnect/session behavior, accessibility and timing remain
Samuel-operated Android/iPhone scenarios with device/browser/result receipts.

The local CA lasts 14 days and the leaf 7 days; regenerate explicitly for each new run,
never silently while an accepted run has pending device data. New CA trust is a manual
phone step. Expiration/IP changes must stop readiness until matching TLS/origin is restored.

Push is off by default. The prepared launcher has an explicit `--enable-local-push` option
that generates one native Web Push P-256 VAPID pair per isolated run, stores it only in
private 0600 state, and injects the existing `deps.push` configuration. Its synthetic
`mailto:local-test@example.invalid` subject is not a provider account. Only the public key
reaches the browser; the private key never does. Phone notification permission remains a
native UI action, and actual delivery still depends on reachable browser push services and
must be recorded separately. This source preparation performs no key generation,
subscription or send. G0's complete phone/push acceptance and T093/T087 cannot be claimed
with push disabled or simulated. Real recovery email and external hosting remain separate
inputs; this design does not authorize either.

Real push delivery, recovery email deliverability, provider ownership, production
monitoring, historical upgrade and demonstrated restore remain unverified by this fixture.
No OP/G0/device task is closed merely because the local HTTPS application becomes reachable.

### Source-preparation result — 2026-10-21

The source is published at `apps/server/scripts/local-phone-target.ts`, and the server
TypeScript project includes `apps/server/scripts/`. Only its explicit `prepare --dry-run`
path has been executed; it reported that it wrote no files and created no resources. Static
checks cover strict run/state validation, loopback-only disposable services,
source/schema/lock/build identity, synthetic fixtures, HTTPS verification against the
current IP SAN, and process/resource ownership checks. Every non-dry-run operational
command revalidates the local Docker endpoint/context before loading state or accessing
Docker. The launcher has not prepared a target or generated credentials/certificates, and no
Compose resources, database, build, or listener were created. Root source approval is
recorded in [the source receipt](../../specs/003-courier-app/local-target-source-results.md).
The reviewed-draft/code prerequisites and serialized rehearsal above remain mandatory;
T084 and OP-test-target must both pass before G0/phone acceptance.


### Native readiness requirement from runtime RED — 2026-10-21

Run a was stopped safely after the narrow network-name correction; its volumes and
failed evidence remain, and development services stayed unchanged. Run b then failed
the complete-health guard before Docker's first healthy event. Root's read-only event
timeline places PostgreSQL healthy 0.77 seconds after the prepare log ended; S3Proxy
healthy followed later, with zero restarts. TCP/HTTP readiness alone did not establish
the declared health precondition.

The launcher must use native Compose bounded health waiting before the complete
ownership/health verification, keeping the existing 90-second startup bound and all
health/count/identity guards. No arbitrary sleep, retry-to-green or weaker health rule
is accepted. Source correction and independent review precede any cleanup or fresh
run. Run b remains partial with only its own loopback services; no app build/listener.


### Third launcher runtime RED: native authentication rate limit — 2026-10-21

Run c prepare/private build/seal passed; HTTPS HTML/assets/worker and two Origin
refusals responded correctly. First operational verify failed at the fourth rapid
password sign-in: c-serve.log records three 200 sign-ins then 429. Installed native
BetterAuth1.7.6 enables production limiting and caps sign-in at 3/10 seconds, returning
X-Retry-After. The verifier unnecessarily signs owner in for each Origin probe.
Root independently confirmed the request timeline and native implementation.
Source review reopens: reuse one owner session; explicitly report and respect only
a validated bounded native 429 X-Retry-After, with at most one retry. Keep all auth
assertions and production protection; never retry bad credentials or silent failures.
Stop only the retained own listener before edits; preserve run c evidence/data.
Root source approval remains required before fresh resource rehearsal.42/81 (52%).


### Graceful terminal shutdown RED retained — 2026-10-21

After root-authorized Ctrl-C of run c own PTY, N1 found HTTPS port free and
root independently confirmed recorded PID91110 absent. Private state still says
running/processPid91110, rather than prepared/process:null. All containers and
volumes retain identities. This is failed shutdown evidence, not a successful
restart. No state was forged or cleanup attempted. Review the lifetime of signal
handlers during asynchronous server/DB closure and state persistence; guards and
resource ownership must remain intact.42/81 verified (52%).


### Shutdown source decision before implementation — 2026-10-21

Independent Luna audit reproduced native Node termination on a second SIGINT
during asynchronous cleanup with once/off handlers. A minimal pnpm PTY trial
delivered one signal and completed, so duplicate pnpm forwarding is NOT proved
as the cause of run c. Preserve that uncertainty and actual failed state.
Approved narrow correction: keep process.on SIGINT/TERM handlers installed
through server/DB closure and prepared-state persistence, with existing closing
guard ignoring duplicates; remove only after completion. No sleeps, forced kills,
state forgery, ownership weakening or runtime acceptance. Fresh real shutdown
must pass executor and root review before readiness.42/81 verified (52%).


### T084 / local target double QA complete — 2026-10-21

Executor N1 and independent root N2 approve isolated run phone-20261021-d. Prepare,
private envDir:false build/seal, native TLS/auth/role/catalog/route/private-photo
checks, graceful fingerprint-checked SIGTERM and stable restart all passed. Root
ran its own live verifier, Docker/PID/TLS/CSP audit, and exact source provenance.
The sole changed source since T083's accepted 1,281 tests/129 E2E is the launcher;
scoped static/boundary QA plus actual rehearsal cover it. Every earlier failure
and its correction remain retained. Source 459 SHA
0f075fa48ab8c2b3a202a711ccb2a14f16d84881fbb202478df35c730b3d70f5; private build
9ccfb13a7c54dd27d48cc4c1fdfe75f17c8913d98e06eaf8fe7359ef1b523020.

Root closes T084 and OP-test-target; G0 permits owner-operated trusted-LAN
acceptance. Catalog is now 43/81 (53%), 38 open. Next is owner access/trust check,
then prepared T093/T087 physical scenarios and final T088. Feature 004 stays
blocked. No phone, provider or production acceptance is inferred. The current
listener remains available; only the public CA and private synthetic access-file
path are handed to Samuel. TLS expires 2026-10-28 16:15:05 Bogotá; IP changes
invalidate readiness until reviewed. No OS trust/firewall changes were made.


### LAN availability incident — 2026-10-21 22:11 Bogotá

Samuel reported that the offered URL did not work. Root confirmed unchanged en0
IP192.168.58.219, no listener on8443, and recorded PID98556 absent. The two d
containers remained healthy with unchanged IDs/loopback ports; private state still
reported running. The last retained request was successful earlier in the day;
termination cause is not established. Earlier rehearsal evidence is historical,
not proof of current availability.

Current OP-test-target/G0 access readiness is reopened. T084 remains a verified
documentation/rehearsal task; catalog43/81 (53%) is unchanged. Executor recovery
is restricted to stopping owned d resources with volumes preserved, then fresh e
prepare/private build/seal with a detached nohup/caffeinate direct Node process,
without a parent pnpm/PTY lifecycle. Independent root liveQA must pass before
claiming restored access. No source, OS trust/firewall or provider change.


### LAN availability restored on detached run e — 2026-10-21

Executor stopped only owned d resources, preserving volumes and developer services,
then prepared/built/sealed phone-20261021-e with unchanged source. An initial shell
nohup/disown attempt did not create a listener (prepared/null state); its diagnostic
was retained and never counted as success. Native child_process.spawn with detached
true and unref then started caffeinate/direct Node with ignored stdin/private logs.
Root independently confirmed PID 12004, PPID 1, PGID 12004, no TTY and unique 8443 listener
after the launcher helper exited. No OS service/trust/firewall or product source change.

N1's verifier log reports full completion and bounded native 429 handling; the wrapper
failed to capture its exit because zsh variable status is readonly. That wrapper failure
is retained, not relabeled exit 0. Root independently ran the full verifier with exit 0
captured directly, GET 200 with normal trusted TLS, and Docker/PID/TLS/permissions audit.
Evidence: root-e-verify.log, root-e-https.json and root-e-resource-audit.json in
.git/local-orchestration/phone-target-rehearsal/. All developer identities/ports remain
unchanged; PG/S3 are loopback-only. Exact source 459 SHA remains
0f075fa48ab8c2b3a202a711ccb2a14f16d84881fbb202478df35c730b3d70f5.

Root restores OP-test-target/G0 availability approval. Catalog remains 43/81 (53%),
38 open; no physical scenario is completed. The URL is unchanged, but the new e public
CA and synthetic access file replace the earlier d handoff. Leaf expires
2026-10-28 22:12:32 Bogotá. Owner access/trust and T093/T087 remain pending.
