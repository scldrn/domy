# Repository consolidation plan — 2026-10-23

## Owner scope and invariant

The owner requests one clean local/GitHub repository, without duplicate code or
competing versions. Consolidate through one reviewed PR and squash into main;
remove obsolete branches only after preserving every unique change in main or a
private Git bundle. Do not rewrite trunk history, remove migration history,
reviewer checklists, receipts, secrets, test evidence or operational data.
The latest explicit local-only validation instruction supersedes historical CI
requirements. Publish with GitHub's documented skip annotation for push/PR events;
never dispatch, inspect or wait on remote workflows. No infrastructure deployment.

## Findings and dependency order

1. Preserve refs, binary diff and untracked files privately. Fetch actual remote
   branch/PR metadata. Baseline source `36ef1cd6` already has four passing local gates.
2. Exact-file and TypeScript function-body scans cover 273 production modules:
   no identical source files or repeated function bodies of 80+ tokens found.
3. PR30 contains a unique approved 003/T136 transport correction absent from the
   candidate: literal loopback and the native DNS-refusal regression. Restore that
   regression first and retain RED. Port the existing decision using current files;
   keep all later auth/actor/public-origin behavior. Align newly added public E2E
   fixtures to the same IP origin, including message-link parsing. Bind preview
   explicitly, preserve cookies, service worker, deadlines, retries and axe checks.
4. Revalidate all four gates locally on frozen source. Inspect local-only branch
   changes for missing unique work; never delete an unreviewed unique change.
5. Commit current reviewed candidate and receipts, push a single short-lived
   branch, create/review/squash its PR, and close superseded PR30. Publish/merge is
   authorized by this cleanup request; deployment remains out of scope.
6. Verify main exact tree/source, remove incorporated local/remote branches,
   prune references and confirm no open PRs or uncommitted files. Preserve the
   private backup and all historical failures, without publishing alternate tags.

## Acceptance

Run pnpm check, pnpm test, pnpm test:e2e --retries=0 and pnpm build; preserve first
failures. Re-scan source duplicates, validate links/DAG, compare published main's
source against the passing manifest, and inspect remote branch/PR state. No new
business rule, schema, dependency, production behavior or architecture is added.
This is the existing 003/T136 approved plan, extended to current public fixtures;
all nine constitutional principles and existing owner decisions remain applicable.

## First integrated browser finding

The first consolidated browser run preserves154 passes/one failure. Its native
trace shows the direct delivery request starting10ms after an optimistic pickup,
and returning `not_applied` before the pickup's79ms request commits. The portal
correctly remains picked up. This is a fixture precondition race: an optimistic
phone label is not a server acknowledgment. In the existing pending-photo scenario,
wait for the native pickup response and validate its applied outcome before sending
the synthetic delivery. Validate that delivery's applied result as well. Preserve
all photo/date/privacy/24-hour expiry assertions and limits; no runtime code changes.
Run the corrected case locally, then the final four gates on frozen source.
