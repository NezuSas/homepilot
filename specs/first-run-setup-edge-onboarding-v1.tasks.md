# First-Run Setup & Edge Onboarding V1 - Tasks

- [ ] Data Layer & Persistence Setup
    - [ ] Create domain types for `SystemSetupState` in `packages/system-setup/domain`.
    - [ ] Create `004_add_system_setup_table.sql` migration.
    - [ ] Implement `SqliteSystemSetupRepository.ts` focused on `SystemSetupState` retrieval/mutation.

- [ ] Application Layer (`SystemSetupService.ts`)
    - [ ] Build `getSetupStatus()` deriving `requiresOnboarding = !isInitialized` alongside signals `hasAdminUser`, `hasHAConfig`.
    - [ ] Build `completeOnboarding(userId)` performing **live validation** via `HomeAssistantSettingsService`.
    - [ ] Build idempotency guard: Return `isInitialized === true` silently as successful in `completeOnboarding`.
    - [ ] Add explicit activity log dispatches using structure `ONBOARDING_STARTED`, `ONBOARDING_HA_TESTED`, `ONBOARDING_COMPLETED`.
    - [ ] Register Service and wiring instances cleanly inside `bootstrap.ts` container avoiding loops.

- [ ] HTTP Routing (`OperatorConsoleServer.ts`)
    - [ ] `GET /api/v1/system/setup-status` -> Require Operator min role.
    - [ ] `POST /api/v1/system/setup-status/complete` -> Require Admin strict role.

- [ ] Operator Console UI Frontend
    - [ ] Setup effect fetching `/setup-status`. Branch UI entirely to guided wizard if `requiresOnboarding: true`.
    - [ ] Enhance Step 1 to show diagnostic matrix (System state, Username/User context acting, HA config present, last known HA connection state).
    - [ ] Build Step 2 allowing modification and HA live `testConnection`.
    - [ ] Build Step 3 concluding the flow by sending `POST /complete` handling live 400 backend rejections appropriately.
    - [ ] Make the Wizard accessible non-intrusively from HA Settings after completion, rendering without block.

- [ ] Tests (`verify_onboarding_v1.ts`)
    - [ ] Test status uninitialized format shape.
    - [ ] Test status successfully initialized logic tree.
    - [ ] Test role enforcement preventing operators finalizing onboarding.
    - [ ] Test hard-fail preventing finalizing onboarding with fake HA parameters.
    - [ ] Test idempotency of `POST /complete` strictly yielding 200 OK after already being Initialized.
    - [ ] Test persistency mock validating reboot logic preserves Status.
