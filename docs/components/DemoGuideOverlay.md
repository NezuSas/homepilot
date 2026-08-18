# DemoGuideOverlay

**Source:** `apps/operator-console/src/components/DemoGuideOverlay.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Guides the user through relevant console actions by highlighting the active
target without blocking navigation to the required step.

## Contract

Consumes local demo state and optional navigation. It finds the target element,
adjusts the highlight to the viewport, and renders text exclusively through
i18n keys defined by each step.

## Usage

On desktop, position the explanation near the target. On mobile, keep the guide
available as a bottom card within the safe area without clipping controls or
hiding the experience.

## States and Acceptance

The overlay updates position on scroll and resize, can finish with Escape, and
keeps touch actions accessible on mobile, tablet, and desktop. It neither traps
focus nor blocks scrolling: the user can directly complete the highlighted
action without the guide interfering with navigation.