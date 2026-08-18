# DashboardRoutinesSection

**Source:** `apps/operator-console/src/components/DashboardRoutinesSection.tsx`
**Family spec:** `specs/routines-unified-console-v1.md`

## Purpose

Composes favorite scenes and automations on Home under one **Favorite routines**
surface.

## Contract

Receives scene and automation lists, their favorite identifiers, the identifier
currently being processed, and callbacks to execute scenes, toggle automations,
and open routine management.

## Behavior

- Scenes appear as **Manual** routines and execute when selected.
- Automations appear as **Automatic** routines and toggle between active and
  paused when selected.
- When no favorites exist, it communicates the empty state and offers access to
  routine management.
- It preserves ES/EN labels and uses a responsive one-, two-, or three-column
  grid.