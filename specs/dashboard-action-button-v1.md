# Dashboard Action Button v1

**Status:** Implemented

## Context

HomePilot already offers stateful device tiles for lights, switches, and covers. A Home Assistant `button` is different: it exposes a one-time `button.press` service and has no persistent on/off state. Treating it as a light or a toggle would present false state and allow irrelevant bindings.

## Goal

Provide a dedicated **Action Button** card in dashboard Sections. The card invokes the existing device command endpoint with the explicit `press` command and gives clear, accessible command feedback without pretending that the device is on or off.

## Scope

- Support Home Assistant `button` entities as a native device profile with only the `press` capability.
- Dispatch `press` to Home Assistant as `button.press`.
- Add a Section catalog card called Action Button that binds only to devices declaring `press`.
- Render the card as a full-surface, stateless action with pending, success, and error feedback.
- Preserve all existing stateful device-control cards and their bindings.

## Out of scope

- Replacing the existing device-control/toggle card.
- Adding confirmation, automation, or scene semantics to a button press.
- Inferring `press` for legacy devices that do not explicitly advertise it.
- Changing Home Assistant credential, authorization, or command endpoint contracts.

## Acceptance Criteria

- **AC1 — Native profile:** `button.*` is discoverable/importable as a Home Assistant `button` profile with a single `press` command and no semantic on/off state.
- **AC2 — Safe dispatch:** an authorized existing device-command request with `press` maps only to `button.press`; `press` is rejected for other profiles by the existing capability validation.
- **AC3 — Editor binding:** the Section catalog exposes Action Button and its assignment list includes only snapshot devices that explicitly advertise `press`.
- **AC4 — Stateless UX:** an assigned Action Button executes one press per interaction, is disabled while pending, and presents pending, successful, or failed feedback without `aria-pressed` or an on/off label.
- **AC5 — Accessibility and responsiveness:** the live Action Button is a native button with an accessible name, visible keyboard focus, busy state, and readable compact/large layouts.
- **AC6 — Compatibility:** existing device-control cards, persisted Section cards, imports, and command behavior remain unchanged.

## Design Decision

This is intentionally not a second toggle card. It complements the existing `device_control` card with Home Assistant's stateless Button-card behavior. Its neutral surface and restrained primary interaction belong to the existing Warm Local Command Center design system.

Transient feedback must not repaint the whole card as a generic success or error
surface. The card stays on the normal dashboard elevation while its border,
icon, and compact status indicator communicate pending, success, or failure.
The status copy must remain single-line and legible in the compact card size in
both light and dark themes.

## Verification

- Device profile, import, driver, capability, catalog, compatibility-filter, and action-widget tests cover AC1–AC5.
- `npm run typecheck`
- `npm run build`
- `npm run build --prefix apps/operator-console`
- `npm run test`
- `npm run check:i18n`
- `docker compose up --build`