# Repository consolidation results — 2026-10-23

## Canonical source and owner scope

The owner requested one clean local/GitHub repository and authorized consolidation
of the verified candidate. The release source is `main`; short-lived review branches
are removed after squash. No trunk history rewrite or production deployment.
Historical receipts, migrations and reviewer checklists remain traceability evidence,
not competing application implementations. The current entry point is the
[engineering handoff](../engineering-handoff.md).

## Code and branch review

An exact-file scan and TypeScript AST function-body scan cover 273 production
modules across server, web and domain. No identical source files or repeated
complete function bodies of 80+ tokens were found; this is the scope of the scan,
not a claim that every similar expression represents a defect.

The stale PR30 held an approved 003/T136 transport correction missing from the
working candidate. Its native DNS-refusal regression failed before restoration;
literal IPv4 origins/cookies/preview/proxy and current public fixtures make it pass.
All later auth, actor, public-origin and cleanup behavior is preserved. Scenario
inventories from the old notification and transport branches are retained.
No runtime source file changes in server/web/domain were needed for consolidation.

All previous refs, the binary working diff and eight untracked files were backed
up under `.git/local-orchestration/repository-consolidation-20261023/`, including
a recoverable Git bundle. Unique historical work is preserved without alternate
active branches or duplicate files in the application tree.

The first integrated browser run also exposed an existing fixture race: a direct
synthetic delivery overtook the phone’s optimistic pickup. Native traces preserve
the pickup and `not_applied` delivery responses; the portal correctly stayed picked
up. The test now waits for the actual pickup acknowledgment and asserts both
applied outcomes. Its original photo/date/expiry/privacy assertions remain intact,
and the corrected case passes without runtime changes.

## Validation and publication

Current source SHA-256:
`d604a2876d27da5ffae669c4be9db899b17c2ba183a7b3f1f99fe2cee855e599` (540 files).
All four gates pass on an unchanged before/after manifest:
`pnpm check`, 1,626 tests (424 domain/820 server/382 web), 155 browser scenarios
with zero retries (9.8m, cold tracking 2866.1 ms against 3,000 ms), and
`pnpm build`. The rebuilt arm64 image is `sha256:2ea640a3da2bf4dba313d85eca1baf8f0e929dd72752f92bd6418612006c2e7b`
(`domy:consolidated-d604a287`). Native imports pass; 282 runtime files,
configuration and dependency layers match the earlier upgrade-tested image.
Private logs preserve the initial two Docker
startup failures: native host-port publication exceeded 10 seconds before any test
in those suites ran. A native Docker preflight published in 168.7 ms; the two affected
suites then passed 9/9. The complete suite subsequently passed without changing
source, timeouts, workers, assertions or coverage. No failed business assertion was
hidden, and no remote workflow was dispatched or awaited.

Publication uses a single squash PR with `[skip ci]` on the branch head and squash
commit, matching the existing workflow’s push/PR event types. Final checks require
an exact matching source/tree on local and remote main, zero uncommitted files,
one local/remote branch and no open PR. Post-publication inventory is retained
privately. The five physical/final tasks remain open; cleanup does not close them.
