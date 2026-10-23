# Local app-only restart rehearsal — verified locally

Date: 2026-10-22 (America/Bogota). Status: N1 and independent root N2 app-only restart checks passed. This receipt does not claim phone, physical,
production, provider, or G1 acceptance.

## Candidate and frozen identity

The candidate is synthetic run `phone-20261022-public-b`, on the current LAN address
`192.168.58.219:8445`. Its initial state recorded phase `running` and app PID `65900`; the verified replacement PID is `75085`.
PostgreSQL remains on `127.0.0.1:15435`; S3Proxy remains on `127.0.0.1:19102`.

The restart helper pins the candidate's source digest
`a708ba74689f8d6a0c9948e7d10f7e39d2c25974c30adb796246b68bc7919e28`, schema digest
`44c18a4b09d70a6988a18a12b01f970a9bd8e673aaf682a600e954f0370b3a07`, lock digest
`50f41517a321ef8cb3b6e005e9672ea08703ae302585e8d87ea7864c7ef5b718`, and private build digest
`fc6224baced85c2ef82de932f3e57dd91a56477fadacdedb0c8637f4e9c52584`. The reviewed launcher
`apps/server/scripts/local-phone-target.ts` is pinned at SHA-256
`8d6736fc63a8da2c46bc76d311d97e19d255f4e55700a574bd3a82d1efc96506`. The previously
root-verified technical catalog remains 523 files with digest
`2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6`.

The target's PostgreSQL and S3Proxy container ID prefixes are `686d3704a55e` and
`32d365e5d93c`. The helper also checks the exact run/project labels, pinned images, healthy
PostgreSQL state, loopback-only published ports, named volume mounts, and the sole owned
network. It compares those resource identities before and after the app restart.

## Reviewed execution boundary

The private helper is
`.git/local-orchestration/public-lan-current-network/restart-rehearsal.mjs`, SHA-256
`aeb3c2b0472c50ea363ba3ea989150b3f8cdee7f889bb381e798eadc53c6b7c6`, mode `0700`. It is
inert unless given exactly `--execute-phone-20261022-public-b-restart`; invocation without
that flag was checked to return before reading state. `node --check` passes under Node
`v24.21.0`. Failure evidence is written only inside a fresh private attempt directory made
by that invocation, and records a controlled failure code and stage without error messages.

Before signaling the app, one authorized invocation will validate `parseTargetState`, the
saved PID's `ps` start-time/command fingerprint, the unique HTTPS listener, current interface
address, source/schema/lock/build digests, local Docker context and owned-resource identities.
It then opens a UTC-started, repeatable-read, read-only PostgreSQL snapshot. For all 31 tables
(30 `public` and the Drizzle migration journal), it stores only the qualified table inventory,
row counts, and SHA-256 hashes of `to_jsonb(row_data)::text` rows sorted with `COLLATE "C"`;
hash input is UTF-8 byte-length-prefixed. The migration sequence is captured in the same
snapshot. The JSON projection keeps PostgreSQL timestamps as strings, avoiding client-side
`Date` parsing.

Only after that private baseline is synced to disk will the helper send one `SIGTERM` to the
verified app PID. It waits at most 15 seconds for the old PID to exit and launcher state to
become `prepared` with `process: null`. It does not call the launcher's `stop` command, Compose
`stop`, or Compose `down`.

The helper then starts one detached process with the absolute launcher path, `apps/server` as
its working directory, and `serve --run-id phone-20261022-public-b`. Telemetry is disabled,
both Sentry DSNs are empty, and no `.env` is loaded. The private server log is created
exclusively with mode `0600`; the process is unreferenced. The helper waits at most 60 seconds
for the new PID and running state to agree, then checks the HTTPS root with the target's
private CA. It performs no authentication or authenticated/native verification.

Before returning success, it takes the same all-table read-only snapshot, writes private
before/after manifests and a root-facing result manifest, and requires the complete table
inventory, row counts, row hashes, and migration sequence to match. The result shape includes
`tables`, `beforeFingerprints`, `afterFingerprints`, old/new PIDs, container IDs before/after,
and source identities for the independent root N2 comparison. No photo objects are read,
application DB mutations are requested, or container/volume/network resources are created.
On any failure, private evidence and resources are retained without blind retry or cleanup.

