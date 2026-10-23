# Candidate source recovery — 2026-10-23

The owner requested a solo continuation toward production readiness. No subagents or remote
CI are used. The current branch is `chore/deployment-readiness-verification`, HEAD `f0bc5ac`;
newer verified receipts supersede rewound status paragraphs.

A fresh web typecheck fails with nine diagnostics: account-dialog mutations lost their actor
and idempotent-workflow contract; the courier task export no longer matches its existing tests.
Eight files differ from the previously verified 537-file source manifest `9604ca96`.

Recover only those eight exact Git blobs, verified by full SHA-256 against the retained final
manifest. Preserve the current bytes privately before replacement. This restores approved
001/T132/T136 and 003/T083/T135 behavior and existing regression assertions; it introduces no
new domain rule, schema, dependency or architectural change. All nine constitutional principles
and the existing plans/contracts remain applicable. No unresolved design choice is introduced.

Private evidence: `.git/local-orchestration/readiness-solo-20261023/`, with source manifests,
`recovered-map.json`, pre-recovery backups and the original failing typecheck log. The four new
exploratory test files belong to the later audit and are preserved for investigation; they are
not silently discarded or treated as passing product evidence.

Acceptance: inspect recovered diffs, pass web typecheck and affected account/courier/RPC tests,
resolve actionable audit findings, then all four local quality gates on a frozen final source.
Run the historical-schema/image rehearsal only against the named synthetic lab after reviewing
its bounded operations. Physical tasks remain open until actual device evidence exists.
