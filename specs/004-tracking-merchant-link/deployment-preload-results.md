# Cold first-load preload results (OP-01)

This receipt records a narrowly scoped cold-load optimization. It does not close an OP-01 task
or claim Caddy, production-container, phone, or production verification. The aligned rationale is
in the [local runtime lifecycle plan](../../docs/local-runtime-lifecycle-plan.md).

## Finding and correction

The prior full local browser gate reported 153 passed and one failure in SC005: cold public
tracking status visibility measured `3094.3 ms`, above the unchanged `3000 ms` budget. The
preserved first full-gate result is historical evidence for the pre-optimization source.

The first optimization moved the global stylesheet import from `app.tsx` into the bootstrap
`main.tsx` and added a build-only Vite HTML transform that preloaded the generated dynamic
`app.tsx` chunk. It improved the focused cold measurement to `3026.8 ms`, but still missed the
budget by `26.8 ms`.

The trace from that first optimization showed why app-only preloading was insufficient: the
entry JavaScript and stylesheet began around `261 ms`; the app chunk also began around `261 ms`
and took about `1487 ms`; most of the app chunk's static JavaScript dependencies began around
`749–751 ms`; and the tracking route chunk began around `2682 ms`. The trace is preserved at
`.git/local-orchestration/op01/preload-correction-n1/tracking-page-shows-the-re-85f2b-cold-weak-mobile-connection-chromium/trace.zip`.

The bounded correction keeps the stylesheet in the bootstrap and extends the same build-only
transform to traverse the app chunk's public `OutputChunk.imports` graph. It emits deduplicated
`modulepreload` links for the app chunk and its reachable static-import chunks. It skips missing
or non-chunk targets and does not follow `dynamicImports`, so route chunks stay lazy. The links
include `crossorigin`; the app remains dynamically executed only after `main.tsx` applies Zod's
strict-CSP `jitless` configuration. No timing budget, retry setting, or browser assertion was
changed.

## Verification

The focused command was:

```sh
pnpm --filter @domy/web exec playwright test tests/e2e/tracking-page.spec.ts tests/e2e/csp-styles.spec.ts --grep 'cold weak|CSP-clean' --retries=0
```

Results are recorded by invocation below. The first optimization run is included to show why the
static-graph extension was needed; its Playwright output was one passing CSP test and one cold
budget failure. The static-graph executor run passed both tests, with cold visibility at
`2839.7 ms`. Its private directory is named `preload-correction-n2` because it was the
executor's second focused attempt; that name does not mean it was the independent QA N2 run.
Root's independent N2 run also passed both tests, measuring `2857.0 ms`. All runs used
`--retries=0`.

| Run | CSP-clean Select | Cold status visible | Result |
| --- | --- | ---: | --- |
| Prior full local browser gate | — | 3094.3 ms | 153 passed, 1 failed (SC005) |
| Executor focused attempt 1, app-only preload | passed | 3026.8 ms | 1 passed, 1 failed (SC005) |
| Executor focused attempt 2, static-graph preload | passed | 2839.7 ms | 2 passed |
| Root independent QA N2 | passed | 2857.0 ms | 2 passed |

The executor's second focused run record is preserved at
`.git/local-orchestration/op01/preload-correction-n2/focused-run.txt` (0600 under a 0700
directory). Root's independent run log is
`.git/local-orchestration/op01/root-preload-browser-n2.log` (0600). The first app-only attempt's
trace remains in its separate private directory. These focused browser checks do not establish
Caddy headers, production serving, or container behavior; the tests apply the app's CSP to the
Vite preview document.

## Integrated quality-gate result

Root reports all four local quality gates passed on the same 537-file source manifest,
SHA-256 `9604ca9689fc7e354f9f1245a424f72316b4b5ed041635f65c505403dabb32e2`. The recorded
before/after JSON manifests compare exactly. The private gate outputs are
`.git/local-orchestration/op01/full-check-v2.log`, `full-test-v2.log`, `full-e2e-v2.log`,
`full-build-v2.log`, and `full-gates-v2-{before,after}.json`.

| Gate | Result |
| --- | --- |
| Check | Passed |
| Test | Passed: 424 domain, 804 server, and 382 web tests (1610 total) |
| Browser E2E | Passed: 154 tests, 10.9 minutes, zero retries; cold tracking visibility `2837.3 ms` |
| Build | Passed, exit 0 |

The earlier 153-pass/1-fail browser result at `3094.3 ms` and both focused optimization attempts
remain recorded above as historical evidence. The current full E2E result is under the unchanged
3000 ms budget. These gates cover repository checks, tests, browser E2E, and the project build;
they do not verify Caddy headers, a running container, physical phones, or production serving.

The scoped ESLint on the changed TypeScript files, web typecheck, Prettier, and `git diff
--check` passed before the focused static-graph browser run.

## Source identity

| File | SHA-256 |
| --- | --- |
| `apps/web/vite.config.ts` | `e86909463d354c58920fbb41fbff6c53c5a9860e8ec25f41d0109c9bbbb8f828` |
| `apps/web/src/main.tsx` | `78d48a2e9f912980f7f94d7989267e53fac4118fff855056954a3d07fc852d20` |
| `apps/web/src/app.tsx` | `050b11b217767b14d1131e4ede796fb5326063486e52dc1e267db8de1dfc056f` |

These source files are bound to the 537-file manifest above; the full-gate before/after
manifests are an exact match.
