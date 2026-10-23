# OP test target: local rehearsal evidence

Status: root approved the launcher source, including resource-name, bounded health-wait,
authentication-rate-limit, and graceful-shutdown fixes. Failed runs a/b/c were retired with
their data volumes preserved. Run `phone-20261021-d` was privately built, sealed, verified
before and after an app-only graceful restart, and then passed root's independent N2 live
verification and resource audit. Both executor verifies handled one native 429 through the
bounded Retry-After path. No URL is offered to the operator. Physical phone/camera/installation
acceptance, push delivery, external-provider retention, and T084/G0 closure remain unverified.

## First prepare attempt: observed RED

Preflight at `2026-10-21 15:48:42 -05` found LAN interface `en0` at `192.168.58.219` and
Docker context `desktop-linux` using the local Unix socket. The existing development
containers were `domy-postgres-1` on port 5432, `domy-adminer-1` on 8080, and `domy-s3-1`
on 9100. Requested ports 8443, 15432, and 19100 were free. The requested run ID
`phone-20261021-a` was unused before the attempt. Preflight evidence is in
`.git/local-orchestration/phone-target-rehearsal/preflight-*.log`.

The authorized `prepare` invocation for `phone-20261021-a` exited nonzero. Its preserved
output is `.git/local-orchestration/phone-target-rehearsal/prepare.log`. Docker created the
two run-labelled containers, volumes, and network before the ownership check rejected the
network. The message `no se modificó nada` was inaccurate: this attempt had already created
run-scoped resources.

The concrete comparison defect is recorded by the RED logs:

| Read-only command | Actual output |
| --- | --- |
| `docker network ls -q --filter label=com.domy.local.run-id=phone-20261021-a` | Network ID `311038eab1b3` |
| `docker network ls --format '{{.Name}}' --filter label=com.domy.local.run-id=phone-20261021-a` | `domy-phone-phone-20261021-a-network` |
| `docker ps -a --format '{{.Names}}' --filter label=com.domy.local.run-id=phone-20261021-a` | `domy-phone-phone-20261021-a-postgres-1`; `domy-phone-phone-20261021-a-s3proxy-1` |
| `docker volume ls --format '{{.Name}}' --filter label=com.domy.local.run-id=phone-20261021-a` | `domy-phone-phone-20261021-a-pgdata`; `domy-phone-phone-20261021-a-s3data` |

Raw command output is preserved in `red-network-ids.log`, `red-network-names.log`,
`red-container-names.log`, and `red-volume-names.log`. Label and loopback binding details
are preserved in `red-network-labels.log` and `red-container-labels-ports.log`. The private
state summary in `prepare-partial-state-summary.log` records only allowlisted metadata; the
full private state was not printed.

## Source correction and N1 checks

The narrow fix makes every non-container resource listing use Docker's `{{.Name}}` format
for run-label, project-label, and exact-name filters. Container listings retain `{{.Names}}`.
Expected-name, label, count, image, port-binding, and fail-closed ownership checks remain in
place. Ownership guard failures now say that the operation stopped, without claiming that no
earlier side effects occurred.

| Check | Result |
| --- | --- |
| Pure CLI/state smoke against published launcher | PASS, exit 0: 13 accepted/rejected expectations; `.git/local-orchestration/phone-target-rehearsal/n1-pure-cli-state-final.log` |
| Read-only native listing using formatted resource names | PASS; `.git/local-orchestration/phone-target-rehearsal/n1-*-names.log` |
| CLI `prepare --dry-run` | PASS, exit 0; no files or resources created; `.git/local-orchestration/phone-target-rehearsal/n1-cli-dry-run.log` |
| Prettier | PASS, exit 0 after formatting the script; `.git/local-orchestration/phone-target-rehearsal/n1-prettier-final.log`. The initial check failure is preserved in `n1-prettier.log`. |
| Scoped ESLint | PASS, exit 0, `--max-warnings 0`; `.git/local-orchestration/phone-target-rehearsal/n1-eslint-final.log` |
| Server typecheck | PASS, exit 0 (`tsc --noEmit`); `.git/local-orchestration/phone-target-rehearsal/n1-server-typecheck-final.log` |
| `git diff --check` and whitespace check including untracked owned files | PASS, exit 0; `n1-diff-check-final.log` and `n1-untracked-whitespace.log` |
| Updated launcher SHA-256 | `f4d70f52c288a494d84a4f83c8ab3ee528105992cd9e9c036139f30b381ad1be` |

