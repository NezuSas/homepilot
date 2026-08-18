# StatusPill

**Source:** `apps/operator-console/src/components/ui/StatusPill.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Represents a short non-interactive state: active, off, available, error, or
pending.

## Contract

Receives label and semantic variant; it neither translates nor infers device
state. The dot-only variant optionally receives `dotLabel` to announce context;
without it, the dot is decorative.

## Usage

Use alongside a title or detail, never as the only indicator for a critical
action.

## States and Acceptance

Maintains short text, sufficient contrast, no compact-card overflow, and a
non-color-exclusive state signal. Long labels wrap within available width
without expanding the container or interfering with nearby icons or actions.