# Notification delivery design gate — R21

Date: 2026-10-22, America/Bogota. This operational gate requires verified T020;
it does not bypass T022's separate verified T021 prerequisite.

Root aligned research R21 and the plan's structure/Complexity Tracking before UI
changes. A native browser pending-action queue is necessary for R8/T022 durable
marks: memory loses its UUID on reload; courier records have different actors and
contracts; one shared storage array risks cross-tab lost writes. Per-action keys
and the existing native browser-lock pattern add no service/table/dependency.

Only actor/action/merchant/service-date/shipment-ID metadata is stored, never composed text,
phones or bearer codes. A prepared phase precedes the external action; only a
durably ready phase after successful open/copy can be posted. This prevents reload
or another tab from marking before the external action succeeds. A shared pure
eligibility helper must serve composer, counts and chosen IDs; retries retain
the captured IDs instead of recomputing from a changed list. Inactive merchants
remain visible but new sharing is disabled; prior marks may still complete.

Independent Luna/max read-only analysis found no HIGH/CRITICAL contradiction.
Its recovery edge was incorporated: rediscover prepared intents on later actor
panel mounts, keep them unsent and show persistent guidance, require a human
repeat, and persist a replacement before removing the superseded prepared key.
Root added conditional phase transitions/cleanup under the existing native
per-action lock pattern after open/copy; no lock/network await delays the popup.

Root reviewed actor isolation, exact-key acknowledgment, blocked-storage/popup/
clipboard failure paths and uncertain-response preservation. Required implementation
regressions cover prepared/ready crash windows, storage failures, same-UUID reload/
two-tab replay, stale actors and corrupt metadata without deleting pending work.
No prepared or unconfirmed action may auto-send or be shown as notified.

Design gate verified; T022 implementation remains blocked until T021 passes root
N2. Runtime/storage/gesture behavior is not claimed passing by this analysis.