The initial Prettier check found formatting in the launcher; it was corrected with Prettier,
then the complete scoped formatting check passed. All runtime resource-name queries in the
patched source use `--format '{{.Name}}'` for network and volume listings; container name
queries continue to use `{{.Names}}`.

The follow-up after root approved the source fix is recorded below. No target for operator
testing is ready yet.

## Acceptance limits

Run d verified CA-checked HTTPS with the current LAN IP SAN; HTML/assets, manifest and
service worker; secure synthetic sessions, Origin rejection, owner/dispatcher boundaries,
catalogue/settings, linked/unlinked courier route access, and private-photo access. The app
configuration explicitly sets `frame-ancestors 'none'`; the launcher does not assert a
complete `worker-src`, `manifest-src`, or `img-src` CSP policy. It did not test on a physical
phone, camera, PWA installation, push subscription/delivery, or external-provider retention.
The VAPID pair is synthetic and persisted locally, but no notification was sent. No URL is
offered to the operator.


## Root source-fix review — 2026-10-21

Root independently reproduced the actual read-only Docker ID/name mismatch and
verified the network's exact run/project/managed labels and loopback-only containers
(`root-network-red-verification.json`). Exact reverse reconstruction matches prior
script SHA c10d43b8; `root-network-fix.diff` proves the correction changes only the
three listing formats and truthful guard messages. All ownership, image, port,
count and no-overwrite guards remain byte-identical. Root's own scoped ESLint and
server typecheck passed (`root-fix-{eslint,typecheck}.log`).

Corrected script f4d70f52c288a494d84a4f83c8ab3ee528105992cd9e9c036139f30b381ad1be
is approved for scoped cleanup/rehearsal. This does not certify a running target.
Only the failed owned run may be stopped, preserving volumes; then a fresh run b
may be prepared under the original safety boundaries. T084/G0 remain pending.

## Executor N1 follow-up — 2026-10-21

Root approved the source correction and granted the exclusive resource slot. The exact
`stop --run-id phone-20261021-a` command exited 0 (`a-stop.log`). Read-only follow-up
confirmed its containers and network were absent, both volumes remained, and the three
development containers retained the preflight IDs and ports. PostgreSQL and S3 ports 15432
and 19100 were bind-available after cleanup. Evidence is in `a-post-stop-*.log`.

Fresh preflight selected `en0` at `192.168.58.219`, Docker context `desktop-linux` on the
local Unix socket, and found no resources or private directory for `phone-20261021-b`. Ports
8443, 15432 and 19100 were available and the pinned Postgres 18 and S3Proxy 4.1.1 images
were cached. Evidence is in `b-preflight-*.log`.

The authorized `prepare --run-id phone-20261021-b` command exited 1 with
`Un servicio aislado no está ejecutándose en estado saludable.` (`b-prepare.log`). A later
read-only inspection found both run containers healthy with zero failing streak; this does
not establish whether their health changed after the guard. The allowlisted private-state
summary records phase `failed`, no process, no build digest and no VAPID pair configured.
The two containers, network and two volumes remain labelled for run b, with service ports
bound only to loopback. No state JSON, environment values, passwords or keys were printed.
Evidence is in `b-prepare-state-summary.log`, `b-prepare-containers.log`,
`b-postgres-health.log`, `b-s3-health.log`, `b-prepare-networks.log`, and
`b-prepare-volumes.log`.

