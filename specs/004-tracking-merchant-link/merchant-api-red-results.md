# Merchant endpoint integration RED — 004/T024

Date: 2026-10-22, America/Bogota. Local dirty base94a7e24.

Executor and root independently ran:

```bash
pnpm --filter @domy/server exec vitest run tests/merchant-link.test.ts
```

Both collect9 cases:6 intended absent-route failures and3 baseline passes. Root
duration10.34s; executor9.97s. Missing list/stream/rotation yields404 instead of
200, and valid-code out-of-window dates yield404 instead of422. Unknown/foreign,
older-window and deactivated-merchant baselines pass with inherited uniform404;
individual shipment tracking remains active. These passes are not proof of a
merchant implementation or its eventual isolation predicates.

Fixtures use real PostgreSQL/private S3, actual registration/dispatch/courier/photo
operations, parameterized code reads and finally-restored clocks. Executor corrected
a missing Amy tariff override reason; root review requested the Node crypto import,
removal of redundant post-assertion returns and finally cleanup. The original defective-fixture run is preserved separately.
Root added the retained-S3/reverted-proof case: after a successful owned stream,
revert must deny the old proof while bytes remain. In RED the first missing stream
assertion blocks that later revert; rotation replays and later boundary assertions
likewise must execute and pass under T027, and are not claimed executed now.

Both scoped Prettier/ESLint/server types pass. Root additionally ran recursive
all-workspace types successfully after T025's temporary authoring errors were
corrected. Root inspected the final diff and independently reproduced the clean
RED without setup/import/collection failures. No product implementation or stubs.

Test SHA-256:b22bf42ee40724ae9ef98bef79d74d0aeb0560273591688832b0e85cb158135f.
Logs:.git/local-orchestration/merchant-t024/, including n1-red-final.log,
root-red.log and all static/type logs; first fixture failure remains n1-red.log.
T024 RED accepted. T027 still waits for verified T026. Catalog60/81(74%),21open.
No deployment, physical proof or remoteCI.
