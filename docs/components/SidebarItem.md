# SidebarItem

**Source:** `apps/operator-console/src/components/ui/SidebarItem.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Primary or secondary sidebar navigation item.

## Contract

Receives label, icon, active state, count, and callback or navigation target.
The shell calculates visibility from permissions.

## Usage

Use for every sidebar option and sub-option; consumers must not define
independent text sizing.

## States and Acceptance

Normal, active, expanded, collapsed, and focus states retain a visible or
accessible label at every breakpoint. In expanded sidebar, long labels wrap
within available width rather than truncate; when collapsed on desktop, the
label hides visually and remains through `title`. The active item exposes
`aria-current="page"`.