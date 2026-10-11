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

Options use a minimum 44px target and normal-case 14px medium labels.
Wrapped options start from a 96px flex basis to avoid fragmenting short labels
on narrow screens; they move to another row rather than compressing every word.
The group and options reuse `--radius-control`; no new shape variants exist.
If the current value is missing or disabled, the first enabled option remains
the keyboard entry without silently selecting or saving it.
Review `/tests/ui/button-review.html?component=segments` (Vite development only).

## Adoption status

RoutinesView and SearchFilterBar delegate geometry, labels, colors and states to
the primitive. They retain only external width/flex layout. Horizontal filters
use the existing `layout="scroll"` contract, not option-level style overrides.
An AST regression test protects these two adopted consumers. Other consumers
remain pending individual migration and real-screen validation; this is not a
claim of complete application-wide adoption.
SearchFilterBar currently has no production consumers; its composition is
covered separately rather than presented as an active application flow.

DashboardViewConfigModal also delegates option appearance to the primitive.
Its three configuration destinations remain labelled in mobile and desktop;
wrapping belongs to the shared control, not an icon-only local skin. Keyboard
Home/End and saving are tested in the real modal with mocked data.

SectionCardEditorModal uses the shared scroll layout. The external card-editor-tabs
CSS skin is removed; the editor does not redefine option radius, colors or state.

SceneDeviceSelector retains its commands and selection callbacks while using
central option geometry and typography; no option-level skin is supplied.

DeviceInspector and ModbusConnectionCard use central selector styling as well.
The Modbus consumer retains external widths only; filtering, counts and bindings
are unchanged. It does not implement transport or execute physical commands.
