# ToggleSwitch

**Source:** `apps/operator-console/src/components/ui/ToggleSwitch.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Accessible boolean control for preferences and configuration. It represents on
and off state without exposing domain contracts.

## Contract

Receives `checked`, `onCheckedChange`, and a required accessible `label`. It
supports historical `sm` and `md` aliases, compatible native button attributes, and
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

The single target is 56×44px; a centered 56×32px track keeps the approved
visual footprint while increasing touch height. Both size aliases use it.
Light/Dark off styles apply to the track, not the transparent touch area.
Reduced motion disables the loading spinner animation.
Review `/tests/ui/button-review.html?component=switches` (Vite development only).