No build, operational verify, listener, cleanup or retry followed the run b failure. Its
resources remain untouched pending root review. The corrected launcher SHA-256 remains
`f4d70f52c288a494d84a4f83c8ab3ee528105992cd9e9c036139f30b381ad1be`.

## Bounded health-readiness correction — 2026-10-21

Root's preserved read-only timeline `.git/local-orchestration/phone-target-rehearsal/root-b-health-red-timeline.json`
shows the `prepare` log ending at epoch `1792616273.648285`. Postgres first reported healthy
at `1792616274.420365292`, 0.772080292 seconds later; S3Proxy first reported healthy at
`1792616277.334271835`, 3.685986835 seconds later. Neither container restarted. This confirms
that the ownership/readiness guard ran before Compose's native health status became ready.

The only launcher behavior change is adding `--wait --wait-timeout 90` to the existing
`compose up --detach --pull never` invocation. The manual 90-second TCP/HTTP checks and all
resource count, label, image, port, and health guards remain. The existing child-process
timeout is 120 seconds. Installed Compose advertises both options in
`.git/local-orchestration/phone-target-rehearsal/c-compose-up-help-flags.log`.

| Source-only N1 check | Result |
| --- | --- |
| Prettier | PASS, exit 0; `.git/local-orchestration/phone-target-rehearsal/c-prettier.log` |
| ESLint `--max-warnings 0` | PASS, exit 0; `.git/local-orchestration/phone-target-rehearsal/c-eslint.log` |
| Server typecheck | PASS, exit 0; `.git/local-orchestration/phone-target-rehearsal/c-server-typecheck.log` |
| Pure CLI/state smoke | PASS, 13 accepted/rejected expectations, 0 failures; `.git/local-orchestration/phone-target-rehearsal/c-pure-cli-state.log` |
| CLI `prepare --dry-run` | PASS, no files or resources created; `.git/local-orchestration/phone-target-rehearsal/c-cli-dry-run.log` |
| Native Compose help | PASS: both `--wait` and `--wait-timeout` are advertised; full output in `c-compose-up-help.log` |
| Updated launcher SHA-256 | `8c095316ace74d1e9e25a0f98f342e238c6197a76359f89b4eb333788b551d1d` |

No operational launcher command or Docker resource mutation was run for this source correction.
The failed run b resources and the two preserved run a data volumes remain untouched.
Root must review this source correction before authorizing cleanup or a new attempt.


### Native Compose health-wait correction approved — 2026-10-21

Root independently reviewed the exact one-line change against reconstructed approved
f4d source. Native `--wait --wait-timeout 90` precedes the complete health guard;
no budgets or ownership checks changed. Own scoped ESLint and server typecheck
passed. Launcher SHA 8c095316ace74d1e9e25a0f98f342e238c6197a76359f89b4eb333788b551d1d
is approved. Earlier application QA is unchanged. The executor subsequently stopped only
run c with the guarded launcher, preserving its data volumes and the a/b volumes, then
prepared fresh run d and performed the rehearsal documented below. No task/status checkboxes
were changed. Catalog remains 42/81 (52%); T084 and G0 remain open pending root N2 and later
physical acceptance.

## Run c authentication and shutdown RED — 2026-10-21

The approved run `phone-20261021-c` was prepared, privately built with `envDir: false`,
sealed, and started on the current LAN interface. The live verifier used Node HTTPS with the
run CA and hostname/IP verification. HTML, referenced JS/CSS, `/manifest.webmanifest`, and
`/sw.js` returned 200 before the authentication phase failed. The sanitized
`.git/local-orchestration/phone-target-rehearsal/c-auth-response-statuses.log` records the
exact auth endpoint/status sequence, without headers, bodies, user IDs, or cookies:

| Request | Status |
| --- | ---: |
| Owner synthetic sign-in before invalid-Origin probe | 200 |
| `ban-user` with invalid Origin | 403 |
| Owner synthetic sign-in before missing-Origin probe | 200 |
| `ban-user` with missing Origin | 403 |
| Owner synthetic sign-in for owner role checks | 200 |
| Dispatcher synthetic sign-in | 429 |

