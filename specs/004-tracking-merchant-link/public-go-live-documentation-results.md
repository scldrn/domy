# 004/T033 Go-live documentation results

Date: 2026-10-22. This receipt records the documentation slice only; it is not a task
closure or production-readiness approval.

## Changes

- Updated the [README production section](../../README.md#production) with the production
  `PUBLIC_BASE_URL` requirements, owner-managed support contact, courier disclosure scope,
  and individual-consent prerequisite.
- Linked [owner requests and outstanding courier consent](../../OWNER-REQUESTS.md), [OP-01
  deployment runbook requirements](../../docs/archive/integral-execution-backlog.md#op-01--deployment-upgrade-and-recovery-runbook),
  [OP-04 ownership and privacy prerequisites](../../docs/archive/integral-execution-backlog.md#op-04--business-ownership-privacy-and-visual-inputs),
  and [local deployment inventory](../../docs/archive/local-deployment-inventory.md).

## Contract checked

- `PUBLIC_BASE_URL` is required in production, must use HTTPS, and must resolve to the same
  normalized origin as `APP_URL`. The shared origin schema rejects credentials, paths,
  queries, and fragments; it accepts and normalizes a single trailing slash. Outside
  production, server configuration may fall back to `APP_URL`. Vite embeds the validated
  public origin in the web build, so changing it requires rebuilding that bundle.
- The owner-only **Configuración** page edits the company name and optional support phone.
  Public pages omit phone and WhatsApp contact actions when no support phone is configured.
- Public tracking may expose the responsible courier's first name and phone only when the
  shipment is `dispatched` or `picked_up` on an eligible in-progress route. [Constitution VII
  (version 2.0.0)](../../.specify/memory/constitution.md) and Ley 1581 de 2012 require each
  courier's individual authorization before real details are disclosed. The owner ledger
  records feature approval (“yo lo autorice”) but, as of 2026-10-22, has no individual consent
  receipts or their location. Feature approval is not individual consent.

The statements above were checked against [server env validation](../../apps/server/src/env.ts),
the [shared origin schema](../../packages/domain/src/schemas/public-origin.ts), its
[environment tests](../../apps/server/src/env.test.ts), [Vite origin injection](../../apps/web/vite.config.ts),
[settings authorization](../../apps/server/src/routes/settings.ts), the
[owner-only settings page](../../apps/web/src/routes/settings.tsx), and the
[public tracking projection](../../packages/domain/src/public-tracking.ts).

## Validation and limits

- `git diff --check`: pass.
- Relative Markdown targets in `README.md` and this receipt: pass (external URLs and
  fragments were skipped).
- No runtime, provider, database, device, or production deployment checks were run for this
  documentation-only change. The [local deployment inventory](../../docs/archive/local-deployment-inventory.md)
  is preparatory and is not a completed deployment rehearsal.
- Individual courier consent remains a go-live prerequisite. Do not disclose real courier
  details through production tracking links until those authorizations are collected and
  reviewed. Physical acceptance and final delivery gates remain separate work.

## Orchestrator acceptance — VERIFIED LOCAL

Root independently reviewed the complete README addition and the referenced
origin parser, server configuration, Vite injection, support role boundary and
constitution. A second read-only reviewer found no CRITICAL/HIGH contradiction.
Root repeated `git diff --check` and the32-target relative-link validation:PASS.
README SHA-256 remained
`cb265004e1e16eb88211622049c425e86aaae754f2b581ee76b2f187e824918b`
through review. Existing unrelated README edits are preserved.

T033 closes as a documentation task after both-level QA:76/81(94%),5open.
No runtime/build input changed; the final T032 check/1566tests/153browser/build
receipt remains the technical baseline. Re-running those suites for Markdown
would add no behavioral verification. Actual individual consent is deliberately
not certified:it remains an OP-04/OP-release-evidence prerequisite before go-live.
G1, physical T034, deferred003/T093/T087/T088 and finalT035 stay open.
