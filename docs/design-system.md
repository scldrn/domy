# Design System

Domy's user interface follows **Material Design 3** (M3) as its design language, implemented
with **Tailwind CSS** and **shadcn/ui** components. M3 sets the components, states, roles, and
accessibility; Domy expresses its own identity through the axes M3 leaves open — typeface,
color scheme, shape, and a few patterns of its own (§8). This document is the source of truth
for how M3 is applied in Domy; anything it does not cover defers to the official specification.

- **Specification**: [m3.material.io](https://m3.material.io) (foundations, styles, components)
- **Color tooling**: [Material Color Utilities](https://github.com/material-foundation/material-color-utilities)
  (official, Apache 2.0) generates every color role from one seed color
- **Icons**: [Material Symbols](https://fonts.google.com/icons) **Rounded** (Apache 2.0),
  imported as individual SVGs, never as an icon font (§7.1)
- **Owner**: Samuel Calderón owns visual decisions.
- **Last updated**: 2026-10-13

## 1. Principles for Domy

1. **The courier app comes first.** It is used one-handed, outdoors, on low-end Android
   phones, often in poor signal. Every rule here is checked against that context first.
2. **Familiar over novel.** 75 % of couriers use Android; M3 patterns (navigation bar,
   floating action button, snackbar, bottom sheet) are already known to them.
3. **Status at a glance.** The shipment state, pending sync count, and at-risk windows are
   always visible without scrolling.
4. **One primary action per screen** on the courier app, reachable with the thumb.
5. **Offline is a normal state**, not an error: shown calmly and persistently (§8).

For the dispatch panel, the identity adopted on 2026-10-01:

6. **The day and the clock organize the board.** Delivery windows against "now" are the
   board's first picture (§8, day ribbon); everything else is quieter.
7. **Tracking numbers read like parcel labels**: condensed, heavy, always the same.
8. **Color means state.** Slate and paper carry the interface; strong color is reserved for
   shipment states, plus one accent for focus and "now".
9. **Sentences before tiles.** A page opens with what the person needs to know, in a plain
   sentence, not a grid of numbers.
10. **One bold element per screen**; the rest stays disciplined.

## 2. Surfaces

| Surface | Users | Primary window size class | Navigation |
| --- | --- | --- | --- |
| Courier app | Couriers | Compact (< 600 dp) | Navigation bar (bottom) |
| Dispatch panel | Dispatcher, owner | Expanded and larger (≥ 840 dp); must remain usable at medium | Navigation rail (expanded), navigation drawer (large and larger) |
| Tracking page | Merchants, recipients | Compact first, any size | None: single page |
| Merchant link (C-03) | Merchants | Compact first, any size | None: single page |

Window size classes follow M3: compact < 600 dp, medium 600–839, expanded 840–1199,
large 1200–1599, extra-large ≥ 1600.

## 3. Color

### 3.1 Scheme generation

- Every color role is generated with Material Color Utilities by
  `scripts/generate-design-tokens.ts` (`pnpm tokens`) and committed as CSS variables in
  `apps/web/src/styles/tokens.css`. Hand-picked hex values outside the generated scheme are
  forbidden.
- **Seed color**: **Pizarra (slate) `#34495E`**, scheme variant **Tonal Spot** (M3 default)
  with two adjustments: the primary palette keeps the seed's own chroma, so primary actions
  are slate rather than a brighter blue, and the neutral palettes drop to chroma 4 and 8, so
  surfaces read as cool paper.
  Chosen on 2026-10-01 from five proposals rendered on the dispatch board (it replaced ink
  indigo `#2B3A8F`): sober and professional, it leaves strong color to the state colors
  (§3.3), and no local delivery competitor uses it (Rappi and DiDi orange, Mercado Libre
  yellow, Uber black, Servientrega green). The logo uses the seed exactly.
- **Accent**: **Verde azulado `#1F7A8C`**, a custom color (§3.3) used only for the focus
  indicator, the "now" line of the board, and the current page's icon in the navigation
  rail. Selections use `secondary-container` (soft slate), so the accent stays rare.
- Schemes shipped: light, dark, and **high contrast** (M3 contrast level "high"). The
  courier app offers high contrast as a one-tap setting for direct sunlight.
- Default: light scheme; the dispatch panel and pages follow the device preference.

### 3.2 Roles used

The standard M3 roles: `primary`, `on-primary`, `primary-container`,
`on-primary-container`, the same four for `secondary`, `tertiary`, and `error`, plus
`surface`, `on-surface`, `on-surface-variant`, `surface-container-lowest`,
`surface-container-low`, `surface-container`, `surface-container-high`,
`surface-container-highest`, `surface-dim`, `surface-bright`, `inverse-surface`,
`inverse-on-surface`, `inverse-primary`, `outline`, `outline-variant`, `scrim`, `shadow`.

Domy's surface roles, taken from the same palettes (tones in light / dark):

| Role | Tone | Used for |
| --- | --- | --- |
| `paper` | neutral 94 / 6 | Page background |
| `sheet` | neutral 100 / 12 | Content: tables, forms, the ribbon, dialogs, menus |
| `sheet-alt` | neutral 97 / 15 | Table headers, bins inside a sheet |
| `rail` | primary 20 / 8 | Navigation rail, sign-in panel, snackbar |
| `rail-raised` | primary 30 / 20 | Current page in the rail (the seed itself in light) |
| `on-rail` / `on-rail-variant` | neutral 98 / 92, variant 80 / 75 | Text on the rail |
| `rail-accent` | accent 80 | Current page's icon |

### 3.3 Custom colors for shipment states

M3 defines only `error`. Domy adds four **custom colors**, each with its four roles (color,
on-color, container, on-container); the state colors are harmonized with the seed, the
accent is kept as chosen:

| Custom color | Base | Used for |
| --- | --- | --- |
| `accent` | `#1F7A8C` | Focus indicator, "now" on the board (§3.1) |
| `success` | `#2E7D32` | Delivered, synced |
| `warning` | `#F9A825` | At risk, returned, pending sync, photo skipped, fee to review |
| `info` | `#1E6FD9` | On the way (in route, picked up), informational notices |

`error` covers late shipments, delivery exceptions, and failed sync; `tertiary` marks
"Asignado". Color is never the only signal: every state also carries its label.

Route statuses reuse these roles, so a route reads like its shipments (adopted 2026-10-13):
"En preparación" `tertiary` (as "Asignado"), "En curso" `info` (as on the way), "Finalizada"
`success` (as "Entregado"), and "Cancelada" neutral (`on-surface-variant` with an
`outline-variant` dot, as "Anulado").

### 3.4 Mapping to shadcn/ui tokens

shadcn/ui components read their own variable names; they are aliases of M3 roles:

| shadcn/ui token | M3 role |
| --- | --- |
| `--background` | `paper` |
| `--foreground` | `on-surface` |
| `--card` / `--card-foreground` | `sheet` / `on-surface` |
| `--popover` / `--popover-foreground` | `sheet` / `on-surface` |
| `--primary` / `--primary-foreground` | `primary` / `on-primary` |
| `--secondary` / `--secondary-foreground` | `secondary-container` / `on-secondary-container` |
| `--muted` / `--muted-foreground` | `surface-container-high` / `on-surface-variant` |
| `--accent` / `--accent-foreground` | `secondary-container` / `on-secondary-container` |
| `--destructive` | `error` |
| `--border` | `outline-variant` |
| `--input` | `outline` |
| `--ring` | `accent` |

The Tailwind utilities `secondary` and `accent` name M3's `secondary` role and Domy's
`accent` color, not shadcn's tokens of the same name; shadcn's tokens stay internal.

## 4. Typography

- **Typeface**: **Archivo** (Omnibus-Type, SIL OFL 1.1), one variable family with width
  (62–125 %) and weight (100–900) axes. Self-hosted from `@fontsource-variable/archivo`
  (Latin subsets load on demand, about 90 KB) and cached by the service worker for offline
  use. No third-party font requests.
- **Width carries the hierarchy**: headlines widen (108–118 %), body text stays at 100 %,
  and tracking numbers condense (75 %) like a parcel label.
- **Type scale**: a modular scale from 12 to 56 px, exposed as Tailwind utilities with the
  M3 role names (`text-display-l` … `text-label-s`), plus two of Domy's own:

| Role | Size / line height (px) | Weight | Width | Tracking |
| --- | --- | --- | --- | --- |
| Display L / M / S | 56/56 · 44/46 · 36/40 | 650 | 118 · 116 · 114 % | −0.025 · −0.02 · −0.02 em |
| Headline L / M / S | 40/44 · 32/37 · 24/30 | 650 · 650 · 600 | 115 · 112 · 108 % | −0.02 · −0.015 · −0.01 em |
| Title L / M / S | 20/28 · 17/25 · 15/21 | 600 | 100 % | 0 |
| Body L / M / S | 16/24 · 15/22 · 13/18 | 400 | 100 % | 0 |
| Label L / M / S | 15/20 · 13/17 · 12/16 | 550 | 100 % | 0.005 · 0.01 · 0.015 em |
| `text-lede` | 19/29 | 400 | 100 % | 0 |
| `guia` (tracking numbers; combine with any size) | — | 700 | 75 % | 0.03 em |

- Courier app minimum body text: **Body L (16 px)**. Money amounts and tracking numbers use
  tabular figures.
- Sizes are set in `rem` so they follow the user's system font size.
- Line length stays under 80 characters (the board's opening sentence: 68).

## 5. Layout and spacing

- 4 dp base grid; spacing utilities use multiples of 4.
- **Touch targets: minimum 48 × 48 dp** everywhere (M3 and Constitution VII agree); fields
  and buttons are 48 px high, chips are 32 px with a 48 px target.
- Dispatch panel: a dark navigation rail (240 px, 72 px collapsed) beside a paper canvas;
  content is left-aligned in a column of at most 1280 px with 32 px gutters, laid out in
  sheets.
- Courier app: primary actions sit in the bottom third of the screen; destructive actions
  are never adjacent to the primary action.
- Margins and panes follow M3 canonical layouts: list-detail for the dispatch board,
  supporting pane for route building.

## 6. Shape, elevation, motion, and states

| Token group | Values (M3) |
| --- | --- |
| Shape (corner radius) | Domy scale: extra-small 6 (marks, bars) · small 10 (buttons, fields, chips, menus — M3 Expressive "square" shape) · medium 14 (sheets) · large 20 (dialogs) · extra-large 28 · full (avatars, round icon buttons) |
| Elevation (tonal, levels 0–5) | 0 · 1 · 3 · 6 · 8 · 12 dp; expressed through surface-container roles, shadows only where M3 requires them |
| Easing | standard `cubic-bezier(0.2, 0, 0, 1)` · emphasized decelerate `cubic-bezier(0.05, 0.7, 0.1, 1)` · emphasized accelerate `cubic-bezier(0.3, 0, 0.8, 0.15)` |
| Duration | short 50–200 ms · medium 250–400 ms · long 450–600 ms |
| State layer opacity | hover 8 % · focus 10 % · pressed 10 % · dragged 16 % |

All motion respects `prefers-reduced-motion`. The panel has one orchestrated moment: the
board's windows draw in from their start, once, when a day loads; everything else moves only
in answer to the person (opening, expanding, confirming).

## 7. Components

M3 component → implementation. shadcn/ui components are restyled with the tokens above;
components shadcn/ui lacks are built once in the web app's shared UI folder, following the M3
spec.

| M3 component | Implementation | Domy usage |
| --- | --- | --- |
| Buttons (filled, tonal, outlined, text) | shadcn `Button` with M3 variants | Filled = the one primary action per screen |
| Floating action button | Custom, M3 spec | Courier: main route action; dispatcher: new shipment |
| Navigation bar | Custom, M3 spec | Courier app, 3–4 destinations |
| Navigation rail / drawer | shadcn `Sidebar` restyled on `rail` | Dispatch panel: product name, destinations in groups, the account and "Cerrar sesión" at the foot; a "Saltar al contenido" link comes first |
| Top app bar | Custom, M3 spec | Panel: global search (`/` jumps to it) and "Nuevo envío" |
| Cards | shadcn `Card` | Stops, shipments, tracking summary |
| Lists | Custom, M3 spec | Route stops, search results |
| Chips (filter, assist, input) | shadcn `Toggle`/`Badge` restyled | Board filters, payment mode, delivery window presets |
| Text fields (outlined) | shadcn `Input`, `Textarea` restyled | All forms; outlined variant only |
| Menus, select | shadcn `DropdownMenu`, `Select`, `Combobox` | Merchant, neighborhood, and courier pickers |
| Dialogs | shadcn `Dialog` / `AlertDialog` | Confirmations |
| Bottom sheets | shadcn `Drawer` | Courier: confirm delivery, report exception |
| Snackbar | Sonner, restyled | Action feedback, sync results |
| Progress indicators | Custom, M3 spec | Sync, uploads |
| Badges | shadcn `Badge` restyled | Pending sync count, at-risk count |
| Segmented buttons | shadcn `ToggleGroup` restyled | Board views, payment method |
| Date and time pickers | shadcn `Calendar` + `Popover`, `es` locale | Delivery windows, history filters |
| Tabs | Buttons with `aria-pressed`, M3 secondary tabs look | Board status filter with each status's count |
| Search | shadcn `Command` | Global search by tracking number, merchant, recipient |
| Data table | shadcn `Table` on a `sheet`; TanStack Table only once sorting or column controls are needed | Dispatch board, history, master data. M3 has no data table spec; fixed columns that line up across a page's tables, a second line in `body-s` for related facts, wide tables scroll inside their own focusable area |
| File picker | Native input, visually hidden, opened by an outlined button "Elegir archivo" | Bulk registration |

### 7.1 Icons

| Axis | Value |
| --- | --- |
| Style | Rounded (matches M3 shapes and the Material 3 Expressive direction) |
| Weight | 400 |
| Fill | 0 by default; 1 for the selected navigation destination |
| Optical size | 24 px on the courier app; 20 px in dense dispatch tables |
| Grade | 0 on light schemes; −25 on the dark scheme |

## 8. Domy patterns

- **Connectivity banner** (courier app): persistent, `warning` container, text "Sin
  conexión — N acciones pendientes". Never blocks the screen.
- **Sync indicator**: badge on the navigation bar with the pending action count; snackbar
  when a sync completes or fails, with a retry action.
- **Shipment state mark**: a dot and the label in the state's color (§3.3), identical on
  every surface; "Registrado" is a hollow dot.
- **Route state mark**: the same dot and label, with the route status roles of §3.3.
- **Tracking number**: `guia` style, the link to the shipment wherever it appears.
- **At-risk and late**: `warning` and `error` roles with the remaining or overdue time.
- **Photo skipped**: `warning` chip "Sin foto" on the dispatch board.
- **Registered by dispatch**: events recorded on a courier's behalf show an `info` label
  "Registrado por despacho" in the history.
- **Page header** (dispatch panel): headline-medium title, an optional supporting line, marks
  (state mark, badges) beside the title, and the page's actions on the right. The board's
  title is the day itself ("Jueves 1 de octubre", announced as "Tablero de despacho, …") with
  the day stepper beside it.
- **Day sentence** (dispatch board): the day in one `text-lede` paragraph — shipments,
  deliveries, pending from earlier days, late and at risk (late in `error`), and the cash still
  to collect; numbers are strong so the eye can scan them.
- **Day ribbon** (dispatch board): the delivery windows from 8 a. m. to 8 p. m. on one sheet,
  one bar per shipment in as few lanes as possible, the elapsed part of the day shaded, and an
  `accent` line at "now"; earlier days' shipments and those without a window sit in bins at
  either side. Bars take the state's tone (late or exception, at risk, on the way, to go,
  delivered). It is a picture of the list below: assistive technology gets its summary and
  the list, pointing at a bar marks its row, and clicking it scrolls there.
- **Empty state**: on a sheet, an icon in a `secondary-container` circle, what happened, and
  the next action; never a bare sentence.
- **Error and not-found screens**: the same pattern, with "Reintentar" or "Ir al tablero";
  a failed page never stays blank.
- **Global search** (top app bar): outlined search field; Enter opens "Historial" with the
  term; `/` focuses it from anywhere outside a field.
- **Screens outside the panel** (sign-in, recovery, the courier's waiting page): the product
  name on `rail` beside a plain form on `paper`; stacked on narrow screens.

## 9. Content

- All user-facing text is Spanish (Colombia), using the glossary's UI terms.
- Sentence case for titles, buttons, and labels ("Confirmar entrega", not "Confirmar
  Entrega").
- Buttons start with a verb. Error messages say what happened and what to do next.
- Money: `$ 13.000` (COP, no decimals, `.` thousands separator). Dates: `30 sep 2026`;
  times: `2:30 p. m.` Formatting uses `Intl` with the `es-CO` locale.

## 10. Accessibility

- WCAG 2.2 AA (Constitution VII). M3 on-color pairs meet 4.5:1 by construction; custom
  combinations must be checked.
- Visible focus indicator on every interactive element (M3 focus ring, `primary`).
- Every icon-only button has an accessible name in Spanish.
- High contrast scheme available on the courier app (§3.1).

## 11. Brand

| Item | Decision |
| --- | --- |
| Product name | Domy (company: Cohex, shown as operator and support contact) |
| Seed color | Pizarra `#34495E` (§3.1); accent verde azulado `#1F7A8C` |
| Logo direction | **"Route d"**: a geometric lowercase "d" drawn as a route that starts at one point (pickup) and closes at another (delivery). No sector clichés (scooter, box, map pin, speed arrows). |
| Wordmark | Lowercase "domy" in an open-license geometric sans (Manrope or Plus Jakarta Sans), customized. Until the artwork exists, the interface shows the name as text in Archivo at 125 % width; the UI itself is set in Archivo (§4). |
| App icon | White symbol on the seed color |
| Status | Direction approved 2026-09-30; artwork pending |

Required brand assets:

| Asset | Size | Use |
| --- | --- | --- |
| Master logo | SVG | Source for every other asset |
| Favicon | SVG | Browser tab |
| App icons | PNG 192 and 512, purpose `any` | PWA install |
| Maskable icon | PNG 512, symbol inside the central 409 px circle, separate file | Android adaptive shapes |
| Monochrome icon | SVG, purpose `monochrome` | Android 13+ themed icons |
| Apple touch icon | PNG 180 | iOS home screen |
| Link preview image | 1200 × 630 | Tracking links shared on WhatsApp |