Correction: an earlier informal count of six sign-ins was wrong; the preserved log has four
`/api/auth/sign-in/email` requests, with statuses `200, 200, 200, 429`. The verifier did not
capture the response body or retry header, so the 429's exact server response is unknown.
The first failed verify's actual sanitized output is in
`.git/local-orchestration/phone-target-rehearsal/c-verify-first.log`; it ended with the
generic safe message `Better Auth no creó una sesión sintética segura.` The candidate change
reuses the owner session for the two Origin probes, and retries only a 429 that includes a
single integer `X-Retry-After` value from 1 through 10, waiting that many seconds once. It
does not retry other statuses or change Better Auth limits. No operational verifier rerun
has occurred after this source edit.

An authorized Ctrl-C was sent only to the executor's own serve PTY (session 61948). The PTY
exited with status 1. The allowlisted post-signal summary
`.git/local-orchestration/phone-target-rehearsal/c-after-sigint-state-summary.log` still
reported phase `running` and the prior process PID; root later confirmed that PID 91110 was
absent. The recorded containers remained healthy and unchanged, the HTTPS port was released,
and volumes were preserved. No second signal, manual kill, state edit, stop/down, or cleanup
was attempted. An independent auditor found that a second signal can arrive after a one-shot
handler is removed during asynchronous close; this is a plausible explanation, not proven
as the cause of this run's stale state.

The source-only candidate keeps `SIGINT` and `SIGTERM` handlers registered while closing the
HTTPS server, ending the DB client, and persisting `prepared`/`process: null`. A `closing`
guard ignores duplicate signals, and handlers are removed in `finally` after cleanup. It
emits sanitized start/completion/failure events without state or error details. This fix has
not been exercised against a listener because run c is now left untouched for root review.

| Source-only candidate N1 check | Result |
| --- | --- |
| Prettier first check | Expected formatting failure, preserved in `c-sourcefix-prettier-attempt1.log`; corrected with Prettier before final checks. |
| Prettier final | PASS, exit 0; `c-sourcefix-prettier-final.log` |
| Scoped ESLint `--max-warnings 0` | PASS, exit 0; `c-sourcefix-eslint-final.log` |
| Server typecheck | PASS, exit 0 (`tsc --noEmit`); `c-sourcefix-typecheck-final.log` |
| Pure import/CLI/state smoke | PASS: 1 valid and 10 invalid command cases, 1 valid and 5 invalid state cases; `c-sourcefix-pure-smoke-final.log` |
| CLI `prepare --dry-run` | PASS, no writes/resources; `c-sourcefix-dry-run-final.log` |
| Receipt Prettier check | PASS, exit 0; `c-sourcefix-receipt-prettier.log` |
| `git diff --check` and explicit trailing-whitespace scan | PASS, exit 0; `c-sourcefix-git-diff-check.log` and `c-sourcefix-untracked-whitespace.log` |
| Earlier typecheck wrapper attempt | Shell parse failed before `pnpm` ran (`zsh: unmatched '`); the successful final typecheck above used explicit empty DSN environment values. |
| Candidate launcher SHA-256 | `6dbb6d44511f035f5cddec0638ed52122032e15d41dde6158336a7997322d322` |

Run c was prepared from launcher SHA
`8c095316ace74d1e9e25a0f98f342e238c6197a76359f89b4eb333788b551d1d`; its allowlisted state
summary recorded source digest `7827e35fffae6139db40d3f1f13243a89828cb27ba1fddb9303a244147a4b6e8`
and build digest `9ccfb13a7c54dd27d48cc4c1fdfe75f17c8913d98e06eaf8fe7359ef1b523020`. The
sealed build predates these source edits and is stale against the current launcher. No rebuild
or verifier retry followed for c. This run c's partial verification does not establish role,
route, catalogue, or private-photo readiness. Run d is documented separately.


### Authentication/shutdown source correction approved — 2026-10-21

