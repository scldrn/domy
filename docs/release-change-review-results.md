# Release change review

## Scope and plan — 2026-10-23

Owner request: review uncommitted changes, distinguish new work from old work, integrate
only correct changes and leave one clean deployment candidate. No deployment, remote CI
or new agent work. Base: `6b0256d`; existing offline code/data/coverage are preserved.

The original tracked patch and untracked files are preserved privately under
`.git/local-orchestration/release-change-review-20261023/`. Local files are not evidence
of their author's intent or completed validation. The release-verification draft names
this exact base, so its runtime changes are new relative to main. Its older inventory
and pending statuses require reconciliation; they are not a new readiness certificate.

## Owning work and decisions

| Owner | Work and acceptance |
| --- | --- |
| `001/T156` | Bound sign-in connection use, trusted native IP, startup/config validation, process drain and dependency security patches. Preserve transactional account invariants, audited actors, recovery privacy and role tests. |
| `002/T065` | Active courier at dispatch, concurrent accepted-action replay and same-courier join. Keep T063 aggregate fixes; reconcile actual T064 documentation changes without replacing historical receipts. |
| `003/T137` | Storage timeouts, photo authorization/immutability, photo failures that permit route refresh, request bounds, input storage bounds and concurrent record replay. Preserve pending photo bytes on conflict and all existing offline regressions. |
| `004/T036` | Reuse bounded request limiting for sign-in and IPv6 prefixes; preserve capacity refusal rather than evicting live public buckets. Keep anonymous response/privacy contracts. |
| OP-01/OP-02 | Tracked backup/restore tooling, production routing and migration-aware readiness; validate against isolated local resources only. |

Before implementation, analysis rejects silent photo deletion on HTTP 409 and live
rate-bucket eviction: both weaken existing guarantees. Readiness journal data needs a
Zod boundary. Restore scripts remain diagnostics, not a scheduler or provider backup.
No business expansion, new service, migration, threshold relaxation or test exclusion.

Required local commands: `pnpm check`, `pnpm test`,
`pnpm test:e2e --retries=0`, `pnpm build`, `pnpm audit --prod`, plus shell syntax and
native backup/restore/process/storage regression tests. Inspect final diff and build
the new Docker candidate; the previous image does not certify changed runtime files.

## Dispositions after inspection

- Retain new runtime hardening and its native tests, subject to the final gates.
- Correct the proposed photo-conflict deletion: preserve bytes and report the refusal
  after committing accepted records and refreshing the route. Permanent RED reproduced
  the deletion before the correction.
- Reject live-bucket eviction. Permanent RED demonstrates it admits an overflow client;
  retain the cap/refusal and the new IPv6 /64 grouping.
- Replace the new "never mark a voided shipment" test with the actual FR-017/R8 contract:
  a copied/opened notification's delayed acknowledgment remains a historical fact after
  voiding. Composition/listing still exclude voided shipments. The original failed
  attempt is retained; no notification runtime change or existing assertion is removed.
- Keep T064 history verbatim and append reconciliation instead of replacing its old QA
  receipt with a claim that the old review never happened. Apply the missing task/plan
  qualifications and T015 path correction.
- Replace the mixed deployment-verification draft with a pointer to current evidence;
  preserve its complete original contents privately and earlier versions in Git history.
- Pin Zod 4.6.6 and fast-uri 3.1.9 after native audit identified newly published patches:
  [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) and
  [fast-uri advisory](https://github.com/advisories/GHSA-w74x-v6f9-j3xg).

## Validation

Current frozen source: SHA-256
`a2c9c55a564a837811de8c4c8c2c0b0875630450f6ac378b02257e5afbc19152`
(550 source/configuration/test/tool files; documentation excluded).

- `pnpm check`: PASS, zero lint/type/format errors or warnings.
- `pnpm test`: PASS, 1,686 cases = 426 domain + 870 server + 390 web.
- `pnpm build`: PASS, including the actual service worker.
- `pnpm audit`: PASS, zero reported vulnerabilities, including development packages.
  Patched Undici 8.12.2 and serialize-javascript 7.1.3 as well as Zod/fast-uri.
- `bash -n scripts/backup.sh scripts/restore.sh`: PASS. Native PostgreSQL tests execute
  both scripts, restore into a separate database and refuse live/system/existing targets.
- Scoped duplicate scan: 273 production TS/TSX modules; no identical files or identical
  complete function bodies of 80+ tokens. No claim about every semantic similarity.
- Docker build and native runtime: PASS, UID 1000, no host ports, fresh migrations,
  seven health/routing/access checks and exit 0 on shutdown. Root separately matches
  154 image source/configuration hashes and imports the native app with patched Zod.
- `pnpm test:e2e --retries=0`: PASS, 155 cases with zero retries; cold public status 2875.1 ms, below the unchanged 3,000 ms limit.

Image: `domy:release-review-a2c9c55a`, immutable ID
`sha256:3e7039d675c4d3c864872c86e51761c0cd7007df518a48dbc1d7272bbbf423f9`,
Linux arm64. It uses the synthetic build origin `https://domy-release-review.test`;
rebuild for the actual public origin/platform. This is a local candidate, not a deployment.
Its storage configuration deliberately points to closed loopback during startup checks;
provider access/retention and delivery are not certified by that check.

First attempts remain in private logs: initial formatting/lint defects, the photo-conflict
and limiter RED cases, and a first full run with 868/870 server cases passing. Its two
failures were the unapproved notification expectation and an immutability fixture whose
second image broke the newly enforced JPEG header. The fixture now retains the valid
header and changes the payload marker; the 409 assertion remains. One conservative test
restart is retained; before/after manifests subsequently proved identical. A first image
hash-probe invocation omitted stdin forwarding and produced no proof; the corrected
interactive invocation supplies the recorded hash result. No product failure was hidden
as a successful retry and no threshold, deadline or existing assertion was relaxed.


## Final review and integration

Root reviewed the final diff, contract/plan/task alignment, exact source manifests,
native image checks, schema/migration preservation, private recovery tooling and
all local gate results. No independent-agent review is claimed. T156/T065/T137/T036
are closed in their owning features; these four convergence tasks are outside the
original 81-entry catalog. No original physical task is marked passed by this review.

The new image supplies fresh-install/runtime evidence. SQL migrations are unchanged;
the prior historical-schema upgrade receipt retains its original image/source and is
not relabeled as a rehearsal of this new image. Provider configuration, real-origin
image build, platform selection, production deployment and physical public/mobile
acceptance remain the owner's operational steps.
