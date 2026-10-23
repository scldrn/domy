# Public origin configuration results — 004/T001

Date: 2026-10-21 (America/Bogota). Local-only, dirty branch
`codex/local-readiness-orchestration`, base `94a7e2450ec2abae4192f7f864e34c4638f7c963`.
Source identity before/after root QA: 461 files, SHA-256
`adb2e974c14025cb3c23a5108ed32f9e51bf1b6beb43def82f5f9f619a313e2d`.

## Change and scope

Shared `publicOriginSchema` canonicalizes HTTP(S) origins and rejects credentials,
paths/traversal, backslashes, query/fragment delimiters, whitespace and controls.
Server configuration requires an explicit HTTPS PUBLIC_BASE_URL matching canonical
APP_URL in production; development/test may use APP_URL as fallback. Vite defines
only the selected validated public scalar. Its native config hook respects
`envDir: false`; E2E and future phone build/runtime use their actual shared origin.
No package dependency or schema change. The `.env.example` email comment now agrees
with the existing no-token-logging recovery behavior; no mail behavior changed.

## Executor N1

Luna/max captured meaningful server-env RED before implementation: 10 failed / 2
passed, exit 1. Final shared validator 20/20 and server env 14/14 pass; check passes.
A normal build and an actual private envDir:false build passed; only the intended
public define resolved, and a synthetic secret was absent from 116 artifacts.
The normal build preceded the final validator edge fix; root rebuilt final source.

Retained diagnostics: first private-probe report used the wrong relative log path,
then succeeded after path correction; no product failure inferred. The explicit C0
regex triggered the existing ESLint no-control-regex rule; it was replaced with
Unicode property Cc, without disabling lint. Original RED and lint failure remain
under `.git/local-orchestration/public-t001/` alongside successful outputs.

## Orchestrator N2

Root inspected source, original assertion retention, caller bindings and private-build
instructions, then independently ran on frozen source:

| Command | Result |
| --- | --- |
| `pnpm test` | PASS, 1,311 tests: domain 303, server 687, web 321; 186.72 s |
| `pnpm check` | PASS, zero warnings/errors; 61.21 s |
| `pnpm --filter @domy/web exec playwright test tests/e2e/courier-route.spec.ts --retries=0 --reporter=list` | PASS, 2/2 first attempts, real DB/storage/built worker; 16.67 s |
| `pnpm build` | PASS on final source; 4.79 s |

Root additionally resolved native Vite config with envDir:false and an explicit
HTTPS test origin, built a fresh private bundle with synthetic private sentinels,
and scanned 352 artifacts across that build, the ordinary build and the N1 private
build. Exact scalar define and absence of the sentinel in defines/artifacts passed.
Private receipts: `root-results.json`, `root-origin-probe.json`, before/after source
manifests and matching logs in `.git/local-orchestration/public-t001/`.
`git diff --check` passes. No all-129-case E2E rerun is claimed for this configuration slice.

## Decision and remaining gates

Root approves T001 and unlocks T002/T003 RED. This proves configuration/build plumbing,
not completed public pages or deployed link reachability: those belong to the tracking,
merchant and G1 target checks once their dependent pages exist. The running LAN e target
still serves its earlier sealed 003 baseline; it was not rebuilt, restarted or migrated.
No physical acceptance, provider service, remote CI, publication or production deployment.
003/T093/T087/T088 remain deferred/open. Catalog: 44/81 verified (54%), 37 open.
