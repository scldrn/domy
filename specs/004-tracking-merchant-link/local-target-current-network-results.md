# Local 004 target — current-network `public-b` run

Date: 2026-10-22 (America/Bogota). This receipt records the separately authorized local
preflight, isolated target preparation, private web build/seal, detached serving, and native
verification for `phone-20261022-public-b`. It is LAN-only evidence. It does not establish
physical phone acceptance, G1 completion, production readiness, provider delivery, or public
internet availability.

## Candidate and isolated resources

The current `en0` address was `192.168.58.219`; the target origin and application listener are
`https://192.168.58.219:8445`. PostgreSQL is bound only to `127.0.0.1:15435` and S3Proxy only
to `127.0.0.1:19102`. Local push is disabled. The target state records run ID
`phone-20261022-public-b`, phase `running`, process PID `65900`, and build digest
`fc6224baced85c2ef82de932f3e57dd91a56477fadacdedb0c8637f4e9c52584`.

The reviewed launcher remains SHA-256
`8d6736fc63a8da2c46bc76d311d97e19d255f4e55700a574bd3a82d1efc96506`. The candidate's
source, schema, lock, and build digests are respectively:

- Source: `a708ba74689f8d6a0c9948e7d10f7e39d2c25974c30adb796246b68bc7919e28`
- Schema: `44c18a4b09d70a6988a18a12b01f970a9bd8e673aaf682a600e954f0370b3a07`
- Lockfiles: `50f41517a321ef8cb3b6e005e9672ea08703ae302585e8d87ea7864c7ef5b718`
- Build: `fc6224baced85c2ef82de932f3e57dd91a56477fadacdedb0c8637f4e9c52584`

The separately root-verified 523-file technical baseline remains
`2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6`.

| Resource | Verified identity |
| --- | --- |
| Compose project | `domy-phone-phone-20261022-public-b` |
| PostgreSQL | Container `686d3704a55e`, `domy-phone-phone-20261022-public-b-postgres-1`, pinned PostgreSQL 18 image digest `74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336`, healthy, `127.0.0.1:15435` → `5432` |
| S3Proxy | Container `32d365e5d93c`, `domy-phone-phone-20261022-public-b-s3proxy-1`, pinned image digest `87662b2a5afcdfa5f478a1c61650bae4c87bbd15f6ff2823236bcfd66ef7fe04`, healthy, `127.0.0.1:19102` → `80` |
| PostgreSQL volume | `domy-phone-phone-20261022-public-b-pgdata` |
| S3 volume | `domy-phone-phone-20261022-public-b-s3data` |
| Private network | `domy-phone-phone-20261022-public-b-network` |
| App process | PID `65900`, detached Node listener on `192.168.58.219:8445` |

## Preflight, prepare, build, and seal

Immediately before preparation, read-only checks confirmed `en0=192.168.58.219`, proposed
ports 8445/15435/19102 free, the exact candidate container/volume/network names absent, and
both pinned images cached in local Docker context `desktop-linux`. The no-write dry-run
exited 0:

```sh
pnpm --filter @domy/server exec node scripts/local-phone-target.ts prepare \
  --run-id phone-20261022-public-b --host-ip 192.168.58.219 \
  --https-port 8445 --pg-port 15435 --s3-port 19102 --dry-run
```

After Root's scoped grant and a fresh absence/IP check, actual preparation exited 0 with
local push disabled and no `.env` input:

```sh
env SENTRY_DSN= VITE_SENTRY_DSN= BETTER_AUTH_TELEMETRY=false BETTER_AUTH_TELEMETRY_DEBUG=false \
  pnpm --filter @domy/server exec node scripts/local-phone-target.ts prepare \
  --run-id phone-20261022-public-b --host-ip 192.168.58.219 \
  --https-port 8445 --pg-port 15435 --s3-port 19102
```

The private Vite build used `envDir:false`, wrote only to the run's private `dist/`, set
`APP_URL` and `PUBLIC_BASE_URL` to the same HTTPS origin, left both Sentry DSNs empty, and
disabled telemetry. It exited 0:

```sh
APP_URL="https://192.168.58.219:8445" PUBLIC_BASE_URL="https://192.168.58.219:8445" \
SENTRY_DSN='' VITE_SENTRY_DSN='' BETTER_AUTH_TELEMETRY=false \
  pnpm --filter @domy/web exec node --input-type=module -e \
  'const {build}=await import("vite"); await build({envDir:false,build:{outDir:"../../.git/local-phone-target/phone-20261022-public-b/dist",emptyOutDir:true}});'
```

The build sealed successfully with:

```sh
env SENTRY_DSN= VITE_SENTRY_DSN= BETTER_AUTH_TELEMETRY=false BETTER_AUTH_TELEMETRY_DEBUG=false \
  pnpm --filter @domy/server exec node scripts/local-phone-target.ts verify \
  --seal-build --run-id phone-20261022-public-b
```

The detached Node server was started from the repository-root wrapper using the absolute
launcher path, `apps/server` as child working directory, and owner-only server log. It
listens on the exact current LAN address; the database and S3 ports remain loopback-only.

## Native and root verification

The native launcher verifier exited 0:

```sh
env SENTRY_DSN= VITE_SENTRY_DSN= BETTER_AUTH_TELEMETRY=false BETTER_AUTH_TELEMETRY_DEBUG=false \
  pnpm --filter @domy/server exec node scripts/local-phone-target.ts verify \
  --run-id phone-20261022-public-b
```

One synthetic sign-in encountered the configured Better Auth rate limit. The verifier
accepted its bounded `X-Retry-After` value and made its single 10-second retry before passing;
this is a reported retry, not a first-attempt pass. Root independently repeated native
verification with the same bounded retry. Root's additional CA-validated HTTPS probes passed
on first attempt: anonymous tracking, merchant day, and merchant detail returned 200 with
strict domain schemas and no-store/noindex headers; both public app shells returned 200;
office notifications returned 200 with a strict schema while anonymous notifications
returned 401; and an unknown tracking code returned the uniform 404 response. These probes
made no operational mutations and logged no bearer code, cookie, credential, or response
body. Logs are retained in
`.git/local-orchestration/public-lan-current-network/root-native-verify.log` and
`.git/local-orchestration/public-lan-current-network/root-public-verify.log`.

The target's private directory is
`.git/local-phone-target/phone-20261022-public-b/` (mode 0700); `state.json` and
`server.log` are mode 0600. The verification-log directory is mode 0700. No secret value or
raw state is included in this receipt.

The prior source-A app process PID `41028`, source PostgreSQL container `0c299b8f24f8` on
`127.0.0.1:15433`, 003 app PID `12004`, and 003 containers `e771c9ab2030`/`d1c57b95ee34`
were preserved. Their prior bindings and volumes were not changed. No `.env`, external
provider, domain, phone browser, phone trust-store change, physical camera, push delivery, or
email delivery was used or tested. This receipt does not close G1, `004/T034`, OP-02, or any
physical/provider acceptance requirement.

## Root acceptance of this local receipt

Root independently inspected the receipt and retained verifier logs, repeated native
and strict public probes, and rechecked PID `65900`, both healthy B containers and
loopback-only bindings. The post-check source manifest still contains523 files with
SHA-256 `2a885083983b262318efc2f78a57e3e5fbc1897a6adca121887d64ab2efe52c6`.
A first shell redirection failed before native verification because its private output
directory was absent; root created that directory and then ran the recorded verifier.
No verification failure is hidden by that wrapper correction. Local preparation accepted;
no catalog task, OP gate or physical acceptance is closed by this receipt.
