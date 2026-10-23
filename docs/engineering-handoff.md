# Engineering handoff

## Scope and candidate

Updated 2026-10-23. The owner handles infrastructure procurement and production
deployment. Engineering supplies the code, local verification evidence and runbooks.
Physical-phone acceptance remains deferred by the owner.

The canonical release source is `main` in [scldrn/domy](https://github.com/scldrn/domy).
This handoff accompanies the single consolidation PR; its temporary branch is
removed after squash. The verified 540-file source identity is
`d604a2876d27da5ffae669c4be9db899b17c2ba183a7b3f1f99fe2cee855e599`.
The owner requested solo execution; implementation and separate final inspection
were performed by root, without an independent-agent claim. See the
[consolidation receipt](repository-consolidation-results.md) for source recovery,
branch review, retained first failures and publication verification.

## Verified locally

| Validation | Result |
| --- | --- |
| `pnpm check` | Formatting, lint and strict types pass |
| `pnpm test` | 1626 tests pass: 424 domain, 820 server, 382 web |
| `pnpm test:e2e --retries=0` | 155 pass; cold tracking 2866.1 ms, below 3000 ms |
| `pnpm build` | Pass |
| Docker image | Build and separate structural probe pass; UID 1000, exact source files, 10 migrations, built web assets |
| Historical-schema upgrade, prior image with identical runtime files | PASS: 8→10 migrations, 29 old-table hashes preserved, session access, no-op replay and unchanged fresh DB |
| Fresh database/storage on prior image | Earlier two-level proof: 31 tables, 66 validated FKs, exact journal and private bucket access; see its dated receipt |

The before/after source manifests match. First failed runs and corrections remain
in the receipts; no retry or timing-budget relaxation supplies these passes.
The earlier image’s fresh local HTTPS/proxy/privacy rehearsal passed both QA levels;
its exact scope and preserved failures are in the
[container results](../specs/004-tracking-merchant-link/deployment-container-results.md).
The built image is Linux arm64; the production target platform is not selected.

## Five canonical tasks still open

| Task | Remaining acceptance |
| --- | --- |
| `003/T093` | Real-phone courier usability, offline/reopen behavior, tap counts and timings |
| `003/T087` | All 21 courier quickstart scenarios on Android and iPhone |
| `003/T088` | Final courier closure after required acceptance; technical gates already pass |
| `004/T034` | All 14 tracking/merchant quickstart scenarios on real mobile data |
| `004/T035` | Final integrated closure including the deferred physical tasks; technical gates already pass |

These are **76/81 closed tasks (94%)**, not a production-readiness percentage.
Opening the app on the reported phones does not supply the remaining scenario evidence.

## Deployment handoff

The tracked artifacts are `Dockerfile`, `compose.production.yaml` and `Caddyfile`.
The owner supplies the real origin, private service configuration and reviewed image
pins for the target platform. The synthetic lab's CA, credentials, bucket and private
`.git` helpers are local test resources, not production configuration or clone tooling.

Use the [artifact plan](local-deployment-artifact-plan.md) and
[recovery runbook](local-recovery-runbook.md). Historical-schema image upgrade now
[passes locally](../specs/004-tracking-merchant-link/local-image-upgrade-results.md).
The exact candidate image is
`sha256:2ea640a3da2bf4dba313d85eca1baf8f0e929dd72752f92bd6418612006c2e7b`
(`domy:consolidated-d604a287`). Its 282 runtime files and dependency layers
match the previously rehearsed image byte-for-byte; the earlier upgrade receipt
retains its actual image/source identity. The
[consolidation receipt](repository-consolidation-results.md) supersedes earlier
gate counts/source identities; the
[regression receipt](../specs/001-shipment-registration/solo-production-regression-results.md)
retains the preceding implementation evidence. Actual provider retention,
recovery email/push, scheduled backups, individual courier consent and operational
acceptance remain owner deployment obligations; local evidence does not certify them.
Repository publication follows the owner’s cleanup request through one squash PR
using local gates and skip annotations. No production deployment, infrastructure
purchase or remote CI operation is included.
