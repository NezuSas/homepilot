# Auth & RBAC V1 Tasks

- [ ] Documentation
    - [x] Create `specs/auth-rbac-v1-local-edge-security.md`
    - [x] Create `specs/auth-rbac-v1-local-edge-security.tasks.md`

- [ ] Data Layer (SQLite)
    - [ ] Create `packages/auth/domain/User.ts` model.
    - [ ] Create `packages/auth/infrastructure/SqliteUserRepository.ts`.
    - [ ] Create `packages/auth/infrastructure/SqliteSessionRepository.ts`.
    - [ ] Apply migration (or table creation on bootstrap).

- [ ] Domain & Application Layer
    - [ ] Implement `CryptoService` utilizing Node's native `crypto.scrypt` and `randomBytes`.
    - [ ] Implement `AuthService` handling `login`, `logout`, `verifyToken`, `changePassword`.
    - [ ] Implement `InitialBootstrapAdmin` hook (Randomly generate first admin password).

- [ ] HTTP Security (Guards & Routing)
    - [ ] Create decoupled `AuthGuard` identifying headers and mutating `req.user`.
    - [ ] Implement `POST /api/v1/auth/login`, `POST /logout`, `GET /me`, `POST /change-password`.
    - [ ] Enforce Role checks across API mapping utilizing `req.user.role`.

- [ ] Operator Console UI
    - [ ] Add Basic Login View.
    - [ ] Save Token locally (LocalStorage).
    - [ ] Add Logout button to SideNav.
    - [ ] Display logged-in user and role minimally.
    - [ ] Add basic view/modal to consume `change-password` functionality.

- [ ] Tests
    - [ ] Auth successful and failure scenarios.
    - [ ] Auth access denied when unauthenticated.
    - [ ] Error behaviors (Session expired test -> 401).
    - [ ] Error behaviors (User inactive test -> 403).
    - [ ] Auth access denied by RBAC (operator executing admin actions).
    - [ ] Auth logout flow and corrupted token graceful exit.
    - [ ] User Change Password validation.
    - [ ] Verify contextual injection `req.user`.

- [ ] Integrations
    - [ ] Add secure observability event when auth fails.
    - [ ] Add secure observability event when auth succeeds.
