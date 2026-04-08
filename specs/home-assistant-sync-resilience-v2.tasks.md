# Tasks: Home Assistant Sync Resilience V2

- [ ] V2 Planning
    - [x] Refine `specs/home-assistant-sync-resilience-v2.md` with explicit rules.
    - [x] Refine `specs/home-assistant-sync-resilience-v2.tasks.md`.
    - [ ] Update `implementation_plan.md` and await Approval.

- [ ] Reconnection Logic (`HomeAssistantRealtimeSyncManager`)
    - [ ] Add explicit stop(), auth_error, configure handlers dropping timeouts.
    - [ ] Add precise Backoff sequence (1s, 2s, 5s, 10s...) matching rules ensuring Single Active Timer.
    - [ ] Reconfigure socket instantiation abandoning `removeAllListeners()` usage.
    - [ ] Define bootstrap sequence: Connect -> Auth -> Subscribe -> Reconcile.

- [ ] State Reconciliation (`HomeAssistantClient` & `HomeAssistantRealtimeSyncManager`)
    - [ ] Expose/Integrate `getStates()` from `/api/states` endpoint strictly over `HomeAssistantClient`.
    - [ ] Implement `silentApplyState` bypass ensuring NO event emission touches the Automation Engine.
    - [ ] Persist updates correctly mapping UUIDs preserving Unchanged flags.

- [ ] Edge Cases and Connectivity Rules
    - [ ] Surround Reconcile in a Non-Fatal Error Handler block to preserve WebSocket flow.
    - [ ] Implement Strict Logging Shape (type: `HA_RESILIENCE`, custom payload arrays).
    - [ ] Tie `unreachable`, `lastCheckedAt` increments cleanly in `SettingsService`.

- [ ] Automated Validations
    - [ ] Add specific Unit Tests (Jest or similar) for Backoff/Single-Timer constraints.
    - [ ] Add specific Unit Tests defining Auth Fatal dropping logic.
    - [ ] Add specific Unit Tests demonstrating `getStates()` failing without crashing WS.
    - [ ] Develop End-to-End simulation script `verify_resilience_v2.ts` for real integration trace.
