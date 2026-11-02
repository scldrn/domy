# Production-readiness audit — 2026-11-02

Requested by the owner: certify that the software is complete and ready to be sent to
deployment. Deployment itself is out of this stage. Audited commit: `main` `683bad1`, from a
clean checkout, with a synthetic environment only; no provider or real data was touched.

**Verdict on `683bad1`: not certified.** The application worked end to end, but three defects in
the software or its pipeline remained, and the documents claiming readiness were out of date.
Their resolution is under "Resolution" below. The sections after this one record `683bad1` as found.

## Blockers to fix in this repository

| ID | Severity | Finding | Evidence | Proposed fix |
| --- | --- | --- | --- | --- |
| A-1 | High | CI cannot pass on `main`. ESLint runs out of heap in `pnpm check`, so tests, e2e and build never run remotely. The last remotely verified commit is `6b1ec4f`, 11 commits behind `main`; the runs after it were refused for billing. | Run `40068876810` attempt 2 (exit 134, heap limit about 2 GB). Reproduced locally with `--max-old-space-size=2048`. | Give the CI step a larger heap, then read the full run: the runner image moved to Ubuntu 26 and later steps are unverified. |
| A-2 | High | `pnpm audit --prod` fails: `better-auth` 1.7.6 has critical `GHSA-965c-763c-88jm`, high `GHSA-r4xp-prcw-77qf` and low `GHSA-44jh-23m7-hpcf`, published 2026-10-27. | Domy's auth configuration has no Magic Link, OAuth or OAuth Proxy and stores no rate-limit records in the database, so by each advisory's own conditions none applies. The gate is red regardless. | Pin `better-auth` 1.7.7. Do not take 1.7.10 or later yet: 1.7.10, 1.7.14 and 1.7.15 fail two `account-integrity` cases, one of which is the credential-log privacy test (FR-041). With 1.7.7, that file passes (43/43) and nine auth and permission files pass (218/218). |
| A-3 | Medium | Same-id concurrent neighborhood creation can answer 400 instead of 200 (FR-042). No data is corrupted, but the retry reports a false error. | `master-data-idempotency.test.ts:370`: `[201, 400]` in 1 of 2 full server runs, 0 of 9 isolated runs. Probable mechanism, not proven: both inserts pass the `id` check, then the second hits `neighborhoods_name_municipality_key`. Merchants, carriers and rate zones have the same shape of secondary unique constraint. | Write a deterministic RED, then resolve the existing id before reporting a name conflict. |
| A-4 | Low | `seroval` 1.6.8 has two moderate advisories. | `pnpm audit`. An override to 1.6.11 passed the full trial gates. | Add the override. |
| A-5 | Low | Readiness documents are stale: `engineering-handoff.md` (old source hash, image, 1,686 tests, "no new migration") and `status.md` (no PR #43). | Migration `0010` and 1,726 tests exist on `main`. | Rewrite both with the new candidate. |
| A-6 | Low | `apps/server/demo/demo.env` holds a VAPID private key, is untracked and is not ignored, so `git add .` would publish it. | `git check-ignore`. | Ignore the folder. |

Accepted risk to record if the owner agrees: `glob` and `minimatch` (moderate) and `deepmerge`
(low). Upstream has no compatible fix. `glob` and `minimatch` reach production only through
Sentry's bundler plugin, which the server entry point does not load; `deepmerge` is
development-only.

## Verified on `683bad1`

| Check | Result |
| --- | --- |
| `pnpm check`, `pnpm build` | Pass locally; default heap |
| `pnpm test` | Domain 433/433; server 901/902 (A-3); web 391/391 |
| `pnpm test:e2e --retries=0` | 155/155 in 9.9 min; cold tracking 2875 ms (budget 3000 ms) |
| Schema drift | `pnpm db:generate`: no changes |
| Tasks | Only 003/T087, T088, T093 and 004/T034, T035 remain open |
| Traceability | Every FR and SC is cited in code or tests, except SC-008 of 001 and 003 (human training time) |
| Static scan | No TODO, skipped tests, `any` or `@ts-ignore`; no `new Date()` outside the clock |
| Image | Builds for arm64 and amd64 from pinned digests |
| Fresh production stack | Compose config, migrate, seed, Caddy HTTPS, app healthy; no database, storage or app port published |
| Runtime probes | CSP, HSTS, `nosniff`, frame denial; HTTP redirects to HTTPS; `/api/test/clock` 404; public API `no-store` and `noindex` |
| Browser journey on that image | All 15 panel pages load; registered, dispatched; courier pickup; delivery with photo; photo on the panel; public tracking and merchant page. Only expected errors: the 404 caused by the smoke script's own wrong lookup, and the untrusted-certificate error |
| Backup and restore | `backup.sh` plus `restore.sh` into a new database: counts and COP match; refuses the live database |
| Shutdown | Exit 0 on stop; no recipient name, phone or test password in app logs |

Findings of lesser weight: `README.md` calls a repeated seed harmless, but with the app running
`docker compose run app` fails with "Address already in use" because the service has a fixed IP.
Run the seed before `up`. The service worker does not install on an untrusted certificate, the
same condition of the 2026-10-23 iPhone offline failure; with the certificate check bypassed,
Chromium reopens offline. This suggests a cause for that failure but does not prove it on iPhone.

## Resolution

The owner approved correcting every blocker on 2026-11-02.

| ID | Outcome |
| --- | --- |
| A-1 | PR #44. It also fixes what the first full run exposed, in tests that had never run on GitHub: a 38 ms state asserted too late, and a 360 px accessibility path over the default limit (003/T139) |
| A-2, A-4 | PR #45, 001/T157. `better-auth` 1.7.7 and `seroval` 1.6.11 |
| A-3 | PR #46, 001/T158. A trigger-forced regression fails with `[201, 400]` before the fix |
| A-5 | This pull request: handoff rewritten, seed note in the README |
| A-6 | PR #44 |
| C003-5 | 003/T138. Conforms to FR-023; no code change |

Final-candidate rehearsal: arm64 image, fresh stack and browser journey, including offline reopening,
offline delivery with a photo and one applied delivery after reconnecting.

## Outside this repository

These cannot be closed by code and do not block sending the corrected software to deployment,
but they block go-live under the constitution and quote:

- Physical acceptance on real phones and a real domain: 003/T087, T093; 004/T034. Real push,
  mobile data and timings have never been observed. Their closures T088 and T035 depend on them.
- Offline operation: the owner decided on 2026-11-02 that the courier app keeps it, installed or
  in the phone's browser, and that the panel stays online-only. This matches the quote and
  Constitution II and reverses the 2026-10-23 deferral. So physical offline acceptance is required
  again, and the failed iPhone offline reopening is an open defect until retested on a trusted
  certificate. C003-5 also reopens: the phone deletes personal data after 24 hours only when it
  synchronizes (FR-023).
- Decisions and data in `OWNER-REQUESTS.md`: rates (3, 4), courier consent (5), bucket (6),
  dispatcher timings (7), future-dated notices (10), platform and backups (11), logo (8).
- The quote promises automatic backups. The scripts exist; nothing schedules them or copies
  photos. There is also no CD workflow.
