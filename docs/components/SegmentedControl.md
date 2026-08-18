# SegmentedControl

**Source:** `apps/operator-console/src/components/ui/SegmentedControl.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Toggles an exclusive selection among a small set of related options.

## Contract

Receives options, active value, and callback. Options must be stable and
already validated by the view.

## Usage

Use for mutually exclusive filters or modes; use `Select` for many options or
long labels.

## States and Acceptance

Active, inactive, disabled, and focus retain consistent sizing. The group uses
`radiogroup` and each option exposes `role="radio"` with `aria-checked`; Arrow,
Home, and End keys move only across available options. Labels do not truncate:
each option can grow vertically or flow to a new row when available width cannot
show complete text.