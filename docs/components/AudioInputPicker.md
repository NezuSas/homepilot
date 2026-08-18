# AudioInputPicker

**Source:** `apps/operator-console/src/components/AudioInputPicker.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Lets the user choose the voice-assistant capture microphone when more than one
source is available.

## Contract

Receives `devices`, `selectedDeviceId`, label, disabled state, and `onChange`.
It returns `null` when no useful selection exists.

## Usage

Use only in the voice workflow. The consumer enumerates browser devices rather
than this component.

## States and Acceptance

Closes on outside click or Escape and returns focus to the selector when
appropriate. It uses an accessible `listbox` associated with the trigger,
supports Arrow, Home, and End option navigation, keeps long labels visible in
the menu, and constrains both trigger and menu to the viewport.