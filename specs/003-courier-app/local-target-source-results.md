# OP test target source-preparation results

Status: source-only N1 passed and the launcher is frozen for root review. This receipt does
not claim that a phone target was provisioned, served, or accepted.

## Delivered source

- `apps/server/scripts/local-phone-target.ts` implements `prepare`, `serve`, `verify`, and
  `stop` using the existing Node, Hono, Drizzle, Better Auth, Docker Compose, and OpenSSL
  interfaces. Importing the file does not run a command.
- `apps/server/tsconfig.json` includes `scripts`, so the normal server typecheck covers the
  launcher.
- Source SHA-256: `c10d43b8be3ce8270c0ad1d1a85beaba4520ba5b2cb87b9e6f224d4a374dd347`.
  Server tsconfig SHA-256: `1a88e9d701497e4194c03f1977d83cce4f7b4a4d1aed7dc4c9a956f128382461`.
- `docs/archive/local-deployment-inventory.md` records source status, certificate identity limits,
  local push opt-in, and the remaining phone acceptance boundary.
- The source keeps generated state, credentials, certificates, and web build beneath a
  run-scoped private directory under `.git/local-phone-target/`. Compose uses an exact
  project, explicit empty interpolation env, cached image digests, loopback-only service
  ports, generated names, and validated resource labels. `stop` verifies process identity
  and resource ownership and preserves data volumes.
- The launcher derives the database URL from validated generated credentials and fixed
  loopback host/port fields. It does not accept a stored connection URL. TLS verification
  checks the CA/leaf relationship, public CA fingerprint, leaf key match, current IP SAN,
  validity, and a normal HTTPS request with the explicit CA. The local push key pair is
  opt-in and is not generated until a real `prepare --enable-local-push` execution.
- Every non-dry-run `serve`, `verify`, and `stop` invocation rechecks that the active Docker
  endpoint/context is local before loading saved state or making a Docker request. A real
  `prepare` also checks Docker locally; `prepare --dry-run` returns before any Docker call.

## Source-only validation

All checks below ran locally on Node.js 24.21.0. No integration suite, Docker command,
database, certificate generation, build, browser, listener, or phone was used.

| Check | Result |
| --- | --- |
| Executor N1: `pnpm --filter @domy/server typecheck` | PASS, exit 0 (`tsc --noEmit`, including `scripts`); `.git/local-orchestration/phone-target-source/n1-server-typecheck.log` |
| Executor N1: `pnpm exec eslint apps/server/scripts/local-phone-target.ts --max-warnings 0` | PASS, exit 0; `.git/local-orchestration/phone-target-source/n1-eslint.log` |
| Executor N1: `pnpm exec prettier --check apps/server/scripts/local-phone-target.ts apps/server/tsconfig.json` | PASS, exit 0; `.git/local-orchestration/phone-target-source/n1-prettier.log` |
| Executor N1: `git diff --check` | PASS, exit 0; `.git/local-orchestration/phone-target-source/n1-diff-check.log` |
| Executor pure import/CLI/state smoke | PASS, exit 0: one valid and ten invalid command cases; one valid and five invalid state cases, including remote `databaseUrl`; `.git/local-orchestration/phone-target-source/n1-import-state-smoke.log` |
| Executor CLI dry-run | PASS, exit 0: `node apps/server/scripts/local-phone-target.ts prepare --host-ip 192.168.1.20 --run-id n1-source-audit --dry-run` printed the no-write/no-resource result; `.git/local-orchestration/phone-target-source/n1-cli-dry-run.log` |
| Compose healthcheck quoting | PASS: generated YAML parsed to `CMD-SHELL` plus `pg_isready -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"`; after Compose's `$$` escape, the shell command is `pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"` |
| Root-published native CLI smoke | PASS: published Node import, valid dry-run parse, ten invalid inputs rejected, no Docker/DB/TLS/listener operations; `.git/local-orchestration/phone-target-source/root-published-cli.log` |
| Root check after source freeze | PASS: workspace formatting, ESLint, strict TypeScript, and typechecks; `.git/local-orchestration/n2-t083-check.log` |

The quoting check used the Ruby standard YAML parser and Compose dollar-escape semantics; it
did not invoke Docker Compose. The installed LibreSSL does not support `openssl verify
-verify_ip`; the inventory explains that chain/purpose verification alone does not prove
the IP identity, which the launcher checks with `X509Certificate.checkIP` and an ordinary
CA-verified HTTPS request.

The first scoped ESLint attempt correctly reported that the project service excluded
`apps/server/scripts/`. A temporary one-file lint then found 20 real issues: an unused
import, unnecessary optional chains and string conversions, expression-bodied void
callbacks, async functions without awaits, dynamic environment-key deletion, and the
Promise-returning Hono listener passed directly to Node HTTPS. These were corrected without
disabling rules or suppressing diagnostics. The scripts include was added to the server
tsconfig instead of weakening lint. Subsequent ESLint and server typecheck passed. Typecheck
also verified the Better Auth recovery callback return type; its required `Promise<void>` is
returned without claiming that local recovery mail is delivered.

## Not exercised / remaining gates

The only executed launcher path was `--dry-run`. It returns before network/interface checks,
Docker inspection, secret generation, filesystem writes, certificate generation, and service
creation. There are no target credentials or certificates, containers, volumes, database,
web build, or listener from this preparation.

Root source approval is recorded below. No operational target QA has yet run.
All G0 code prerequisites and a concrete T084 draft must be root-reviewed before
serialized synthetic-target rehearsal. This rehearsal supplies T084's local configuration
evidence; G0 and offering the URL for physical phone acceptance still require both T084
and OP-test-target to be fully verified. Provider/production acceptance remains separate.

## Root source approval — 2026-10-21

Root reviewed the published launcher: strict state/arguments, derived loopback DB URL,
private filesystem ownership and symlink refusal, exact isolated resource labels and
bindings, native TLS/IP validation, immutable identities, native runtime compatibility,
local Docker validation on every operational invocation, and safe process/stop ownership.
The executor's own six scoped N1 checks passed; root independently passed the native
import/CLI dry-run, healthcheck quoting, workspace check and build. The 1,281-test run
and 129 first-attempt browser run also passed with the launcher in the checked project.

Published script SHA-256 is
`c10d43b8be3ce8270c0ad1d1a85beaba4520ba5b2cb87b9e6f224d4a374dd347`;
the final checked 459-file source is
`3b51b24f3a7781b21c8e7fdeaf77a6843b9fd156a131204eba3f3d31674823fe`.
Root approves source preparation only, recorded by OP-target-source-reviewed. No
certificate, resource, migration, listener or phone result is implied. The superseding
sequence avoids the earlier T084/rehearsal acceptance cycle without weakening G0.