The single authorized invocation was:

```sh
BETTER_AUTH_TELEMETRY=false BETTER_AUTH_TELEMETRY_DEBUG=false SENTRY_DSN= VITE_SENTRY_DSN= \
node .git/local-orchestration/public-lan-current-network/restart-rehearsal.mjs \
  --execute-phone-20261022-public-b-restart
```

Root's separate read-only pre-restart database baseline is
`.git/local-orchestration/public-lan-current-network/root-db-before-restart.json`.

## N1 execution evidence

At 2026-10-22 23:25 America/Bogota, the one approved invocation exited 0. The helper sent one
`SIGTERM` to PID `65900`, observed the launcher reach `prepared` with no process, and started
the detached `serve` process. The target returned to `running` on `192.168.58.219:8445` as
PID `75085`; the HTTPS root passed with the target's private CA. The helper reported
`local_app_restart_passed`.

The before and after manifests contain all 31 expected table fingerprints and the migration
sequence. The helper verified identical table inventory, row counts, hashes, and migration
sequence across the restart. Its private `result.json` records both fingerprint maps for
root's independent N2 check. PostgreSQL and S3Proxy container IDs remained unchanged:

- PostgreSQL: `686d3704a55ec4f3396038367e3e31312dbc97cc65eba042163ec131c192b70f`
- S3Proxy: `32d365e5d93c7f1db4594e4b3bb001bfbc535b85d4e22fe197289d9f36c33c19`

Private artifacts are under
`.git/local-orchestration/public-lan-current-network/phone-20261022-public-b-restart/`:
the attempt directory is mode `0700`; the before/after manifests, result manifest, and server
log are mode `0600`. Authentication, native verification, public probes, photo reads, and
physical phone scenarios were not performed. Root's independent post-restart N2 comparison
is still pending; no task is closed by this receipt.

No catalog task is closed by this preparation. The physical Android/iPhone scenarios and
final feature acceptance remain open.

## Independent root N2 acceptance

Before the restart, root independently captured all31 complete table hashes in one
UTC `REPEATABLE READ READ ONLY` snapshot through Docker/psql. After N1 released its
slot and before any authentication, root repeated the snapshot and required exact
inventory/count/hash equality against its own baseline. Both commands exited0:

```sh
node .git/local-orchestration/public-lan-current-network/root-db-restart-audit.mjs before
node .git/local-orchestration/public-lan-current-network/root-db-restart-audit.mjs after
```

This is a separate implementation from N1's PostgreSQL.js cursor snapshot. It includes
all user/auth rows; it does not omit session changes to obtain a pass. Private evidence:
`root-db-before-restart.json` and `root-db-after-restart.json` in the same orchestration
directory. Only after that comparison passed, root ran the accepted launcher verifier:

```sh
env SENTRY_DSN= VITE_SENTRY_DSN= BETTER_AUTH_TELEMETRY=false BETTER_AUTH_TELEMETRY_DEBUG=false \
  pnpm --filter @domy/server exec node scripts/local-phone-target.ts verify \
  --run-id phone-20261022-public-b
node .git/local-orchestration/public-lan-current-network/root-public-verify.mjs
```

Both exited0. The native verifier recorded one bounded10s authentication429 retry, retained
in `root-native-after-restart.log`; root public probes passed on their first attempt in
`root-public-after-restart.log`. HTTPS/auth/worker/private-photo access and strict anonymous
tracking/merchant schemas, public no-store/noindex, office notification permissions and
uniform unknown-code404 remain correct after restart. The native synthetic photo probe
is transport/access evidence, not a camera or physical-device result.

The final source catalog remains523 files with SHA-256
`2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6`.
Root accepts this bounded app-restart proof. Physical/final tasks and OP/G1 remain open;
no production restart, provider operation or phone acceptance is inferred.
