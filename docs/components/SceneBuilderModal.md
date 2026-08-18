# SceneBuilderModal

**Source:** `apps/operator-console/src/views/SceneBuilderModal.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Creates or edits scenes through name, scope, and actions supported by available
devices, using the shared console dialog container.

## Contract

Receives home, rooms, devices, and an optional scene. It locally maintains
search, selected actions, and save state. It permits only commands compatible
with light, switch, or cover capabilities.

## Usage

The Routines view opens it to create or edit a scene. `Modal` manages portal,
initial focus, Escape, Tab cycle, scrolling, and fixed footer. During save it
blocks close and repeated submission.

## States and Acceptance

The list preserves search and selection within the viewport. Errors remain
localized in the form; save remains available in the footer and does not
disappear while scrolling on mobile, tablet, or desktop.