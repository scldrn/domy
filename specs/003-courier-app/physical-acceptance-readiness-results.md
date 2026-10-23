# T093/T087 physical acceptance readiness

Date: 2026-10-22 (America/Bogota). This is a static fixture and target audit. No
database, app, browser, build, or Docker operation was run. No phone scenario or
catalog task is marked complete here. The [quickstart result matrix](quickstart-results.md)
still has all 21 physical scenarios Not run.

## Candidate and preserved fixture boundary

| Candidate | Origin and database | Reuse for this batch |
| --- | --- | --- |
| Current LAN candidate: [`phone-20261022-public-b`](../004-tracking-merchant-link/local-target-current-network-results.md) | `https://192.168.58.219:8445`; distinct B PostgreSQL container on loopback `15435`; local push disabled. | This is the target Root accepted for the local LAN batch. It has separate target state and database; E's route rows are not present by inheritance. Root must confirm current target and G0 before offering its URL to the phone operator. |
| Preserved 003 candidate: [`phone-20261021-e`](local-target-rehearsal-results.md) | `https://192.168.58.219:8443`; separate E PostgreSQL container. | Preserve its four per-device courier accounts/routes and 16 shipments. Do not mutate them or read/copy private credentials. Its fixtures do not prove the B build and are not in B's database. |

B's recorded source/schema/lock/build digests are `a708ba74689f8d6a0c9948e7d10f7e39d2c25974c30adb796246b68bc7919e28`, `44c18a4b09d70a6988a18a12b01f970a9bd8e673aaf682a600e954f0370b3a07`, `50f41517a321ef8cb3b6e005e9672ea08703ae302585e8d87ea7864c7ef5b718`, and `fc6224baced85c2ef82de932f3e57dd91a56477fadacdedb0c8637f4e9c52584`; its 523-file technical baseline is `2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6`. E's recorded source/schema/lock/build digests are `8d58f5e7ca62ac1dedcf2d37628e471ed4f5dd27b66e714da347284bd1aecabd`, `cc196c6db44a62fb93b867c6cd138632db23033658b9d3221dc8070cbccb3805`, `50f41517a321ef8cb3b6e005e9672ea08703ae302585e8d87ea7864c7ef5b718`, and `9ccfb13a7c54dd27d48cc4c1fdfe75f17c8913d98e06eaf8fe7359ef1b523020`. The B and E build/source/schema seals differ.

The recorded old T093 fixture starting state comprises four isolated couriers and routes, each with four shipments
(COD COP 0/50,000/25,000/0), one pickup stop and four delivery stops; there are eight
pending tasks per route and no courier records, custody, or handovers. It is a usability
fixture, not the full T087 dataset. The private setup helper is hardcoded to run
`phone-20261021-e` and its `:8443` origin (`.git/local-orchestration/t093-live.mjs`), so
running it again would target the preserved E run, not B. Static syntax validation only:
`node --check .git/local-orchestration/t093-live.mjs` passed.

The current B receipt is the source of truth for B's run ID, LAN address, and sealed
digests. The E seals above are historical. Do not substitute the old target's certificate,
credentials, database, or service date when testing B.

## Physical evidence still needed

The four provisionally reported models are iPhone 15, iPhone 17 Pro Max, Pixel 10 and
Pixel 10 Pro. Their exact OS and browser versions, trusted-certificate method, login state,
and installed-PWA state are not recorded. No physical camera, offline/reopen/restart,
location, push-permission, or push-delivery result is recorded. Existing Chromium checks
and the owner-reported app opening do not fill physical scenarios. Public B has local push
disabled, so its current configuration cannot establish scenario 14's closed-app push
delivery. If that part is scheduled, it needs a separately approved synthetic local-push
target and actual device permission/delivery; that would not establish production/provider
delivery.

Across the scheduled physical devices, record the real viewport and 360/390 CSS-pixel
checks where applicable, light/dark/high-contrast appearance, one-handed reach, 48px
targets, native scrolling, taps, camera/photo result, sync time, offline/reopen/restart
survival, and exact device/browser/PWA state. Measure SC-002 using the existing
[quickstart method](quickstart-results.md): no-COD with actual photo under 30 seconds;
cash-COD under 45 seconds; record every trial and sync separately. Do not use browser
emulation as physical evidence.

## Fixture prerequisites by scenario

Use fresh synthetic rows in the selected isolated target only, with a date chosen when the
phone window is scheduled. Persist generated IDs and exact action bodies privately before
the first write; verify initial route/history/custody and source/build seals before handing
the device to the operator. The matrix below is a preparation plan, not executed evidence.

