# IconPicker

**Source:** `apps/operator-console/src/views/dashboards/components/IconPicker.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Selects Lucide or Material Design icons compatible with dashboards, sections,
and views, with direct name search.

## Contract

Receives value, callback, and optional text. It loads the MDI catalogue once per
session, normalizes `mdi:` and Lucide names, and returns the selected identifier
without knowing dashboard domain behavior.

## Usage

Use from view, section, and tab configuration. Its field uses `Input`, its
portal menu aligns with the trigger, is constrained to the viewport, declares
an accessible list, and closes with Escape.

## States and Acceptance

Search filters up to 120 results, preserves selection, supports a catalogue
still loading, and prevents popup clipping on mobile, tablet, and desktop.