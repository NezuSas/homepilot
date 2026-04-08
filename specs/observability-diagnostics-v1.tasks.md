# Tasks: Observability & Diagnostics V1

- [ ] Planning
    - [x] Create `specs/observability-diagnostics-v1.md`
    - [x] Create `specs/observability-diagnostics-v1.tasks.md`
    - [ ] Create implementation_plan.md and request approval

- [x] Domain Types
    - [x] Create `packages/system-observability/domain/SystemHealth.ts` (all types, interfaces, IssueCode enum)

- [x] Instrumentation (minimal changes to existing modules)
    - [x] Add `getObservableState()` to `HomeAssistantRealtimeSyncManager`
    - [x] Add `getObservableState()` to `AutomationEngine`
    - [x] Track `lastEventAt`, `lastReconnectAt`, `lastReconciliationAt` in SyncManager
    - [x] Track `lastExecutionAt`, counters in AutomationEngine

- [x] DiagnosticsService
    - [x] Create `packages/system-observability/application/DiagnosticsService.ts`
    - [x] Consolidate state from all sources
    - [x] Derive `overallStatus` using explicit rules
    - [x] Derive `issues[]` from explicit conditions
    - [x] Expose `getSnapshot()` and `getRecentEvents()` methods

- [x] API Endpoints (OperatorConsoleServer routing only)
    - [x] Add `GET /api/v1/system/diagnostics` handler
    - [x] Add `GET /api/v1/system/diagnostics/events` handler
    - [x] Wire `DiagnosticsService` through `BootstrapContainer`

- [x] Bootstrap
    - [x] Add `diagnosticsService` to `BootstrapContainer`
    - [x] Inject all required dependencies

- [x] UI (Operator Console)
    - [x] Add Diagnostics view / panel to the frontend
    - [x] Health status badge (healthy/degraded/offline)
    - [x] HA connection and WebSocket status
    - [x] Automation engine status
    - [x] Issues list
    - [x] Recent events timeline

- [x] Tests
    - [x] Test overallStatus derivation rules (healthy / degraded / offline)
    - [x] Test issue detection (all 7 codes)
    - [x] Test snapshot structure validity
    - [x] Test diagnostic events filtering
