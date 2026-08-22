# Tasks: Dashboard Routine and Scene Action Cards V1

Primary spec: [dashboard-routine-and-scene-action-cards-v1.md](./dashboard-routine-and-scene-action-cards-v1.md)

- [x] Add `activate` to the `DeviceCommandV1` dictionary and validity list.
- [x] Add a `scene` capability type with a single `activate` command.
- [x] Add `scene` to `DeviceSemanticType`.
- [x] Add a Home Assistant `scene` device profile (type/semanticType `scene`, capability `scene`), so `getHomeAssistantDeviceProfile('scene.*')` no longer falls back to `sensor`.
- [x] Map `activate` on a Home Assistant `scene`-domain entity to `scene.turn_on` in `HomeAssistantDeviceDriver`.
- [x] Add `AutomationEngine.runRuleNow(ruleId, correlationId)`: finds the rule, runs its action immediately bypassing trigger/loop-prevention, reports success/failure via the existing failure counter.
- [x] Add `POST /api/v1/automations/:id/run` route: auth, ownership validation, 404/403/502/503/200 responses.
- [x] Widen `getAssignableDevicesForSectionCard('action', ...)` to include devices exposing `activate`.
- [x] Extend `action` card's `handleCardAction` to pick `press` or `activate` based on the bound device's actual capability instead of hardcoding `press`.
- [x] Add automation fetch (`GET /api/v1/automations`) alongside the existing scene fetch, triggered by the `scene` card kind.
- [x] Combine scenes and automations into one picker for the `scene` Section card kind, tagging each option and prefixing automation ids (`automation:<id>`) so persisted plain ids keep meaning "scene".
- [x] Extend `handleCardAction`'s `scene` branch to detect the `automation:` prefix and call `/api/v1/automations/:id/run` instead of `/api/v1/scenes/:id/execute` when present.
- [x] Remove the "N actions" detail from the scene picker and the live card's saved description.
- [x] ~~Add a separate `routine` Section card kind~~ — reverted; folded into the `scene` card kind instead (one card, not two).
- [x] Add/update i18n keys (`scene_option_tag`, `routine_option_tag`; removed the now-unused `section_card_routine[_desc]`, `assigned_routine`, `scene_action_one/other`) in Spanish and English.
- [x] Add/update tests: `DeviceProfiles.test.ts`, `HomeAssistantImportService.test.ts`, `HomeAssistantDeviceDriver.test.ts`, `AutomationEngine.test.ts`, `AutomationRoutes.test.ts`, `dashboardUtils.test.ts`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Run `npm run build --prefix apps/operator-console`.
- [x] Run `npm run check:i18n`.
- [x] Run the full relevant test suite (`packages/devices`, `packages/integrations/home-assistant`, `packages/automation`, `apps/api/__tests__`, `apps/operator-console/src/views/dashboards`) — 83 suites / 795 tests passing.
