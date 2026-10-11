# DateField

**Source:** `apps/operator-console/src/components/ui/DateField.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Native date input with a visible empty state, including WebKit on tablets,
where an empty `type="date"` renders as a blank box.

## Contract

Wraps `Input` (type fixed to `date`, calendar icon). It accepts every `Input`
prop except `type` and `icon`. When the value is empty it overlays a decorative
placeholder text. The placeholder text is received through `placeholderLabel`;
the component does not translate.

## Usage

Use wherever a date filter or field is needed instead of a raw `<input
type="date">`.

## States and Acceptance

The control keeps a minimum height of 44 px, adopts the shared field styling
and exposes `data-empty` while it has no value. The placeholder never receives
pointer events and is hidden from assistive technology.
