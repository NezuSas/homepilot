# Card

**Source:** `apps/operator-console/src/components/ui/Card.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Reusable visual surface for grouping semantic content without domain coupling.

## Contract

Receives children and container attributes together with surface variants. It
does not fetch or transform data.

## Usage

Use as the container for sections or compact elements; device, camera, and
media cards retain their specialized components as well.

## States and Acceptance

Preserves tokenized contrast and borders in light and dark themes and never
introduces horizontal scrolling. Header, content, and footer reduce padding on
mobile; long titles, descriptions, and actions adapt to the available width.
Direct footer buttons use the available touch width on mobile and recover
natural width from tablet upward.