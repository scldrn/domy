# Public and notification accessibility — T032

## Initial native verification — RED,2026-10-22

T032 is open. Prerequisites through T022 and T030 are verified; catalog74/81(91%).
Executor authored `apps/web/tests/e2e/public-accessibility.spec.ts` and passed
scoped formatting/lint/types before its first native built-worker run. Its three
cases failed as follows; first traces/output are retained in
`.git/local-orchestration/public-t032/n1-e2e-first{.log,-artifacts/}`.

1. A real Tab-focused support telephone link reports computed outlineStyle:none.
   Root independently inspected generated CSS: outline-none sets
   `--tw-outline-style:none;outline-style:none`; focus-visible:outline-2 consumes
   that variable and sets only width. Existing intended focus rings are absent.
   The global2px focus rule already exists; restoring solid style preserves its
   width/tokens. Native keyboard checks must remain, including later button/date
   actions. Root retained compiled CSS evidence in root-focus-css-before.log.
2. The merchant loading scan hit an axe harness error requiring explicit browser
   context construction. This is not a product failure and is not an axe pass.
3. Real notification loading fails aria-prohibited-attr: a generic div has an
   aria-label without a permissible role. A semantic loading status is required.
   Its assertion failure also exposed handler teardown racing route.fulfill;
   cleanup must await the held handler rather than mask the original result.

Root authorized bounded fixes in the existing public focus classes/shared Button
recipe and notification loading semantics under the already-approved design
system/constitution. No token/global CSS redesign, new dependency, force action,
scanner exclusion, hidden content, relaxed target/focus threshold or retry is
permitted. Harness fixes use native contexts and deterministic empty data, and
held real responses/aborted transport add actual loading/error recovery coverage.
Independent source review and repeated N1/root N2 remain required, followed by
all four full gates because shared runtime focus styling changes.

Earlier public/notification successful-state, invalid/expired/photo and recovery
scans remain valuable baseline evidence; they do not prove the newly discovered
keyboard/loading failures pass. No physical or release acceptance is claimed.

## Second native attempt — preserved failures

The bounded focus/status fixes pass the initial previously failing checks, but
the full three-case attempt remains RED. First case then expected a loading role
on the already-loaded tracking heading; the harness must use the actual heading.
Second case expected generic page-error text while the native API correctly
returns its canonical actionable Spanish network message. Those are assertion
corrections, with recovery/axe checks retained.

The third case exposes a genuine46px global-search input target inside a48px
bordered form. A bounded input minimum restores the approved48px target. Its
other report counted an unfocused visually-hidden skip link as visible; the new
geometry helper must use the existing courier scanner's unfocused sr-only rule.
A separate real Tab-focused skip-link measurement is required so that rule
cannot hide an undersized visible link. Any required skip-link fix follows a
measured causal RED, without relaxing48px.

Second output/traces live at n1-e2e-second.log/n1-e2e-second-artifacts in the same
local directory. Response-gate cleanup is now orderly, with no secondary handler
error. The next iteration also asserts keyboard-visible focus on the public date
field. Independent read-only review found no HIGH/CRITICAL design contradiction;
root clarified the design document's old primary/accent wording to the existing
dedicated accent/2px/offset2 ring, with no palette or token change. T032 stays open.

## Focused verification — GREEN, 2026-10-22

The explicit native Tab measurement first reproduced the focused skip link at
20.25px high. Its causal failure is retained in focused-skip-red.log and
focused-skip-red-artifacts/. Focus-only inline-flex/minimum48px classes fix the
actual visible target without changing its unfocused screen-reader behavior.
The global search input now has a48px minimum, notification loading has a
semantic status role, and existing public/shared Button focus rings explicitly
use solid style. No new dependency, palette, global CSS rule, scanner exclusion,
forced action or relaxed threshold was introduced.

Executor final native verification:3/3 PASS32.9s, retries0
(n1-e2e-third.log and n1-e2e-third-artifacts/). Root independently reviewed the
changes and repeated the same three cases:3/3 PASS34.3s, retries0
(root-focused-first.log and root-focused-first-artifacts/). Scoped executor
formatting/lint/recursive types and root full `pnpm check` pass.

Root's frozen build/test input manifest covers523 files with aggregate SHA-256
`d1ab1e736e5a4f9bdd1759834acd5d69f0f85d22b59b5694b353eb7b2aad7e3b`
(root-source-before.json). Full unit/integration, complete browser and build
gates remain in progress; T032 is not closed by these focused passes.

## Coverage and independent read-only review

The new three cases reuse the unchanged common WCAG2.0/2.1/2.2AA axe scanner.
Loaded tracking, merchant list/detail/return and notification pages pass320/1280
light/dark scans and48px geometry checks. Real held responses and aborted
transports exercise loading/errors/recovery at320px light; merchant empty states
also run both widths/themes. Native Tab/Enter/Space checks measure visible focus
and exercise support links, merchant date/row/return, notification skip/open/
retry/checkbox/copy actions. The notification loss-of-ACK case commits through
the actual API before aborting transport; external WhatsApp is isolated.

