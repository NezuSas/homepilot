# SPEC: Operator Console Sidebar Visual Standardization V1

**Status:** Implemented
**Date:** 2026-08-21
**Scope:** Visual-only standardization of the existing Operator Console views reachable from the sidebar.

## Problem Statement

The Operator Console exposes both resident and operational views through one sidebar. Several screens used different page-header treatments, decorative labels, nested page frames, or raw presentation colors. This made navigation feel like separate products even though the underlying design system already provided semantic tokens and reusable primitives.

## Scope

- Standardize view headers around one shared hierarchy: icon, title, optional supporting description, and an action region.
- Keep headings semantic and readable without decorative eyebrow labels.
- Remove duplicated page chrome and invasive selected-state borders from affected sidebar views.
- Bring Routines, Spaces, Energy, System Status, Audit Logs, Execution History, native cameras, and Home Assistant settings onto shared token-based surfaces.
- Unify active, hover, focus, and collapsed-rail treatment for every existing sidebar destination.
- Present the Edge's single active Home as the operating context in Spaces; do not render a home count, selector, or redundant home card.
- Preserve all existing routes, API calls, state behavior, permissions, controls, translations, and responsive breakpoints.

## Out of Scope

- New navigation destinations, API contracts, stores, backend behavior, or business rules.
- Rebranding HomePilot or replacing dashboard and assistant interaction models.

## Acceptance Criteria

- **AC1:** Affected top-level operational views use `SectionHeader` with a semantic page hierarchy.
- **AC2:** Supporting text is readable body copy beneath its title rather than an all-caps decorative eyebrow.
- **AC3:** No affected view contains a nested `PageFrame`, duplicate refresh action, or thick colored left selection border; sidebar selection uses one compact semantic surface.
- **AC4:** System status and configuration use semantic tokens for health states in both light and dark themes.
- **AC5:** Existing controls, responsive layouts, API calls, and navigation behavior remain intact.
- **AC6:** Typecheck, root build, Operator Console build, test suite, and Docker Compose startup succeed.
- **AC7:** Spaces loads the authorized Home as the single active context, retains owner-only home renaming and all room/device operations, and does not render “Registered Homes”, a home count, or a selectable home list.