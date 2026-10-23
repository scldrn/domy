# OP-01 local image upgrade rehearsal

**Plan only; no historical database, migration, or runtime operation has been run.** Test the
current candidate against schema 0007. Commit `94a7e24` supplies migration SQL only; it is not
represented as a released app image. This plan authorizes neither production use nor task closure.

## Target and prerequisites

Use one Compose project, `domy-op01-20261022`, with its existing PostgreSQL volume, S3Proxy,
app, and Caddy. Keep fresh current-schema database `domy`; add only logical database
`domy_upgrade` in that PostgreSQL instance. Reuse the exact candidate image ID for app and both
one-shot migration runs. No second stack or prior app image.

Before any database write, require the unchanged candidate-source four-gate pass
(`9604ca9689fc7e354f9f1245a424f72316b4b5ed041635f65c505403dabb32e2`), root's image-structure
review, successful fresh local runtime/readiness, and root review of this sequence plus the
private runner/fixture diff. These are prerequisites, not results claimed here. Record image ID,
source identity, journal, and private resource inventory.

The historical side is migration SQL only. Reconstruct the exact eight-file migration history
and journal from `94a7e24`; the tree contains migrations `0000`–`0007` and no `0008`/`0009`:

```sh
set -o pipefail
LAB='.git/local-orchestration/op01/lab-20261022'
mkdir -m 700 "$LAB/historical-archive"
git archive 94a7e24 apps/server/src/db/migrations | tar -x -C "$LAB/historical-archive"
```

Verify that archive's file list and hashes, then bind its `apps/server/src/db/migrations`
directory read-only over the current candidate image's migrations path for the first one-shot
migration. Run the current candidate's normal one-shot migrator against `domy_upgrade` next,
without the historical bind. Do not build or describe an old application image.

## Required private command contract

The present `compose-safe.mjs` is fixed to one private interpolation file, permits only the
fresh migration command, and rejects `stop`; it cannot bind historical SQL or select an app
database target. Do not bypass it with direct Compose/Docker commands. Root must first review a
minimal extension with only these fixed operations: capture baseline IDs/image/logs; stop
`app`+`caddy` by expected IDs; create `domy_upgrade` only if absent; run archived/current
migrations with the same candidate image and a fixed read-only historical bind; run one
target-bound fixture; and start the app using a named `fresh` or `upgrade` mode. Map those modes
to prevalidated private env files; accept no arbitrary paths, commands, `--rm`, retries, or
cleanup. Keep the project/context and private evidence paths fixed; this is not a general
passthrough or tracked framework.

Prepare separate mode-`0600` app/migrator env files, changing only the DB name and preserving
private lab secrets. Stop app/Caddy before switching app DB targets. Because Compose may replace
the app when its env-file hash changes, first capture the successful baseline app ID, image ID,
non-secret inspect metadata, and sanitized logs. Replacing only that baseline app needs a
separate current root grant identifying the inspected app/Caddy IDs and candidate image; keep
the Caddy ID unchanged. Preserve all failed containers and evidence.
Never print URLs, credentials, cookies, tokens, or rows. See the
[artifact plan](local-deployment-artifact-plan.md).

## Rehearsal sequence

1. Recheck the fixed project's inventory and confirm candidate image ID, fresh `domy` runtime,
   private Caddy CA, and expected resources. Record app/Caddy IDs; keep PostgreSQL/S3Proxy
   running and stop only that app/Caddy pair before historical DB work and the env switch.
2. Confirm `domy_upgrade` does not exist. Create it in the existing PostgreSQL container,
   apply archived migrations `0000`–`0007` with the candidate image's one-shot migrator, and
   verify the journal has exactly those eight entries.
3. Before `0008`/`0009`, create synthetic owner/courier users through Better Auth. Save the
   owner's generated credential and `auth.api.signInEmail` session in a new mode-`0600` file
   outside the image/build context; never raw-insert auth rows or print secrets. Reuse the
   business shapes in
   [`migration-toolchain.test.ts`](../apps/server/tests/migration-toolchain.test.ts),
   [`courier.ts`](../apps/server/tests/setup/courier.ts), and
   [`custody-invariants.ts`](../apps/server/tests/setup/custody-invariants.ts): merchant/settings,
   municipality/zone/neighborhood, courier, shipment, assigned route/stop/task, and valid
   pickup/delivery custody plus corresponding events. Use synthetic IDs, `.invalid` email,
   fictional contact data, and integer COP fee/COD/cash values. Require nonempty owner account
   and session rows before DDL. No photos/providers/real accounts; do not use `db:seed` (it logs
   passwords).
4. Before current DDL, save each table's exact schema-0007 column list and canonical row
   count/SHA-256, including auth, route, task, custody, events, and journal; also save schema,
   FK definitions/validation, migration sequence, and shipment/courier COP totals. Reuse the
   `to_jsonb`/C-order/UTF-8 length-prefixed SHA-256 logic in
   [hash helper](../.git/local-orchestration/public-db-restore/root-verify-c-readonly-complete.py)
   via a target-specific read-only call (the checker itself is pinned to restore-c). Store hashes,
   not rows. Derive counts from the archived DDL; confirm observed 30 relations/63 validated
   FKs or abort on mismatch.
5. Run the candidate's current one-shot migrator on `domy_upgrade`. Rehash every existing
   non-journal table with the exact saved 0007 column list; require rows and COP totals unchanged.
   Require the journal's exact saved prefix plus only entries 0008/0009 and a new empty
   `account_action_receipts` table. Require sequence 8→10, 31 relations, and 66 validated FKs
   with matching definitions; also require full current schema-description equality with fresh
   `domy` (columns/defaults/nullability, constraints, enums, indexes; see
   `migration-toolchain.test.ts`). Save full 0009 hashes for
   the replay baseline.
6. Assert `company_name = 'Cohex'`/non-null; `support_phone`, `link_replaced_at`,
   `notified_at`, and `notified_by` null; and new codes unique and matching
   `[A-Za-z0-9_-]{22}`. Replay current migrations once; require full 0009 row hashes, schema,
   journal, and sequence unchanged. Retain
   [`secret-codes.test.ts`](../apps/server/tests/secret-codes.test.ts) assertions. Root compares
   saved 0007-column hashes before using the saved auth session.
7. Select the app env for `domy_upgrade`; under the separate grant, replace only the captured
   baseline app with the same image and start the stopped Caddy container. Require the Caddy ID
   unchanged, check readiness with the private CA, and use the saved owner session for
   authenticated `GET /api/shipments/search?q=TEST0001`; require the seeded shipment. Keep
   fixture secrets outside logs/receipt and remove secret fields only after a passing proof.
8. On full pass, stop that app/Caddy pair, restore the private app env selection to fresh
   `domy`, and start the same services again. Preserve both databases, volumes, networks,
   migration job records, and evidence. On any failure, stop progression: preserve first
   failure and partial resources, do not retry, roll back, delete, or automatically switch DBs.

## Blockers and exit

Before the first write, root must settle the wrapper extension, target-bound Better Auth fixture,
private PostgreSQL role/commands, and target-specific audit invocation. If any is unclear, leave
the rehearsal unrun. Phone, provider, production, remote-CI, backup/RPO/RTO, and object-recovery
evidence are out of scope. Execution needs a separate current root grant after fresh runtime and
private-operation review; no task is closed.
