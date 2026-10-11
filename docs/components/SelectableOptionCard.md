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

## Desktop design book — page 13 (AC79)

One geometry in both themes: minimum height 48px, `rounded-card` radius (28px),
12px padding and 40px reserved on the right for the 16px decorative check.
The title is 15px semibold; optional context is 14px regular. Height grows with
wrapped text. Selection changes token-based border/background, not geometry.
Focus uses the primary ring; disabled behavior remains native.

The consumer owns the named radio group, selection and group keyboard navigation.
The card does not persist data or execute device commands.
Local isolated review: `/tests/ui/button-review.html?component=options`.

## Consumer adoption

NativeCameraDiscoveryModal uses the shared card for profiles, manual setup and
discovered cameras. AssistantActionModal uses it for exclusive room selection.
Consumers supply content, checked state and events, not local geometry or colors.
The AC79 AST regression test scans all console TSX consumers for local card style
props and radio implementations outside SelectableOptionCard/SegmentedControl.
Image presets, multi-selection days and operational device tiles have different
interaction/content contracts and are not interchangeable with this card.
