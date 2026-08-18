# Operator Console Design System

## Purpose

The HomePilot design system provides a premium, local-first operating console
without screen-specific visual drift. CSS tokens, Tailwind exposure, and
reusable primitives are the visual source of truth.

## Sources of Truth

| Area | Location | Responsibility |
|---|---|---|
| CSS tokens | `apps/operator-console/src/index.css` | Color, surfaces, radius, motion, and shadow |
| Tailwind bridge | `apps/operator-console/tailwind.config.js` | Token access through utility classes |
| UI primitives | `apps/operator-console/src/components/ui` | Reusable interaction controls |
| Frontend rules | `docs/operator-console-frontend.md` | Module and composition rules |

## Semantic Tokens

### Surfaces

- `background`: base canvas.
- `card`: persistent panels and cards.
- `popover`: dialogs, menus, and elevated content.
- `border` and `border-subtle`: structural separation.

### States

- `primary`: Nezu orange (`#D9542B`) for identity, focus, and primary actions.
- `accent`: Nezu lime (`#C9DF38`) for eco and efficiency meaning only.
- `light-active`: warm amber for physical lighting state.
- `success`, `warning`, and `danger`: semantic health and risk states.
- `muted`: secondary information.

## Color Strategy

Dark mode uses warm graphite surfaces rather than flat black. Light mode uses a
professional neutral canvas with visible card separation. Orange is the primary
interaction color; lime is reserved for eco meaning; amber represents active
lighting. Cyan is not an identity or selection color.

A screen must not introduce raw utility colors when a semantic token exists.
Active states use one semantic color rather than decorative color mixing.

## Typography and Scale

`Rubik` is the UI family and `Disket Mono` is reserved for technical metadata,
identifiers, timestamps, and operational values. Components use the exposed
font tokens instead of declaring font families directly.

| Token | Intended use |
|---|---|
| `text-nano` | decorative detail or timestamp; never functional content |
| `text-micro` | compact metadata and actionable state labels |
| `text-label` | short labels with restrained tracking |
| `text-caption` | supporting text |
| `text-body-compact` | dense navigation and rows |
| `text-body` | normal reading and controls |
| `text-card-title` | card title |
| `text-section-title` | section title |
| `text-view-title` | screen title |

Use the hierarchy: view title → section title → card title → body → metadata.
Arbitrary `text-[Npx]` values are reserved for data visualizations where size
is intrinsic to the component.

## Required Primitives

Use `PageFrame`, `Button`, `IconButton`, `Card`, `Input`, `SearchInput`,
`SelectField`, `SegmentedControl`, `StatusPill`, `Modal`, `AlertBanner`,
`EmptyState`, `SidebarItem`, and `SectionHeader` before creating parallel
implementations.

## Rules

1. Use semantic tokens and named radius values.
2. Reuse the existing primitive for buttons, filters, banners, empty states,
   and dialogs.
3. Views compose the system; they do not define a parallel visual language.
4. New visual components require explicit props and may not depend on global
   state unless they own that workflow.
5. Active device status labels use `text-micro`, without forced uppercase or
   excessive letter spacing.
6. Device rooms use calm grouped surfaces rather than a SaaS-style tile wall.