Root reconstructed exact approved 8c09 from retained c10d plus approved diffs, then
inspected combined diff `af2a39fba8115d544c5b705eb952bdf9d84a373a2b5f9bd6c291a2b31ffc60d7`.
Current launcher `6dbb6d44511f035f5cddec0638ed52122032e15d41dde6158336a7997322d322` passes
executor N1 and independent root ESLint/types/format. Root directly executed the extracted
actual signIn function against 14 boundary cases: immediate failures, strict retry-header
validation, one bounded native 429 wait/retry, and final failure. Two extracted actual
shutdown callback cases prove repeated/mixed signals retain handlers through exactly one
cleanup/persistence. These are source-only checks, not network or real shutdown acceptance;
Node's stripping API emitted its standard experimental warning in this disposable audit
harness. An initial harness extraction syntax error is retained separately, corrected without
product edits.

Root also independently reviewed quickstart prerequisite corrections and verified
all 21 scenario rows byte-identical to HEAD, linked files present, and the unpinned command
removed. The executor then stopped only run c, preserved its volumes, prepared/built/sealed
run d, and completed the app-only restart documented below. Catalog remains 42/81 (52%);
T084/G0 remain open pending root N2 and later physical acceptance.

## Run d executor N1 — 2026-10-21

Root approved launcher SHA `6dbb6d44511f035f5cddec0638ed52122032e15d41dde6158336a7997322d322`
and granted the exclusive resource/build slot. The executor stopped only stale run c using
the native launcher command
`pnpm --filter @domy/server exec node scripts/local-phone-target.ts stop --run-id phone-20261021-c`;
it exited 0 (`.git/local-orchestration/phone-target-rehearsal/d-stop-c.log`). Read-only
inventory confirmed c's containers/network were absent while its two volumes remained. The a
and b volumes also remained. The development services kept their preflight identities and
ports: PostgreSQL `a7ffe3cab8a8`/5432, Adminer `c490b3a659d8`/8080, and S3 `b3b6814cd5a4`/9100.
The cleanup/preflight evidence is in `d-preflight-*.log`.

Preflight at `2026-10-21 16:15:00 -05` found default interface `en0`, LAN IPv4
`192.168.58.219`, local Docker context `desktop-linux` using the local Unix socket, cached
Postgres 18 and S3Proxy 4.1.1 images, free TCP ports 8443/15432/19100, and no resources or
private directory for new run `phone-20261021-d`. The exact approved `prepare` command with
`--enable-local-push` exited 0 (`d-prepare.log`). It bound PostgreSQL and S3Proxy only to
`127.0.0.1`; generated synthetic VAPID material and credentials in the private run state;
and reported the public CA path
`.git/local-phone-target/phone-20261021-d/tls/domy-phone-ca.cer`. The run state and access
file modes were both 0600. No password or key material was printed.

Before invoking `emptyOutDir: true`, a path precheck verified that the web build ran from
`apps/web` and resolved its outDir exactly to
`.git/local-phone-target/phone-20261021-d/dist` (`d-build-path-precheck.log`). The private
Vite/service-worker build used `envDir: false`, blank Sentry DSNs, and disabled Better Auth
telemetry; it exited 0 (`d-private-build.log`). The native launcher `verify --seal-build`
then exited 0 (`d-seal-build.log`). The saved source digest is
`8d58f5e7ca62ac1dedcf2d37628e471ed4f5dd27b66e714da347284bd1aecabd`; the sealed build digest
is `9ccfb13a7c54dd27d48cc4c1fdfe75f17c8913d98e06eaf8fe7359ef1b523020`.

