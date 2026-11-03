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
- **Last updated**: 2026-11-02 (feature 006: lime accent, pizarra surfaces, the balanced
  board, the panel's theme switch). Approved by the owner on 2026-11-02 («Apruebo en verde»: delivered
  stays `success`, not lime) (feature 006, FR-001).

## 1. Principles for Domy

1. **The courier app comes first.** It is used one-handed, outdoors, on low-end Android
   phones, often in poor signal. Every rule here is checked against that context first.
2. **Familiar over novel.** 75 % of couriers use Android; M3 patterns (navigation bar,
   floating action button, snackbar, bottom sheet) are already known to them.
3. **Status at a glance.** The shipment state, pending sync count, and at-risk windows are
   always visible without scrolling.
4. **One primary action per screen** on the courier app, reachable with the thumb.
5. **Offline is a normal state**, not an error: shown calmly and persistently (§8).

For the dispatch panel, the identity adopted on 2026-10-01 and revised with the balanced
board on 2026-11-02:

6. **Every hour on the page, the rest one click away.** What a person looks at or acts on
   every hour stays visible; everything else sits behind a link, a side panel, or "Ver todos".
   Long lists show a bounded first page. A screen that needs scrolling to be understood is
   overloaded.
7. **Tracking numbers read like parcel labels**: condensed, heavy, always the same.
8. **Color means state.** Pizarra and paper carry the interface; strong color is reserved for
   shipment and route states, plus lime, the one accent, for action and focus.
9. **Sentences before tiles.** A page opens with what the person needs to know, in a plain
   sentence, not a grid of numbers.
10. **One bold element per screen**: one lime primary action. Pizarra blocks group live
    summaries; a screen has at most two, and the first one is the screen's own summary.

## 2. Surfaces

