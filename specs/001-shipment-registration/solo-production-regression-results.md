# Solo production regression results

Verified 2026-10-23 in `chore/deployment-readiness-verification`, based on `f0bc5ac`.
The owner requested solo execution; no independent subagent review is claimed.
Root implemented RED/green corrections, then inspected the diff/contracts and ran
all local gates on the same frozen source. No remote CI or production operation.

## Findings and corrections

- Restored eight files byte-for-byte against the previous verified manifest after
  nine web type errors exposed a source-version regression. Original bytes and
  matching Git blob hashes are retained privately; unrelated work is preserved.
- **001/T139:** decoded pagination JSON now passes a Zod date/UUID tuple before
  PostgreSQL. Six malformed shapes return safe Spanish 400 errors.
- **001/T146:** native Better Auth password verification and counters execute in a
  transaction under a normalized-email advisory lock. Twelve simultaneous failures
  yield four 401 responses and eight 423 refusals; the fifth failure commits the
  lock, correct credentials remain locked, existing sessions survive, and the
  fixed 15-minute expiry permits later access.
- **001/T070/T073:** concurrent identical edit/void UUIDs return successful replay
  with one version increment/event. Different concurrent intents still conflict.
- **001/T083/T086:** filtered SQL subqueries avoid the PostgreSQL parameter limit;
  native Maps group histories without repeated full-array scans. CSV includes all
  66,000 shipments; a separate 15,000-shipment history case preserves timestamps.
- **003 history regression:** equal-clock visible events retain stable order after
  invisible receipt insertion, using event UUID as the final detail sort key.

Native production-origin controls pass three cases in separate production Node
processes. The exploratory foreign-redirect failures arose from Better Auth's
explicit test-mode bypass; no duplicate application URL validator was added.
Permanent regressions replace four exploratory probes, whose exact bytes remain
archived. Initial RED, lint failure and integrated history failure are retained.

## Final verification

| Command | Result |
| --- | --- |
| `pnpm check` | PASS: formatting, lint, strict types |
| `env -u NO_COLOR pnpm test` | PASS: 424 domain + 820 server + 382 web = 1,626 |
| `env -u NO_COLOR -u CI pnpm test:e2e --retries=0` | PASS: 154, zero retries; 10.2 minutes |
| `pnpm build` | PASS |

Cold tracking measured 2,912.1 ms against the unchanged 3,000 ms budget.
The 540-file before/after manifest is identical:
`36ef1cd6ec355a7ee7e58009388a6990352e810ecf8754ec19bce5c63f26087c`.
Private evidence: `.git/local-orchestration/readiness-solo-20261023/`, including
`check-final.log`, `test-full-final.log`, `e2e-full-final.log`, `build-final.log`
and source manifests. No skipped final-suite cases or retry-green closure.

001/T139 and T146 are reclosed after this verification. Five catalog tasks remain
open for actual phone acceptance and dependent final closure; neither browser
emulation nor the [image upgrade](../004-tracking-merchant-link/local-image-upgrade-results.md)
closes them. These are local candidate results, not production approval.
