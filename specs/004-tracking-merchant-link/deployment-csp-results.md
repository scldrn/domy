# Deployment CSP compatibility results (OP-01)

This receipt records a bounded browser compatibility correction for the strict Hono CSP. It
does not close an OP-01 task or claim Caddy, container, deployment, phone, or production
verification. The aligned rationale is in
[`local-runtime-lifecycle-plan.md`](../../docs/local-runtime-lifecycle-plan.md).

## Finding and correction

The controlled Playwright test obtains the exact policy from `/health/live` and applies it to
the built Vite preview document. Its corrected RED run opened the real carrier Select and
completed the keyboard selection path, then failed the zero-CSP-violation assertion with
`script-src` and three `style-src-elem` events.

The first CSP correction allowed the fixed Base UI and Sonner stylesheet payloads and called
`z.config({ jitless: true })` from a first import in `main.tsx`. Its browser run still reported
`script-src` and `style-src-elem`. The preserved console named the required style hash as
`sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=`. Installed Sonner 2.0.8 source confirms
that `__insertCSS()` appends an empty `<style>` to `head` before appending its fixed CSS text
node. The first Zod import was also too late: ES module dependencies are evaluated before the
entry module body.

The final source keeps the strict script policy and adds only exact style hashes. The empty
hash admits a style element with zero CSS bytes; it does not permit arbitrary inline CSS. The
web entry now configures the web Zod instance and dynamically imports `app.tsx` only afterward,
so app and domain schemas evaluate with `jitless` already set. Node-side Zod behavior is
unchanged.

| Fixed content | UTF-8 bytes | `style-src-elem` source |
| --- | ---: | --- |
| Base UI 1.8.0 `styleDisableScrollbar.getElement()` | 107 | `'sha256-kLmvWqfziFavKtqHqRsb90f006UAK2Dmd0It5Iz2KFA='` |
| Sonner 2.0.8 `__insertCSS()` stylesheet | 14916 | `'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY='` |
| Sonner's transient empty `<style>` content | 0 | `'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='` |

No `unsafe-eval` or `style-src-elem 'unsafe-inline'` source was added.

## Verification

The focused command was:

```sh
env -u NO_COLOR pnpm --filter @domy/web exec playwright test tests/e2e/csp-styles.spec.ts -g "keeps bundled styles CSP-clean while keyboard selecting a carrier" --retries=0
```

The single authorized final invocation reported `1 passed (12.5s)`. The test verified zero
captured CSP violations, keyboard selection of a carrier, and the expected scrollbar style.
Playwright's `.last-run.json` recorded `status: passed` and no failed tests. A zsh wrapper then
returned an error while trying to assign the result to zsh's readonly `status` variable; this
was a result-recording error after Playwright completed, and the test was not rerun. The output
is preserved privately at
`.git/local-orchestration/csp-styles-corrective-prebrowser/corrective-green.log` (0600 under a
0700 directory). Earlier causal RED and failed GREEN artifacts remain in their separate
private directories.

Before the final invocation, Prettier, ESLint on the touched TypeScript files, and server and
web type checks passed. Root's independent N2 rerun of the same Playwright case also passed
with exit 0 (`1 passed`, 12.2s). Its private output is
`.git/local-orchestration/op01/root-csp-browser-final.log` (0600), and it is bound to the
537-file source manifest SHA-256
`d99b3fce94e543fc9ba10bdf2168f20a7c99dba7e717dc165c70cbf07738330b`. Both browser runs inject
the app policy onto the Vite preview response; they do not verify TLS, Caddy headers, container
networking, or production serving.

## Source identity at the final focused invocation

| File | SHA-256 |
| --- | --- |
| `apps/server/src/app.ts` | `203b2bb67eaa64f791023ddce35fd97bcf32124879461554c527aa5f81d5af60` |
| `apps/server/tests/runtime-health.test.ts` | `66c2bbb3a245f25f828cded668c6a79daab304d444c6ca59ba1afb23929faf61` |
| `apps/web/src/main.tsx` | `51bb52df33f4b5fe46100f7ee1e537f23291d48d5ce35b267ff556bd13a30442` |
| `apps/web/src/app.tsx` | `f7dc1e582dacc92fd0b2bbf914704614e5f34ea9a59e48c03d959ca50a80a8db` |
| `apps/web/tests/e2e/csp-styles.spec.ts` | `a4271006fdc6ab8e8edf67e3526348deaf844be4a33d7973874b9ac410f7d831` |

## Integrated quality-gate result

The focused CSP results and file hashes above document the earlier browser-only validation on
manifest `d99b3fce94e543fc9ba10bdf2168f20a7c99dba7e717dc165c70cbf07738330b`. Root subsequently
reports all four local quality gates passed on the same final 537-file source manifest,
SHA-256 `9604ca9689fc7e354f9f1245a424f72316b4b5ed041635f65c505403dabb32e2`; the recorded
before/after JSON manifests compare exactly. Private evidence is in
`.git/local-orchestration/op01/full-check-v2.log`, `full-test-v2.log`, `full-e2e-v2.log`,
`full-build-v2.log`, and `full-gates-v2-{before,after}.json`.

| Gate | Result |
| --- | --- |
| Check | Passed |
| Test | Passed: 424 domain, 804 server, and 382 web tests (1610 total) |
| Browser E2E | Passed: 154 tests, 10.9 minutes, zero retries; cold tracking visibility `2837.3 ms` |
| Build | Passed, exit 0 |

The pre-optimization full browser result of 153 passed and one SC005 failure at `3094.3 ms`
remains preserved as historical evidence; it is superseded by the final 154-test pass under the
unchanged 3000 ms budget. The focused CSP regression also passed in the final root N2 run with
zero policy violations. These repository gates do not establish Caddy headers, container
runtime behavior, physical-phone behavior, or production serving.

