# Textarea

**Source:** `apps/operator-console/src/components/ui/Textarea.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Reusable multiline field for general editable content with consistent
accessible label, focus, error, and support text.

## Contract

Extends native `textarea` attributes. `containerClassName` controls container
layout and `className` modifies only the editable area. If given `label`, it
creates and associates an accessible id automatically.

## Usage

Use for general multiline text, such as editable dashboard title content. Keep
visible text translated in the consumer. It does not replace the conversation
composer, which owns voice, sending, keyboard shortcuts, and operational height.

## States and Acceptance

Empty, focus, value, disabled, and error preserve contrast, visible focus, and
long-text support without horizontal overflow. Container and editable area may
shrink within grids or flexible rows; label, help, and error wrap to available
width. Help or error is referenced through `aria-describedby`; error also
exposes `aria-invalid`.

## Shared field design (AC79)

Reuses Input's `hp-text-field`, `hp-field-label` and `hp-field-message` rules:
tokenized 12px radius, normal-case medium label, 8px spacing and readable
placeholder/help without opacity attenuation. The default minimum remains 96px
and vertical resizing/native rows, values, events and ref stay compatible.

Review `/tests/ui/button-review.html?component=textarea` with the Vite
development server active. This is a separate Light/Dark sheet with synthetic
empty, edited, error, disabled and read-only states, not a production route.
