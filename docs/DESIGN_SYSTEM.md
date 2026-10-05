# Agency OS — Design System

All tokens live in `apps/web/src/app/globals.css` (`@theme static`). Every token is a CSS variable **and** a Tailwind utility; dark mode overrides the same variables under `.dark`. Never hard-code colours, font sizes or radii in pages.

## Palette

| Role | Token / utility | Light | Use |
|---|---|---|---|
| Primary (Royal Blue) | `primary` | `#112250` | Sidebar, main buttons, headings, selected nav, KPI values |
| Secondary (Sapphire) | `secondary` | `#3C507D` | Hover, tabs, secondary buttons, chart series 2 |
| Accent (Quicksand) | `accent` / `accent-strong` (text) | `#E0C58F` / `#86672B` | Indicators, fills, hairlines — ≤5% of the screen. Never as a status or validation colour |
| Background (Swan Wing) | `background` | `#F5F0E9` | App background |
| Surfaces | `surface`, `surface-secondary`, `card` | `#FFFFFF`, `#FAF7F2` | Cards, tables, inputs, dialog footers |
| Borders (Shellstone) | `border`, `border-subtle`, `border-strong` | `#E3D9CF`, `#EDE6DE`, `#D8CBC2` | Dividers, inputs, cards |
| Text | `text-primary`, `text-secondary`, `text-muted` | `#1A2238`, `#3D4560`, `#6B6760` | Navy/charcoal, never pure black |
| Success / Warning / Danger / Info | `success`, `warning`, `danger`, `info` (+ `-soft`, `-foreground`) | muted, accessible variants | Status only |

Charts: `chart-1` Royal (dominant) · `chart-2` Sapphire · `chart-3` gold (one accent series) · `chart-4/5` neutrals · `chart-grid` gridlines.

## Typography — one family (Inter), three sizes

| Class | Size / line | Use |
|---|---|---|
| `text-heading` | 24 / 32 | Page titles, KPI numbers |
| `text-subheading` | 16 / 24 | Section and card titles, dialog titles |
| `text-body` | 14 / 20 | Everything else: body, tables, labels, helper text, metadata, badges, chart labels |

Hierarchy inside body text comes from weight (400/500/600) and colour, not from extra sizes. Codes and amounts use `tabular-nums` (same font, even-width digits), never a second family. Tailwind's default size scale is switched off in `globals.css`, and the lint refuses `text-xs…9xl`, pixel sizes, `font-mono`/`font-serif`, bold and italic in class names. The only marked exceptions are the printed A4 documents (invoice, payslip, monthly report) and the public website's headline.

## Shape & spacing

- Radius: `rounded-lg` 8px (buttons, inputs) · `rounded-xl` 10px (inner panels) · `rounded-2xl` 12px (cards, dialogs).
- Shadows: `shadow-card` (near flat), `shadow-md`, `shadow-lg` (popovers/dialogs). Borders before shadows.
- Spacing tokens `--spacing-xs…xl` = 4 / 8 / 16 / 24 / 32px; cards use 20px padding.

## Components (`apps/web/src/components`)

| Need | Use |
|---|---|
| Page title + actions | `PageHeader` (title left, actions right) |
| KPI tile | `StatCard` / `KpiCard` |
| Section container | `Card` family or `SectionCard` |
| Actions | `Button` — `default` (primary), `secondary`, `ghost`, `soft`, `danger`, `link`; sizes `xs/sm/default/lg/icon` |
| Status | `StatusBadge status="Overdue"` (auto semantic tone) or `Badge tone=…` |
| Forms | `Field` (label, required mark, hint/error, auto-linked id) + `Input` / `Textarea` / `Select`; `FormSection` for long forms |
| Tables | `Table`, `THead` (sticky), `TR`, `TH`/`TD` with `numeric`, `SortableTH`, `TablePagination` |
| Dialog / drawer | `DialogContent` (centred) or `side="right"`, with `DialogHeader/Body/Footer` |
| Empty / loading / alerts | `EmptyState`, `Skeleton`, `SkeletonRows`, `Alert` |

## Layout

- Pages use the full width of the screen beside the menu (no centred cap); forms keep their own narrow widths.
- Side menu: Royal background, Sapphire active item, 3px Quicksand indicator. Home and Genie Assistant on top; then sections that fold open (Sales and clients, Delivery, Money, People, Management) — the one holding the current page opens by itself and the open ones are remembered; Settings and Help at the foot. Its scrollbar is thin and shows only while the pointer is over the menu. Drawer below `lg`.
- Settings is one page (`/app/settings`) listing its sections; every settings page (and import, audit log) shows the section list on the left on wide screens.
- Top bar: agency switcher, where-you-are trail (section › page), search (Ctrl K — pages, clients, videos), notifications, help, theme, profile menu.
- Page header: title and actions; a page's explanation longer than 100 characters sits behind an ⓘ beside the title.
- Responsive grids always declare a base column (`grid grid-cols-1 md:grid-cols-…`) so wide tables scroll inside their card instead of stretching the page.
