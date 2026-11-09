# Container rehearsal results (OP-01)

## Current scope — 2026-10-23

The candidate image, fresh synthetic install and actual HTTPS/proxy rehearsal pass
executor N1 and independent root N2 verification. Historical-image upgrade remains
planned, not executed. Physical acceptance and production deployment are not
certified here. Catalog completion remains **76/81 (94%), five open tasks**.
The owner handles external infrastructure and deployment; this is local engineering evidence.

## Prerequisites and identity

Root completed `pnpm check`, `pnpm test` (1610 tests),
`pnpm test:e2e --retries=0` (154 passed, 10.9 minutes), and `pnpm build`.
Cold tracking visibility was 2837.3 ms against the unchanged 3000 ms limit.
The before/after 537-file manifest is identical:
`9604ca9689fc7e354f9f1245a424f72316b4b5ed041635f65c505403dabb32e2`.
See the [preload results](deployment-preload-results.md) for earlier preserved failures.

The executor used the inspected local Unix `desktop-linux` context and its
single-node Docker-driver builder. The tag was absent before the one authorized
build. Build arguments were the synthetic HTTPS origin
`https://domy-op01.test:8446` and an empty public browser reporting DSN. No
application secrets were build arguments. The build exited zero in 39.761 seconds.

| Property | Verified value |
| --- | --- |
| Image ID | `sha256:f9c052a29f8bcfea38678e25b4da0fe0cdb351b640f4fe1104d73b57770bd551` |
| Platform | Linux arm64, local host rehearsal only |
| User | `node` (runtime UID 1000) |
| Entrypoint / command | `docker-entrypoint.sh` / `node src/index.ts` |
| Working directory | `/workspace/apps/server` |
| Node runtime | 24.22.0 from the pinned base image |

The first build log is mode 0600 under the mode-0700 private lab directory:
`.git/local-orchestration/op01/lab-20261022/candidate-image-build-first-private.log`.
Its SHA-256 is `85bf3bcccaca97d8f93fac42704517933af49aa5ead17771cb639c3c30e5479e`.
Field-only executor metadata excludes `.Config.Env`; its initial read-only
extraction failed before writing evidence, then the corrected field-only query
passed without rebuilding or modifying the image.

## Independent root verification

Root independently inspected the immutable image ID and ran a retained container,
`domy-op01-image-n2`, with network `none`, a read-only filesystem, all capabilities
dropped and `no-new-privileges`. The probe exited zero and verified:

- All 148 copied server/domain source files match the final source manifest.
- Ten versioned SQL migrations are present.
- Domain, application, environment and migration modules import successfully.
- Built HTML, service worker and web manifest exist.
- The process is UID 1000; `/workspace/.env` and `/workspace/.git` are absent.

The probe imported modules without starting the app or invoking migrations. Its
private evidence is `root-image-structure-n2-private.log` in the same lab directory.
This is structural runtime evidence, not HTTP, schema, bucket, network-isolation
or deployment acceptance.

## Fresh installation: both QA levels pass

The fresh project `domy-op01-20261022` uses the immutable image above. Preflight
confirmed resource absence, cached image pins, free loopback ports and no subnet
collision. The private Caddyfile passed binary validation with the pinned Caddy
image, network `none` and no published ports. Only PostgreSQL/S3Proxy started
first; root independently confirmed their identities, internal database network,
two persistent volumes and unpublished backend ports.

The guarded bucket initializer and explicit migration jobs exited zero and were
retained. Executor and root independently verified 31 tables, all 66 validated
foreign keys, the exact ten migration hashes/timestamps, sequence value 10 and
empty account-action receipts. Root independently performed a successful
`HeadBucket` through the image's installed SDK. The new `company_settings` column
and default were verified; root's first inspector queried `settings` by mistake,
so its preserved output was followed by a narrow corrected read-only check.

The app is healthy and Caddy runs on the exact images. Only Caddy has active host
bindings, `127.0.0.1:8081` and `127.0.0.1:8446`. Its edge bridge permits egress;
app/proxy and database networks are internal. Root independently verified exact
app/proxy addresses and no usable external default route in the app. Kernel
loopback IPv6 reject records do not provide egress.

## Actual HTTPS, proxy and privacy: both QA levels pass

Only the public local CA certificate was copied, mode 0600. All HTTPS checks
validate that CA and hostname; no TLS bypass, host trust modification or DNS change
was used. Executor's live-assets probe passed 37 assertions over ten responses.
Root independently verified 13 responses plus a malformed HTTP request:

- Live/ready, index, hashed JavaScript, manifest and service worker return 200.
- Tracking/client HTML return 200 with `no-store` and `noindex`; an unknown tracking
  API link returns JSON 404 with those same privacy headers.
- Anonymous private-photo access returns JSON 401.
- Actual HTML CSP retains strict script/object/frame rules and the three reviewed
  style-element hashes, with the intentional style-attribute allowance.
- Marker requests produce 200/404/502; malformed HTTP returns 400. Zero markers
  appear in the captured logs, which retain useful request status/latency and
  upstream-error diagnostics (root: 193 app records, 88 Caddy access records).

Both levels independently tested two distinct edge clients presenting the same
forged forwarding headers: client A receives sixty 404s followed by a 429; client B
receives 404. Root used fresh addresses for its own test. This proves the actual
Caddy overwrite and separate client rate buckets. Root also confirmed that its
edge client could not directly reach the app listener within the bounded probe.

Observed cache headers: health/public responses use `no-store`; index, hashed JS,
manifest and worker have no explicit `Cache-Control`. No immutable-cache claim is
made. These are native HTTPS checks, not a new physical-phone or installed-PWA test.

Private evidence includes `root-infrastructure-n2-private.json`,
`root-schema-n2-private.log`, `root-company-schema-n2-corrected-private.log`,
`root-bucket-n2-private.log`, `root-runtime-topology-n2-private.json`,
`stage3-live-assets-proof-private.json`, `root-live-runtime-n2-private.json` and
`root-proxy-n2-private.json` under the same lab directory. Raw request logs and
markers remain private. All evidence files are mode 0600.

## Preserved verification failures and remaining scope

The first executor metadata template dereferenced a health field absent on Caddy
and completed migration jobs; it was corrected using full state JSON and optional
health handling. Its initial IPv6 count included kernel loopback reject rows;
classification was corrected from captured interface/flag data. No service restart
or source change was needed. Root's pre-execution HTTPS probe syntax check also
caught an invalid regular-expression escape; that version was retained before
correction and before any HTTP request. Guard argument refusals occurred before
operations and did not mutate services. First evidence remains preserved.

The final source manifest still exactly matches the four-gate identity above after
all image/runtime probes. Historical-schema container upgrade is only
[planned](../../docs/archive/local-image-upgrade-plan.md). Authenticated account creation,
photo upload through this new image, real providers, scheduled backup/object recovery,
physical/offline installed-device acceptance and production deployment are not
claimed by this receipt. Existing repository tests and earlier synthetic restore
receipts retain their own scopes. See the
[engineering handoff](../../docs/engineering-handoff.md) for the owner boundary and
five still-open canonical tasks. No task is closed by implication.
