# Notification composition input alignment

Date: 2026-10-22, America/Bogota. Prerequisites T016/T027–T029 are verified.

Before writing T017/T018 assertions, the composer executor identified that T017
requires domain-level voided exclusion while the notification list omitted status.
Root approved adding the existing non-sensitive `ShipmentStatus` to each list row.
No new status, table, dependency or public-bearer disclosure is introduced.

The shared composer signature is
`composeMerchantMessage(merchant, shipments, baseUrl, includeNotified = false)`.
It excludes voided shipments in every mode and notified shipments by default.
The existing all-date option explicitly includes notified shipments. The detailed
20-entry / compact21-entry threshold applies after eligibility filtering.
The web consumes the shared schema and helper, without copying business filters.

R8, data-model notification rows, HTTP GET shape/composition section and canonical
T017/T018 tasks were aligned before dependent tests. Independent Luna/max
rereview found no HIGH/CRITICAL discrepancy; root reviewed all four edits and
confirmed they implement FR016's existing voided/default/all-date requirements.
GET still excludes voided rows; POST retains its prior nonempty atomic actor/
operation/sorted-ID-set receipt contract and409 conflicting replay.

This is artifact analysis, not a passing implementation or task closure. T017–T019
remain open RED deliverables until their respective executor and root evidence.

## T021 detail and actor alignment

After T017–T020 verification, root aligned the HTTP contract, R15 and data model
before API changes: only `ShipmentDetail` gains trackingCode, nullable UTC ISO
notifiedAt and nullable actor-UUID notifiedBy. Lists/summaries keep their shapes.
New notification web intents supply the optional captured-actor header already
used for merchant replacement. The existing guard rejects malformed UUID input
as invalid_request and a different actor as actor_changed before receipts/effects;
existing callers may omit the header. A re-send preserves first time and actor.

UUID case/order does not alter the sorted receipt set. The first receipt belongs
to the existing shipment-event namespace and rejects a foreign shipment-event
operation. It does not establish global uniqueness across separate audit/route
receipt tables, and no registry or redesign of those areas is implied.

Independent Luna/max rereview found no HIGH/CRITICAL inconsistency and root
confirmed source ordering and field scope. This is design evidence only; the
executor must still prove new API behavior through RED/GREEN and root N2.

Root source review and independent rereview then identified two bounded gaps:
inactive merchants remain visible under FR015 but their private link is invalid,
and notification events omitted the injected recordedAt. The GET merchant shape
now includes existing `isActive`; T022 blocks new sharing while inactive, as the
existing merchant-link control already does. POST still records/retries an earlier
successful open/copy after deactivation. Both event clocks use the injected instant.
Contract/model/R15/tasks are aligned before these implementation corrections;
the executor must preserve causal regressions and revalidate the final source.
