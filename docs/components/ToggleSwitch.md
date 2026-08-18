# ToggleSwitch

**Source:** `apps/operator-console/src/components/ui/ToggleSwitch.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Accessible boolean control for preferences and configuration. It represents on
and off state without exposing domain contracts.

## Contract

Receives `checked`, `onCheckedChange`, and a required accessible `label`. It
supports `sm` and `md` sizes, compatible native button attributes, and
`isLoading` for asynchronous persistence. An additional `onClick` can observe
or cancel the change with `preventDefault` without replacing the controlled
contract.

## Usage

The consuming view supplies visible label, translation, and persistence. Do not
use for one-shot actions: use `Button` or `IconButton` instead.

## States and Acceptance

Exposes `role="switch"`, `aria-checked`, and `data-state` as `checked` or
`unchecked`. During `isLoading`, it disables itself, communicates `aria-busy`,
and replaces thumb content with an equally-scaled decorative indicator. It
retains fixed touch dimensions, visible focus, and `touch-manipulation`, so it
does not shrink or overflow responsive rows.