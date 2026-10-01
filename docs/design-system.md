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

- `primary`: approved Dashboard warm orange in Dark and burnished copper in Light, for identity, focus, and primary actions.
- `accent`: aliases `primary`; efficiency-only `eco` remains a separate semantic token.
- `light-active`: warm amber for physical lighting state.
- `success`, `warning`, and `danger`: semantic health and risk states.
- `muted`: secondary information.

## Color Strategy

Dark mode uses warm graphite surfaces rather than flat black. Light mode uses a
professional neutral canvas with visible card separation. Orange is the primary
interaction color; eco is reserved for efficiency meaning; amber represents active
lighting. Cyan is not an identity or selection color.

A screen must not introduce raw utility colors when a semantic token exists.
Active states use one semantic color rather than decorative color mixing.

The approved Dashboard palette is the application-wide standard. `index.css`
defines theme values on `:root` and `.light`; views must not override `primary`,
text or core surface tokens. Dashboard material/opacity treatments consume the
global palette. Body-portaled overlays inherit it. Runtime `colors` and
`lightColors` reference CSS variables, not duplicated hex palettes. Solid orange
controls use dark espresso text in Dark for contrast; Light keeps white over copper.

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
7. Routine lists use `RoutineCardGrid` with bounded compact tracks, not expanded
   full-width cards. Execution is an explicit button independent of scheduling
   and management controls; card surfaces themselves never execute routines.
8. Empty collection lists use `EmptyState` with `variant="collection"`, a
   decorative domain icon and concise guidance. When creation is already in
   the header, do not repeat that action inside the empty state. Other views
   may reuse the same variant; the default primitive remains compatible.
9. Initial asynchronous components own their skeleton composition. Share only
   visual atoms and the accessible `LoadingState` announcement, never one generic
   silhouette across cards, cameras, rooms or editors. Route fallbacks use the
   matching view composition. Retain visible data during refresh and preserve
   specialized Dashboard geometry and action feedback.
10. Scenes and Automations use one stable list with an independent favorite star.
    Device selectors reuse `SearchableSelectField`: optional labeled groups,
    searchable space/type descriptions and keyboard navigation across groups.
11. Spaces is the everyday room view, not a second device configuration manager.
    Reuse Dashboard action, sensor, cover and media presenters in bounded compact
    tracks. Keep momentary feedback separate from toggle state and never render
    a missing reading as off. Empty rooms reuse the collection EmptyState without
    a duplicate creation action; device configuration remains in Device manager.
12. Device manager is configuration-only, including its inspector. Camera sessions
    and daily controls live in Spaces/Dashboard. Room displays use the existing
    validated catalog and momentary action presenter; hidden, non-executable,
    slider or confirmation-required entries never become executable buttons.
