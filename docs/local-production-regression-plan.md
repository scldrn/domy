# Solo production regression closure — 2026-10-23

## Scope and analysis

Continue without subagents or remote CI. Preserve the other audit's four exploratory files and
all first failures. Restore the eight SHA-verified candidate files under the source recovery plan.
New audit evidence reproduces concurrent password-failure counter loss (001/T146, FR-033) and
same-UUID shipment-edit retries incorrectly returning conflict (001/T070/T073, FR-042).
Cursor payload validation (001/T139/T082/T085) and large owner export (001/T083/T086, FR-025)
need explicit regressions before any correction. These enforce existing requirements.

Two recovery-origin failures may be test-only: installed Better Auth 1.7.6 explicitly disables
origin validation by default in test mode. Verify identical requests with production-mode auth
before identifying a product defect. Do not add duplicate URL validation around the library.

## Design and task order

1. Add permanent real-PostgreSQL regressions for concurrent sign-in failures and edit/void
   UUID replay, invalid cursor shapes, and large export completeness. Preserve unrelated edits.
2. After RED, serialize each account's sign-in decision in an existing PostgreSQL transaction
   using a per-normalized-email advisory lock and a transaction-bound Better Auth instance.
   Commit failure counters before returning lockout; retain existing sessions and expiry behavior.
3. For shipment conflicts, distinguish an already-committed matching UUID/entity from a
   genuinely different concurrent action, both at the editable-state guard and conditional write.
4. Validate decoded cursor JSON with a Zod tuple at the boundary; invalid input returns 400.
5. If export RED confirms bind/scale failure, query related rows with a filtered-shipment
   subquery and index results by shipment in native Maps. Preserve rows, ordering and COP.

All nine constitutional principles apply: modular monolith, no schema/dependency additions,
shared business semantics, transactional events, strict types, meaningful RED/green evidence,
Spanish errors, source order and private credentials/logs. No architectural complexity or
unresolved requirement is introduced. The critical findings are implementation defects to
resolve before release; existing approved feature artifacts remain authoritative.

## Acceptance

Pass the permanent focused tests, production-origin controls and restored UI regressions; then
freeze source and pass check, full Vitest, first-attempt Playwright with zero retries, and build.
Repeat the candidate image proof and historical-schema rehearsal after source changes. Physical
acceptance is recorded separately and never replaced by browser emulation. Do not close tasks
on test-only harness behavior or suppress failed assertions.


## Integrated history finding

The first full run passed818 server tests and failed one retained correction test:
unchanged history events with equal occurred/recorded timestamps swapped positions after
an invisible receipt was inserted. Preserve that failure. Add an explicit tied-clock
regression and use the existing event UUID as a final ascending sort key, after the two
business timestamps, in the detail query. This preserves chronological rules and makes
repeated reads stable; it does not weaken the unchanged-history assertion.
