# Operator Console Modular Component Catalogue

This operational catalogue complements
`specs/operator-console-modular-components-v1.md`. It documents reusable UI
choices and does not define business rules.

## Required Primitives

| Need | Component | Do not use it for |
|---|---|---|
| Textual or destructive action | `ui/Button` | icon-only navigation |
| Compact icon action | `ui/IconButton` | primary action without an accessible label |
| Editable single-line text | `ui/Input` | option selection or multiline content |
| Editable multiline text | `ui/Textarea` | the operational conversation composer |
| Option selection | `ui/SearchableSelectField` | native selects or ad hoc parallel menus |
| Search | `ui/SearchFilterBar` | duplicated local search fields |
| Critical confirmation | `ConfirmModal` | `window.confirm` |
| Application dialog | `ui/Modal` | a global overlay outside the shell |
| Compact semantic status | `ui/StatusPill` | unstructured status text |
| No results | `ui/EmptyState` | an unexplained empty container |
| Sidebar navigation | `ui/SidebarItem` | manually styled navigation links |

## Individual Documentation

Each modular component has a purpose, contract, usage, and acceptance record in
`docs/components/`. The executable SDD coverage check fails if a required
component document is missing.

## Composition Rules

1. A view owns data and permission orchestration; a visual component does not
   query an integration directly.
2. Device entities use `DeviceTileBase` or `DeviceTileShell` and expose only
   capability-enabled actions.
3. Camera, media, scene, sensor, room, and dashboard cards also follow their
   domain specification.
4. New visible text is added to both English and Spanish locale resources.
5. Do not create a parallel modal, button, selector, or card when a listed
   component already covers the need.

## Review Checklist

- Uses semantic visual tokens.
- Is keyboard accessible with visible focus.
- Handles long text and both supported UI locales.
- Keeps actions inside the mobile viewport.
- Preserves existing data during refresh.
- Uses typed props rather than hidden domain logic.