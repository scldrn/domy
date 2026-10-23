# Public tracking story local acceptance — 004/T016

Date: 2026-10-22, America/Bogota. Dirty local base94a7e24.

The public page consumes the inferred Hono query through one query-options
definition. Route prefetch overlaps the anonymous API call and lazy component
loading; protected route guards were not changed. It renders only domain-approved
status/destination/queue/COD/courier/support fields with shared display formatters.
Errors hide stale data; all states retain the generic heading. Polling continues
every30seconds while visible, including expired links that may become current
after a record revert. Spanish next actions, 48px contacts and explicit anonymous
axe scans remain. No session query, private photo or other shipment is shown.

Executor N1 reported8/8 integrated E2E passing in1.4min (3 foundational public
privacy/worker cases,5 tracking journeys). Its wrapper failed afterward assigning
zsh's readonly status variable; the retained Playwright output is8PASS, not a
claimed successful wrapper exit. A safe metric log line was added afterward
with scopedformat/lint checks; root's full final-source run validates that source.
All failures and traces remain in .git/local-orchestration/public-t016/.

Root corrected queue phrase markup without changing the exact assertion, expired
polling, a canonical reprogrammed-state expectation after revert, and measurement
precision. The original before-navigation monotonic start, cold anonymous context,
250ms latency,1.5Mbps download and <=3000ms bound remain. Native frame visibility
is captured before the retained exact visibility assertion so assertion retry
backoff is not measured as loading. Protocol and evidence rationale are in plan.md
and research R20; no threshold/cache/fake-response shortcut was introduced.

Root independently reviewed all final source and ran all four gates, sequentially:

```bash
env -u NO_COLOR pnpm check
env -u NO_COLOR pnpm test
env -u CI -u NO_COLOR pnpm test:e2e
env -u NO_COLOR pnpm build
```

All exited0: fullformat/lint/stricttypes;1472tests (396domain/723server/353web);
138first-attemptE2E in8.9min; productionbuild. No errors/warnings. Cold status
readiness was2803.4ms, under3000ms. Real lifecycle refresh and expired-link
reactivation each passed without reload; recipient/courier privacy and actual
rate limiting passed. PostgreSQL and private storage are real disposable services.

The492-file build/test input manifest is identical before/mid/after all gates:
49e15ee7425b719e4d76ed4a5f46edaf0b4c15dd68a0ca47e64e805c2e6dbac7.
Logs and manifests: .git/local-orchestration/public-us1-full/.
Final owned-file SHA-256:

- public/api.ts:618d1e4f16f7fb55f975ae4d18a3c2d3d5b44d8dc3483bbb14098a27d49411a9
- tracking-status.tsx:55233c56db7ad74e97aa631285c50997547c5372efeda7ff71f7597552cec369
- routes/tracking.tsx:6116b8bf20f0eeb7a6aae0577637c88ee98eaa0720d3966d3443c824e462f2bb
- tracking-page.spec.ts:5821bc743482a446616c1eb2e462ad952075c2d97ad3280daec2484118caa115

T016 accepted; T001–T016 are verified by their deliverables. R19 merchant
artifact gate separately passes independent review, so T023/T024/T025 RED
may begin in parallel (native DB/build/E2E executions serialized). Catalog59/81
verified (73%),22open. No remoteCI, deployment or physical acceptance; the
sealed003 LAN candidate remains unchanged. Deferred003 and004 physical/final
gates remain open.
