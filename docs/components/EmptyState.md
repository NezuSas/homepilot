# EmptyState

**Source:** `apps/operator-console/src/components/ui/EmptyState.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Explains why a collection or surface has no data and offers an action when
appropriate.

## Contract

Receives icon, title, description, and optional action. It semantically
associates title and description, announces through `role="status"`, and keeps
the icon decorative. It does not decide whether a collection is empty.

## Usage

Use after the initial load has completed; do not replace previous data during a
refresh.

## States and Acceptance

The message is translatable, announced atomically, does not block scrolling,
and its action retains visible focus. On mobile it reduces vertical space,
wraps long titles and descriptions without overflow, and forces direct action
to available width; from tablet onward it retains natural centered size.