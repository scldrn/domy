# Notification browser RED verification — 004/T019

Date: 2026-10-22, America/Bogota. Accepted only as a test-first deliverable.
The `/notificar` page and notification actions are not implemented or passing.

Three real-fixture browser cases specify five shipments across two merchants,
native WhatsApp popup and clipboard, new-only/all-date composition, notified
status/time, shipment tracking copy, missing-phone support,21-entry compact text,
working public destinations, and stable-UUID lost-ACK recovery after navigation/
reload. The same-tap check holds the actual POST transport behind a promise gate
until the external popup opens; external WhatsApp is intercepted without sending.
The lost-ACK case uses the real POST through `route.fetch()` and drops its response.
Phone-width320px axe checks remain, without forced input or added exclusions.

Before execution root reviewed and corrected latent test issues: the independent
scenario now creates five shipments; singular/plural counters are complete;
notification time comes from the actual shipment-detail API by UUID and is scoped
to its definition row; popup interception is polled and cannot depend on a fast
mark response. No obsolete fixed server-start timestamp is assumed.

Executor N1 and root N2 both collect3 intended missing-page failures. All fixtures
complete and each test reaches the rendered `Esta página no existe` fallback when
expecting the initial `/notificar` heading. N1 case durations5.9/5.6/5.3s; root
5.7/5.6/5.3s. There are no setup/import failures or retries. All later message,
popup, clipboard, timestamp, privacy, axe and recovery assertions remain blocked,
and are not claimed passing. Both levels pass scoped format/lint/web typecheck.

```bash
env -u CI -u NO_COLOR pnpm --filter @domy/web exec playwright test tests/e2e/notify-merchants.spec.ts --retries=0 --reporter=list
pnpm exec prettier --check apps/web/tests/e2e/notify-merchants.spec.ts
pnpm exec eslint apps/web/tests/e2e/notify-merchants.spec.ts --max-warnings 0
pnpm --filter @domy/web typecheck
```

Browser command intentionally exits1; static checks exit0. Final test SHA-256:
`ec73e8f7f86b7bd9a30ba35d78e84f5cbc8be591310a82368b0a1b6c9768a760`.
Logs/full original and root traces were archived before future browser runs under
`.git/local-orchestration/notifications-t019/`.
T021 may implement the API after its contract alignment; T022 waits for verified
T021. No physical, external-message-delivery, remote CI or deployment evidence.
