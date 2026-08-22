# SPEC: Operator Console Palette and Dashboard Toggle V1

**Status:** Implemented
**Date:** 2026-08-22
**Scope:** Semantic palette refinement and the existing `device_control` dashboard widget.

## Problem Statement

The Operator Console has a documented semantic color system, but its neutral
surface ladders need a more deliberate premium finish in both themes. The
existing dashboard device control also exposes its on/off state mainly through
a centered icon, which is less immediately readable than a full-surface home
automation toggle.

## Palette Decision

The semantic palette stays intact. Three neutral-ladder variants were assessed:

| Variant | Assessment |
| --- | --- |
| Soft Graphite | Preserves the existing look but leaves too little dark elevation and a heavy light canvas. |
| Mineral Contrast | Separates surfaces aggressively but trends toward generic SaaS white panels. |
| Quiet Graphite / Mineral Residence **(selected)** | Uses a warm graphite `30 8% 7%` canvas and a luminous `34 16% 90%` mineral canvas, preserving restrained residential warmth and clear operational elevation. |

Measured normal and secondary text pairs are 16.49:1 / 7.68:1 in dark mode and 13.87:1 / 7.07:1 in light mode. All exceed WCAG AA body-text contrast.
## Product Decision

`device_control` is evolved in place. It already represents the one-device
toggle behavior and is persisted in every existing dashboard. Adding a second
`toggle_button` type would duplicate the same interaction, fragment the
dashboard editor, and require residents to choose between two visual versions
of one operation. The existing widget therefore receives the full-surface
toggle treatment without changing the dashboard data contract.

## Scope

- Refine the dark graphite and light mineral surface ladders through existing
  semantic CSS variables only.
- Preserve orange for identity, action, focus, and generic active state; lime
  for eco; amber for physically active lights; and semantic health colors for
  their documented state meanings.
- Present a full-card, keyboard-operable control for `device_control` widgets.
- Optimistically update the visible device state, reconcile from the successful
  command response, and restore the prior state with a readable inline error
  when the command fails.
- Respect backend-declared capabilities and legacy support for `turn_on`,
  `turn_off`, and `toggle`.

## Out of Scope

- A new dashboard widget type, editor flow, API contract, store, or backend
  command.
- Changes to camera, cover, sensor, scene, room, or media widgets.

## Acceptance Criteria

- **AC1:** Dark and light themes use the selected documented semantic palette
  and keep ordinary body text at WCAG AA contrast or greater.
- **AC2:** No raw Tailwind color utilities are introduced in Operator Console
  source; state colors resolve through semantic project tokens.
- **AC3:** A device card is one real button with `aria-pressed` that represents
  its active state, a visible focus ring, and readable compact/full layouts.
- **AC4:** A supported card tap immediately changes the whole-card state and
  sends the existing device command endpoint request.
- **AC5:** A rejected or failed command restores the prior visible device state
  and exposes a localized inline error without changing the layout.
- **AC6:** A successful command reconciles the card from the returned device
  snapshot; declared capability constraints are respected.
- **AC7:** Existing dashboard widget data remains compatible and the camera
  presentation path remains unchanged.
- **AC8:** Typecheck, builds, i18n validation, relevant tests, the full test
  suite, and Docker Compose runtime validation pass.


## Follow-up Clarification

The dashboard-action-button-v1 specification adds a stateless Home Assistant-style press card. It complements this stateful device-control card and does not introduce a duplicate toggle.