| Scenarios | Reusable fixture grouping and prerequisites |
| --- | --- |
| 1–7 | One courier can first open the PWA with no dispatched route (1), then receive an ordered route of four shipments and two pickup stops (2). Put three shipments at pickup A and one at pickup B: confirm two of the three at A, leaving that stop pending (3). Use two zero-COD deliveries for photo/no-photo (4), one COP 85,000 shipment for COP 50,000 cash + COP 35,000 company transfer with receipt photo (5), and a second COP 85,000 shipment for COP 80,000 collection plus required note (6). Before picking up the remaining A shipment, attempt its delivery and exercise call/WhatsApp/map shortcuts (7), then continue only after the pickup. Keep the four shipments' recipient, COD, pickup, window, and route order distinct and verified. |
| 8–10 | A separate active route and courier session for offline pickup plus delivery/photo/collection; preserve the resulting pending outbox across app reopen and a real phone restart (8). Keep the records pending to test refusal to sign out (10), then reconnect without touching the app and verify exactly-once sync/history on the board (9). If exercising the US3 addition in 8, provide a second eligible shipment for an exception so three pending records are observable. |
| 11–13 | On an exception-capable route, report one delivery exception plus a pickup problem (11); reuse that delivery for retry and completion, and use a second exception shipment for return (12). A further exception shipment must be rescheduled to the next real service day, received at the office, and added to a route the following day (13). Plan this group against the actual service calendar and TLS validity; do not fake a future service day. |
| 14–18 | For live change notices (14), start with the app open on a dispatched route while the dispatcher adds, removes, reorders, and edits, then close the app before the final add. Actual closed-app notification requires device permission and delivery; current B has local push off. For handover (15), prepare linked couriers A and B, an A-held shipment, B's receiving session/device, and an explicit pending handover. Use separate in-progress route items for offline pickup then dispatcher removal (16), and offline delivery followed by reassignment to B (17). For duplicate offline records (18), sign in as courier A on two phones and use one isolated delivery intent with the second phone offline. |
| 19–20 | For corrections/reverts (19), provide separate package cases for earlier-time office entry, collected-amount correction, and package-delivery revert. Provide three errand cases: original route still in progress with the same courier, original route completed, and original route now assigned to a different courier. For the day summary (20), use distinct deliveries for COP 100,000 cash, COP 50,000 company transfer and COP 30,000 merchant payment, plus a COP 12,000 disbursement; compare the expected COP 88,000 cash-to-deliver total including pending records. |
| 21 | Use one synthetic courier session on the isolated candidate, retain its original session ID/expiry privately, and create pending work while the route is loaded. Only after a separately reviewed, scoped fixture setup changes that session row to a nearby future expiry, wait for real wall-clock expiry; observe the real Better Auth 401, sign in again as the same courier, and confirm the pending work synchronizes once. Do not change global auth TTL/configuration, bypass cookies, or use `DOMY_FAKE_NOW`. No session-row change has been made. |

The two-pickup route shape for scenarios 2–7 is not provided by the old per-device
fixtures: scenario 3 needs three shipments at one pickup stop and another shipment at the
second pickup stop, while the route has four distinct delivery stops. The older static
fixture plan explicitly calls for this separate four-shipment route. Stateful scenarios
8–21 need additional isolated rows or groups as mapped above; do not assume that consumed,
reassigned, completed, or returned rows can be reused as a clean starting state.

## Next local steps when phones are scheduled

1. Root rechecks the current LAN address, run/build identity, and acceptance of B/G0;
   record each device's exact OS, browser, trust method, and PWA installation state before
   any sign-in. If the address or candidate changes, stop and use the new accepted receipt.
2. Decide the scenario order and actual service date. Root reviews a B-specific, private,
   date-at-execution fixture plan/helper and its exact write set before any fixture setup.
   Do not run the E helper, create the large fixture set now, or prepare scenario 13/21
   until their dates and reviewed prerequisites are known. Keep E, source A, 003, and
   development resources untouched.
3. After a scoped Root grant, execute only the reviewed B fixture setup once; then verify
   links, route/shipment IDs, pickup/delivery stop counts/order, COD, initial history, and
   zero courier records/custody before device use. On any ambiguous mutation, retain
   private checkpoints and stop for review rather than retrying with new IDs.
4. If scenario 14's push case is in scope, separately prepare and accept an isolated
   local-push-enabled candidate before the phone test. Keep push/provider delivery claims
   explicitly limited to the mechanism actually exercised.
5. Have the owner perform the scheduled physical cases, preserving failed trials and
   pending work. Root independently verifies backend effects, synchronization and route
   history for each stateful group. Record blockers and evidence paths without passwords,
   cookies, tokens, addresses, or real recipient data; leave the 21 result cells and
   reviewer checklist unchanged until each scenario has real evidence.

This readiness receipt makes no phone-trust, physical usability, camera, offline, push,
provider, RPO, production, or G1 claim.
