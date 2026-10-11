# ActionMenu

**Source:** `apps/operator-console/src/components/ui/ActionMenu.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Non-modal overflow menu for the actions of a card or Section. It renders a
trigger `IconButton` and a portal popup with `role="menu"`.

## Contract

Props: `label` (accessible name of the trigger and the menu), `items`
(`{ label, icon, onSelect, disabled?, danger? }[]`) and optional `compact`.
It receives all texts; it neither translates nor knows what an action does. The
pure helpers `getActionMenuPosition` and `shouldDismissActionMenu` hold the
placement and outside-dismissal rules and are exported for testing.

## Usage

Use for secondary actions that do not deserve a visible button. It never locks
scrolling or traps page focus.

## States and Acceptance

Opens with Enter, Space, ArrowDown (first item) or ArrowUp (last item); moves
with ArrowUp, ArrowDown, Home and End; closes with Escape (returning focus to
the trigger), Tab or an outside pointer or focus. It stays inside the visual
viewport (above or below the anchor) and closes if the anchor scrolls out of
view. The trigger exposes `aria-haspopup`, `aria-expanded` and `aria-controls`.
