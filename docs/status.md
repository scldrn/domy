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
| 006 UI redesign | US1 (board, #53–#56) and US2 (shipment form #57, bulk #58, detail #59, «Rutas» #60, «Historial» #62, «Notificar clientes» #63) on `main`; US3 courier shell, «Mi ruta», «Parada» (#64), «Mi día» and «Pendientes» (#65) on `main`. The public cold start has ~700 ms of margin under 3 s (#66). Every e2e screen is checked for identifiers, dark, and narrow widths (T003, T004, #69). US4 complete: «Seguimiento» and «Enlace del cliente» (T053, T054), sign-in screens and the courier waiting page (T055–T057). Open: US3 T052 (phone measurement), US5, polish, the top bar's search results and last-update status (T019), state marks restyle (T018), setup T001 |

## Next step

Feature 006: US4 is complete (T053–T057); the top bar's search results and «Actualizado hace» (T019) and the restyled marks and states (T018) are on `main`. The US5 proposals (T061, T063, T065) are published for the owner (artifact v28); their screens follow his decision. US5 started apart: the audit
log's names come from the server (T058, T060); the screens wait for their proposals (T061–T066). Every public
change keeps the 3-second cold start of `tracking-page.spec.ts` green (#66 left ~700 ms).
Route files export only `Route`, and `routes/root.tsx` stays empty of UI: anything else there
loads with every public page. Each passing e2e test checks its last screen in dark and at the
narrow widths (`checkScreen` in `fixtures.ts`), and test data never embeds a whole UUID.
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
