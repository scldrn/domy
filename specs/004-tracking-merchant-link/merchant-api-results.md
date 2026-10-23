# Merchant endpoints and rotation — 004/T027

Date:2026-10-22, America/Bogota. Dirty local base94a7e24.

Implemented anonymous merchant day/detail/photo reads and authenticated flat
Merchant+linkCode replacement/detail responses. Required validated publicBaseUrl
is injected from environment at startup, not request headers. All reads retain
no-store/noindex and uniform unknown/inactive/replaced/foreign capability404s;
active-code dates outside the shared 30-Bogotá-day window yield422.

List queries batch only summary/provenance/collection inputs and partition events
by shipment before legacy matching. Detail uses current effective applied,
non-reverted records and strict domain projection; note text becomes only the
support notice or null. statusAt prefers current record occurredAt, then latest
appended real status transition, never same-state administration or updatedAt.
Initial registration differs from restoration. Direct photos require current
owned uploaded proof and retained bytes, read from acknowledged storageKey;
no storage keys escape list/detail. Reverted delivery proof is denied even while
its object remains. Tracking queries remain narrow and unchanged in behavior.

Rotation locks the merchant, binds receipt actor/operation/merchant, handles unique
races with rollback/revalidation, and returns the current code on replay without
rotating again. Audit stores linkReplacedAt, never old/new bearer codes. Existing
merchant PATCH rejects a rotation UUID; other legacy generic no-op semantics
remain unchanged. Independent source review confirms this bounded R16 guarantee.

N1:5 focused server files/59 PASS12.41s; full domain22files/412 PASS670ms;
scoped format/lint and recursive types PASS. Root independently reviewed source,
queries, contracts, isolation and replay branches and ran:

```bash
pnpm --filter @domy/server exec vitest run
pnpm --filter @domy/domain exec vitest run
pnpm exec prettier --check <the 12 owned paths below>
pnpm exec eslint <the 12 owned paths below> --max-warnings 0
pnpm --recursive typecheck
```

Root N2:68 server files/738 PASS144.51s;22 domain files/412 PASS904ms;
format/lint/types/diff whitespace PASS. All12 source hashes identical before/after.
No tests were skipped or budgets relaxed. Public tracking and all existing server
regressions are included. No build/E2E acceptance is claimed for unfinished UI.

Preserved RED and correction history: missing date helper2RED; native expanded
13cases10missing-featureRED3baselinePASS. The first58PASS/1FAIL product run had
a wrong test expectation: reverting delivery restores picked_up at the new
record_reverted17:00 transition, not the original pickup time. Its log remains
n1-focused-final.log. Later checks verify the current transition explicitly.
The earlier mistaken year-boundary expected-date log was overwritten by the
executor and is NOT retained; no original raw failure is claimed. Root independently
verified final tests: Dec2–Dec31 before Bogotá midnight, Dec3–Jan1 afterward,
both inclusive30days. The missing-export RED and all subsequent native failures
remain separate. This evidence limitation is explicit, not hidden as a clean run.

The local-phone runner changed only its source createApp publicBaseUrl wiring.
Removing that single line reconstructs SHA8ba9e12007ea67a416ede6c3dcdd0a789fd17ce2ca6aa4a18bf91245e01a09e9,
matching T016's manifest. The sealed LAN target was not operated or rebuilt.

Final SHA-256:

- apps/server/src/routes/public.ts: f4c356d2ae335ab2c30ddafb885bce08454530d2cc05fd8159d39859f03aeb38
- apps/server/src/routes/merchants.ts: 0538fde41d78cb186ef7f9630610fac85f9139563948ee94e773552d502926fc
- apps/server/src/lib/master-data.ts: c6875b8fd1eb67fb2f94dd95d0241b51bcd2af4ae0413345afe897393afcaaf3
- apps/server/src/app.ts: cd298f02239aae6e3f2e642e8c0e7a6025c95d7f4f763888df6ca87a65029953
- apps/server/src/index.ts: b629d3bea1e33c5974d099e95303091382b4a5d1484ae0d70e63258cf2debaf0
- apps/server/scripts/local-phone-target.ts: 8d6736fc63a8da2c46bc76d311d97e19d255f4e55700a574bd3a82d1efc96506
- apps/server/tests/setup/app.ts: 81478e401ff7f06d4a0af67df6a4e71530c65fe625d5b144a75b304a6ee3bc90
- apps/server/tests/merchant-link.test.ts: d390414d5cf65c2e3fdb3d744588d337777c4635c1716b2de51626b0d3a12db4
- packages/domain/src/schemas/master-data.ts: 3f0da73442570f40bec8319b358fa36ea463f561bf3dbe93a12020236e37fb29
- packages/domain/src/public-tracking.ts: 4a733e346111f09ab6a718e85ca8e1a29f2c22f9f29de2ca658450e97715be45
- packages/domain/src/bogota-time.ts: 23a91b2168856f494076a5bc2c45c87a770fce33744abb962591714ef9c918b8
- packages/domain/src/merchant-service-date.test.ts: 7adf7a09bce07bbf31451d9c83d0a17ffdaad07ddaf15155b55da7797caafaa9

Evidence:.git/local-orchestration/merchant-t027/ includes N1 logs, root-full-server,
root-full-domain, root-format/lint/types, and matching root-source-before/after.json.
T027 accepted locally; catalog64/81(79%),17open. T028/T029 and independent T031
are now eligible. Physical acceptance, final story gates and deployment remain open.
