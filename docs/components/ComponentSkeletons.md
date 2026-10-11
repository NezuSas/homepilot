# ComponentSkeletons

**Source:** `apps/operator-console/src/components/ui/ComponentSkeletons.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Collection of loading placeholders that mirror the layout of each view and card
while its initial data settles (`ScenesSkeleton`, `SpacesSkeleton`,
`HomeSkeleton`, `DiagnosticsSkeleton`, `ViewSkeleton`, and so on).

## Contract

Each export is presentation only: it draws bars and blocks with the same
geometry as the final content and renders no real data, text or action. It is a
collection, not a single wrapper, so the native-element contract does not
apply (see `scripts/check-modular-contract.mjs`). `ViewSkeleton` selects the
placeholder for a view.

## Usage

Show a skeleton only for the initial load (see `useInitialLoading` and
`useDashboardDelayedSkeleton`); keep existing data visible during refresh.

## States and Acceptance

A skeleton has the same footprint as the content it replaces so nothing shifts
when data arrives, and it is hidden from assistive technology.
