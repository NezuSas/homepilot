# Button

**Source:** `apps/operator-console/src/components/ui/Button.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Primary, secondary, neutral, or destructive textual action. It confirms an
intent; it is not for purely icon-based navigation.

## Contract

`ButtonProps` extends native button attributes and adds `variant`, `size`, and
`isLoading`. `isLoading` disables the action, exposes `aria-busy`, and shows a
decorative indicator. AC79 defines one geometry: minimum height 44px, radius
`--radius-control` (12px), Inter semibold 14px / 20px, 8px gap, 16px icons,
16px horizontal and 10px vertical padding. Labels may wrap; height may grow.
Historical `xs`, `sm`, `md`, and `lg` sizes are compatibility aliases, not
different designs. Functional variants are primary, secondary, outline, ghost,
danger, and warning, with shared Light/Dark `--button-*` tokens.

## Usage

Use `primary` for the principal action, `danger` only for destructive work, and
`IconButton` when no visible text exists. Selectors, tabs, interactive cards,
and drag controls retain their specialized semantic components. Text comes from
consumer i18n.

Consumers may define placement and width, not their own radii, height, padding,
typography or elevation. `IconButton` wraps this same primitive. Interactive
cards/options use `SurfaceButton` (`ui/SurfaceButton.tsx`) to preserve their own
layout and semantic roles; this is not an alternative action-button style.

## States and Acceptance

Supports normal, hover/focus, disabled, and loading states; preserves visible
focus and token-defined touch area. Labels may wrap within available width
without clipping. Containers must allow the documented touch area and wrapping.
`__tests__/button-standardization.test.ts` checks literal consumer classes;
`tests/button-review.spec.ts` checks rendered geometry and pending/ready states
at 360/768/1440px, with no API or authentication. The development preview is
`/tests/ui/button-review.html`; it is not a production route.
