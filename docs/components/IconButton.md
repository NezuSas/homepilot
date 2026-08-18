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
hover, focus, disabled, and loading states. The icon scales proportionally with
`sm`, `md`, or `lg` touch target. It uses `touch-manipulation` to avoid delay or
unwanted gestures for compact mobile actions.