Existing built-worker suites retain edge-state axe checks: invalid/429 tracking
(`tracking-page.spec.ts:336-355`), expired/reverted tracking (`:195-284`),
merchant proof pending/unavailable (`merchant-page.spec.ts:371-509`), anonymous
public screens (`public-pages.spec.ts:83-105`) and notification sharing/recovery
(`notify-merchants.spec.ts:157-420`). The edge-state cases do not claim every
width/theme/geometry Cartesian combination; invalid merchant dates are checked
as an API422 rather than a visual field-error scenario. No manual assistive-
technology, physical phone or production conformance claim follows from axe.

The independent Luna reviewer read the source (including untracked files, which
are absent from ordinary git diff) and found no CRITICAL/HIGH issue. Root also
reviewed source, retained causal defects and native focused evidence, and checked
`git diff --check`. The only existing axe exclusion remains the documented
invisible framework focus guard; T032 adds none.

## Full local gates — running

Root full `pnpm test` passes1566 tests:424domain (24files,549ms),760server
(70files,171.56s; real PostgreSQL),382web (44files,1.74s). Output:
root-test-first.log. Full `pnpm check` already passed. The complete
`env -u NO_COLOR pnpm test:e2e --retries=0` run is now executing against the
frozen source; full build and final source equality are still required.

## First full browser run — failed and retained

Full run:152PASS/1FAIL,153cases,9.8min,retries0. Output/traces retained in
root-e2e-first.log/root-e2e-first-artifacts/. The cold public status took
2913.8ms within the unchanged3000ms budget. This run is not a full gate pass.

The unrelated keyboard-registration scenario assumed Amy Tecnology was the
first unfiltered merchant. The new real accessibility fixture sorts before it.
Root inspected the native trace: Accesibilidad T0325c130da6 is the first option
and actually has data-highlighted, while Amy is second. The product correctly
responds to ArrowDown; the old fixture-specific assertion is order-dependent.
Root retained the causal DOM in root-register-failure-snapshot.json.

The executor is correcting the harness to capture the first real option's stable
identity and assert that same highlighted option both before and during the held
search. The filtered Bullish highlight-before-Enter, response gate and complete
registration assertions must remain. No product change or retry-green is used.
Focused repeated N1, independent root review and a new complete run are required.
T032 stays open at74/81(91%).

The first attempted identity-based harness fix itself failed: it tried to read a
visible option before ArrowDown had opened the popup. Root independently found
the trace's final getAttribute call waiting on the closed list, rather than a
product focus regression. The executor interrupted the known-failing repeat
run gracefully and preserved keyboard-regression-first.log and
keyboard-regression-first-artifacts/:12PASS,2FAIL,1interrupted,20notrun. The
interruption is not an accessibility defect or passing run. The correction now
opens via ArrowDown before identifying the first visible option, then checks
that exact identity/highlight throughout the held search. New development-only
error messages are English. Final focused/repeated and root full QA are pending.

## Integrated harness correction — executor verified

The corrected affected case passes1/1, followed by the combined three public
accessibility plus four keyboard-registration cases repeated five times:35/35
PASS2.8min,retries0. Each repetition runs public fixtures before registration.
Output/artifacts:keyboard-regression-focused-corrected{.log,-artifacts/} and
keyboard-regression-final{.log,-artifacts/}. Scoped formatting/lint/recursive
types and root full check pass. No application code changed after the original
focused accessibility passes.

Root reviewed the final registration correction: ArrowDown opens the native
list; the first actual option has a nonempty label and validated DOM id, and
that exact option must remain highlighted through the held search. The final
filtered Bullish highlight, Enter, selected merchant/pickup, recipient fields,
quote and one successful registration assertions remain intact. Root's final
frozen source manifest is523files, SHA-256
`2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6`.
Its only difference from the first full browser source is this test file
(`5f0d475464c8b5b3eda19b6b863132c9ba971639cbb561d885a31cf656704529`).
The root final full suite/build and unchanged-manifest checks remain pending.

## Final orchestrator acceptance — VERIFIED LOCAL, 2026-10-22

All four root gates pass on the same final523-file source:

- `pnpm check`: Prettier, zero-warning ESLint and strict recursive types PASS.
- `env -u NO_COLOR pnpm test`:1566PASS (424domain/760server/382web);
  server159.34s, web1.73s.
- `env -u NO_COLOR pnpm test:e2e --retries=0`:153/153PASS9.7min, no retries;
  cold tracking2847.5ms within unchanged3000ms.
- `pnpm build`: web/service worker and server types PASS, zero warnings.

Logs are root-{check,test,e2e,build}-final.log in the private local evidence
directory; root-e2e-final-artifacts/ preserves the final browser metadata.
root-source-final-before.json, root-source-after-n1-final.json,
root-source-after-e2e-final.json and root-source-after-build-final.json all
match523files/SHA2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6.
Root verified the only intervening build/test change was the reviewed registration
harness correction, and reviewed runtime classes/ARIA plus the full test source.

T032 closes after executor and orchestrator QA; catalog75/81(93%),6open.
T033 documentation is now eligible. Physical003/T087/T088/T093,004/T034 and
final004/T035 remain open; no provider, individual consent, physical acceptance,
remote CI, deployment or production conformance is certified here.
