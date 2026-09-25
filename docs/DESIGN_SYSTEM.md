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

## Typography — one family (Geist), three sizes

| Class | Size / line | Use |
|---|---|---|
| `text-heading` | 24 / 32 | Page titles, KPI numbers |
| `text-subheading` | 16 / 24 | Section and card titles, dialog titles |
| `text-body` | 13 / 20 | Everything else: body, tables, labels, helper text, metadata, badges |

Hierarchy inside body text comes from weight (400/500/600) and colour, not from extra sizes.

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

- Sidebar: Royal background, Sapphire active item, 3px Quicksand indicator; collapsible on desktop (icon rail), drawer below `lg`.
- Top bar: breadcrumbs, search (Ctrl K), theme, notifications, profile/role menu.
- Responsive grids always declare a base column (`grid grid-cols-1 md:grid-cols-…`) so wide tables scroll inside their card instead of stretching the page.
