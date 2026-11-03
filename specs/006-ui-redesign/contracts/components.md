# Contract: Shared Components

Each shared component has one look and one behavior everywhere (FR-005). Props are the
contract; styling follows [design-tokens.md](design-tokens.md). Existing components are
marked; the rest are new in `apps/web/src/components/`.

| Component | Props (essential) | Behavior and rules |
| --- | --- | --- |
| `PageHeader` (exists, extended) | `title`, `sentence?`, `action?` (one), `aside?` | Title then sentence; at most one emphasized action (FR-007) |
| `SummarySentence` | parts with emphasis and state tone | Reads as one sentence; numbers emphasized; states colored only when they are states |
| `StageCounts` | stages `{ key, label, count, sub }`, `selected`, `onSelect` | Progress bar plus one button per stage with `aria-pressed`; selecting filters and scrolls the list into view |
| `AttentionList` | items from `attention.ts`, `limit` (5), `extraSummary` | One row per item: tone tile, tag, title, detail, one action; "Ver todos"; "Además" line filters the list |
| `StateMark` (exists) | shipment or route status | Dot or shape plus label; same everywhere (FR-006) |
| `TrackingNumber` | `value` | Condensed heavy "guía" style |
| `Money` | `amount` | Integer COP with `$` and thin space; `—` for none |
| `DataList` | columns, rows, `pageSize`, `onOpen` | Grid rows (not a table element inside loops that break semantics), header row, wraps long text to two lines, "Ver los N", rows become cards under 820 px |
| `FilterBar` | tabs, chips, selects | Tabs for status; one alert chip; selects for client and courier; "Quitar filtros" when any is set |
| `SidePanel` (on shadcn `Sheet`) | `open`, `title`, `onClose` | Focus moves in on open and back to the opener on close; Escape closes; sticky header |
| `EmptyState`, `QueryState` (exist) | as today | One calm sentence and, when useful, one action |
| `ThemeSwitch` | — | Toggles `light`/`dark`; label states the target theme; remembered (R3) |
| `Wordmark`, `LogoSymbol` (exist) | `className` | The brand's only representation (FR-009) |

Targets: 24 px in the panel, 48 px in the courier app; visible focus in `accent-strong` on
light surfaces and `accent` on pizarra.
