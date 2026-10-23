# Local image upgrade results

Verified 2026-10-23 by root alone, as requested by the owner. No production
migration, provider configuration, remote CI or physical acceptance was performed.
The [regression receipt](../001-shipment-registration/solo-production-regression-results.md)
records all four passing gates and the unchanged 540-file source identity.

## Candidate and isolated target

- Image tag: `domy:readiness-solo-36ef1cd6`.
- Immutable image: `sha256:ce72df1ed574204d7dc440ab294481ddb1ef333cf451145101ab43436317590c`.
- Source SHA-256: `36ef1cd6ec355a7ee7e58009388a6990352e810ecf8754ec19bce5c63f26087c`.
- Local Docker context/builder: `desktop-linux`; tested platform `linux/arm64`.
- Fixed project: `domy-op01-20261022`; HTTPS bound to loopback port 8446,
  with the existing private CA and explicit hostname/SNI. This is not a phone URL.

The image builds successfully. A network-disabled, read-only structural probe checks
UID 1000, Node 24.22.0, all 148 server/domain source hashes, 10 SQL migrations, built
web/worker/manifest assets and native module imports; no `.env` or `.git` is bundled.
The pinned Node digest is a published OCI index including amd64 and arm64; only
arm64 runtime execution is evidenced here.

## Historical-schema rehearsal

The fixed runner was reviewed before execution, checks resource IDs and source
hashes, captures baseline metadata/logs and refuses a previous failure/database.
It adds only logical database `domy_upgrade` in the existing synthetic PostgreSQL.
Archived SQL `0000`–`0007` from `94a7e24` supplies the historical schema, not a
claimed historical application image. The same candidate image runs every job.

| Check | Result |
| --- | --- |
| Historical baseline | 8 journal entries, 30 relations, 63 validated foreign keys |
| Representative data | 2 native accounts, 1 signed session, 2 shipments, 1 active route, 3 stops, 4 tasks, 3 applied records and audit/custody history |
| Current migrations | 10 exact journal entries, 31 relations, 66 validated foreign keys |
| Old-column hashes | All 29 existing non-journal tables retain exact rows/counts/hashes |
| COP totals | Fees 26,000; COD 75,000; received cash 50,000 preserved |
| New schema/defaults | Full schema equals fresh install; codes unique, defaults correct, receipt table empty |
| Migration replay | Full schema, table hashes, journal and sequence identical |
| Authenticated HTTPS | Strict CA validation; preserved owner session and migrated shipment search pass |
| Return to fresh database | Same Caddy container; new image healthy; entire fresh DB snapshot unchanged |

Root separately inspects saved proofs and issues a read-only PostgreSQL query:
10 migrations, 2 shipments, 3 records, 1 session, 2 users, COP 50,000 cash and zero
unvalidated foreign keys. This is a second inspection by the same engineer, not an
independent-agent audit. The original PostgreSQL/S3Proxy, volumes, CA, fresh database
and both databases' evidence remain retained. Successful app instances were
replaced only after preserving their metadata/logs; no failed resource was deleted.

## Evidence and limits

Private evidence lives in `.git/local-orchestration/readiness-solo-20261023/`:
image build/structure logs, immutable metadata and `upgrade/` snapshots, job logs,
strict-TLS proofs, `result.json` and `root-second-inspection.json`. Credentials and
cookies are private mode-0600 files and are never included in this receipt.
The active local fresh configuration is `upgrade/compose-fresh.env`; the original
lab interpolation file remains historical and pins the older image. Do not reuse
that historical wrapper as a current-image deployment command.

This completes the bounded local upgrade rehearsal in the
[plan](../../docs/local-image-upgrade-plan.md). Existing restore/proxy/privacy
receipts retain their own source identities and scope. Public origin, target-platform
validation, provider delivery/retention, scheduled backups, consent and real-device
acceptance remain deployment/owner obligations. G1/G2 and the five catalog tasks
are not closed by this local result.
