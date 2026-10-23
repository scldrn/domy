# OP-02 local restore rehearsal — restore-c completed after app-only continuation

Date: 2026-10-22 (Bogotá). One root-authorized invocation each ran for restore-a, restore-b,
and restore-c. A and B stopped before restore. C restored the snapshot, matched the full
manifest, and verified a migration no-op, then stopped during a pre-request database-clock
check. A separately reviewed, root-authorized app-only continuation resumed that exact C
target and completed registration/replay and postchecks without restoring or migrating again.
The local synthetic rehearsal now passes N1 and independent root N2 verification. Broader
OP-02/G1, provider and physical/final acceptance remain incomplete.

Source: synthetic run `phone-20261022-public-a`, PostgreSQL loopback port `15433`, PID `41028`.
The original observed LAN address was `10.12.117.118`; the current en0 address is
`192.168.58.219`, while the source app remains bound to the old address. PostgreSQL loopback
and the source state/data remain intact. The helper uses the validated source PostgreSQL
container and loopback port; it does not call the source HTTPS app or S3. Source inventory:
1 dispatched/notification-marked shipment, 1 route, 1 courier-record row, 1 shipment-event
row, 1 photo-metadata row, 0 pending actions. Catalog: 30 application tables, the Drizzle
migration table, and `drizzle.__drizzle_migrations_id_seq` (`last_value=10`). The separate
523-file catalog digest is `2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6`.
The launcher state uses source identity digest
`a708ba74689f8d6a0c9948e7d10f7e39d2c25974c30adb796246b68bc7919e28`, schema digest
`44c18a4b09d70a6988a18a12b01f970a9bd8e673aaf682a600e954f0370b3a07`, lock digest
`50f41517a321ef8cb3b6e005e9672ea08703ae302585e8d87ea7864c7ef5b718`, and build digest
`e5ada0e75b34a13666db1148c8cb66cd5f3903a0a8dda6db057260e558bf2d11`.
The prior 003 target (PID `12004`) and its containers, volumes, and networks remain untouched.

First target: run `phone-20261022-restore-a`, container
`domy-phone-phone-20261022-restore-a-postgres-1`, new volume/network, loopback port `15434`,
image `postgres@sha256:74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336`.
The initial inventory found the port free and uniquely named resources absent. This attempt
created the container, volume, and internal network; they remain in place after failure. A
separate `public-b` LAN instance is unrelated and is not the source for this restore.

## Restore-a attempt

The read-only source snapshot started at `2026-10-23T03:50:33.088Z` and stayed open through
baseline queries and schema/data dumps. The helper inventoried all 31 tables (30 public plus
the Drizzle journal), 66 foreign keys, and a stable sampled migration sequence. The private
custom archive is 111,944 bytes; schema dump is 66,392 bytes with normalized SHA-256
`7410d3433a0fc3d5cd9a9b0a6250c6274349121117461affbe20c2084b75f046`. The event log records
the snapshot and dump completion. The helper stopped about 4.4 seconds after preflight at
`target_container: identity_mismatch`, before target readiness, archive-list validation,
restore, migration, or app requests.

Read-only Docker inspection confirmed the target-a image, label, volume, and network. Its
`HostConfig.PortBindings` contained `127.0.0.1:15434`, while
`NetworkSettings.Ports["5432/tcp"]` was an empty list at verification time. The helper checks
the active binding list and stopped. Artifacts and target-a resources remain preserved; do
not retry, clean up, or reuse them before separate root review. The zsh wrapper also failed to
capture the helper exit code because `status` is a reserved read-only variable; the private
sanitized console records the helper failure. The one invocation was not repeated.

Private attempt evidence is at
`.git/local-orchestration/public-db-restore/phone-20261022-restore-a/`; captured console is
`.git/local-orchestration/public-db-restore/launcher-console-20261022.log`. The helper stopped
before writing its final row-hash manifest, so per-table hash values are not retained.

## Restore-b attempt

Root approved a separate helper and target rather than changing or reusing restore-a. The
read-only preflight found no restore-b container, volume, or network with its proposed names
and no listener on loopback port `15436`. Run `phone-20261022-restore-b` uses
container `domy-phone-phone-20261022-restore-b-postgres-1`, database
`domy_restore_public_b`, new volume/network, loopback port `15436`, and the same cached pinned
PostgreSQL image. Its ordinary Docker bridge preserves host-native loopback connectivity; it
permits standard bridge egress and is not egress-isolated. The executor itself makes no
external requests, and the network check requires restore-b to be its only attached endpoint.
The executor is
`.git/local-orchestration/public-db-restore/restore-local-b.mjs`. It retains ownership,
mount, network, and active-loopback-binding checks, and waits up to 45 seconds for the
container's active binding before checking it. It has its own exact grant string and private
work directory.

