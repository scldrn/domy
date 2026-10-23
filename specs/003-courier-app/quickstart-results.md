# Quickstart and T091 timing results

This file records server timing evidence for T091. It does not claim T087's required
Android/iPhone scenarios or physical usability review; those remain separately pending.

Owner sequencing update, 2026-10-21: “omite y continuemos” defers physical execution
while development proceeds to 004. All physical rows below remain Not run; T093/T087
and final T088 closure are not passed or removed. Final delivery still needs that
evidence. The four phone fixtures are preserved.

## T091 — Native courier API on the feature 002 busy-day fixture

| Operation | Required budget | Observed worst run | Result |
| --- | ---: | ---: | --- |
| Snapshot for a route of 15 shipments | < 500 ms | 5 ms (worst of five) | PASS |
| Apply 50 disbursement records | < 2,000 ms | 236 ms (worst of five) | PASS |

The test uses real PostgreSQL, authenticated HTTP requests, and the 100,000 historical
shipment / 40-route busy-day fixture. Detailed fixture and measurement method are in
[courier-scale-results.md](courier-scale-results.md). The T090 security matrix and its
PostgreSQL/S3 setup are in [courier-security-results.md](courier-security-results.md).

The initial capacity command completed on 2026-10-21 at 11:00:08 local time (10.94 s suite
duration). An authorized reporting rerun completed at 11:01:06 (8.53 s); its test output
reported the operation timings above. Both runs passed the same assertions on the unchanged
fixture and budgets.


## Owner-reported access check — 2026-10-21

Samuel reported: “revisada, funciona y abre en android y ios”. Record opening
the local app on both platforms as reported PASS for the access check only.
Current candidate is `phone-20261021-e`; source SHA
`0f075fa48ab8c2b3a202a711ccb2a14f16d84881fbb202478df35c730b3d70f5`.
Reported device text: “iphone 15 - 17 pro max. Pixel 10 y 10 Pro”. Provisionally
record iPhone 15, iPhone 17 Pro Max, Pixel 10 and Pixel 10 Pro as four models; exact
OS/browser versions, sign-in state, certificate trust method and installed-PWA
state have not yet been supplied. No timing, offline/restart,
photo, synchronization or push result was reported. All 21 scenario rows remain
unexecuted; opening alone does not complete scenario1 or T093/T087.

## Physical acceptance protocol — pending owner execution

Samuel operates the real Android and iPhone. Browser automation and the local
HTTPS verifier do not complete T093/T087. Root must accept the current target
and G0 before offering the URL. Record the exact run/build and device model, OS,
browser version and installed-PWA state before starting each device's cases.

The first access check verifies trusted HTTPS, sign-in and route rendering only.
Do not consume the acceptance shipments during it. Prepare separate synthetic
fixtures for multiple pickups/deliveries, both couriers, corrections, amounts and
returns before running the full scenarios. No production accounts or secrets.

For T093, record 360/390 CSS px, light/dark/high contrast, one-handed reach,
48px targets, primary-action taps, native scrolling, offline/reopen/device restart,
photos and synchronization. Walk a complete route online and offline; compare
every courier screen with `docs/design-system.md` and panel additions with feature 002.
Measure SC-002 deliveries without COD including the photo (<30s), and
with cash COD (<45s), using the same documented start/end for every measurement.
Record failures and blocked prerequisites explicitly; preserve diagnostics.

Scenario13 needs the next real service day; schedule it within the accepted TLS
validity. Scenario21 needs a separately reviewed synthetic session fixture with
a nearby future `expiresAt` in the isolated DB before the phone loads that session.
Record real server time, create pending work offline before expiry, wait for real
expiry, then reconnect and observe 401 followed by sign-in as the same courier and
successful synchronization of the preserved work. Do not change application auth
configuration, fake clocks or bypass cookies.
Push cases require actual permission and delivery on each installed device.

### Agent browser preflight — local e candidate

At the owner's request (“hazlo tu”), root used the in-app browser to sign in
with the original synthetic courier and navigate Mi ruta → Pendientes → Mi día.
Sign-in/navigation succeeded; Pendientes showed no unsynchronized records.
Mi día showed one existing delivery, COP 50,000 cash and zero pending stops;
Mi ruta had no dispatched route. These are observed server/UI baseline facts,
not evidence of the owner's timing/device-specific actions. Existing history
and records were preserved.

The browser initially rejected the local CA. The owner personally selected
Proceed; root did not bypass the security interstitial. This browser exception
does not validate certificate trust or PWA installation on any device.

