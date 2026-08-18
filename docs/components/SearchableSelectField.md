# SearchableSelectField

**Source:** `apps/operator-console/src/components/ui/SearchableSelectField.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Canonical modular selector for general option selection. Search is always
present, so it replaces short menus and selectors implemented inside views and
widgets.

## Contract

Receives `value`, typed options, callback, translated placeholder, and explicit
search and positioning configuration. It knows no domain data and performs no
network calls.

## Usage

Use for devices, scenes, rooms, types, time zones, and card sizes. Do not
create ad hoc portal selectors or native selects for business options.
Specialized icon and audio pickers remain separate because they resolve their
own catalogues and previews.

## States and Acceptance

Supports empty value, selected value, search, described option, empty list,
disabled state, visible focus, Escape, and outside click close. Arrow keys
enter and navigate options; Home and End move to extremes; focus returns to
the trigger on confirm or close. The menu stays in the viewport on mobile,
tablet, and desktop; trigger, search, label, and help can shrink within grids
or flexible rows without overflow.