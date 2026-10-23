# Public tracking RED verification — 004/T009 and T011

Date:2026-10-22, America/Bogota. Dirty local base94a7e24; foundation integration
verified on c13b486c. R17/R18 clarify wire serialization, kind/status precedence,
receiver provenance, office precedence, queue eligibility and expiry deadline.

## T009: pure projection

Executor and root independently ran:
`pnpm --filter @domy/domain exec vitest run src/public-tracking.test.ts`.
Both collect72 cases and fail72 at the intentional runtime-checked missing export;
root305ms, no module/import/collection error. Later product assertions are blocked
and are not represented as already passing. The suite covers32 state/kind pairs,
private-field allowlist/exclusion, support/window, kind destination/receiver, reasons,
COD, courier/queue gates, office custody, reprogramming, effective final/revert and
exact deadline boundaries, Bogotá time. T013 must execute every assertion GREEN.

Root review corrected initial ordinary wording applied before reverse/errand kind
rules, strengthened active-route office custody and actual reprogrammed date, and
aligned the newly specified nested wire shape. Errands become En curso on dispatch
because they have no pickup operation; reverse pre-pickup wording is kind-specific.
Original and corrected logs remain public-t009/domain-red*.log and root-red*.log.
Final test SHA:5044522219fded478cebad8e59c554e5ac2f73d92a5d6d88ea072978d64a5390.

## T011: native HTTP/database

Executor and root independently ran:
`pnpm --filter @domy/server exec vitest run tests/public-tracking.test.ts`.
Both collect8 cases:7 intended valid-link404 failures and1 passing uniform unknown
link case; root5.79s. Initial lifecycle fixtures before each first query use real
registration/route/courier/void APIs, never direct status writes. Native setup completes.
Later steps behind the first missing-endpoint assertion (some decisions, returns,
expiry and reversion) remain unreachable in RED and must pass under T015. No inferred
claim that every lifecycle stage has already executed is made.

Root removed an unchecked errand-response cast via a minimal Zod boundary and fixed
the helper so expired cases can expect the expired variant rather than being forced
to full-state false. Private values and effective receiver names are deliberately
different. Carrier destination, reverse queue, real COD/privacy and expired-only
key assertions remain. Original/corrected logs are retained under public-t011/.
Final test SHA:88999b8d127f22fe1f0b684edc66b79afb04cf40430c0d3bccce3fe85e1916bc.

## Decision

Both levels scoped format/ESLint and domain/server types PASS. Root approves these
RED-only deliverables; this is not public projection/API implementation acceptance.
T013 is unlocked; T015 still requires verified T013/T014 and T006. T012 browser RED
continues separately. Canonical catalog55/81(68%),26open. No remote CI/deployment or
physical acceptance occurred.
