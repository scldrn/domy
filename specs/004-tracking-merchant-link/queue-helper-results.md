# Pending-stop queue implementation — 004/T014

Date:2026-10-22, America/Bogota. Prerequisite T010 RED independently verified.
Only packages/domain/src/routes.ts changed. The pure helper takes stops, shipment
ID and canonical kind; it does not mutate data or add dependencies/configuration.
Reverse pickup anchors only at its pending pickup; normal/carrier deliveries at
their pending delivery. Errands/missing anchors return null. Each preceding stop
with pending corresponding delivery/return work counts once; completed/failed and
pickup/errand work do not count. Caller retains active-route/status eligibility.

Executor focused41/41 tests PASS80ms, scoped format/ESLint and all three workspace
types PASS. Root reviewed the diff and independently ran41/41 PASS81ms, scoped
Prettier/ESLint and domain types PASS. Logs .git/local-orchestration/public-t014/.
Final source SHA-256:a7a7665ca6012ba06ea6b6418ceb8fe30481628907420e2cc0a90f64fe02eeae.
T014 accepted locally; T015 remains blocked by T009/T013/T011 requirements. Full
story integration gates remain later; this does not expose a public queue/API yet.
Catalog53/81(65%),28open.
