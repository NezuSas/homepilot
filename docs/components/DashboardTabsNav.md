# DashboardTabsNav

**Source:** `apps/operator-console/src/components/DashboardTabsNav.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Presents and selects dashboard tabs, including contextual creation and
configuration when the user has permission.

## Contract

Receives tabs, active index, and selection, creation, edit, and mobile-menu
callbacks. The view retains dashboard persistence, permissions, and data.

## Usage

Use only inside the dashboard surface. Titles, labels, and accessibility text
are already translated by the consumer.

## States and Acceptance

Navigation scrolls horizontally when needed. Each tab visually limits long
titles, retains the complete name as label and tooltip, and keeps edit and
creation actions without causing page overflow.