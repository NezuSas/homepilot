# DeviceTileShell

**Source:** `apps/operator-console/src/components/ui/DeviceTileShell.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Structural shell for device cards with consistent density and layout.

## Contract

Receives header, body, and action content as slots. It neither derives
integration state nor executes commands.

## Usage

Use when a card needs a different composition while retaining the device visual
system.

## States and Acceptance

Content does not overlap, honors tokenized minimum height, and adapts from one
to multiple columns. It can shrink inside narrow grids or panels, retains touch
interaction when applicable, and communicates disabled state through
`aria-disabled`. When it contains internal controls, keyboard input does not
accidentally activate the containing card.