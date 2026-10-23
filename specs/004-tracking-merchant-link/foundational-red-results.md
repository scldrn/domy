# Foundational RED verification — 004/T002 and T003

Date: 2026-10-21 (America/Bogota). Local dirty branch
`codex/local-readiness-orchestration`, base `94a7e2450ec2abae4192f7f864e34c4638f7c963`.
Prerequisites: T001 configuration and W12 design verified; D6 local inventory verified.
Combined RED source: 464 files, SHA-256
`ceefb587a8e40f1ce8f316093ca0a9e3743ef8b6a326c9217597809d53fb8a3d`.

These tasks explicitly deliver failing tests before implementation. Their verified
state means the intended missing behavior was reproduced, not that protection exists
or that the full suite is green. T004/T005/T006 must turn every applicable assertion green.

## T002 — Native code generation and populated upgrade

Luna N1 and root N2 each ran, against separate disposable PostgreSQL 18 instances:

`pnpm --filter @domy/server exec vitest run tests/secret-codes.test.ts`

Both exited 1 with four collected tests and four intended assertion failures: missing
codes in single/bulk creation, missing stable-code precondition, absent NOT NULL column
metadata, and missing merchant codes after the nonempty 0008 upgrade fixture. No setup,
collection, database or API-harness failure. Root duration: 3.80 s. Native PostgreSQL
migration-replay NOTICE messages were retained; they are not hidden or reclassified errors.

The tests additionally require ignored client-chosen codes, merchant codes, concurrent
replay/edit stability, no secret fields/values in creation audit snapshots, positive
control inserts before constraint probes, shipment/merchant uniqueness/null/format checks,
paired notification author/time, and migration replay preserving old relationships,
fees, human guides and created/audit history. Later assertions stop at the first missing
feature; this RED run does not independently prove those later assertions pass.

The static parameterized prior-schema fixture contains two merchants, two pickup points,
two shipments and their creation/audit history. It never uses the dev or LAN databases.
Root removed no assertions; it requested a checked boundary instead of a response cast,
valid control rows and typed variadic SQL fixture parameters before the first run.
N1 and root focused formatting/lint pass; root server typecheck including both new files
passes. Test SHA: `090a6171db3fc663680668d0944ab60e7c6f709fc29def50302ea81cab776081`.
Evidence: `.git/local-orchestration/public-t002/n1-red.log` and `root-n2-red.log`.

## T003 — Native public HTTP boundaries

Luna N1 and root N2 each ran:

`pnpm --filter @domy/server exec vitest run tests/public-protection.test.ts`

Final runs both exited 1 with five collected tests and five intended assertion failures:
four missing no-store assertions (anonymous API, API/photo errors, both SPA documents,
and injected 500), plus request 61 returning 404 instead of 429. Root duration: 4.01 s.
The real Node HTTP listener and PostgreSQL setup/teardown completed without harness errors.

Coverage includes noindex/no-store, anonymous uniform Spanish invalid-link JSON, changing
forged forwarding headers against the actual transport peer, exact 60,000ms monotonic
rollover, private fixture HTML documents, and request/error/reporting diagnostics without
raw/encoded/malformed bearer values. Only optional monotonic-clock and webDist test seams
were added; no protections were implemented. Tests keep useful route/status diagnostics.

Original N1 additionally reached and proved the raw bearer logging leak. Root strengthened
the tests with explicit encoded/malformed value checks and 500 headers. On final source,
the earlier missing-500-header assertion prevents later log assertions; similarly the
429 mismatch prevents rollover assertions. All must execute and pass under T006; no
coverage is inferred from unreachable RED assertions.

N1 and root focused format/lint/types pass. Test SHA:
`fc8f753be24baffe0f8420d7fca23be66bdeebdace3df7fd9c61c206960b453c`.
Evidence: `.git/local-orchestration/public-t003/`, original and strengthened N1 logs,
metadata, root-n2-red.log and root format/lint/typecheck logs. Native DB runs were serialized.

## Root decision

Root inspected the source, independently reproduced both REDs and approves these two
RED-only deliverables. T004 and T006 are now unlocked; T005 waits for verified T004.
All 35 task identities and reviewer-owned checklist markers remain unchanged.
Catalog: 46/81 verified by task deliverable (57%), 35 open. No new public story,
physical result, full-green gate, remote CI or deployment is claimed. Dev and phone
container identities/ports and PID 12004 were independently confirmed unchanged after QA.
