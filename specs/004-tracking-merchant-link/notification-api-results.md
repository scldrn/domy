# Notification API local verification — 004/T021

Date: 2026-10-22, America/Bogota. T018/T020 and the contract alignment were verified
before implementation. T021 is accepted; notification UI/story gates remain pending.

Native Hono endpoints enforce owner/dispatcher roles. GET uses the shared strict
query/response schemas and Bogotá default date, returns only date-matched nonvoided
shipments grouped by merchant, and retains inactive merchants with `isActive` for
the UI sharing gate. POST validates the whole nonempty batch, canonicalizes UUID
case/order, serializes its action and locks shipment rows in deterministic order.
One transaction writes all marks and events. Receipts bind actor/operation/ID set
in the shipment-event namespace; replay has no second effect, conflicts409, and
later new-action resends preserve the first timestamp/actor. Supplied captured-actor
headers are checked before receipt/effects; legacy authenticated callers may omit.

Both event clocks use the injected server instant. Already selected/opened marks
can complete after merchant deactivation. Codes never enter receipt/audit metadata.
Only protected `ShipmentDetail` gains trackingCode and nullable notification time/
actor UUID; courier snapshots, base shipments and lists retain their exact shapes.
CSV/XLSX append `Notificado` using the existing Bogotá instant formatter.

Executor retained causal REDs for routes, receipt/actor binding, UUID casing,
actual timestamp cells, activity projection and injected recordedAt. Independent
source analysis/root review resolved the activity/clock gaps before final QA.
N1 final affected server43tests/5files10.05s, domain423tests and static checks pass.

Root's broader first run collected755 server tests:753 passed and2 failed on
obsolete contract assertions (37 rather than38 export headers; strict protected
detail lacking the three approved new fields). The full run was not green and
its log remains unchanged. Only those two test files were aligned, retaining all
strict courier/list schemas and requiring the new detail types/nulls and final
export header. Root reversed the six-line detail extension and matched the original
hash; the complete manifest differs only in those two tests, with product unchanged.

Root final focused N2 passes all43 tests/5files14.80s, own full423domain tests,
scoped Prettier/zero-warning ESLint and recursive typecheck. Final513-file manifest
is identical before/after final QA:
`ba13222e885cc9bc051b88c7e44a085301f894759779698c396ac1eb76d6308b`.

```bash
env -u NO_COLOR pnpm --filter @domy/server exec vitest run tests/notifications.test.ts tests/shipments-export.test.ts tests/shipments-search.test.ts tests/operations-export.test.ts tests/courier-contract.test.ts
env -u NO_COLOR pnpm --filter @domy/domain exec vitest run
pnpm --recursive typecheck
```

Scoped format/lint covered all owned server/domain sources and both aligned tests.
Logs, first failures, hashes and manifests:
`.git/local-orchestration/notifications-t021/`. The final full-story check/test/E2E/
build remain required after T022; no single full755-pass run is claimed here.
No remote CI, actual message sending, deployment or physical acceptance occurred.

## Reopened detail projection — 2026-10-22

Root discovered notification receipt metadata (`operation`, `shipmentIds`) being
interpreted as before/after shipment fields by the existing generic detail mapper.
A native causal test fails with `operation: ["n", "o"]` instead of null changes.
The actor, timestamps and real stored receipt must remain intact. T021 is reopened
and dependent T022 assembly held until executor/root QA pass. Logs are retained
under notifications-t021/root-detail-history-red.log. The earlier first targeted
command selected no matching case (14 skipped), so it is not RED evidence.

The projection follow-up is now VERIFIED LOCAL at both levels: N1 six affected
server files/65tests12.04s and root N2 same65tests14.22s; scoped formatting, lint
and server types pass. The exact command uses notifications, shipments-export,
operations-export, courier-contract, shipments-update and shipments-reassign
test files. Stored receipt assertions and replay remain intact; only the detail
projection yields null changes for notification metadata. Actor, event and both
timestamps are asserted unchanged. Recursive types failed solely on concurrent
T022 web routes pending generator execution; this failure is preserved, not
claimed green. Full integrated recursive types/check remain T022 prerequisites
for story closure. No contract shape changed, no receipt was rewritten.

Final source SHA-256 e9878c49d2eccbef20d47c9b8ae55887e448cef8f3f36f45a0e2a50d25e74063;
notification test82e7e741f5304e2c87727a42e39ec1dcd1fecaadde25f681127d530cc341a0e2.
Root hashes matched frozen executor files. Logs: followup-detail-* and
root-detail-{server,format,lint,types}.log under notifications-t021. T021 closes
again; catalog72/81(89%),9open. T022 assembly may resume.
