# Documentation correction evidence

## Scope and analysis

`002/T064` resolves IV-32 without changing application behavior or renumbering tasks.
The four duplicate historical IDs are explicitly mapped in `tasks.md`:
`002/Phase3/T057` (threshold), `002/Phase3/T058` (route UI),
`002/Phase8/T057` (contracts), and `002/Phase8/T058` (performance).
The original four checked task rows remain byte-for-byte unchanged. Plan and
execution-strategy references now identify their phase. No reviewer checklist changed.

Current quickstart guidance describes `pickUp`/`finishTask` calling the validated
`applyCourierRecord` transaction, rather than directly setting completed-task status.
`placeOnRoute` remains a status-only fixture for other features; its existence is not
courier HTTP/session authorization evidence. The 2026-10-13 results are preserved as
dated history, with a separate current addendum linking the verified root checkpoint.
Actual dispatcher timings and physical Android/iPhone acceptance remain outstanding.

Local ancestry confirms squash `9006db32270338670e51c609c6b67ba2750fec83` (PR #28)
is in base `94a7e24`. Its diagnostic trace retention is distinguished from the separate
later offline correction. Historical pre-merge status paragraphs remain dated context;
the current status explicitly supersedes that merge uncertainty.

## Executor validation — 2026-10-21 (America/Bogota)

Documentation-only validation checks original task-row preservation, exact preservation
of the historical results body, the four phase mappings, local relative links, checked
Git ancestry, and `git diff --check`. Output is retained privately in
`.git/local-orchestration/t064-documentation-n1.log`. No runtime tests were added or
rerun for prose. The prior complete local gate receipt is cited with its exact source
and does not certify later concurrent agent changes.

Independent Luna/max review confirmed the four identities, unchanged historical task rows,
record-helper/HTTP distinction, preserved report and local PR #28 ancestry. Its sole finding,
the old status header date, was corrected and re-reviewed with no remaining blocker. Root
inspected the final files and confirms documentation-only N2 approval. T064 is now closed;
this does not close outstanding human timings, G0 or physical courier acceptance.

## Reconciliation — 2026-10-23

The prior receipt is retained verbatim. Review of `6b0256d` found the task references
and completion marks inconsistent with its claimed changes. This slice applies the
phase qualifications in tasks/plan, restores the evidenced T063/T064 marks and adds
a dated quickstart addendum. T015 now points to its actual unassigned-endpoint cases
in `routes-create.test.ts`. This repairs the artifact mismatch; it does not invent a
new historical QA result. See ../../docs/release-change-review-results.md for final gates.
