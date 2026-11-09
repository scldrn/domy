# Project status

Where Domy stands and what comes next, so any session can resume without the conversation
that produced it. Updated 2026-11-09 (America/Bogota); update it whenever a slice is merged or the next step
changes.

**Latest audit: [production-readiness audit of 2026-11-02](production-readiness-audit-2026-11-02.md).
Its software blockers are resolved on `main`; physical acceptance and owner inputs remain.**
**Owner decision of 2026-11-02: the courier app must work offline, installed or in the browser; the
panel stays online-only. This reverses the online-only release recorded below.**

## Features

Work follows Trunk-Based Development (constitution 2.0.0): every slice lands on `main` through
a short-lived branch, so the specification and implementation of every feature live on `main`.

| Feature | State |
| --- | --- |
| 001 Shipment registration | 27 integral catalog tasks verified locally; latest T139/T146 regression closure is recorded below. Consolidated and release-review validated |
| Panel identity (design) | On `main` (`c363847`); rules in [design-system.md](design-system.md) |
| 002 Routes and dispatch | 2 integral catalog tasks verified locally, including aggregate overflow and traceability; retain historical feature receipts |
| 003 Courier app | T093/T087 physical acceptance, now including offline, and dependent T088 closure remain open |
| 004 Tracking page and merchant link | T034 physical acceptance and dependent T035 closure remain open |
| 006 UI redesign | Every user story on `main`: US1 board (#53–#56); US2 daily operation (#57–#63); US3 courier app (#64, #65); US4 public pages, sign-in and the courier waiting page (#70, #71); US5 master data and administration (#75, #76, and this slice). Guards for identifiers, dark and narrow widths (#69), live search and last update (#73), load test (#72). Open: polish T068–T071, T052 and T001 (phone measurement), a full CI run |

## Next step

Feature 006: every user story is implemented (US1–US5, the last on 2026-11-09). What remains is
the polish phase (T068 coherence review with the owner, T069 timed walkthrough, T070 docs, T071
deleting what the redesign left unused and the size comparison), T052 and T001 (the physical
phone measurement), and one full CI run on `main` to close the feature. Every public change
keeps the 3-second cold start of `tracking-page.spec.ts` green (~2.3 s now). Route files export
only `Route`, never reference an imported value at module level (helpers and `typeof` in types
go in `features/`), and `routes/root.tsx` stays empty of UI: anything else there loads with
every public page; a test caps the modules every page preloads at 20 (17 today). Each passing e2e test checks its last screen in dark and at the narrow widths
(`checkScreen` in `fixtures.ts`), and test data never embeds a whole UUID.
The [load test](load-test.md) of 2026-11-09 holds ten times Cohex's busiest day with no errors;
rerun it on the production machine before go-live.
`pnpm audit --prod` reports two moderate advisories in `glob` and `minimatch` under
`@sentry/node` 11.1.0's bundler plugins, a path the server never feeds outside input; Sentry
11.11.0 (released 2026-11-05) fixes them, so upgrade `@sentry/node` and `@sentry/react` together
once that release has aged.

## History

Earlier checkpoints (features 001–004, the local release review, and the owner decisions of
October) are in [archive/status-history.md](archive/status-history.md); superseded plans are in
[archive/](archive/).