The first `serve --run-id phone-20261021-d` ran under `caffeinate -i -s` in its own PTY
(session 78767). Its allowlisted summary recorded PID 97027, process start time
`Wed Oct 21 16:15:37 2026`, and fingerprint
`67853f59a88247220ab6744ff5a8bc4c9893b2683976d59dc6c707c144fa6b5e`.
`verify --run-id phone-20261021-d` exited 0 (`d-verify-first.log`). It recorded exactly one
native 429 handling event with a validated 10-second `X-Retry-After`, waited once, retried
that sign-in once, and completed verification. The successful verifier checks include
CA/IP-verified HTTPS, compiled assets/manifest/service worker, secure synthetic sessions,
Origin rejection, owner/dispatcher role separation, catalogue and pickup points, settings
authorization, linked versus unlinked courier route access, and private-photo upload/read
boundaries.

To exercise app-only graceful shutdown, the executor used the one-shot helper
`.git/local-orchestration/phone-target-rehearsal/d-sigterm-verified.mjs`. Immediately before
signalling, it compared the private run/process metadata with native `ps` start time and
argv-derived fingerprint, checked the exact run title, and confirmed the saved PID was the
unique listener on 8443. It then sent exactly one SIGTERM to verified PID 97027. The PTY
exited 0; the server log ended with sanitized close-started/completed events. Afterward the
allowlisted state was `prepared` with `process: null`, the PID was absent, and port 8443 was
free. The two run d containers stayed healthy with IDs
`c72658e70ca4` (Postgres) and `9ee0a1534cce` (S3Proxy); network and both volumes remained.
The read-only evidence is in `d-sigterm-verified.log` and
`d-after-first-shutdown-*.log`.

Without rebuilding, rerunning `prepare`, or generating keys, the executor started the same
`serve` command again in its own caffeinated PTY (session 64150). The new allowlisted summary
recorded PID 98556, start time `Wed Oct 21 16:17:05 2026`, and fingerprint
`b40efd21063b63282ee11eaa4696e1e68f9acc7c1a8eef5ba87c11856b0a151e`. The second
`verify --run-id phone-20261021-d` also exited 0 (`d-verify-restart.log`) and completed the
same bounded 429 wait/retry. Before and after restart, the credential fingerprint remained
`aad48b91fc36adb3bdacdb90cb3074b6a7b7a52072af879bf2ce3dc5169c7c13`, the VAPID-pair
fingerprint remained
`fc7ba66f4cd5148a0491bb031fb13491d385fd6d9f783fafbed564b4e107b5b4`, and source/build
digests, run ports, private file modes, container IDs, network, and volume names remained
unchanged. No secret values were logged.

The public leaf certificate is at
`.git/local-phone-target/phone-20261021-d/tls/server.crt`; the public CA is at
`.git/local-phone-target/phone-20261021-d/tls/domy-phone-ca.cer`. The leaf PEM-file SHA-256 is
`a19d2f7136cc686fb007f2f5258c845b184d872e1d21e2d1ff97199eddf2c869`; its SAN is
`IP Address:192.168.58.219, IP Address:127.0.0.1, DNS:localhost`, and its validity is
`Oct 21 21:15:05 2026 GMT` through `Oct 28 21:15:05 2026 GMT`. Native X509 metadata checks
returned the LAN IP and `localhost` as matching identities. The CA fingerprint and
allowlisted certificate metadata are in `d-final-certificate.log`.

Root subsequently ran an independent live `verify` with exit 0 (`root-d-verify.log`) and
audited TLS/certificate permissions, PID/unique HTTPS listener, healthy loopback-only target
containers, and unchanged development service identities (`root-d-resource-audit.json`).
The audited source aggregate remained
`0f075fa48ab8c2b3a202a711ccb2a14f16d84881fbb202478df35c730b3d70f5`. The listener was kept
available for root's verification; no operator URL is offered. This rehearsal does not test
physical-device trust installation, camera permission, PWA installation, push
subscription/delivery, provider email/retention, or production service behavior. The local
VAPID opt-in only proves stable synthetic key persistence, not notification delivery. No OS
trust store, firewall, external provider, or production resource was changed.


## Root N2 runtime approval — 2026-10-21

