# Input

**Source:** `apps/operator-console/src/components/ui/Input.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Reusable text input for simple values controlled by a view.

## Contract

Extends native `input` attributes with shared visual variants.
`containerClassName` controls container width or row behavior; `className`
customizes only the input element; and `endAdornment` places a compact action
inside field geometry. When given a `label`, it creates and associates an
accessible id automatically. Value, validation, and business message belong to
the consumer.

## Usage

Use with an accessible label, translated placeholder, and an error explained at
or beside the field. It applies to text, password, identity, onboarding, home,
room, and scene names. Use `SearchInput` for simple modular searches. It does
not replace ranges, files, text areas, radios, or domain-specific inputs. When
sharing a row with a primary action, use `Button size="md"` or `IconButton`
with `h-10 w-10` to preserve the field's base `h-10` height.

## States and Acceptance

Empty, focus, value, disabled, and error states preserve contrast, visible
focus, and long-text support. Container and control shrink within grids or flex
rows; long labels and help wrap without horizontal overflow. `endAdornment`
reserves internal space without changing base height. Help or error is
referenced through `aria-describedby`; error also exposes `aria-invalid`.