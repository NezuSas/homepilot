# DeviceTileBase

**Source:** `apps/operator-console/src/components/ui/DeviceTileBase.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Visual base for a device card that unifies icon, title, subtitle, badge, action,
and state presentation.

## Contract

`DeviceTileBaseProps` receives icon, title, `active`, `disabled`, `error`,
`syncing`, actions, and children. It does not query drivers or decide commands.

## Usage

Specialized light, curtain, sensor, and device cards reuse this base and pass
only compatible actions.

## States and Acceptance

Available, active, offline/disabled, error, and syncing each have a visual cue
that does not rely only on color. On mobile it reduces padding, safely wraps
long text, and keeps contextual actions visible when hover is unavailable; on
desktop they appear on card interaction. With `onClick`, it exposes button
semantics and responds to Enter or Space without double-activating internal
controls.