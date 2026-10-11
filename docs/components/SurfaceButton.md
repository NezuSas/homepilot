# SurfaceButton

**Source:** `apps/operator-console/src/components/ui/SurfaceButton.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Interactive surface (a card, an option or a tile) that behaves like a button.
It is not a conventional action button: use `Button` or `IconButton` for those.

## Contract

Extends the native button attributes and forwards its ref. `isLoading` disables
the control, sets `aria-busy` and shows a spinner. It applies only behavior:
touch handling, focus ring and disabled state. Layout, color and radius come
from the consumer through `className`.

## Usage

Use for selectable cards, device tiles and dashboard action tiles. Prefer
`SelectableOptionCard` when the surface is a choice in a group.

## States and Acceptance

Keeps a visible focus ring, `touch-manipulation`, `disabled:opacity-45` with no
pointer events, and a spinner that respects `prefers-reduced-motion`.
