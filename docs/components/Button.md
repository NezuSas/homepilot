# Button

**Source:** `apps/operator-console/src/components/ui/Button.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Primary, secondary, neutral, or destructive textual action. It confirms an
intent; it is not for purely icon-based navigation.

## Contract

`ButtonProps` extends native button attributes and adds `variant`, `size`, and
`isLoading`. `isLoading` disables the action, exposes `aria-busy`, and shows a
decorative indicator without changing size. `size="md"` shares `Input`'s `h-10`
base height for inline textual actions.

## Usage

Use `primary` for the principal action, `danger` only for destructive work, and
`IconButton` when no visible text exists. Selectors, tabs, interactive cards,
and drag controls retain their specialized semantic components. Text comes from
consumer i18n.

## States and Acceptance

Supports normal, hover/focus, disabled, and loading states; preserves visible
focus and token-defined touch area. Labels may wrap within available width
without stretching rows, cards, or dialogs.