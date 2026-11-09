# Baselines

Measures the redesign is checked against (T001, research R12, SC-006, SC-008).

## Bundle size (`apps/web/dist/assets` after `pnpm build`)

Baseline: commit `4af0a07` (#52), the last `main` before feature 006 changed code. Sizes in
bytes; gzip is Node's default level.

| Build | JavaScript | JavaScript gzip | CSS | CSS gzip | JS + CSS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline `4af0a07` | 1 535 466 | 508 622 | 105 293 | 17 993 | 1 640 759 |
| After daily operation (T046, 2026-11-08) | 1 641 093 | 545 680 | 121 891 | 20 567 | 1 762 984 |
| Change | +6.9 % | +7.3 % | +15.8 % | +14.3 % | **+7.4 %** |
| Every story (T071, 2026-11-09) | 1 696 667 | 573 187 | 127 506 | 21 304 | 1 824 173 |
| Change | +10.5 % | +12.7 % | +21.1 % | +18.4 % | **+11.2 %** |

Budget (R12): the total grows at most 10 %. Within budget after US1 and US2; **1.2 points over
it with every story**, measured by T071. No module is duplicated between chunks, and the
growth is the redesigned screens' own code (`src` is the largest share) rather than a new
library. What every page loads is what the cold start pays for, and it stayed at the level
#66 left: 25 files, about 200 KB gzip, the public tracking page at about 2.3 s on the weak
connection, and a test caps it at 20 preloaded modules. Getting back under 10 % would mean
trimming screens or replacing a library (`cn`, `read-excel-file` and `@sentry/*` are the
largest candidates), which is left to the owner's decision rather than done before the
client demonstration.

## Still to measure

- Step count of each daily flow before the redesign (register, bulk register, edit, create and
  dispatch a route, find a past shipment, notify; SC-006).
- The courier route screen's time to first content on a real low-end Android phone (Android
  10+, Chrome, installed app, mid-signal 4G, median of 5 cold opens; SC-008). It joins the
  pending physical tests and needs the owner's phone.