Root inspected standard and high-contrast Mi día at actual 360×800 and 390×800
CSS viewports, confirmed document width equals viewport width, and used native
scrolling to expose every financial row above fixed navigation. The existing
browser zoom required viewport capability values 468/507×1040 to obtain those
actual CSS sizes; raw override values were not mislabeled as CSS measurements.
The native AX tree described contrast as a checkbox while DOM exposed a button;
a failed checkbox locator was corrected using the observed DOM button. No
product defect or forced click is inferred. Contrast was restored to its
original off state. No permission/push prompt was accepted.

Saved screenshots under `.git/local-orchestration/`:
`t093-ui-mi-dia.png`, `t093-ui-360-standard.png`,
`t093-ui-360-high-contrast.png`, `t093-ui-390-standard.png` and
`t093-ui-390-high-contrast.png`. These are Chromium/browser checks, not physical
Android/Safari tests. Camera, offline/restart, delivery timing, dark mode and
all full scenario outcomes remain pending. T093/T087 are not closed.

### Independent T093 fixture preparation approved

Executor N1 ran exactly one fresh setup using the reviewed private helper
`ed329fa671f15a1ced47ca96a3ce5e18353d880b0f09e4d7d62051ee5771d276`.
It exited 0 with empty stderr; UUIDs/inputs/checkpoints were persisted before
mutations, original route unchanged. Source/build identities remained sealed.
Private manifest and device-access file are 0600; QA directory 0700.

Root independently authenticated through real CA-verified HTTPS and checked:

- Four distinct native user-to-courier links and four isolated in-progress routes.
- Sixteen shipments, COD 0/50000/25000/0 per route; one pickup and four delivery stops.
- Eight pending tasks per route, zero courier records, no custody or handovers.
- Exact native history: created→registered, registered→assigned, assigned→dispatched.

The first root audit incorrectly expected assigned/dispatched as event types.
Native source shows status_changed with fromStatus/toStatus; root corrected
the assertion to validate all three exact event transitions. That diagnostic
is retained; no product/fixture edits or setup retry followed. The corrected
read-only audit exited 0 and wrote a private sanitized root-audit.json.

Root then signed in through the visible browser with the pixel-10 fixture
account, saw Ruta 4 with 0/5 completed stops, inspected all four pickup entries
and returned without confirming actions. Confirmar recogida buttons measured
approximately 48 CSS px high (47.9988 from zoom/subpixel rounding). The four
phone fixtures remain unconsumed. Saved proof: t093-ui-route-ready.png.
Browser viewport and contrast were restored; the tab remains open for review.

Evidence: `.git/local-orchestration/t093-live-prepare-ed329/`,
`t093-root-audit.log`, `t093-root-audit-event-type-assumption.log`; private
QA state is under `.git/local-phone-target/phone-20261021-e/qa-t093/`.
The access file contains synthetic credentials and is not copied into this
receipt. None of this closes physical T093 or any T087 scenario.

### Isolated agent browser journey — 2026-10-21

Root completed a separate fifth `agent-browser` fixture through visible controls,
preserving the four phone fixtures. Independent Luna N1 reviewed the helper delta
and ran one fresh setup; root N2 verified its initial native route/history before
any courier action. Helper SHA:
`229ab8ba14b2386198176fc43b6910070342dcc66f59016e161c3b2fd5b7ee8c`.
Setup evidence: `.git/local-orchestration/t093-browser-prepare-229ab8/` and
`t093-browser-root-audit.log`.

Observed interface results on Ruta 6:

- Four pickups saved and synchronized through explicit confirmation buttons.
- Three deliveries confirmed: COP 50,000 cash, zero COD with a synthetic image,
  and COP 25,000 cash. Each review showed recipient, amount, payment and photo state.
- One explicit “Destinatario ausente” exception saved with its custody warning.
- The route completed automatically; Mi ruta showed no dispatched route.
- Mi día showed three deliveries, one exception, COP 75,000 cash and zero pending
  stops. Pendientes showed all records and photos synchronized.

Delivery without optional image interactions and the exception each used three
primary taps from Mi ruta through explicit final confirmation. The photo used
the existing public `apps/web/public/icons/icon-192.png` through the native file
chooser; it was not a camera capture or a personal photo. The fixture named
`offline-photo-cod` was delivered **online**: this browser exposes no offline
control. No offline, physical restart, camera, push or SC-002 timing result is
inferred. No camera/location/notification permission was accepted.

Screenshots in `.git/local-orchestration/`: `t093-browser-cash-delivery.png`,
`t093-browser-exception.png`, `t093-browser-photo-review.png`,
`t093-browser-completed-mi-dia.png` and `t093-browser-completed-pending.png`.
Viewport was restored and the summary tab retained.

