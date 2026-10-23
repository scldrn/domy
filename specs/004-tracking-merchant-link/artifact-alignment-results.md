# Public feature artifact alignment — W12

Date: 2026-10-21 (America/Bogota). Local branch: `codex/local-readiness-orchestration`;
base `94a7e2450ec2abae4192f7f864e34c4638f7c963`, existing dirty tree preserved.
This is design analysis, not implementation, physical acceptance or deployment.

## Authority and execution sequence

The owner's “omite y continuemos” defers 003 physical tests for local development.
003/T093/T087/T088 remain open and block final delivery; no scenario is inferred passed.
The DAG retains 003/T088 as a final 004/T035 dependency. All 35 feature 004 IDs remain
unchanged and unchecked. Delivery order: foundations → tracking → merchant portal →
notification UI. Independent RED suites may be authored in parallel.

## Independent analysis and root reconciliation

Two GPT-6 Luna/max reviewers inspected feature artifacts and actual source read-only.
Root aligned plan, research R12–R16, model, HTTP contract and tasks, then both reviewers
reread the changes. Both report no remaining CRITICAL/HIGH design blocker. Root inspected
the source and diff; implementation must still prove every planned protection.

| Finding | Resolution / owning tasks |
| --- | --- |
| Bearer paths and creation snapshots can reveal secrets | Common request/error/reporting redaction; exclude codes from creation history; T003/T005/T006/T015/T027 |
| Notifications precede their merchant destination | Portal/rotation before notification browser delivery; T019/T022 depend on T027–T029 |
| Required code columns lack populated upgrade design | Stable native cryptographic per-row default/backfill, nonempty prior-schema upgrade and generated migration; T002/T004/T005 |
| Empty/reused notification keys lack complete receipt binding | Reject empty batches, validate all IDs, transactional serialized actor/operation/sorted-ID receipt; T018/T021 |
| Direct photos omit the page's date boundary | Same active merchant code, ownership and 30-day Bogotá service-date predicate; T024/T027 |
| Carrier destination omitted from projection allowlist | Explicit carrierName/destinationTown at every nonexpired carrier status; T009/T011/T013 |
| Deactivation wording can invalidate shipment tracking | Deactivation affects merchant code only; T024/T027 |
| Proxy assumptions have no current topology proof | Real Node transport peer; ignore forwarding; bounded monotonic limiter; actual proxy verification deferred to OP-01/G1; T003/T006 |
| Existing worker still intercepts public documents | Registration skip plus public navigation exclusions, both headers and controlled-browser verification; T003/T006/T007 |
| Origin/build and settings contracts incomplete | Canonical selected public origin/build-runtime parity; independent partial owner settings updates; T001/T008 |

Coverage: 24/24 FR and 5/5 buildable SC have task mappings; this is coverage of design
intent, not passed acceptance. SC-006/007 are post-launch measurements. Reviewer-owned
checklists remain read-only: requirements 16/16, public-pages 36/36 checked.

## Local checks and existing-data boundary

`SPECIFY_FEATURE_DIRECTORY=specs/004-tracking-merchant-link .specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks`
passed and resolved this feature. Canonical ID/order, relative links, DAG acyclicity and
`git diff --check` passed. Analysis hooks before/after are optional git commits and were
skipped under the current local-only/no-publication scope. No mandatory analysis hook.

D6 preliminary read-only inventory used `docker exec domy-postgres-1 psql -U domy -d domy`
with a `BEGIN READ ONLY` transaction and counts only: shipments 0, merchants 1,
courier_records 0, record_photos 0; last applied migration ID 5. No row contents/secrets
were printed and no migration applied. The sealed LAN target uses a separate synthetic
DB and is preserved. Production data is not inventoried or authorized for change.
D6 subsequently passed independent Luna N1 and root N2 count/metadata queries:
PostgreSQL version_num 180006, neither new code column present, applied journal entry
0004_courier_app (created_at 1791992064242), while repository files extend through
0008_purple_red_hulk. Root accepts this bounded local inventory only; no migration
or operational-row edit occurred. Before T004, verify a populated isolated upgrade
from the current pre-feature schema;
this empty-shipment developer DB cannot prove upgrade safety. D6 is verified for
that bounded local scope; operational inventory/lock impact remains a
release obligation for the eventual authorized production target.

## Root decision

W12 is approved for local T001, followed by independent T002/T003 RED. Neither reviewer
nor root marks any 004 implementation task complete here. Catalog remains 43/81 (53%).
No package dependency, application behavior, DB schema or running LAN resource changed in W12.
