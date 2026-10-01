# Design System

Domy's user interface follows **Material Design 3** (M3) as its design language, implemented
with **Tailwind CSS** and **shadcn/ui** components. This document is the source of truth for
how M3 is applied in Domy; anything it does not cover defers to the official specification.

- **Specification**: [m3.material.io](https://m3.material.io) (foundations, styles, components)
- **Color tooling**: [Material Color Utilities](https://github.com/material-foundation/material-color-utilities)
  (official, Apache 2.0) generates every color role from one seed color
- **Icons**: [Material Symbols](https://fonts.google.com/icons) **Rounded** (Apache 2.0),
  imported as individual SVGs, never as an icon font (§7.1)
- **Owner**: Samuel Calderón owns visual decisions.
- **Last updated**: 2026-09-30

## 1. Principles for Domy

1. **The courier app comes first.** It is used one-handed, outdoors, on low-end Android
   phones, often in poor signal. Every rule here is checked against that context first.
2. **Familiar over novel.** 75 % of couriers use Android; M3 patterns (navigation bar,
   floating action button, snackbar, bottom sheet) are already known to them.
3. **Status at a glance.** The shipment state, pending sync count, and at-risk windows are
   always visible without scrolling.
4. **One primary action per screen** on the courier app, reachable with the thumb.
5. **Offline is a normal state**, not an error: shown calmly and persistently (§8).

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

- Every color role is generated from a single **seed color** with Material Color Utilities
  and committed as CSS variables. Hand-picked hex values outside the generated scheme are
  forbidden.
- **Seed color**: **Ink indigo `#2B3A8F`**, scheme variant **Tonal Spot** (M3 default). Chosen
  because it is premium and calm, clashes with no state color (§3.3), and no local delivery
  competitor uses it (Rappi and DiDi orange, Mercado Libre yellow, Uber black, Servientrega
  green). The logo uses the seed exactly.
- The `info` custom color shifts toward cyan so it stays distinct from the indigo primary.
- Schemes shipped: light, dark, and **high contrast** (M3 contrast level "high"). The
  courier app offers high contrast as a one-tap setting for direct sunlight.
- Default: light scheme; the dispatch panel and pages follow the device preference.

### 3.2 Roles used

Standard M3 roles only: `primary`, `on-primary`, `primary-container`,
`on-primary-container`, the same four for `secondary`, `tertiary`, and `error`, plus
`surface`, `on-surface`, `on-surface-variant`, `surface-container-lowest`,
`surface-container-low`, `surface-container`, `surface-container-high`,
`surface-container-highest`, `surface-dim`, `surface-bright`, `inverse-surface`,
`inverse-on-surface`, `inverse-primary`, `outline`, `outline-variant`, `scrim`, `shadow`.

### 3.3 Custom colors for shipment states

M3 defines only `error`. Domy adds three **custom colors**, generated and harmonized with
the seed through Material Color Utilities, each with its four roles (color, on-color,
container, on-container):

| Custom color | Used for |
| --- | --- |
| `success` | Delivered, synced |
| `warning` | At risk, pending sync, photo skipped |
| `info` | In route, informational notices |

`error` covers late shipments, delivery exceptions, and failed sync. Color is never the only
signal: every state also carries a label and, where space allows, an icon.

### 3.4 Mapping to shadcn/ui tokens

shadcn/ui components read their own variable names; they are aliases of M3 roles:

| shadcn/ui token | M3 role |
| --- | --- |
| `--background` | `surface` |
| `--foreground` | `on-surface` |
| `--card` / `--card-foreground` | `surface-container-low` / `on-surface` |
| `--popover` / `--popover-foreground` | `surface-container` / `on-surface` |
| `--primary` / `--primary-foreground` | `primary` / `on-primary` |
| `--secondary` / `--secondary-foreground` | `secondary-container` / `on-secondary-container` |
| `--muted` / `--muted-foreground` | `surface-container-high` / `on-surface-variant` |
| `--accent` / `--accent-foreground` | `secondary-container` / `on-secondary-container` |
| `--destructive` | `error` |
| `--border` | `outline-variant` |
| `--input` | `outline` |
| `--ring` | `primary` |

## 4. Typography

- **Typeface**: Roboto (preinstalled on Android). A self-hosted Roboto subset (Latin, WOFF2)
  is the fallback for iOS and desktop and is cached by the service worker for offline use.
  No third-party font requests.
- **Type scale**: the M3 baseline scale, exposed as Tailwind utilities (`text-display-l` …
  `text-label-s`):

| Role | Size / line height (px) | Weight | Tracking (px) |
| --- | --- | --- | --- |
| Display L / M / S | 57/64 · 45/52 · 36/44 | 400 | −0.25 · 0 · 0 |
| Headline L / M / S | 32/40 · 28/36 · 24/32 | 400 | 0 |
| Title L / M / S | 22/28 · 16/24 · 14/20 | 400 · 500 · 500 | 0 · 0.15 · 0.1 |
| Body L / M / S | 16/24 · 14/20 · 12/16 | 400 | 0.5 · 0.25 · 0.4 |
| Label L / M / S | 14/20 · 12/16 · 11/16 | 500 | 0.1 · 0.5 · 0.5 |

- Courier app minimum body text: **Body L (16 px)**. Money amounts and tracking numbers use
  tabular figures.
- Sizes are set in `rem` so they follow the user's system font size.

## 5. Layout and spacing

- 4 dp base grid; spacing utilities use multiples of 4.
- **Touch targets: minimum 48 × 48 dp** everywhere (M3 and Constitution VII agree).
- Courier app: primary actions sit in the bottom third of the screen; destructive actions
  are never adjacent to the primary action.
- Margins and panes follow M3 canonical layouts: list-detail for the dispatch board,
  supporting pane for route building.

## 6. Shape, elevation, motion, and states

| Token group | Values (M3) |
| --- | --- |
| Shape (corner radius) | none 0 · extra-small 4 · small 8 · medium 12 · large 16 · extra-large 28 · full |
| Elevation (tonal, levels 0–5) | 0 · 1 · 3 · 6 · 8 · 12 dp; expressed through surface-container roles, shadows only where M3 requires them |
| Easing | standard `cubic-bezier(0.2, 0, 0, 1)` · emphasized decelerate `cubic-bezier(0.05, 0.7, 0.1, 1)` · emphasized accelerate `cubic-bezier(0.3, 0, 0.8, 0.15)` |
| Duration | short 50–200 ms · medium 250–400 ms · long 450–600 ms |
| State layer opacity | hover 8 % · focus 10 % · pressed 10 % · dragged 16 % |

All motion respects `prefers-reduced-motion`.

## 7. Components

M3 component → implementation. shadcn/ui components are restyled with the tokens above;
components shadcn/ui lacks are built once in the web app's shared UI folder, following the M3
spec.

| M3 component | Implementation | Domy usage |
| --- | --- | --- |
| Buttons (filled, tonal, outlined, text) | shadcn `Button` with M3 variants | Filled = the one primary action per screen |
| Floating action button | Custom, M3 spec | Courier: main route action; dispatcher: new shipment |
| Navigation bar | Custom, M3 spec | Courier app, 3–4 destinations |
| Navigation rail / drawer | shadcn `Sidebar` restyled | Dispatch panel |
| Top app bar | Custom, M3 spec | All app surfaces |
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
| Tabs | shadcn `Tabs` | Dispatch panel sections |
| Search | shadcn `Command` | Global search by tracking number, merchant, recipient |
| Data table | shadcn `Table` with M3 tokens; TanStack Table only once sorting or column controls are needed | Dispatch board, history, master data. M3 has no data table spec; use dense rows (40 px) on desktop only; wide tables scroll inside their own focusable area |

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
- **Shipment state chip**: label + icon + custom color role (§3.3), identical on every
  surface.
- **At-risk and late**: `warning` and `error` roles with the remaining or overdue time.
- **Photo skipped**: `warning` chip "Sin foto" on the dispatch board.
- **Registered by dispatch**: events recorded on a courier's behalf show an `info` label
  "Registrado por despacho" in the history.

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
| Seed color | Ink indigo `#2B3A8F` (§3.1) |
| Logo direction | **"Route d"**: a geometric lowercase "d" drawn as a route that starts at one point (pickup) and closes at another (delivery). No sector clichés (scooter, box, map pin, speed arrows). |
| Wordmark | Lowercase "domy" in an open-license geometric sans (Manrope or Plus Jakarta Sans), customized. Logo only; the UI stays in Roboto. |
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