The authorized invocation completed the source snapshot and dump, created the ordinary bridge,
volume, and container, verified the active `127.0.0.1:15436` binding and sole network endpoint,
and confirmed the target database was empty with a distinct PostgreSQL system identifier. It
then stopped at `pg_version: source_target_client_versions_differ`, about 3.3 seconds after
preflight. It did not reach archive-list validation or restore. The private archive is 111,944
bytes; schema dump is 66,392 bytes with normalized SHA-256
`7410d3433a0fc3d5cd9a9b0a6250c6274349121117461affbe20c2084b75f046`. All 31 tables, 66
foreign keys, and stable sampled migration sequence were observed during the source baseline.
The final row-hash manifest was not persisted. The invocation's captured helper exit code was
1. Artifacts and restore-b resources remain preserved; no retry or cleanup occurred.

Private attempt evidence is at
`.git/local-orchestration/public-db-restore/phone-20261022-restore-b/`; captured console is
`.git/local-orchestration/public-db-restore/launcher-console-restore-b-20261022.log`. The
source and target client-version strings were not persisted, so the failure is reported only
as the helper's comparison result.

## Restore-c attempt

Root directed a third isolated candidate after restore-b stopped. Read-only preflight found
the restore-c container, volume, network, private work directory, and loopback port `15437`
absent/free. The helper uses run `phone-20261022-restore-c`, container
`domy-phone-phone-20261022-restore-c-postgres-1`, database `domy_restore_public_c`, its own
volume/network, and the cached pinned PostgreSQL image. It retains the ordinary bridge and
its egress disclosure, exact endpoint check, ownership/mount checks, and loopback readiness
verification. It has an exact restore-c grant string. Its SHA-256 is
`fc031304d4c063745edfde16c103988b6b61b18cbd515c4628da6e9583cb1eb8`; `node --check` passes.
Root reviewed it and granted one invocation with auth telemetry disabled and empty Sentry
DSNs; no `.env` was loaded.

