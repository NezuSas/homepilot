# RangeInput

**Source:** `apps/operator-console/src/components/ui/RangeInput.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Modular control for continuous or discrete numeric values such as cover
position, opacity, and image crop.

## Contract

Receives `value`, `min`, `max`, `step`, `onValueChange`, and optional
`onValueCommit`. Change is communicated continuously; commit is emitted when
the gesture ends with pointer, on focus exit, or explicitly with Enter,
avoiding a commit per key press. `formatValue` and `showBounds` display limits
and current value without duplicating visual structure.

## Usage

Use for specialized native ranges. The consumer retains domain rules,
translates `aria-label`, and decides whether a value requires deferred commit.

## States and Acceptance

Preserves visible focus, disabled state, and a consistent touch target. Control
and bounds adapt to available width; central value retains priority and end
labels do not overflow. It executes no business logic and creates no global
state.