| Surface | Users | Primary window size class | Navigation |
| --- | --- | --- | --- |
| Courier app | Couriers | Compact (< 600 dp) | Navigation bar (bottom) |
| Dispatch panel | Dispatcher, owner | Expanded and larger (≥ 1024 px); readable down to 360 px | Pizarra navigation rail, 240 px with labels, collapsible to 76 px with icons only (expanded and larger); a horizontal destination row under the top bar at medium and compact |
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
- **Pizarra surfaces**: the dark blocks (navigation rail, the board's summary and courier
  list, the courier app's header and navigation bar, snackbars) come from a palette of the
  seed's own hue at chroma 14, the tone of the approved board (`#141F2A` is tone 11).
- **Accent**: **Lima `#C8F23C`** (tone 90 of its own palette), adopted on 2026-11-02 for every
  app, replacing verde azulado `#1F7A8C`. It is kept as chosen, not harmonized. Lime is a
  **fill or a mark, never text or a thin line on a light surface** (it reaches only 1.3:1 on
  white): the one primary action of a screen, the current page in the rail, a selected stage,
  the courier's next stop, the live indicator, and focus on pizarra and in the dark scheme.
  Text on lime is `on-accent` (tone 10, 13.3:1). On light surfaces, focus outlines and thin
  accent lines use `accent-strong` (tone 50, 4.5:1 on white, 3.9:1 on paper).
- Schemes shipped: light, dark, and **high contrast** (M3 contrast level "high"). The
  courier app offers high contrast as a one-tap setting for direct sunlight.
- Default: the panel and the public pages follow the device. The panel's top bar has a
  light/dark switch; the choice is remembered on that computer (`domy-theme` in local
  storage) until the person switches back. The courier app follows the phone and keeps its
  high-contrast setting.

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
| `sheet` | neutral 100 / 12 | Content: lists, forms, dialogs, menus, the side panel |
| `sheet-alt` | neutral 97 / 15 | Table headers, bins inside a sheet |
| `rail` | pizarra 11 / 11 (high contrast 8) | Pizarra surfaces: navigation rail, sign-in panel, the board's summary and courier list, the courier app's header and navigation bar, snackbars |
| `rail-raised` | pizarra 20 / 20 | Hover and pressed on pizarra |
| `rail-line` | pizarra 25 / 25 | Dividers and outlines on pizarra |
| `on-rail` / `on-rail-variant` | neutral 98 / 92, pizarra 80 / 80 | Text on pizarra |
| `rail-success`, `rail-warning`, `rail-error`, `rail-info`, `rail-tertiary` | the state's dark-scheme color (tone 80) | State marks and labels on pizarra (about 10:1), where tone-40 roles are unreadable |
| `accent` / `on-accent` | lime 90 / lime 10 | The one primary action, current page, selected stage, next stop, live indicator; text on lime |
| `accent-strong` | lime 50 / lime 80 | Focus outline and thin accent lines on light surfaces (dark: on sheets) |

### 3.3 Custom colors for shipment states

M3 defines only `error`. Domy adds three state **custom colors**, each with its four roles
(color, on-color, container, on-container), harmonized with the seed, plus the accent (§3.1,
§3.2), kept as chosen:

| Custom color | Base | Used for |
| --- | --- | --- |
| `accent` | `#C8F23C` | Action and focus (§3.1); never a state |
| `success` | `#2E7D32` | Delivered, synced |
| `warning` | `#F9A825` | At risk, returned, pending sync, photo skipped, fee to review |
| `info` | `#1E6FD9` | On the way (in route, picked up), informational notices |

`error` covers late shipments, delivery exceptions, and failed sync; `tertiary` marks
"Asignado" and pending handovers. Color is never the only signal: every state also carries
its label or shape. On pizarra the same states use their `rail-*` roles (§3.2). Delivered is
always `success`, never lime: lime means "act here", not "done".

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
| `--ring` | `accent-strong` (on pizarra and in the dark scheme, `accent`) |

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
| `text-lede` | 21/30 (18/26 below 840 px) | 400 | 100 % | 0 |
| `text-figure` (stage counts and other key figures) | 28/32 (24/28 below 840 px) | 650 | 112 % | −0.02 em |
| `guia` (tracking numbers; combine with any size) | — | 700 | 75 % | 0.03 em |

- Section titles inside a screen ("Por resolver", "Mensajeros", "Envíos") use Title L at
  106 % width and weight 650, followed by their count in Body M, `on-surface-variant`.

- Courier app minimum body text: **Body L (16 px)**. Money amounts and tracking numbers use
  tabular figures.
- Sizes are set in `rem` so they follow the user's system font size.
- Line length stays under 80 characters (the board's opening sentence: 68).

## 5. Layout and spacing

- 4 dp base grid; spacing utilities use multiples of 4.
- **Targets**: courier app and public pages **48 × 48 px minimum** (Constitution VII);
  fields and buttons 48 px high, chips 36 px with a 48 px target. Dispatch panel (pointer
  first): fields and buttons **44 px** high, chips 36 px with a 44 px target, and no
  interactive element under 24 × 24 px (WCAG 2.2 target size).
- Dispatch panel: the pizarra navigation rail (240 px, 76 px collapsed) beside a paper
  canvas; content is centered in a column of at most 1520 px with gutters of 16–32 px (2.4 %
  of the width), laid out in sheets with 20 px between blocks.
- Long text (client, recipient, neighborhood, errand) wraps to at most two lines; it is never
  cut without a way to read it.
- Courier app: primary actions sit in the bottom third of the screen; destructive actions
  are never adjacent to the primary action.
- Margins and panes follow M3 canonical layouts: list-detail for the dispatch board,
  supporting pane for route building.

## 6. Shape, elevation, motion, and states

| Token group | Values (M3) |
| --- | --- |
| Shape (corner radius) | Domy scale: extra-small 6 (marks, bars) · small 10 (buttons, fields, menus, icon tiles — M3 Expressive "square" shape) · medium 16 (sheets, pizarra panels) · large 20 (the board's summary block, dialogs) · extra-large 28 · full (avatars, chips, round icon buttons) |
| Elevation (tonal, levels 0–5) | 0 · 1 · 3 · 6 · 8 · 12 dp; expressed through surface-container roles, shadows only where M3 requires them |
| Easing | standard `cubic-bezier(0.2, 0, 0, 1)` · emphasized decelerate `cubic-bezier(0.05, 0.7, 0.1, 1)` · emphasized accelerate `cubic-bezier(0.3, 0, 0.8, 0.15)` |
| Duration | short 50–200 ms · medium 250–400 ms · long 450–600 ms |
| State layer opacity | hover 8 % · focus 10 % · pressed 10 % · dragged 16 % |

All motion respects `prefers-reduced-motion` (it is then removed, not shortened). The panel
has one orchestrated moment: the board's progress bar draws in from the left, once, when a day
loads (medium duration, emphasized decelerate). Two ambient signals repeat: the live
indicator beside "Actualizado hace N s" and the courier's next stop, both a soft lime pulse
every 2.2 s. Everything else moves only in answer to the person: the side panel slides in
(280 ms, emphasized decelerate), snackbars rise, arrows nudge on hover.

## 7. Components

M3 component → implementation. shadcn/ui components are restyled with the tokens above;
components shadcn/ui lacks are built once in the web app's shared UI folder, following the M3
spec.

| M3 component | Implementation | Domy usage |
| --- | --- | --- |
| Buttons (filled, tonal, outlined, text) | shadcn `Button` with M3 variants | Lime filled (`accent`) = the one primary action per screen; slate filled (`primary`) = a row's or a panel's main action ("Decidir", "Resolver revisión"); outlined = other actions; text = links and "Ver todos" |
| Floating action button | Custom, M3 spec | Courier: main route action, lime |
| Navigation bar | Custom, M3 spec, on `rail` | Courier app, 3–4 destinations; the current one with a lime indicator |
| Navigation rail / drawer | shadcn `Sidebar` restyled on `rail` | Dispatch panel: the wordmark (only the symbol when collapsed), destinations in groups, the current page filled in lime, the account and "Cerrar sesión" at the foot; a "Saltar al contenido" link comes first |
| Top app bar | Custom, M3 spec | Panel: rail toggle, global search (`/` jumps to it) with its results, "Actualizado hace N s", the theme switch, "Registro masivo" (outlined), and "Nuevo envío" (lime) |
| Side panel | shadcn `Sheet` (right, 480 px, full width on phones) | A shipment's detail and actions opened from a list without leaving it; focus moves in and returns to the opener; Escape closes |
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
| Tabs | Buttons with `aria-pressed`, M3 secondary tabs look | Status filter of lists (Todos, Por salir, En camino, Entregados, Novedades, Cerrados) with each count |
| Search | shadcn `Command` | Global search by tracking number, merchant, recipient |
| Data list | Grid rows on a `sheet` (each row one button that opens the item); TanStack Table only once sorting or column controls are needed | Dispatch board, history, master data. M3 has no data table spec; fixed columns that line up across a page's lists, a header row on `sheet-alt`, a second line in `body-s` for related facts, a bounded first page with "Ver los N", and cards instead of columns below 820 px |
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
- **Day summary** (dispatch board): one pizarra block (radius large) that opens the board.
  Top left: the title (the day, Display S), the day stepper and date field, and the **day
  sentence** in `text-lede` `on-rail-variant` — shipments, deliveries, pending from earlier
  days, late (`rail-error`) and at risk (`rail-warning`), and the cash still to collect —
  with numbers in `on-rail`, weight 650. Top right: **shortcuts** to the screens that own a
  job ("N envíos sin asignar → Rutas", "N clientes por notificar → Notificar clientes"), each a
  row with its icon, count, a hint, and a lime arrow. Bottom: the **stage counts**.
- **Stage counts**: a progress bar of 8 px segments, one per open stage in its state's
  `rail-*` tone (Por salir neutral, En camino `rail-info`, Entregados `rail-success`, Novedades
  `rail-error`), proportional to its count, then one button per stage (Por salir, En camino,
  Entregados, Novedades, Cerrados) with a colored square, the label, the count in
  `text-figure`, and a one-line breakdown ("5 registrados · 3 asignados", "43 % de hoy",
  "1 por decidir"). Pressing a stage filters the list below (`aria-pressed`, filled lime) and
  scrolls to it; pressing it again clears the filter.
- **Por resolver** (dispatch board): the things that need a person now, on a sheet beside the
  courier list, in this order: delivery exceptions to decide, late, pending handovers, at risk,
  pickup problems; at most five, the rest behind "Ver los N" in the section title. Each row: a
  tone tile with the icon (`error-container`, `warning-container`, `tertiary-container`), a
  tag in the state's color ("Novedad por decidir", "Atrasado · 17 min"), what and who in Title
  S, the detail in Body S, and **one** action ("Decidir" slate filled; "Reasignar",
  "Confirmar", "Asignar" outlined). A last line, "Además: 1 recaudo diferente, 1 por revisar,
  1 sin foto…", filters the list by alerts. Empty: "Todo bajo control".
- **Courier progress** (dispatch board): a pizarra sheet, one row per courier, ordered by
  need (late, then at risk, then out of sync, routes in preparation last): initials, name
  (pressing it filters the list by that courier), route, "5 de 7 paradas", the **stop
  track**, one or two short notes in `rail-*` tones (late, at risk, handover, "Sin
  sincronizar hace 38 min", "Lista para despachar"), and one button: call, or dispatch (lime)
  for a route in preparation. Stop track marks, joined by a line that brightens between done
  stops: pickup done = hollow `rail-success` ring; delivery done = solid `rail-success` dot;
  exception = `rail-error` square; pending = `rail-line` ring; the next stop pulses in lime. A
  legend closes the block. "Ver rutas" in the title opens Rutas.
- **Shipment list** (dispatch board, history): the section title with the count, the filters
  on the right (an "Con alerta" chip, client and courier selects), status tabs under it, then
  the data list ordered by need (exceptions, late, at risk, earlier days, other alerts,
  open, closed), eight rows first and "Ver los N envíos". A row: tracking number (and
  "Exprés", "31 oct, pendiente" or the kind under it), client, recipient and neighborhood,
  courier and route, window and its at-risk or late tag, COD, state mark and its first note.
  Opening a row opens the side panel.
- **Empty state**: on a sheet, an icon in a `secondary-container` circle, what happened, and
  the next action; never a bare sentence.
- **Error and not-found screens**: the same pattern, with "Reintentar" or "Ir al tablero";
  a failed page never stays blank.
- **Global search** (top app bar): outlined search field; Enter opens "Historial" with the
  term; `/` focuses it from anywhere outside a field.
- **Screens outside the panel** (sign-in, recovery, the courier's waiting page): the wordmark
  on `rail` beside a plain form on `paper`; stacked on narrow screens.
- **Courier app look**: light surfaces (`paper`, `sheet`) for every screen's content, so it
  reads in sunlight; pizarra only for the header (the wordmark, the high-contrast and sign-out
  buttons) and the navigation bar; the main route action is the lime floating action button.
  The dark scheme follows the phone; high contrast stays one tap away.

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
- Visible focus indicator on every interactive element: a 3 px outline, 2 px away, in
  `accent-strong` on light surfaces and in `accent` on pizarra and in the dark scheme.
- Automated checks run axe in the light and dark schemes, at desktop and phone widths.
- Every icon-only button has an accessible name in Spanish.
- High contrast scheme available on the courier app (§3.1).

## 11. Brand

| Item | Decision |
| --- | --- |
| Product name | Domy (company: Cohex, shown as operator and support contact) |
| Seed color | Pizarra `#34495E` (§3.1); accent lima `#C8F23C` (since 2026-11-02; before, verde azulado `#1F7A8C`) |
| Logo direction | **"Route d"**: a geometric lowercase "d" drawn as a route that starts at one point (pickup) and closes at another (delivery). No sector clichés (scooter, box, map pin, speed arrows). |
| Wordmark | Lowercase "domy" drawn, not typeset: the symbol is its d, and "omy" continues at the same stroke weight, with the same round ends, and in one color, ending in a solid point on the tail of the y. It takes the current text color (`text-on-rail` on the rail, `text-primary` on light surfaces). The collapsed rail shows only the symbol. The UI itself is set in Archivo (§4). |
| App icon | White symbol on the seed color |
| Status | Direction approved 2026-09-30; symbol artwork chosen by the owner 2026-11-02 (option A); wordmark chosen by the owner 2026-11-02 (option 1, one color from the d to the y). `pnpm icons` draws every asset from it |

Required brand assets:

| Asset | Size | Use |
| --- | --- | --- |
| Master logo | SVG | Source for every other asset |
| Wordmark | SVG, `apps/web/src/assets/brand/` in the current text color, `public/icons/wordmark.svg` in the seed color | The interface's headers and the link preview |
| Favicon | SVG | Browser tab |
| App icons | PNG 192 and 512, purpose `any` | PWA install |
| Maskable icon | PNG 512, symbol inside the central 409 px circle, separate file | Android adaptive shapes |
| Monochrome icon | SVG, purpose `monochrome` | Android 13+ themed icons |
| Apple touch icon | PNG 180 | iOS home screen |
| Link preview image | 1200 × 630 | Tracking links shared on WhatsApp |
