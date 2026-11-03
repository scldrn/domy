# Contract: Design Tokens

The roles every screen may use (FR-002). Generated; never edited by hand. Names are CSS
variables `--md-sys-color-<role>` with Tailwind utilities of the same name.

| Role | Light | Dark | Used for | Never for |
| --- | --- | --- | --- | --- |
| `accent` | lime (tone ≈ 90) | lime (tone ≈ 90) | The one primary action's fill, current page in the rail, selected stage, "now", the next stop's ring, marks on pizarra | Text or 1 px lines on light surfaces |
| `on-accent` | tone 10–15 | tone 10–15 | Text and icons on `accent` | Anything else |
| `accent-strong` | tone ≈ 50 | tone ≈ 80 | Focus outline and thin accent lines on light surfaces | Fills |
| `rail` | primary 10 | primary 8 | Pizarra surfaces: rail, board hero, courier list, courier app header and navigation bar, toasts | Body content backgrounds |
| `rail-raised` | primary 20 | primary 20 | Hover and pressed on pizarra | — |
| `rail-line` | primary 25 | primary 25 | Dividers on pizarra | — |
| `on-rail`, `on-rail-variant` | neutral 98, variant 80 | neutral 92, variant 75 | Text on pizarra | — |
| `rail-success`, `rail-warning`, `rail-error`, `rail-info`, `rail-tertiary` | tone 80 | tone 80 | State marks and labels on pizarra | Light surfaces |
| `paper`, `sheet`, `sheet-alt` | as today | as today | Page, content, table headers | — |
| `success`, `warning`, `info`, `error`, `tertiary` (+ on-, container) | as today | as today | State marks, labels, and tiles on light surfaces | Decoration |

Contrast pairs that a unit test checks in each scheme: `on-accent`/`accent`,
`on-rail`/`rail`, `on-rail-variant`/`rail`, each `rail-<state>`/`rail` (4.5:1),
`accent-strong`/`sheet` and `accent-strong`/`paper` (3:1), `accent`/`rail` (3:1).
