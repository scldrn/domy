# Local deployment and database-recovery handoff

**Status (2026-10-23):** OP-02's synthetic database restore and OP-01's local candidate image,
fresh stack, migrations, proxy/privacy checks, and live assets passed N1 and independent N2
verification. The historical-image upgrade remains plan-only. This document does not authorize
production deployment or close OP-01, broader OP-02, G1, or physical acceptance.

The governing requirements are [Constitution 2.0.0](../.specify/memory/constitution.md),
[OP-01](integral-execution-backlog.md#op-01-deployment-upgrade-and-recovery-runbook),
[OP-02](integral-execution-backlog.md#op-02-backup-and-demonstrated-restore), the
[local deployment inventory](local-deployment-inventory.md), and the detailed
[restore receipt](../specs/004-tracking-merchant-link/local-database-restore-results.md).
The receipt holds exact run evidence and first failures; use it instead of copying old
addresses, process IDs, credentials, or raw state into a new run.

The ratified deployment shape is Docker Compose on one VPS with Caddy for HTTPS, and
[001 research R16](../specs/001-shipment-registration/research.md#r16-local-development-and-ci)
defers its Docker image/Caddy/provider deployment work until a first release is prepared.
OP-01 requires the deployment artifacts and upgrade rehearsal; it does not select a live host,
domain, account, or cost. External production infrastructure/provider purchase and actual
deployment are the project owner's responsibility; no provider account, domain, cost, or
production target was selected or contacted in this local work.

## Current evidence and target boundaries

The recovery proof used the synthetic `phone-20261022-public-a` database as its source. The
current LAN application candidate is the separate `phone-20261022-public-b` run documented in
the [current-network receipt](../specs/004-tracking-merchant-link/local-target-current-network-results.md).
Do not treat public-a's former app address as current, or use public-b as the backup source
without a new identity check. Read the current receipt and recheck the live interface and
bindings before any later local operation.

The recorded run identities are useful for comparing those receipts. They identify those
synthetic builds only; recalculate and review identities for every new candidate.

| Local run | Source digest | Schema digest | Lock digest | Web-build digest |
| --- | --- | --- | --- | --- |
| public-a recovery source | `a708ba74689f8d6a0c9948e7d10f7e39d2c25974c30adb796246b68bc7919e28` | `44c18a4b09d70a6988a18a12b01f970a9bd8e673aaf682a600e954f0370b3a07` | `50f41517a321ef8cb3b6e005e9672ea08703ae302585e8d87ea7864c7ef5b718` | `e5ada0e75b34a13666db1148c8cb66cd5f3903a0a8dda6db057260e558bf2d11` |
| current public-b LAN candidate | `a708ba74689f8d6a0c9948e7d10f7e39d2c25974c30adb796246b68bc7919e28` | `44c18a4b09d70a6988a18a12b01f970a9bd8e673aaf682a600e954f0370b3a07` | `50f41517a321ef8cb3b6e005e9672ea08703ae302585e8d87ea7864c7ef5b718` | `fc6224baced85c2ef82de932f3e57dd91a56477fadacdedb0c8637f4e9c52584` |

The separately computed 523-file catalog digest is
`2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6`; it is a different
identity scope from the launcher's source digest. The recovery run used a cached pinned
PostgreSQL image with digest
`74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336`; source and target
`pg_dump`/`pg_restore` clients all reported PostgreSQL 18.6.

The local launcher is [`local-phone-target.ts`](../apps/server/scripts/local-phone-target.ts).
Its per-run state, credentials, generated Compose files, and certificates are private under
`.git/local-phone-target/<run-id>/`; never copy or print `state.json`. The OP-02 proof helpers
and raw manifests are also machine-local under `.git/local-orchestration/` and are not tracked
repository tooling. This runbook does not assume a clone contains them. Preserve old 003,
public-a, public-b, and restore-c containers, volumes, networks, and first-failure evidence.
Do not run `compose down`, prune, remove, overwrite, or reuse resources as a cleanup shortcut.

The restore target used a dedicated ordinary Docker bridge with one checked endpoint and a
loopback-only host database port so a host-native app could reach PostgreSQL. That bridge
allows outbound container traffic; the executor made no external request, but the network was
not egress-isolated. A future operator must review that boundary for its target. The current
LAN app's PostgreSQL and S3Proxy ports are loopback-only; its HTTPS listener is on the current
LAN interface. These local arrangements are not production network configuration.

## OP-02: select, dump, restore, and verify

Perform this procedure only for synthetic data or an explicitly approved isolated dataset.
Use a new run ID, container, volume, network, database, and unused loopback port for the
restore target. First inventory existing resources and verify that the source identity and
target names are exact. A port check is only a point-in-time observation; reserve the target
only after reviewing the candidate. Use the cached, pinned PostgreSQL image with `--pull=never`
and require source/target client versions to match. Never point these steps at the
operational database.

For a read-only local inventory, compare the repository state and Docker resource list with
the current run receipt:

```sh
git status --short
git rev-parse HEAD
docker ps -a --format '{{.Names}} {{.Image}} {{.Ports}}'
docker volume ls --format '{{.Name}}'
docker network ls --format '{{.Name}}'
```

These commands inspect local files and Docker inventory. They do not establish application
health or backup policy. The launcher's `verify` command also performs app/auth probes; run it
only against the specifically reviewed synthetic target because login can create volatile
sessions. Never dump the launcher state file to the terminal.

### Capture one consistent database snapshot

The proven source did not have host `pg_dump` or `pg_restore` binaries on `PATH`. Use the
PostgreSQL client binaries inside the verified source and target containers, with the archive
streamed to a private local file. Create the run directory with mode `0700`, set `umask 077`,
and keep the archive, schema dump, manifests, and sanitized logs mode `0600`. Do not place
credentials in shell history, argv, tracked files, or console output.

For a consistent archive, a reviewed exporter must hold a source transaction open at
`REPEATABLE READ READ ONLY`, export a PostgreSQL snapshot, and keep that transaction open while
the baseline queries, schema dump, and archive dump use the same snapshot. The command shape
is:

```sh
umask 077
set -o noclobber
docker exec "$SOURCE_CONTAINER" pg_dump \
  --no-password \
  --username="$SOURCE_ROLE" \
  --dbname="$SOURCE_DATABASE" \
  --format=custom \
  --no-owner \
  --no-acl \
  --snapshot="$EXPORTED_SNAPSHOT" > "$PRIVATE_ARCHIVE"
```

`SOURCE_CONTAINER`, role, database, snapshot token, and private archive path must come from
the reviewed run context. Do not place a password in this command. Use the container's
approved local authentication; if it cannot connect without prompting, stop and design a
private credential path before continuing. Capture and compare non-MVCC sequence values
before and after the dump; abort if they differ. Compute the archive digest and byte count
privately. A bare `pg_dump` without the exported snapshot and its held transaction does not
reproduce the demonstrated point-in-time baseline.

### Restore only to a new empty target

Check the target image and PostgreSQL client versions. Confirm the new target database is
empty before restore and has a distinct PostgreSQL system identifier from the source. Use
`pg_restore --list` as a read-only archive check. Because the archive is supplied on stdin,
omit a positional archive filename (including `-`):

```sh
docker exec -i "$TARGET_CONTAINER" pg_restore --list < "$PRIVATE_ARCHIVE"
```

After the list and identity checks pass, restore into the same new empty database in one
transaction. These flags were exercised by the verified synthetic restore:

```sh
docker exec -i "$TARGET_CONTAINER" pg_restore \
  --no-password \
  --username="$TARGET_ROLE" \
  --dbname="$TARGET_DATABASE" \
  --exit-on-error \
  --single-transaction \
  --no-owner \
  --no-acl \
  < "$PRIVATE_ARCHIVE"
```

Do not add `--clean`, `--create`, a drop, or an in-place overwrite. If any precondition or
command fails, stop, retain the first failure and all partial artifacts/resources, and get a
new review before another attempt. Do not blindly retry or clean up the failed target.

### Verify before starting the app

Compare the restored database with the snapshot baseline before authenticating or making
application writes:

- Compare canonical UTC row counts and SHA-256 row hashes for all 31 tracked tables (30
  application tables and the Drizzle migration journal), including every user/auth column.
- Compare the schema digest, all 66 foreign-key definitions and validation states, orphan
  counts, focused relationship joins, and migration-journal sequence state.
- Compare shipment and courier-record financial totals as integer COP, representative event,
  route, and custody history, and photo-metadata relationships. A matching database row does
  not prove the corresponding photo object is present.
- Verify the target system identifier differs from the source. Record archive SHA-256,
  source/build/schema/lock identities, image digest, client versions, target identity, and
  elapsed times without credentials or raw customer rows.

Only then run the repository migration code against the explicit target URL, without loading
the checkout's `.env`. The OP-02 proof restored a database already at the candidate schema;
the migration runner was therefore a no-op, and the full manifest remained unchanged. Do not
use `pnpm db:migrate` with an unspecified `.env` target. Any changed schema/data or migration
failure is a stop condition requiring review.

## OP-01: local image, startup, and proxy verification

The final local candidate used source manifest
`9604ca9689fc7e354f9f1245a424f72316b4b5ed041635f65c505403dabb32e2` and image
`sha256:f9c052a29f8bcfea38678e25b4da0fe0cdb351b640f4fe1104d73b57770bd551`. It is a local
Docker Desktop `linux/arm64` candidate, not a selected production platform. The container
rehearsal receipt records the build, quality gates, and independent image-structure check:
[deployment container results](../specs/004-tracking-merchant-link/deployment-container-results.md).

A fresh synthetic lab initialized its private local S3Proxy bucket and applied the ten current
migrations before the app started. Read-only checks found 31 relations (30 application tables
plus the Drizzle journal), 66 validated foreign keys, and the exact ten migration entries. Root
independently verified schema/journal state and the bucket. The app became healthy on the exact
candidate image; PostgreSQL and the app listener remained unpublished, Caddy was bound only to
`127.0.0.1:8446` and `127.0.0.1:8081`, and the app had no usable external default route.
The proxy/app and database networks were internal. Caddy and edge clients used an ordinary
bridge with egress enabled, so this lab is not blanket egress-isolated.

N1 and N2 used strict CA validation against the local Caddy CA without changing system trust or
DNS. Health live/readiness, root HTML, the actual hashed application JavaScript, web manifest,
service worker, tracking/client pages, public tracking API, and anonymous private-photo denial
passed. The observed asset responses had no `Cache-Control` header for home HTML, hashed
JavaScript, manifest, or service worker; no immutable-cache policy is claimed. Tracking/client
HTML and the unknown tracking API returned `no-store` and `noindex`. CSP matched the reviewed
script, frame/object, and exact style-hash directives.

Two distinct edge clients verified that the first client received 60×404 then 429 while the
second remained 404 with forged forwarded headers. Direct edge-to-app health access failed within
the bounded 1.5-second check. The privacy probe received 200, 404, controlled 502, and malformed
400 responses. Marker scanning found zero markers while app/Caddy logs retained useful request
records, including status and latency. N1 live-assets proof and root's independent runtime and
proxy proofs are private under `.git/local-orchestration/op01/lab-20261022/`; see the packaging
receipt for the proof filenames and cache-header facts:
[deployment packaging results](../specs/004-tracking-merchant-link/deployment-packaging-results.md).

The source working tree stayed frozen during the image and lab run. The earlier Base UI
select-popup CSP failure was resolved without weakening policy; the final local quality gates
passed (`pnpm check`, 1610 tests, 154 E2E tests with zero retries, and `pnpm build`). Cold
tracking visibility was 2837.3 ms against the 3000 ms limit. Shutdown timing/restart behavior
was not exercised by this lab.

### Historical-image upgrade remains a plan

No previous-release image or schema-upgrade rehearsal was run. Do not claim that a prior app
binary can run against the candidate schema. A future bounded rehearsal may use a fresh synthetic
historical schema based on repository snapshot `94a7e24` (migrations 0000–0007) with representative
fixtures, or an identified actual prior release image if one becomes available. First create a
new isolated target and preserve its backup. Stop any old app before candidate migrations, keep it
stopped through DDL, and start only the candidate after successful migration. Do not use the
current retained lab or its consumed grant for an upgrade; this requires a separately reviewed
procedure, fresh target, and new authorization.

The tracked `compose.yaml` remains the development stack and exposes PostgreSQL, Adminer, and
S3Proxy; do not use it as a public topology. The candidate's local health, TLS, proxy identity,
and logging checks do not verify production firewall/provider policy or installed-phone
compatibility. Initial-owner creation remains a separate guarded manual operation; this run did
not create accounts or send email/push. The lab S3Proxy does not prove provider behavior.

## What remains outside this proof

The OP-02 restore and OP-01 container rehearsal remain synthetic local exercises. They do not
establish:

- owner-agreed RPO/RTO or a measured full incident recovery time;
- client-owned daily snapshots, nightly dumps, approved storage, retention, access controls,
  scheduled-job ownership, or failure alerts;
- a production host, public origin/domain, approved cost/authority, production image/platform,
  production network policy, restart/shutdown behavior, or prior-version upgrade rehearsal;
- backup or recovery of S3 photo objects, provider privacy, the documented 12-month lifecycle,
  missing/expired-photo behavior, or cross-store restore ordering;
- actual phone installation, push/email delivery, courier consent, or physical acceptance.

No photo objects were read or copied during the restore proof. Database metadata verification
is not object recovery. Local S3Proxy behavior is not evidence about a provider. The source,
restore target, and Caddy edge bridge allowed egress; do not describe those networks as
egress-isolated. No production deployment, external CI, external provider operation, or
customer-data recovery is authorized by this runbook. External production deployment is the
project owner's responsibility.

## Next three handoff steps

1. Keep the historical-image/schema upgrade plan-only until a prior image or bounded
   historical fixture is identified. If it proceeds, prepare a fresh isolated target and
   immutable backup, stop any old app before DDL, and obtain separate review and authorization.
2. The project owner handles external infrastructure/provider selection, purchase, public
   origin, cost, secrets delivery, and actual production deployment. These local receipts do not
   select or execute those operations.
3. Keep broader OP-02 decisions and evidence separate: agree RPO/RTO, retention/schedule/alerts,
   provider photo-object recovery, and physical Android/iPhone acceptance. None is established
   by the synthetic local database and container rehearsals.
