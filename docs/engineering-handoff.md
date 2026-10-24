# Engineering handoff

## Scope and current candidate

Updated 2026-10-23. The owner handles infrastructure and deployment. Engineering
supplies the reviewed code, local validation and tracked deployment/recovery tools.
Immediate delivery requires internet; physical offline acceptance is excluded by the
[owner's decision](online-release-scope.md). Existing offline code, data and tests remain.

The current candidate follows `main` in [scldrn/domy](https://github.com/scldrn/domy).
Its source/configuration/test/tool SHA-256 is
`a2c9c55a564a837811de8c4c8c2c0b0875630450f6ac378b02257e5afbc19152` (550 files; documentation excluded).
See the [release change review](release-change-review-results.md) for new versus
historical work, rejected changes, original failures and final solo review.
The [prior consolidation receipt](repository-consolidation-results.md) retains its
own earlier source and image; it is not the current runtime validation.

## Verified locally

| Validation | Result |
| --- | --- |
| `pnpm check` | Formatting, lint and strict types pass |
| `pnpm test` | 1,686 pass: 426 domain, 870 server, 390 web |
| `pnpm test:e2e --retries=0` | 155 pass, zero retries; cold tracking 2875.1 ms < 3000 ms |
| `pnpm build` | Web bundle, actual service worker and server types pass |
| `pnpm audit` | Zero reported vulnerabilities, including development packages |
| Docker build/runtime | Linux arm64, UID 1000, fresh migrations, seven native health/routing/access checks and graceful exit 0 |
| Image/source inspection | 154 exact source/configuration hashes match; native imports and patched Zod pass |
| Backup/restore scripts | Native PostgreSQL regression passes; separate restore preserves data/counts/COP and refuses live/system/existing databases |

The frozen before/after source manifests match. No identical production files or
complete function bodies of 80+ tokens were found across 273 production modules.
No new migration was added. The prior [historical-schema upgrade](../specs/004-tracking-merchant-link/local-image-upgrade-results.md)
remains evidence for its original image; this new image was tested on a fresh database.
No remote CI was invoked or awaited. All required local gates passed without changing
assertions, retry policy or performance budgets.

## Original acceptance catalog

| Task | Original wider acceptance still open |
| --- | --- |
| `003/T093` | Full real-phone courier usability, offline/reopen, tap counts and timings |
| `003/T087` | All 21 original courier scenarios on both operating systems |
| `003/T088` | Final courier closure for that original full scope |
| `004/T034` | All 14 public/merchant scenarios on real phones/mobile data |
| `004/T035` | Final integrated closure for that original full scope |

The original 76/81 count is historical catalog accounting, not online-release
readiness. Offline acceptance does not block the owner-requested connected release.
The four additional release-review convergence tasks are verified locally. Partial
phone reports, API probes and Chromium do not certify unobserved physical scenarios.

## Deployment handoff

Use tracked `Dockerfile`, `compose.production.yaml`, `Caddyfile`,
`scripts/backup.sh`, `scripts/restore.sh`, the [artifact plan](local-deployment-artifact-plan.md)
and [recovery runbook](local-recovery-runbook.md).

Local reviewed image: `domy:release-review-a2c9c55a`;
immutable ID `sha256:3e7039d675c4d3c864872c86e51761c0cd7007df518a48dbc1d7272bbbf423f9`.
It was built for the synthetic origin `https://domy-release-review.test` on Linux arm64.
Build the same reviewed source for the real canonical HTTPS origin and target platform;
this synthetic image/configuration is not a ready-configured production environment.

The owner supplies real origin/TLS, secrets, private storage/retention, recovery email,
push configuration, scheduled backups and privacy/operational evidence. The PostgreSQL
tools do not schedule jobs or recover photo objects. Local synthetic credentials, CA
and `.git` helpers must not become production configuration. No production deployment
or infrastructure purchase was performed.
