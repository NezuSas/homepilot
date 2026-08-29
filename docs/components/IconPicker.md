# IconPicker

**Source:** apps/operator-console/src/views/dashboards/components/IconPicker.tsx
**Family spec:** specs/operator-console-bundle-performance-v1.md

## Purpose

Selects the compact Lucide and HomePilot residential Material Design icon
catalog used by dashboards, sections, and views, with direct name search.

## Contract

Receives a value, callback, and optional text. It normalizes mdi: and Lucide
names, resolves the documented local MDI subset without requesting a remote or
full icon catalogue, and returns the selected identifier without knowing
dashboard domain behavior. Unknown persisted names keep their text value and
render through the established fallback.

## Usage

Use from view, section, and tab configuration. Its field uses Input, its
portal menu aligns with the trigger, is constrained to the viewport, declares
an accessible list, and closes with Escape.

## States and Acceptance

Search filters the compact local catalog, preserves selection, communicates the
empty state, and prevents popup clipping on mobile, tablet, and desktop.