The helper corrects the version-output prefix to PostgreSQL's observed `pg_dump (PostgreSQL)
18.6` form while retaining strict equality across all four source/target clients. A read-only
check against the preserved restore-b archive confirmed `pg_restore --list -` treats `-` as a
literal filename and fails; `docker exec -i ... pg_restore --list` with the archive redirected
to stdin succeeds and emits 249 table-of-contents lines. The restore-c list and restore
commands therefore omit the `-` argument and receive archive bytes on stdin. These checks did
not modify either database.

Before creating any target resource, restore-c persists a private 0600 source-baseline JSON
containing the complete 31-table manifest and exact row hashes, business fingerprints,
foreign-key definitions/orphan counts, focused joins, finance totals, sampled sequence state,
snapshot metadata, and source archive/schema digests. This preserves baseline evidence if a
later stage stops.

The one restore-c invocation completed a read-only source snapshot and dump, then persisted
that baseline before target resource creation. It recorded 31 tables (30 public), 66 foreign
keys, a stable sampled sequence, archive size 111,944 bytes, and schema dump size 66,392 bytes
with normalized SHA-256
`7410d3433a0fc3d5cd9a9b0a6250c6274349121117461affbe20c2084b75f046`. The archive SHA-256 is
`4888273fae78247df2be28b344be76ed007d27f15463cc034f2d00978fa39ad9`; the private source
baseline file is 46,465 bytes. Restore-c created its new ordinary bridge, volume, and container,
verified the active loopback binding and sole endpoint, and confirmed an empty database with a
distinct system identifier. Restore succeeded; the full 31-table/66-FK manifest and schema
hash matched, including the migration sequence at `last_value=10, is_called=true`. The
migration call left schema and data unchanged.

The helper then passed pre-existing owner and dispatcher authentication/session checks on the
restored target and stopped at `registration:database_clock_invalid` 3.6 seconds after
preflight. Its first `clock_timestamp()` query returned a value that failed the helper's
`Date`-type assertion. This occurred before the shipment-registration POST, so the idempotent
201/200 replay and persisted shipment/event checks did not run. Source postchecks also did not
run. This does not establish the cause of the timestamp decoding result; no retry or cleanup
was performed. The target, dump, baseline, logs, and partial auth state remain preserved.

Private C attempt evidence is at
`.git/local-orchestration/public-db-restore/phone-20261022-restore-c/`; captured console is
`.git/local-orchestration/public-db-restore/launcher-console-restore-c-20261022.log`. The
captured helper exit code was 1. The helper made no source HTTP request and used no S3/object
storage request. Its ordinary Docker bridge permits egress; no egress-isolation claim is made.

Selected backup point: `2026-10-23T03:59:49.926385Z` (2026-10-22, Bogotá).
C preflight began at03:59:49.295Z; complete restored-manifest comparison passed
at03:59:52.630Z (3.335s), and migration no-op passed at03:59:52.770Z (3.475s).
These are observed local database-phase durations; the later app continuation and
retained debugging interval are separate, and no agreed RPO/RTO is inferred.

### App-only continuation of restore-c

After the first C failure, the root-reviewed sidecar
`.git/local-orchestration/public-db-restore/C-app-resume.mjs` was frozen at SHA-256
`a891a594adf062bd93cf35c938cf653bc8d7f8c42cf70ecff1d827b956d097a7`. It accepts only its
separate continuation grant. Its preflight required the preserved C failure, baseline/archive
digests, prior restore and migration evidence, exact C container/network/image/loopback
identity, unchanged original business history (1 shipment, 1 event, 0 `created` events), and no
final manifest. The continuation used the existing C target and added no database restore,
migration, container, volume, or network. It converted validated PostgreSQL timestamp strings
to `Date` for the database-clock samples, event `recorded_at`, and fixed app clock.

The one authorized invocation exited 0. With auth telemetry disabled, Sentry DSNs empty, and no
`.env` loaded, the app-only preflight passed. Registration returned 201; replay of the same
UUID/body returned 200. Exactly one shipment row and one `created` event persisted, attributed
to the authenticated dispatcher, with an integer fee of COP 10,000. Persisted `recorded_at`
was `2026-10-23T04:08:41.263Z`; it passed the database-clock bracket and differed from the
deterministic application clock. The 27 pre-existing nonvolatile business-table fingerprints
matched, and the source postcheck reported no changed business tables. The original C failure
remains in its event log; this continuation did not repeat the failed registration or retry a
restore.

From `continuation_started` to `continuation_complete`, the recorded elapsed time was 1.265 s;
from `resume_preflight_passed` to `app_rehearsal_complete`, it was 0.170 s. Private continuation
evidence is at
`.git/local-orchestration/public-db-restore/phone-20261022-restore-c-app-resume/`; the captured
console is `.git/local-orchestration/public-db-restore/launcher-console-restore-c-app-resume-20261022.log`
(117 bytes, mode 0600). The final C manifest remains private at
`.git/local-orchestration/public-db-restore/phone-20261022-restore-c/manifest.json` (40,208
bytes, mode 0600). The source business comparison is point-in-time only; auth/session tables
remain excluded as volatile state. No photo objects were read or copied.

The frozen first executor is at
`.git/local-orchestration/public-db-restore/restore-local.mjs`. It validates source identity,
schema/build digests, the source container and exact new target names before creating an
exclusive 0700 run directory. It uses cached PostgreSQL clients inside the source/target
containers, streams custom dump bytes through private 0600 files, and compares client
versions. The read-only repeatable-read source snapshot stays open through the dump and
baseline query. Exact canonical row hashes cover all 31 tables, including every `users`
column; separate business fingerprints omit only volatile auth tables/fields for the
post-snapshot source comparison. Target restore is limited to the new empty database with
`--exit-on-error --single-transaction --no-owner --no-acl`, with no clean/create flags.
Every PostgreSQL.js connection receives and verifies `TimeZone=UTC` at startup. The shipment
event check brackets its persisted database `recorded_at` between database wall-clock samples
and verifies it differs from the fixed application clock. Password values are not command
arguments or console output. Partial artifacts and resources are retained on failure; the
helper has no cleanup or retry path.

## Execution gate

Root static review found two high-severity implementation issues before any execution:
host `pg_dump`/`pg_restore` binaries were unavailable, and the initial full-baseline projection
excluded three user columns. The helper now streams PostgreSQL client input/output via
`docker exec` using the cached containers, and full baseline hashes include every user column.
The auth-filtered fingerprint is limited to the post-snapshot source and preserved-history
checks. A separate review also found an incorrect restore passfile argument; passfiles were
removed, and the target restore receives only the archive stream. The launcher source digest
is distinct from the 523-file catalog digest, and all four launcher identity digests are
pinned. A final static review also required explicit UTC connection startup parameters and a
database-clock bracket for the new event timestamp. These were code-review findings, not
database-operation failures. The first root-reviewed invocation (A) stopped at active port
verification; the second (B) stopped at the client-version guard. Both failures are preserved
above and neither was retried. Root separately reviewed and granted one C invocation; C passed
archive-list validation, full restore, manifest comparison, and migration no-op, then stopped
before the shipment POST because `clock_timestamp()` was a valid string rather than a `Date`.
A separate read-only probe confirmed `valueType=string`, `isDate=false`, and
`validTimestamp=true`; it printed no timestamp value or credentials. Root reviewed and granted
one app-only continuation against the same C target; it completed registration/replay and
postchecks with exit code 0. The continuation added no restore, migration, or new Docker
resource. Root subsequently completed the independent N2 verification recorded below.

## N1 evidence and remaining acceptance

Restore-c passed source identity, snapshot/dump, target isolation, client-version, archive-list,
full-manifest, and migration no-op checks. Its app-only continuation passed the existing-user
authentication, 201 registration/200 same-request replay, single-row/event attribution,
database-time bracket, prior-history preservation, and source business postcheck. Independent root N2 verification passed as recorded below. This local rehearsal does not close
the broader backlog or establish production, provider, or physical acceptance.

Do not read or copy photo objects. No RPO/RTO is agreed. This local synthetic rehearsal cannot
establish schedules, retention, alerts, provider recovery, object recovery, or client-owned
backups.

See [release readiness](release-readiness-results.md) and the
[local target receipt](local-target-preparation-results.md).

## Independent root N2 verification

Root reviewed the full helper/continuation changes, retained all first failures and independently
passed15 timestamp boundary cases (valid Date/ISO/PostgreSQL offsets and invalid inputs).
The frozen continuation uses `parseDatabaseTimestamp(snapshotTime)` for the app clock; an
auditor's later comment mentioning direct `new Date(snapshotTime)` was stale.

Root then created the previously absent database `domy_restore_root_verify_c` in the owned
restore-c PostgreSQL container and restored the exact retained archive there, with no clean,
drop, source write or existing-database overwrite. The separate archive SHA-256 is
`4888273fae78247df2be28b344be76ed007d27f15463cc034f2d00978fa39ad9`.
The independent Python/psql verifier compares canonical row counts and SHA-256 hashes for
all31 tables, including complete users/auth columns before any authentication in this second
database. It also binds the selected archive and baseline identity, compares all66 FK
names/definitions/state, validates constraints, migration sequence, shipment and courier-record
COP totals, and checks the original app target contains exactly2 shipments/2 events with
one new `created` event attributed to the dispatcher who registered it.

The first root invocation reached its result writer and stopped with `TypeError`: Python's
`Path.open` does not accept `opener`. The restored database and original helper were preserved.
Root confirmed that API-signature cause and the existing second database, then ran a separate
read-only completion helper with the corrected exclusive0600 result writer. It contains no
createdb/restore path. All comparisons passed again, exit0, in1.711s; that duration measures
the read-only audit, not a recovery objective or the failed writer's whole operation.

```sh
python3 .git/local-orchestration/public-db-restore/root-verify-c.py --execute-root-restore-c
# First attempt: restored successfully; local result-writer TypeError retained.
python3 .git/local-orchestration/public-db-restore/root-verify-c-readonly-complete.py --execute-root-restore-c
# Read-only completion: exit 0, all comparisons pass; no second restore.
```

Private evidence: `root-first-writer-failure.json` in the orchestration directory and
`phone-20261022-restore-c/root-independent-results.json` (0600). Root accepts this bounded
synthetic database recovery rehearsal after both levels passed. Source data and prior LAN
services remain intact; no application source changed. Catalog remains76/81(94%), with
003/T087/T088/T093 and004/T034/T035 open. OP-02 still requires agreed objectives, owned
scheduled backups/retention/alerts and actual provider/object recovery evidence; G1 stays pending.

Final root documentation checks:140 relative targets exist, the DAG has68 nodes with no
prerequisite-order/state violations, and the catalog recount remains76 checked/5 open.
`git diff --check` passes. Source manifest remains523 files/SHA2a885083; the previously
accepted complete check/test/e2e/build evidence therefore has unchanged runtime inputs.
Root also rechecked retained source/003 and current public-b private bindings after recovery.
