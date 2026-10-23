# T136 — Inferred RPC Response Boundaries

## Scope and design

Task: `001/T136`, IV-33, Constitution V; preserve FR-038/FR-042 retry identities,
transactional behavior and Spanish errors. This slice changes response typing and
unknown-response validation, not account idempotency (`001/T132`) or persisted drafts
(`001/T137`). The orchestrator approved the design before production edits.

Inventory: JSON callers in shipment registration/detail, bulk, history, master data,
routes, dispatch board and courier push configuration; bodyless push mutations;
Better Auth session/sign-in/account/password HTTP callers.

- `unwrap` accepts Hono's `ClientResponse<T, StatusCode, "json">`, returns its native
  `json()` result, and never casts JSON to a caller-selected unchecked shape. Consumers
  infer their responses without explicit generic arguments. Shared domain types remain.
- Merchant/pickup/recipient/neighborhood/named UI selections derive from
  `InferResponseType` using indexed access or `Pick`, retaining the endpoint contract.
- Native Better Auth handlers return `Response`, so Hono cannot infer their JSON.
  `authCall` returns `unknown`. Account list/create projections use Zod validation
  checked against native `Auth["api"]` return types; Hono `JSONParsed` represents
  native date serialization. Roles reuse the domain schema. `Auth` has a type-only
  reexport from the existing server entry point; no new dependency or auth wrapper.
- Both Domy and native auth error payloads are validated before use. Invalid/non-JSON
  errors use an actionable generic Spanish message. Structured error details survive.
- Removing explicit `Promise<Response>` from two route/handover helpers preserves
  their native `c.json` types. No route runtime, mount or chaining changed.
- Recipient suggestions contain a neighborhood because the server uses inner joins.
  The autofill's defensive null case is a local UI input derived from that response;
  the RPC type itself is not widened to fit an old fixture.

All nine constitutional principles were considered: no new architecture, domain rule,
transaction, storage, UI design, privacy surface or dependency. Existing read-only
requirements checklists remain untouched. Shared plan/research alignment and task
closure belong to the orchestrator. No critical/high design finding remains within
this slice; broader feature findings remain tracked by their existing tasks.

## Local verification

Evidence: `.git/local-orchestration/t136-*.log` (local, uncommitted).

RED was captured before production changes:

- `pnpm --filter @domy/web typecheck` rejected unknown inferred responses and
  reported unused negative assertions for currently accepted fabricated/native responses.
  Initial test callback annotations were corrected without weakening assertions.
- `pnpm --filter @domy/web exec vitest run src/lib/api-client.test.ts`:
  4 passed, 1 failed; malformed error code reached `ApiError` without validation.

Final Level 1 results after concurrent T152 policies stabilized:

| Local command | Result | Evidence log |
| --- | --- | --- |
| `pnpm --filter @domy/web typecheck` | Exit 0 | `t136-final-typecheck.log` |
| `pnpm --filter @domy/web test` | 237/237, 28 files, exit 0 | `t136-final-web-tests.log` |
| Focused Vitest: RPC, users, sessions, autofill | 34/34, four files, exit 0 | `t136-final-scoped-tests.log` |
| Server Vitest: `tests/routes-create.test.ts tests/handovers.test.ts` | 17/17, real PostgreSQL, exit 0 | `t136-green-server-tests.log` |
| Scoped ESLint `--max-warnings 0` and Prettier | Exit 0 | `t136-green-eslint.log`, `t136-green-prettier.log` |
| `pnpm check` | Exit 0, no warnings | `t136-final-check.log` |
| `SENTRY_DSN='' VITE_SENTRY_DSN='' pnpm build` | Exit 0, no warnings | `t136-final-build.log` |
| Same empty DSNs + `pnpm --filter @domy/web exec playwright test tests/e2e/register-shipment.spec.ts tests/e2e/access.spec.ts tests/e2e/route-build-dispatch.spec.ts` | 26/26, first run, 1.2 minutes, exit 0 | `t136-final-e2e.log` |
| `git diff --check` | Exit 0 | Local terminal verification |

Permanent compile-time checks reject fabricated output, raw `Response`, nonexistent
fields and generic native-auth claims; route/handover assertions reject erased `{}`
outputs. Runtime checks cover native fetch failure, non-JSON errors, bodyless
success/failure, fields/details, account role/date/UUID/nullable-ban validation and
creation identity. Existing session and autofill behavior remains tested.

Earlier full-web/check/build attempts exposed concurrent T152 work in progress; those
failures were reported without modifying that agent's files, then all affected commands
were repeated successfully after its fixes. No E2E was launched against a stale bundle.
The passing E2E output includes the inherited `NO_COLOR`/`FORCE_COLOR` Node warning and
expected native Better Auth invalid-password warnings from the lockout scenario. There
were no test retries, application assertion failures, lint warnings or build warnings.

No remote workflow, push, commit or deployment occurred. Root Level 2 audit and integrated
quality gates own task closure; this receipt does not mark T136 complete.

## Orchestrator verification — 2026-10-20

Decision: **verified locally and approved for dependency unlocking**. The orchestrator
inspected the implementation, native API/SDK contracts, negative checks, scope and
regressions; it identified and required the reporting-site correction before closure.
The final frozen source identity is
`0c356fec6fd3de1daf6df72b359664eff202ad7d88e752b5905f017046f92a6f`
(427 source/config/test files; base `94a7e24`, dirty local branch).

Independent local QA, all exit 0: `pnpm check`; `pnpm test` (282 domain + 631 server +
237 web = **1,150**); `env -u NO_COLOR pnpm test:e2e` (**100/100**, 6.3 minutes, no retries);
`pnpm build`. General commands used explicit empty `SENTRY_DSN` and `VITE_SENTRY_DSN`;
reporting tests captured only in memory/loopback. Logs: `.git/local-orchestration/n2-*.log`.
The final code fingerprint matched before/after verification; `git diff --check` passed.

The owning canonical task is now checked. This is local implementation verification,
not publication, remote CI, provider, physical-device or production acceptance.
