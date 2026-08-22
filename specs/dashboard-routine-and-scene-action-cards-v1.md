# Dashboard Routine and Scene Action Cards V1

**Status:** Implemented
**Date:** 2026-08-22

## Context

The dashboard's Action card (`action` Section kind, `action_button` widget type) only bound to Home Assistant `button` entities. Two other one-tap, stateless targets could not be assigned to any button-style card:

- **Home Assistant scenes** — a `scene.*` entity has no `light`/`switch`/etc. domain, so `HomeAssistantImportService` classified it under the `unknown` fallback and it was imported as a generic, read-only `sensor`. It could not be assigned to any actionable card.
- **HomePilot automations ("routines")** — automations only run from their own trigger/condition. There was no way to fire one on demand from the dashboard, and no backend endpoint even existed for it.

The existing `scene` Section card kind (`SceneShortcutWidget`, `POST /api/v1/scenes/:id/execute`) already assigned and executed HomePilot scenes correctly. An earlier iteration of this spec added a separate `routine` card kind for automations, but a single button that runs either a scene or a routine is simpler for residents than two near-identical cards — so routines were folded into the existing `scene` card instead of staying a distinct kind.

## Goal

One button-style Section card ("Scene") that can be bound to either a HomePilot scene or a HomePilot automation ("routine"). A tap always executes immediately; neither target exposes an on/off state. The separate `action` card (Home Assistant `button`/`scene` **device** bindings) is untouched.

## Scope

- Classify Home Assistant `scene.*` entities as a `scene` device profile/type with a single `activate` capability, instead of falling back to `sensor`. (This still matters for the `action` card, which can bind a Home Assistant scene *imported as a device* — separate from a HomePilot scene/automation bound to the `scene` card below.)
- Map `activate` on a `scene`-domain entity to the Home Assistant `scene.turn_on` service, mirroring how `press` maps to `button.press`.
- Add `POST /api/v1/automations/:id/run`: validates home ownership, then runs the rule's action immediately via `AutomationEngine.runRuleNow`, bypassing its trigger/condition and loop-prevention cache (both exist to stop automations re-triggering each other, not to block a deliberate manual run).
- Extend the existing `scene` Section card's picker to list both HomePilot scenes (`GET /api/v1/scenes`) and automations (`GET /api/v1/automations`) in one combined, labeled list.
- Persist which kind of target is bound using an `automation:` id prefix (e.g. `automation:<uuid>`) on the card's `entityId`, so every scene card saved before this change — a plain id — keeps resolving as a scene with no migration.
- On tap, the card executes a scene via `/api/v1/scenes/:id/execute` or a routine via `/api/v1/automations/:id/run` depending on that prefix.
- Widen the existing `action` card's device picker to also list devices that expose `activate` (Home Assistant scenes imported as devices), not only `press`.
- Remove the scene picker's "N actions" detail — it added noise without being decision-relevant.

## Out of Scope

- A separate `routine` card kind (reverted after review — one combined card is simpler).
- Confirmation prompts for routine/scene activation — non-destructive, reversible-by-re-running actions.
- Any change to automation trigger/condition evaluation or the loop-prevention window for event-driven firing.

## Acceptance Criteria

- **AC1:** `getHomeAssistantDeviceProfile('scene.tv_input')` (and any `scene.*` entity) resolves to `type: 'scene'`, `semanticType: 'scene'`, `supportedCommands: ['activate']` — not `sensor`.
- **AC2:** `HomeAssistantDeviceDriver.executeCommand` dispatches `activate` on a `scene`-domain entity to `scene.turn_on`; `activate` is rejected for any other domain.
- **AC3:** `POST /api/v1/automations/:id/run` requires authentication, validates the rule's home ownership (403 on mismatch), returns 404 for an unknown rule, 503 if the automation engine isn't wired, 502 with the underlying error if the run fails, and 200 with a correlation id on success.
- **AC4:** `AutomationEngine.runRuleNow` executes the rule's action immediately regardless of its trigger or the loop-prevention cache, and reports success/failure without letting an automation failure throw across the route boundary.
- **AC5:** The `scene` Section card's picker lists both scenes and automations (tagged so they're distinguishable), assigning either persists correctly, and tapping the live card calls the right endpoint (`/scenes/:id/execute` or `/automations/:id/run`) based on the persisted id shape.
- **AC6:** The existing `action` card's device picker (`getAssignableDevicesForSectionCard('action', ...)`) also includes devices exposing `activate`, and the live card dispatches `press` or `activate` depending on which the bound device actually supports.
- **AC7:** Every scene card persisted before this change (plain, unprefixed `entityId`) keeps resolving and executing as a scene with no data migration.

## Verification

- `packages/devices/__tests__/DeviceProfiles.test.ts`, `HomeAssistantImportService.test.ts` cover AC1.
- `packages/integrations/home-assistant/__tests__/HomeAssistantDeviceDriver.test.ts` covers AC2.
- `apps/api/__tests__/AutomationRoutes.test.ts` covers AC3.
- `packages/automation/__tests__/AutomationEngine.test.ts` covers AC4.
- `apps/operator-console/src/views/dashboards/dashboardUtils.test.ts` covers AC6.
- `npm run typecheck`
- `npm run build`
- `npm run build --prefix apps/operator-console`
- `npm run check:i18n`
- `npm run test`
