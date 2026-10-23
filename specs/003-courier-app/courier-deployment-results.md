# 003/T084 Courier deployment documentation results

Status: T084 locally verified after executor N1 and independent root N2 on 2026-10-21.
The isolated synthetic rehearsal passed; provider and physical-device evidence remain
separate obligations. This does not authorize production deployment.

## Documentation added

The [README production section](../../README.md#production) now documents:

- A pre-created private S3-compatible bucket, no public or presigned object URLs, and a
  bucket lifecycle rule that deletes proof photos after 12 months.
- The storage and VAPID variables, which production settings the current parser enforces,
  and which storage defaults operators should set explicitly for the selected provider.
- One stable production VAPID pair, the pinned `web-push` Node API command, server-only
  private-key handling, and the required device re-subscription plan if the pair is rotated.
- The courier PWA's required CSP source directives and the current boundary: the server
  sets `frame-ancestors 'none'`, while Vite does not configure the deployed CSP.
- The distinction between source/configuration instructions and verified provider or
  installed-phone acceptance evidence.

## Source facts checked

- `.env.example` documents S3Proxy as the development default and the storage and VAPID
  environment variable names. `apps/server/src/env.ts` requires the S3 endpoint, bucket,
  access key and secret in production, plus the complete VAPID group. It supplies defaults
  for `S3_REGION` and `S3_FORCE_PATH_STYLE`; production instructions therefore say to set
  the provider's actual region and path style explicitly.
- `apps/server/src/index.ts` calls `ensureBucket()` outside production only. The S3 adapter
  reads, writes and deletes objects but does not install a bucket lifecycle policy. A
  provider's public-access and 12-month expiration settings need independent verification;
  S3Proxy checks are not provider proof.
- `apps/web/src/lib/offline/push.ts` reuses an existing browser push subscription. It does
  not migrate it when the public VAPID key changes. The courier API exposes the public key
  to a linked, authenticated courier; the private key remains server configuration.
- `apps/server/src/app.ts` sets `frame-ancestors 'none'`. `apps/web/vite.config.ts` builds
  the worker and manifest but does not set the production HTTP CSP. The required additions
  are cross-checked with research R17.

## Initial source-only documentation checks (before rehearsal)

No secret values were generated or read. The VAPID generation command was checked against
the pinned `web-push@3.6.7` package entry point, type declaration, and API documentation; it
was not executed. No provider, bucket, target, certificate, database, build, listener, phone
or external workflow was used.

| Check | Result |
| --- | --- |
| README relative path targets and linked research headings | PASS: 13 Markdown links parsed; all relative targets and R6/R8/R17 headings exist |
| README production variables against `.env.example` and source requirements | PASS: documented variables exist; production-required S3/VAPID groups and Vite boundary match source |
| `pnpm exec prettier --check README.md specs/003-courier-app/courier-deployment-results.md` from repository root | PASS, exit 0: all matched files use Prettier style |
| `git diff --check` | PASS, exit 0 for the tracked README diff; the new receipt was also checked for trailing whitespace |

## Not established by this receipt

- The provider's actual bucket privacy, permissions, lifecycle policy, expiration behavior,
  cost, or ownership.
- Real push delivery, key rotation, or re-subscription on Android and iPhone.
- The actual production CSP response. The local rehearsal and its narrower policy are
  documented below; they do not establish a full production policy.

## Quickstart handoff addendum

The courier quickstart now separates ordinary development setup from the approved
isolated LAN rehearsal: the latter uses the launcher's private per-run configuration and
synthetic credentials, with no `.env` or production secrets. For production VAPID setup it
links to the pinned command in the README; the production push requirements are unchanged.
The quickstart also states that an initial smoke check is not T087/T093 acceptance and that
the launcher's one-courier, one-route, one-shipment fixture needs additional courier accounts,
routes and shipments before all manual cases can be run. The 21 scenario rows and their
acceptance expectations remain unchanged. This documentation addendum does not record a new
target run, phone result, or provider verification and does not close T084, T087 or T093.


## Independent local rehearsal approval — 2026-10-21

Executor N1 prepared, privately built and sealed `phone-20261021-d`, verified the
real HTTPS application, gracefully stopped only its fingerprint-verified app process,
and restarted without regenerating credentials, VAPID keys or build. Both operational
verifications exited 0. Root inspected source/diffs and the complete N1 evidence, then
independently ran the operational verifier (exit 0) and audited Docker bindings,
resource identities, private file modes, certificate chain/IP and effective CSP.

The compiled worker/manifest, secure authentication/Origin/role boundaries, synthetic
catalog/route and private photo access passed. The response CSP is exactly
`frame-ancestors 'none'`; the README correctly describes additional requirements for
a complete production policy. Stable synthetic VAPID keys survived restart; no actual
phone subscription or delivery is claimed. The local photo byte/access check is not
camera, image-display, provider-privacy or lifecycle-expiration proof.

Current 459-file source SHA is
`0f075fa48ab8c2b3a202a711ccb2a14f16d84881fbb202478df35c730b3d70f5`. Root's exact
reconstruction proves only the launcher changed from T083's accepted application
(check, 1,281 tests, 129 first-attempt E2E and build); scoped launcher QA and actual
resource rehearsal validate those subsequent changes. Full chronology, failures and
commands: [rehearsal receipt](local-target-rehearsal-results.md). Local root evidence:
`.git/local-orchestration/phone-target-rehearsal/root-d-verify.log`,
`root-d-resource-audit.json`, `root-d-effective-csp.json` and
`root-application-source-provenance.json`.

Root approves T084 and the local target; G0 permits owner-operated phone acceptance.
T093/T087 remain unexecuted, T088 remains open, and feature 004 remains blocked.
