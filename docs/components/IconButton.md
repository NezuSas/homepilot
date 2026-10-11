# IconButton

**Source:** `apps/operator-console/src/components/ui/IconButton.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Compact icon action for close, edit, refresh, or opening contextual actions.

## Contract

Receives icon, accessible `label`, variant, `isLoading`, and native button
attributes. `label` is required for screen readers and tooltip. While loading,
it disables itself, exposes `aria-busy`, and replaces the icon with an
equally-scaled decorative indicator.

## Usage

Do not replace a textual button when meaning is not universal. The consumer
translates the label and controls disabled and loading state.

## States and Acceptance

Shows visible focus, does not shrink on touch devices, and supports normal,
hover, focus, disabled, and loading states. It wraps `Button` with `size="icon"`:
44×44px, radius 12px and icon 16px. Historical `sm`, `md`, and `lg` are aliases
of that same touch target. Consumers must not override dimensions or radius.
It uses `touch-manipulation` to avoid delay or
unwanted gestures for compact mobile actions.

## Review and design alignment

Open `/tests/ui/button-review.html?component=icons` in the development server
for a separate, compact Light/Dark sheet. It uses real primitives, Lucide
icons and synthetic actions only: no login, application bootstrap or API.
`button-review.spec.ts` checks 44×44px, 12px radius, centered 16px icons,
keyboard activation/focus, disabled tab skipping and loading at 360/768/1440px.
The SVG is decorative and cannot become a separate focus target.

Figma page 02 (`7:3`, sheets `9:1405` / `9:1796`) still documents historical
32/36/44px sizes, translucent neutral/danger colors and larger LG icons.
The later approved single Button standard takes precedence: no new sizes,
no separate IconButton palette. The Figma sheets were inspected, not modified;
exact visual parity with their historical examples is not claimed.
