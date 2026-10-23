# OP-01–OP-04 Release Readiness Evidence

Date: 2026-10-22 (America/Bogota). This is a dated evidence inventory, not an OP-gate,
G1, device-acceptance, or production approval. T001–T033 are verified locally. The T032
technical gates passed on a 523-file source snapshot, SHA-256
`2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6`: `pnpm check`,
1566 unit/integration tests, 153/153 browser cases with zero retries, and `pnpm build`.
T033 separately verified documentation and links; it did not change runtime inputs. See
[T032 evidence](public-accessibility-results.md) and [T033 evidence](public-go-live-documentation-results.md).

| Area | Evidence available on this date | Evidence still required |
| --- | --- | --- |
| **OP-01 — deployment and upgrade** | The [read-only inventory](../../docs/local-deployment-inventory.md) found a single Node application and development-only PostgreSQL/S3Proxy setup; it did not inspect external systems. T004 generated an additive migration and tested fresh schema plus historical 0008/0005 upgrades and replay against isolated PostgreSQL ([migration receipt](schema-migration-results.md)). The owner confirms no domain has been purchased and the available network is local only. | No public HTTPS domain or production-like provider target has been supplied. Identify and authorize an exact isolated candidate, operator, HTTPS origin, network/ports, secret-delivery method, safe data and cost. Record immutable source/schema/build identities; rehearse fresh install and a representative prior-schema upgrade, then verify proxy trust, health/restart, worker/cache/CSP, auth, photos and offline compatibility. Define forward-fix and restore steps before applying a migration. The schema tests are not a deployment rehearsal. |
| **OP-02 — backup and restore** | The inventory found no tracked backup schedule, retention configuration, restore runbook, measured recovery receipt, or agreed RPO/RTO. That was the initial inventory; the later local addendum below now records an actual synthetic restore verified at both levels. | Agree recovery objectives with the owner; configure client-owned backup access, retention and failure alerts; restore an actual selected backup into a separate isolated database. Verify relationships, accounts, financial examples and custody history, measure recovery time, and handle object/photo recovery separately. |
| **OP-03 — providers and monitoring** | Local S3Proxy and browser tests cover application behavior only. The inventory establishes no client-owned production bucket, email/push delivery, provider receipt, or production monitoring. The owner has supplied no provider target; none was contacted or configured. | If an authorized provider target is later available, verify private-bucket permissions and lifecycle, photo retry/missing-object behavior, real Android/iPhone push, recovery-email delivery, and sanitized monitoring and incident ownership. Record provider/account ownership and actual results; local simulators are not provider evidence. |
| **OP-04 — business and privacy inputs** | The [README](../../README.md#production) documents the support settings and the individual-consent boundary. The owner’s “yo lo autorice” approves feature scope only; the [owner ledger](../../OWNER-REQUESTS.md) and T033 receipt record no individual courier-consent receipts or their location as of this date. The owner has deferred physical 003 checks to continue local 004 development; the sealed `phone-20261021-e` candidate is 003, not a 004 acceptance. | Before any real courier name/phone is exposed, collect and review each courier’s authorization under [Constitution VII, v2.0.0](../../.specify/memory/constitution.md). Resolve the remaining OP-04 rate, directory/contact, client ownership/cost, logo and operational-data inputs with the owner. Use synthetic courier data until consent is evidenced. |

The existing LAN authorization permits local flow checks with synthetic data; it does not enable mobile-data/external-preview acceptance or establish G1. The next permitted work is local preparation. A new isolated LAN rehearsal remains covered by the existing owner authorization once its exact candidate, ports and safety prerequisites are reviewed; do not ask for that authorization again. External provider changes require their own exact scope and authorization. Use synthetic data and capture commands, dates, hashes and limitations without secrets. The owner’s “omite y continuemos” defers physical 003 work for local 004 development; it does not pass `003/T093`, `T087` or `T088`. The [DAG](../../docs/local-execution-dag.json) keeps OP-release-evidence in progress and G1 pending. G1 requires the verified 004 tasks plus actual OP evidence and an authorized isolated rehearsal. `004/T034` follows G1; `004/T035` also requires `003/T088`. G2 remains a separate production-approval gate. No production migration, deployment, remote CI or physical acceptance is claimed here. See [OP-01–OP-04 requirements](../../docs/integral-execution-backlog.md#op-01--deployment-upgrade-and-recovery-runbook).

## Root verification

Root independently reviewed the source receipts and DAG, checked all9 relative
link targets and whitespace, and retained the owner’s LAN-only response. This
preparation is complete; actual OP evidence remains incomplete and G1 stays
pending. No additional authorization is needed merely to continue previously
authorized safe LAN preparation. Catalog progress remains76/81(94%); the
five physical/final tasks stay unchecked.

## Later local rehearsal addendum

The new synthetic004 candidate phone-20261022-public-a was subsequently
prepared, privately built/sealed and started on the current LAN IP, independently
verified at both levels. [Local rehearsal evidence](local-target-preparation-results.md)
records exact hashes, private bindings, retained failed wrappers, native auth
rate-limit retries and root public API probes. This supplies scoped local
preparation evidence beyond the initial inventory. It does not establish a
representative deployment upgrade/restore, external providers, mobile data,
individual consent or G1 completion. Previous003 data/services remain intact.

## Current-network candidate addendum — 2026-10-22

After the LAN address changed, a separate `phone-20261022-public-b` candidate
was prepared and independently verified at https://192.168.58.219:8445.
[Current-network results](local-target-current-network-results.md) retain
resource/build identities, bounded authentication retries and root public probes.
The earlier public-a resources remain intact as the separate local backup source.
This adds local rehearsal evidence only; G1, provider, consent and physical/final
requirements remain pending. Catalog progress stays76/81(94%).

## Local database recovery addendum — 2026-10-22

The [restore receipt](local-database-restore-results.md) now demonstrates recovery
of the selected public-a synthetic snapshot into restore-c, followed by an independent
root restoration into a second empty database. Exact31-table hashes,66 FK definitions,
schema/sequence/COP examples, no-op migration, existing account access and idempotent
registration pass. Prior business history/source fingerprints are preserved. First harness
failures and the root writer failure/read-only completion remain documented. No source
or provider was modified. This satisfies only the bounded local demonstration; agreed
RPO/RTO, schedules/ownership/retention/alerts and provider/object recovery remain open.
OP-release-evidence stays in progress; G1 and the five catalog tasks remain pending.

## Solo image-upgrade addendum — 2026-10-23

The [current handoff](../../docs/engineering-handoff.md) and
[upgrade receipt](local-image-upgrade-results.md) supersede the earlier claim that
a representative local image upgrade remains unrun. The 540-file source `36ef1cd6`
passes check, 1,626 tests, 154 zero-retry E2E and build. The new arm64 image
upgrades a synthetic schema-0007 DB with accounts, session, routes, courier records
and COP totals preserved; replay and the original fresh database are unchanged.
Root worked solo and separately inspected the results. This narrows the local
OP-01 gap; actual providers, scheduled backups, consent, mobile data and physical
acceptance remain unevidenced. OP-release-evidence stays in progress; G1/G2 and
the five physical/final catalog tasks remain pending. No production operation.
