# Merchant portal local verification — 004/T028/T029

Date: 2026-10-22, America/Bogota. Dirty local base `94a7e24`.
T028/T029 are accepted after both QA levels and the full final-source gates below.

## Behavior and review

The anonymous merchant page consumes native inferred Hono queries. Its query keys
include the bearer code and selected date; errors hide stale payloads. The default
day comes from the server; date bounds use the shared Bogotá calendar helper.
List/detail polling runs every60seconds while visible. Financial totals, delivery
attempts, actual receiver and private proof availability come from the approved
domain projections. Every nonblank note becomes the fixed support notice; stored
notes remain unchanged. Support actions remain available in the inline detail.

The panel copies the validated public-origin URL and confirms link replacement.
An uncertain response retains its actor, merchant and action UUID. The new client
sends `X-Domy-Actor-Id`; the server checks a supplied header before effects or
replay, preserving compatibility for older authenticated callers without it.
The native regression proves a cookie/actor mismatch has no rotation or receipt.
The merchant date query uses Hono's native validator for end-to-end inference,
while active-code lookup still precedes calendar validation (uniform404).

Root reviewed source, contracts, replay and browser assertions. Independent
Luna/max review found no remaining HIGH/CRITICAL contract or privacy findings.
It confirmed the bounded focus defect and subsequent source correction; its
review alone does not claim runtime acceptance.

## Executor N1 and preserved failures

`merchant-page.spec.ts` final3/3PASS23.8s, retries0. Four earlier failed
attempts are preserved with logs/traces: obsolete receiver expectation and a
clock instant short of24hours from server receipt; duplicate receiver locator;
a field locator mistakenly placed before opening detail; and an accessible-name
assumption for `term`. Corrections use the actual fixture receiver, the associated
definition, scoped card/totals selectors and an unambiguous25-hour expiry instant.
Exact24-hour behavior remains covered by domain tests. No runtime shortcut,
money assertion, privacy check, axe scan or timing budget was weakened.
Evidence: `.git/local-orchestration/merchant-t028/n1-e2e-{first,second,third,fourth,fifth}*`.

The real lost-ACK test commits the first replacement through `route.fetch()` and
aborts only delivery of its response. Initial N1 failed on Escape focus restoration:
opening the retry dialog unmounted its opener. The one-condition product fix
keeps the recovery panel mounted while its intent/error exist, allowing Base UI's
native focus restoration. First logs/full traces were archived before another run.
The first run stopped at focus; its later replay assertions did not execute.
Final N1 passed1/1 in14.0s (3.3s test), including focus, three axe states, exactly
two POSTs with the same UUID, identical committed/replayed code, old404/new200 and
enabled copying after resolution. Web358tests and scoped static checks also pass.
Evidence: `.git/local-orchestration/merchant-t029/recovery-e2e-{first,second}*`.

## Orchestrator N2

Final506-file source manifest before/mid/after gates, identical:
`55c5813422779537459303dd1ffa11c8d30fa76a2b0abe88ace04f6b855c3c74`.
Full final-source `pnpm check` passed with zero warnings. `pnpm test` passed1511
tests:412domain,741server (69files,223.41s) and358web. The506-file manifest is
identical after all gates. Full142-case first-attempt E2E passed in9.3minutes,
including all four new merchant journeys. Cold tracking readiness2852.2ms remains
below3000ms. Production build passed. All commands exited0:

```bash
env -u NO_COLOR pnpm check
env -u NO_COLOR pnpm test
env -u CI -u NO_COLOR pnpm test:e2e
env -u NO_COLOR pnpm build
```

Logs are retained under `.git/local-orchestration/merchant-us3-full/`.
An earlier complete static check passed before the one-condition focus correction
and is preserved separately.

No remote CI, publication, deployment or physical-phone acceptance is claimed.
The sealed003 LAN target was not rebuilt or restarted.

Catalog67/81 verified (83%),14open. T017–T019 notification RED tasks are now
eligible in parallel; implementations remain blocked until their own RED QA and
ordered domain/API prerequisites pass. Physical003 and final004 gates remain open.
