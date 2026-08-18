# CoverPositionControl

**Source:** `apps/operator-console/src/components/CoverPositionControl.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Controls the percentage position of a compatible curtain or blind.

## Contract

Receives `initialPosition`, `onPositionChange`, `disabled`, and required
`ariaLabel`. The callback fires only after confirming a changed position by
mouse, touch, blur, or keyboard.

## Usage

Use only when cover capabilities include position. The consumer translates the
`ariaLabel` and dispatches the command.

## States and Acceptance

Displays 0–100%, synchronizes external changes, and does not issue repeated
commands for the same value. It does not introduce fixed-language default
labels: the consumer always supplies the accessible translation.