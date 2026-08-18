# SectionHeader

**Source:** `apps/operator-console/src/components/ui/SectionHeader.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Uniform header for separating a section and its contextual actions.

## Contract

Receives title, optional description, icon, and actions. The view resolves
permissions and content.

## Usage

Use in pages and panels requiring hierarchy; do not duplicate visual titles in
the same surface.

## States and Acceptance

Supports long text, wrapping actions, and vertical mobile layout. Content keeps
available width and each direct action takes full width on mobile; from tablet
it recovers natural width, wraps without clipping, and aligns to the header
end. Group subtitles indent only when an icon exists.