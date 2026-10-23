# Public and panel permission matrix — T030

Date:2026-10-22, America/Bogota. Prerequisites including T022 are verified.
Dirty branch `codex/local-readiness-orchestration`, base `94a7e24`.

## Coverage and review

Only `apps/server/tests/role-permissions.test.ts` changed. Existing001–003
assertions were preserved; its large HEAD diff includes preexisting accepted work.
The endpoint matrix adds notification GET/POST and merchant link replacement.
Native successful fixtures supplement the permission matrix's invalid-body probes.
Owner and dispatcher can mark notifications and rotate links; courier and anonymous
attempts are denied without changing notification fields/events or link/audit state.
Existing matrix/settings cases cover shipment detail/export, merchant detail and
GETsettings for office roles versus owner-only PATCH.

A real PostgreSQL/S3 fixture registers, dispatches, picks up and delivers a shipment,
uploads proof, then anonymously reads all four004 public GETs with200, public
no-store/noindex headers and exact stored image bytes. Unknown/malformed bearer
reads return404/link_not_found. POST/PUT/PATCH/DELETE on each public resource
return404; shipment status/code/version, event rows, photo metadata and bytes stay
unchanged. Source review confirms public handlers only register reads; safe HEAD/
OPTIONS are not treated as mutations. Existing protection/tracking/merchant tests
retain deeper privacy, uniform invalid-link and actual role semantics.

Root clarified ambiguous historical contract wording: existing approved GETsettings
is owner+dispatcher; PATCH remains owner-only. This is artifact alignment, with no
permission/runtime change. New code introduces no dependency, casts or database mocks.

## Double local QA

Both levels ran:

`env -u NO_COLOR pnpm --filter @domy/server exec vitest run tests/role-permissions.test.ts tests/public-protection.test.ts tests/public-tracking.test.ts tests/notifications.test.ts tests/merchant-link.test.ts`

N1:140tests/5files13.81s; root N2:140/5files18.03s, exit0. Both also passed
scoped Prettier, ESLint with zero warnings and `pnpm --recursive typecheck`.
Root inspected the new rows/helpers/two native tests and preserved older coverage.
Source SHA-256 matched before/after root QA:
`985ab6831d58c02c39868f7a0bd7ca3acf8d310b1f938b25647199af07ee39a6`.
Logs:`.git/local-orchestration/public-t030/`; initial passing run and lint
correction remain alongside final N1 and independent root outputs.

T030 is verified locally. No product behavior changed; the prior T022 full gates
remain its historical runtime baseline, not a new full-suite claim for added tests.
Catalog74/81(91%),7open. T032 continues; physical/provider/privacy evidence and
final release tasks remain open. No remote CI, publication or deployment.