Post-action double QA passed. Luna N1's native HTTPS auditor and root N2's
independent execution both exited 0 and produced equal sanitized reports:
eight unique applied courier records (four pickups, three deliveries, one
exception), matching event timestamps/authors, a finished route/event and correct
summary/custody. The proof is an uploaded JPEG, 3,195 bytes with start/end markers,
served to the owner with HTTP 200 and `private, no-cache, no-store, must-revalidate`.
Anonymous access returns 401; another courier and the original courier after
route completion both receive 403, as required for finished work. This verifies
conversion/private access for this small image, not a camera compression benchmark.
Root's separate audit also confirmed the 16 phone shipments remain dispatched
with zero records, and recomputed source/schema/lock/build seals without changes.

Exact commands: `node --check .git/local-orchestration/t093-postjourney-photo-audit.mjs`
and `node .git/local-orchestration/t093-postjourney-photo-audit.mjs` (N1); root
reviewed that helper and ran the same commands for its `-root-n2.mjs` copy, changing
only the fresh report filename. Helper SHA
`0efff2a0460cbf669e06c9ce47cf1eaa05063d3d7f64216fbedac28dd86dfeb3`;
root copy SHA `2ede15f4cf935bae9d4a5d2ed2617164b65944c7a0ff72464e77f4413cf148de`.
Reports: `t093-postjourney-photo-audit.json` and
`t093-postjourney-photo-audit-root-n2.json` under `.git/local-orchestration/`.
Audits create ordinary authentication sessions and snapshot reads may update
`lastSyncedAt`; they do not create courier records or alter route/custody history.
No application changes required a new global-gate run. Browser success does not
close physical T093/T087. Catalog remains 43/81 (53% by count).

### Reported device inventory (provisional)

| Device model | OS / browser version | Login / PWA installation | T093 result |
| --- | --- | --- | --- |
| iPhone 15 | Not reported | Not reported | Not run |
| iPhone 17 Pro Max | Not reported | Not reported | Not run |
| Pixel 10 | Not reported | Not reported | Not run |
| Pixel 10 Pro | Not reported | Not reported | Not run |

The owner's original model wording is retained above. Access is reported by
platform; do not infer that every listed model completed every check. The
preparation uses one independent fixture per provisional device identity.

### T093 measurement method (defined before execution)

Use a distinct synthetic account/courier/route for each reported device; keep the
original e account and its route untouched. New device fixtures are preparation,
not evidence of human completion. Before changing accounts, pending work must
finish synchronizing under its original account. No deletion of IndexedDB/outbox.

For each SC-002 measurement, begin at the first intentional tap opening the delivery
from Mi ruta, with the route already loaded. Stop when the confirmed action is shown
as saved locally. Include all required data entry and, for no-COD, actual camera/photo
capture; record sync time separately. Keep each observed trial and any failure,
without selecting only the fastest. Target: no-COD including photo <30s; cash COD <45s.
Count all normal-flow taps from Mi ruta through explicit final confirmation; record
optional edits/photo interactions separately from the primary-action tap count.

Record each device's actual viewport; do not infer 360/390 CSS px from its model or
label a desktop emulation as physical evidence. For light/dark/high contrast,
check all courier screens, one-handed reach and native scrolling. Walk the whole
route with online and offline segments; photograph only neutral synthetic items.
Pending actions/photos must survive app reopen and a real device restart, then
automatically sync once on reconnection. Root will inspect backend effects/history
and the dispatch panel, independently of the owner's physical observations.

| Quickstart scenario | Android | iPhone | Evidence / timing |
| --- | --- | --- | --- |
| 1 | Not run | Not run | Pending |
| 2 | Not run | Not run | Pending |
| 3 | Not run | Not run | Pending |
| 4 | Not run | Not run | Pending |
| 5 | Not run | Not run | Pending |
| 6 | Not run | Not run | Pending |
| 7 | Not run | Not run | Pending |
| 8 | Not run | Not run | Pending |
| 9 | Not run | Not run | Pending |
| 10 | Not run | Not run | Pending |
| 11 | Not run | Not run | Pending |
| 12 | Not run | Not run | Pending |
| 13 | Not run | Not run | Pending |
| 14 | Not run | Not run | Pending |
| 15 | Not run | Not run | Pending |
| 16 | Not run | Not run | Pending |
| 17 | Not run | Not run | Pending |
| 18 | Not run | Not run | Pending |
| 19 | Not run | Not run | Pending |
| 20 | Not run | Not run | Pending |
| 21 | Not run | Not run | Pending |

Every row refers to the unchanged steps and expectations in [quickstart.md](quickstart.md).
A passing setup check cannot fill these cells. Add dated actual results and private
artifact paths without passwords, cookies, tokens or real recipient data.