Root independently ran the native verifier after N1's successful restart: exit 0,
normal CA/IP TLS verification, every auth/role/catalog/route/private-photo assertion
passed, with the bounded native 429 wait visible in the log. Independent inspection
confirmed the same healthy loopback-only containers and unchanged developer services,
PID 98556 as the sole HTTPS listener, private files at 0600 and no retained CA key.
The leaf chain passed native OpenSSL and the live CSP matched source. Root reviewed
the fingerprint-checked SIGTERM helper and actual prepared/null/restart evidence.

Source remains exactly `0f075fa48ab8c2b3a202a711ccb2a14f16d84881fbb202478df35c730b3d70f5`.
Only the launcher differs from T083's accepted application; exact reconstruction
provenance is retained. Root closes T084 and OP-test-target, verifies G0 for manual
LAN acceptance, and updates the catalog to 43/81 (53%), 38 open. No actual phone
trust/access, camera, installation, push delivery or provider result is inferred.

Evidence: `root-d-verify.log`, `root-d-resource-audit.json`,
`root-d-effective-csp.json`, and `root-application-source-provenance.json` under
`.git/local-orchestration/phone-target-rehearsal/`. An initial read-only resource
audit assumed `lsof -Fp` emitted only PID fields; native output also included an fd
field. The parser was corrected to select PID fields, with no product edits or
operational verifier retry (`root-resource-audit-parser-note.txt`).


## Availability recovery run e — 2026-10-21

After the earlier d listener was found absent while its state still said running,
the executor stopped only run d with the native launcher. The command exited 0;
`e-stop-d.log` records that its listener, containers, and network were stopped and
its volumes were preserved. Read-only preflight found `en0` at `192.168.58.219`,
the local `desktop-linux` Docker context, cached images, no run e resources or
private run directory, and free ports 8443/15432/19100. The preflight logs also
record the unchanged development service identities and ports.

Commands used:

```sh
pnpm --filter @domy/server exec node scripts/local-phone-target.ts stop --run-id phone-20261021-d
pnpm --filter @domy/server exec node scripts/local-phone-target.ts prepare --run-id phone-20261021-e --host-ip 192.168.58.219 --https-port 8443 --pg-port 15432 --s3-port 19100 --enable-local-push
SENTRY_DSN='' VITE_SENTRY_DSN='' BETTER_AUTH_TELEMETRY=false BETTER_AUTH_TELEMETRY_DEBUG=false caffeinate -i -s pnpm --filter @domy/web exec node --input-type=module -e 'const {build}=await import("vite"); await build({envDir:false,build:{outDir:"../../.git/local-phone-target/phone-20261021-e/dist",emptyOutDir:true}});'
pnpm --filter @domy/server exec node scripts/local-phone-target.ts verify --run-id phone-20261021-e --seal-build
SENTRY_DSN='' VITE_SENTRY_DSN='' BETTER_AUTH_TELEMETRY=false BETTER_AUTH_TELEMETRY_DEBUG=false node .git/local-orchestration/phone-target-rehearsal/e-start-detached.mjs
SENTRY_DSN='' VITE_SENTRY_DSN='' BETTER_AUTH_TELEMETRY=false BETTER_AUTH_TELEMETRY_DEBUG=false pnpm --filter @domy/server exec node scripts/local-phone-target.ts verify --run-id phone-20261021-e
```

The stop and prepare commands exited 0. The private build exited 0, followed by
the seal command exiting 0. The detached-helper invocation exited 0. The final
verify command's wrapper result is described below because zsh rejected its
attempt to assign to the special variable `status`.

The exact `prepare` command for `phone-20261021-e` used HTTPS 8443, PostgreSQL
15432, S3 19100, and `--enable-local-push`; it exited 0 (`e-prepare.log`). The
synthetic VAPID pair was written only to the private target state. No push was
sent and no device was subscribed. The public CA is
`.git/local-phone-target/phone-20261021-e/tls/domy-phone-ca.cer`; synthetic access
credentials are in `.git/local-phone-target/phone-20261021-e/phone-access.txt`.
The latter file was checked for mode 0600; its contents were not read or logged.

