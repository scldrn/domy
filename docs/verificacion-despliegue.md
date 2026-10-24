# Deployment verification

Updated 2026-10-23. The owner requested review and consolidation of the local
release-hardening changes, without deployment or remote CI.

## Current authority

Use [release change review](release-change-review-results.md) for the current source,
change dispositions, first failures and final validation. Use the
[engineering handoff](engineering-handoff.md) for the deployment candidate and
[online release scope](online-release-scope.md) for the owner's scope decision.

The previous draft mixed older branch inventories, in-progress tests, already integrated
fixes and proposed behavior changes. Its original local contents are preserved privately
with the review backup; the earlier tracked version remains in Git history. Those
paragraphs are not current defect confirmations or gate results. No reviewer-owned
checklist or historical receipt is rewritten as a new pass.

## Required local checks

- Formatting, lint and strict types: `pnpm check`.
- Unit/native PostgreSQL/storage suites: `pnpm test`.
- Browser journeys and built worker: `pnpm test:e2e --retries=0`.
- Production compilation: `pnpm build`.
- Production dependency audit: `pnpm audit --prod`.
- Docker candidate inspection, native health/routing/process checks and isolated
  backup/restore regression tests on the same reviewed source.

The release review receipt records completion; this list alone is not evidence.

## Release boundaries

Immediate delivery requires internet. Physical offline acceptance is deferred by the
owner; existing outbox data, implementation and regression coverage are preserved.
Public/mobile-data and native notification acceptance are not inferred from API or
Chromium results. Real origin/TLS, provider configuration, photo retention, scheduled
backups, privacy evidence and deployment remain with the owner. The tracked restore
tooling verifies a separate database; it never authorizes overwriting an operational DB.
