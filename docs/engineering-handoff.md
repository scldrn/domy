# Engineering handoff

## Scope and candidate

Updated 2026-10-23. The owner handles infrastructure procurement and production
deployment. Engineering supplies the code, local verification evidence and runbooks.
Physical-phone acceptance remains deferred by the owner.

The candidate is the **uncommitted working tree** on
`codex/local-readiness-orchestration`, based on `94a7e24`. That base commit alone
does not contain the candidate. The verified 537-file source identity is
`9604ca9689fc7e354f9f1245a424f72316b4b5ed041635f65c505403dabb32e2`.
Preserve unrelated work when preparing the reviewed release commit.

## Verified locally

| Validation | Result |
| --- | --- |
| `pnpm check` | Formatting, lint and strict types pass |
| `pnpm test` | 1610 tests pass: 424 domain, 804 server, 382 web |
| `pnpm test:e2e --retries=0` | 154 pass; cold tracking 2837.3 ms, below 3000 ms |
| `pnpm build` | Pass |
| Docker image | Build and independent structural probe pass; UID 1000, exact source files, 10 migrations, built web assets |
| Fresh local database/storage | Both QA levels pass; 31 tables, 66 validated FKs, exact 10-entry migration journal and private bucket access |

The before/after source manifests match. First failed runs and corrections remain
in the receipts; no retry or timing-budget relaxation supplies these passes.
The fresh local HTTPS/proxy/privacy rehearsal also passes both QA levels;
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
[recovery runbook](local-recovery-runbook.md). Historical-schema image upgrade remains
[planned](local-image-upgrade-plan.md), not executed. Actual provider retention,
recovery email/push, scheduled backups, individual courier consent and operational
acceptance remain owner deployment obligations; local evidence does not certify them.
No production deployment, infrastructure purchase, remote CI, commit or publication
was performed for this handoff.
