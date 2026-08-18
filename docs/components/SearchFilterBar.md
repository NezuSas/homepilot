# SearchFilterBar

**Source:** `apps/operator-console/src/components/ui/SearchFilterBar.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Consistent local search over already loaded lists.

## Contract

Receives query, callback, placeholder, and presentation options. When a query
exists, it displays a compact localized clear action through modular `Input`.
Business filtering and remote loading remain in the view.

## Usage

Use for devices, spaces, scenes, or long lists. Placeholder and labels come
from i18n.

## States and Acceptance

Must remain readable on mobile, show visible focus, and not remove existing
content while filtering. On mobile it stacks search and filters; from tablet it
arranges them in a row to use available width. Clearing search retains stable
height and width. Options remain navigable through horizontal scrolling without
forcing view overflow.