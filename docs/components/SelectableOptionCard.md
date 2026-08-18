# SelectableOptionCard

**Source:** `apps/operator-console/src/components/ui/SelectableOptionCard.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Represents an exclusive option with title, optional description, and selected
state. It is used inside a `role="radiogroup"` container when options require
more context than a compact selector.

## Contract

Receives `title`, `description`, `checked`, and conventional button props. It
emits `onClick`; the consumer retains selected state and the `radiogroup` that
groups options.

## States and Acceptance

Preserves `radio` semantics, visible focus, selected indicator, safe wrapping
for long text, and adequate touch area from mobile through desktop.