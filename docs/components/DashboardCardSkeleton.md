# DashboardCardSkeleton

**Source:** `apps/operator-console/src/components/ui/DashboardCardSkeleton.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Loading placeholder for a Dashboard card, by variant (`control`, `sensor`,
`camera`, `media`, `climate`, `energy`, `display`, `generic`), plus
`DashboardSkeletonBar` for the individual bars.

## Contract

Props: `variant`, optional `className`, `mediaOnly` (no border) and `visible`
(enables the shimmer and the `data-dashboard-skeleton` marker). It is
presentation only: the outer card or grid cell owns dimensions and
interaction. The `sensor` variant exposes the `sensor-card` container name so
the reading layout matches the real card.

## Usage

Render it in the card slot while the first snapshot of its data is pending.

## States and Acceptance

`aria-hidden`, `pointer-events-none`, no layout shift when the real card
replaces it, and the shimmer stops under `prefers-reduced-motion`.
