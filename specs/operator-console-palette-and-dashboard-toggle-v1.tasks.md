# TASK BREAKDOWN: Operator Console Palette and Dashboard Toggle V1

Primary specification: [operator-console-palette-and-dashboard-toggle-v1.md](./operator-console-palette-and-dashboard-toggle-v1.md)

## Palette

- [x] Review the semantic-color commits and record palette candidates in `DESIGN.md`.
- [x] Select and implement one semantic neutral elevation ladder for dark and light themes.
- [x] Verify ordinary text and control contrast against the selected surfaces.
- [x] Verify no raw Tailwind color utility is introduced in Operator Console source.

## Dashboard toggle

- [x] Decide and document the in-place `device_control` evolution.
- [x] Build the full-surface button treatment using existing semantic device states.
- [x] Add optimistic update, response reconciliation, and rollback-on-error behavior.
- [x] Preserve capability gating, keyboard focus, `aria-pressed`, compact layouts, and camera behavior.
- [x] Add coverage for command selection, optimistic state, rollback, and accessible pressed state.

## Validation

- [x] Run typecheck, root and Operator Console builds, i18n validation, targeted tests, full tests, and Docker Compose runtime validation.
