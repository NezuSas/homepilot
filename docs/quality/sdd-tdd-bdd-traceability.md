# SDD / TDD / BDD Traceability Matrix

Modbus TCP local V1: AC1/AC2/AC4/AC5/AC6 → `packages/integrations/modbus/__tests__/ModbusService.test.ts`; AC3/AC4 → `ModbusTcpClient.test.ts` (PLC TCP simulado); AC2 → `apps/api/__tests__/ModbusRoutes.test.ts`; AC7 → escenarios `Native Modbus configuration` en `responsive-shell.spec.ts`. Integración física no ejecutada; sin equivalencias automáticas Xinje.

| Bounded context | Primary spec | TDD suite | Executable BDD evidence |
|---|---|---|---|
| User administration | `user-management-v2-admin-user-administration.md` | `__tests__/UserManagement.test.ts` | `apps/api/__tests__/AdminRoutes.test.ts`: admin-only management and secret-free DTOs |
| Authentication | `auth-rbac-v1-local-edge-security.md` | `apps/api/__tests__/AuthRoutes.security.test.ts` | Login lockout after failed attempts |
| Devices | `device-command-execution.md` | `packages/devices/__tests__/command_api.test.ts` | Valid command dispatch and invalid-state rejection |
| Device discovery | `device-discovery-inbox.md` | Device route sync and delete tests plus responsive shell | Summary-only query, deletion integrity, and progressive candidate load |
| Home Assistant WebSocket | `home-assistant-realtime-sync-v1.md` | Home Assistant WebSocket client test | Valid handshake subscribes; timeout is classified as unreachable |
| Home Assistant settings | `home-assistant-settings-connection-management-v1.md` | Home Assistant settings service test | Settings route tests cover validation, masked token, optional save, and reduced status |
| Sonoff LAN | `sonoff-local-integration-v1.md` | Sonoff device driver test | Local dispatch and unsupported-command rejection |
| Tuya policy | `tuya-integration-policy-v1.md` | Home Assistant import service test | Imported Tuya cover retains Home Assistant bridge |
| Device capabilities | `device-capabilities-command-validation.md` | Command capability validator test | Unsupported capability command is rejected |
| Automation lifecycle | `automation-rule-lifecycle-v1.md` | Automation lifecycle test | Scheduled creation retains local time, IANA zone, and days |
| Automation engine | `automation-engine-v2-event-driven.md` | Automation engine test | Concurrent bounces are deduplicated and audited |
| Diagnostics | `observability-diagnostics-v1.md` | Diagnostics service test | Diagnostics route requires authentication and delegates snapshot/timeline |
| Native cameras | `native-camera-local-integration-v1.md` | Native camera route test | Authenticated list hides password and validates `homeId` |
| Durable local persistence | `local-durable-persistence-v1.md` | SQLite database manager test | DELETE journal avoids WAL/SHM sidecars on Windows bind mounts |
| Scenes | `scene-lifecycle-v1.md` | Scene execution service test | Parallel scene execution |
| Assistant | `assistant-v1.md`, `nezu-domestic-assistant-v1.md` | Assistant execution and conversation tests | Residential command resolution, execution, and conversation matrix |
| Local voice conversation | `home-conversation-natural-voice-v1.md` | Voice and assistant route tests | Canonical wake, local Whisper STT, Piper TTS, and safe error |
| Operator Console | `operator-console-v1.md` | Assistant API client test | Conversation submission from the console |
| Assigned operational devices and compact insights | `operator-console-v1.md` AC60, `energy-management-v1.md` AC4 | deviceOperationalEligibility, assignedEnergyPresentation, SceneDeviceSelector, AutomationDeviceSelect, CompactSystemPresentation tests | Responsive `Assigned compact insights`: five Home suggestions, assignment alerts preserved, unassigned energy readings excluded in mobile/tablet/desktop; `Automation device groups`: unassigned option excluded and last assigned option reachable |
| Application shell | `operator-console-v1.md` | Demo steps test | Guided demo with stable selectors and views |
| Dashboard sections | `dashboard-layout-and-widgets-v1.md` | Section card catalogue test | Card normalization and layout compatibility |
| User dashboard navigation | `user-dashboard-navigation.md` | Responsive shell test | Collapsible dashboard group and authenticated child navigation |

This matrix supports the traceability acceptance criterion in
`engineering-quality-compliance-v1`. Every row is maintained with automated
evidence and is expanded before its context is declared implemented.
