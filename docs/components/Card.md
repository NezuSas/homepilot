# Card

**Source:** `apps/operator-console/src/components/ui/Card.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Reusable visual surface for grouping semantic content without domain coupling.

## Contract

Receives children and container attributes together with surface variants. It
does not fetch or transform data.

## Usage

Use as the container for sections or compact elements; device, camera, and
media cards retain their specialized components as well.

## States and Acceptance

Preserves tokenized contrast and borders in light and dark themes and never
introduces horizontal scrolling. Header, content, and footer reduce padding on
mobile; long titles, descriptions, and actions adapt to the available width.
Direct footer buttons use the available touch width on mobile and recover
natural width from tablet upward.

## Catalog variants (pattern adoption V1)

`variant` also accepts `flat` (opaque `bg-card` with a plain border, no shadow) for in-page
surfaces, and `radius` selects the corner token (`card`, `section`, `panel`). Use these instead
of rebuilding a card with `rounded-* border bg-card` classes; layout (padding, margin, flex)
stays in `className`.

`as` renders a native landmark (`article`, `section`, `aside`) instead of a `div`, so cards that are
landmarks keep their HTML semantics. Do not emulate them with `role` on a `div`.
