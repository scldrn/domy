# Engineering handoff

## Scope and current candidate

Updated 2026-11-02. The owner handles infrastructure and deployment. Engineering supplies the
reviewed code, validation and tracked deployment and recovery tools. The courier app must work
without signal, installed or in the phone's browser; the dispatch panel requires internet. The
candidate is `main` in [scldrn/domy](https://github.com/scldrn/domy). The
[production-readiness audit](production-readiness-audit-2026-11-02.md) holds findings, evidence and
limits. Earlier receipts describe their own sources, not this candidate.

## Verified

| Validation | Result |
| --- | --- |
| GitHub Actions | Check, tests, e2e and build pass on each pull request of the audit; e2e has zero retries and no failure traces |
| `pnpm test` | 1,728 pass locally: 433 domain, 904 server, 391 web |
| `pnpm test:e2e --retries=0` | 155 pass locally, twice |
| `pnpm audit --prod` | No critical, high or low advisories; `glob` and `minimatch` moderate, accepted by the owner; see the 001 dependency results |
| Docker image | Builds for arm64 and amd64 from pinned digests; each target must rebuild with its real origin |
| Production stack | Fresh migrate, seed and start behind Caddy HTTPS with S3-compatible test storage |
| Browser journey on that stack | Panel, dispatch, courier pickup, offline reopening, offline delivery with photo, exactly-once sync, tracking, merchant page, export |
| Backup and restore | `scripts/backup.sh` and `scripts/restore.sh` into a new database; counts and COP match. This ran on `683bad1`; the scripts did not change |

Chromium with the certificate check bypassed is not physical evidence. Local Docker occasionally
times out binding a test container's ports under load; it has not occurred on GitHub.

## Open acceptance

| Task | Still needs |
| --- | --- |
| `003/T087`, `003/T093` | All courier scenarios on real Android and iPhone, including no signal, push, tap counts and timings |
| `003/T088` | Final courier closure after those |
| `004/T034` | All public and merchant scenarios on real phones and mobile data |
| `004/T035` | Final closure after that |

These need HTTPS with a certificate the phones trust, so a test environment comes first. The iPhone
offline reopening failure of 2026-10-23 stays open until retested there.

## Deployment handoff

Use tracked `Dockerfile`, `compose.production.yaml`, `Caddyfile`, `scripts/backup.sh`,
`scripts/restore.sh`, the [artifact plan](local-deployment-artifact-plan.md) and the
[recovery runbook](local-recovery-runbook.md). Run migrations, then the seed, then start `app`.

The owner supplies origin and TLS, secrets, private storage with its 12-month lifecycle rule,
recovery email, push keys, scheduled and off-server backups including photos, and the privacy and
business inputs in [OWNER-REQUESTS.md](../OWNER-REQUESTS.md). No CD workflow exists yet.