Before invoking `emptyOutDir: true`, the path check resolved the web working
directory and exact private destination as
`.git/local-phone-target/phone-20261021-e/dist` (`e-build-path-precheck.log`).
The Vite build used `envDir: false`, blank Sentry DSNs, and disabled Better Auth
telemetry; it exited 0 (`e-private-build.log`). The native
`verify --seal-build` command exited 0 (`e-seal-build.log`). The sealed state
records source digest `8d58f5e7ca62ac1dedcf2d37628e471ed4f5dd27b66e714da347284bd1aecabd`,
schema digest `cc196c6db44a62fb93b867c6cd138632db23033658b9d3221dc8070cbccb3805`,
lock digest `50f41517a321ef8cb3b6e005e9672ea08703ae302585e8d87ea7864c7ef5b718`, and
build digest `9ccfb13a7c54dd27d48cc4c1fdfe75f17c8913d98e06eaf8fe7359ef1b523020`.
The launcher SHA remained
`6dbb6d44511f035f5cddec0638ed52122032e15d41dde6158336a7997322d322`; the
accepted aggregate source SHA remained
`0f075fa48ab8c2b3a202a711ccb2a14f16d84881fbb202478df35c730b3d70f5`.

An initial shell attempt printed `zsh:disown:1: job not found: 11956`; a later
read found e still prepared with no process and no listener, so that attempt was
not counted as a successful launch. The exact diagnostic is retained in
`e-initial-disown-diagnostic.log`. The executor then used the disposable helper
`.git/local-orchestration/phone-target-rehearsal/e-start-detached.mjs`, which
spawned `/usr/bin/caffeinate -i -s` with Node's native `detached: true`, inherited
no PTY or package-manager parent, and called `unref()`. The helper exited 0 and
reported PID 12004. After the helper exited, the launcher state was `running`
with the same PID, start time `Wed Oct 21 22:13:58 2026`, and fingerprint
`306b3912dae89f173432b9487141032a1c8f3b1875a490f1938fb61a96602aec`. Read-only
process inspection found `PPID=1`, `PGID=12004`, and no TTY; the fingerprint and
run title matched, and PID 12004 was the listener on `192.168.58.219:8443`.

The executor invoked the real native `verify --run-id phone-20261021-e` once.
Its private log (`e-verify-detached.log`) contains the normal completion message
after one bounded, validated 10-second Better Auth rate-limit wait. The shell
wrapper then attempted to assign the result to zsh's read-only special variable
`status`, so the wrapper exited 1 and the verifier's own exit code was not
captured. This is recorded in `e-verify-wrapper-diagnostic.log`; the log is not
represented as an exit-0 N1 verify. Root independently ran the native verifier
with exit captured as 0 (`root-e-verify.log`) and confirmed TLS/GET success.

The public CA file SHA-256 is
`9ae764068c562d34d8e6ea30c46f1b2dc76ef08e56eb8c579a0dbd31b14657fd`; the public
leaf certificate is `.git/local-phone-target/phone-20261021-e/tls/server.crt`,
SHA-256 `dec14c9301e60eb9c808de0ed97ce7805bd9c0867a13a05cee724f9b908c8239`,
SAN `IP Address:192.168.58.219, IP Address:127.0.0.1, DNS:localhost`, valid
`Oct 22 03:12:32 2026 GMT` through `Oct 29 03:12:32 2026 GMT`. The CA and leaf
private keys remain private. Root's independent resource audit confirmed PID
12004 as the sole HTTPS listener, two healthy loopback-only target containers,
and unchanged development container identities and ports (`root-e-resource-audit.json`).
The server was left running for root; no shutdown/restart rehearsal was claimed
for run e.

The LAN address and URL are supplied to root for coordination, not offered to
the phone operator in this receipt. This rehearsal does not establish phone
trust installation, camera permission, PWA installation, push subscription or
delivery, provider email/retention, or production behavior. No OS trust store,
firewall, external provider, or production resource was changed.
