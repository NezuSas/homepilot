# Auth & RBAC V1 (Local Edge Security)

**Estado:** Implementado

## 1. Goal
Implement a robust, localized authentication and basic Role-Based Access Control (RBAC) layer for the HomePilot Edge device.

## 2. Technical Stack & Strategy
- **Authentication Strategy**: Local edge authentication using a **Session-backed Opaque Token**.
  - *Details*: Tokens will be securely generated random strings saved in the `sessions` SQLite table.
  - *Expiration*: Fixed 7-day expiration. No sliding sessions for V1.
  - *Logout*: Invalidates strictly the current token requested to be logged out.
- **Token Storage**: The Frontend will store the token exclusively in **LocalStorage**.
  - *Justification*: As an Edge appliance serving a React SPA, LocalStorage is straightforward, survives browser restarts reliably across different kiosk/PWA contexts, and facilitates cleanly mounting the Authorization logic programmatically on `fetch` interceptors.
- **Password Security**: Standard Node `crypto.scrypt` (dependency-free and secure).
- **Login abuse protection**: Login attempts are throttled locally by normalized username and source address. After five failed attempts, the pair is paused for 15 minutes by default. The limits are configurable through `HOMEPILOT_AUTH_MAX_FAILURES` and `HOMEPILOT_AUTH_LOCKOUT_MS`.
- **HTTP hardening**: API and UI responses set anti-clickjacking, anti-sniffing, no-referrer and restrictive permissions headers. The UI also applies a same-origin Content Security Policy.
- **Media uploads**: Avatar and dashboard-background data URIs accept only JPEG, PNG or WebP. Avatars are limited to 2 MiB and backgrounds to 8 MiB after Base64 decoding.

## 3. RBAC Matrix

| Endpoint Area / Action | Role: Operator | Role: Admin |
| :--- | :---: | :---: |
| **`GET /api/v1/auth/me` & `POST /api/v1/auth/logout`** | ✅ | ✅ |
| **`GET /api/v1/system/diagnostics/*`** | ✅ | ✅ |
| **`GET /api/v1/devices/*` & `/api/v1/homes/*`**| ✅ | ✅ |
| **`POST /api/v1/devices/:id/command`** | ✅ | ✅ |
| **`GET /api/v1/automation-rules`** | ✅ | ✅ |
| **`POST / PUT / DELETE /api/v1/automation-rules/*`** | ❌ | ✅ |
| **`POST /api/v1/devices/:id/assign`** | ❌ | ✅ |
| **`POST /api/v1/ha/import` & `/api/v1/ha/refresh` (Manual HA Actions)** | ❌ | ✅ |
| **`GET /api/v1/ha/entities` (Discovery)** | ❌ | ✅ |
| **`GET / POST /api/v1/settings/*` (Settings Read/Write)** | ❌ | ✅ |
| **`POST /api/v1/auth/change-password`** | ✅ | ✅ |

*Note*: Admin actions strictly require the `admin` role. `Operator` has expansive read permission and can execute live telemetry operations (commands), but cannot modify infrastructure arrays or sensitive credentials.

## 4. Bootstrapping Strategy
**First-Admin Setup Execution:**
Upon system startup (`bootstrap()`), if the `users` table is entirely empty, production-like runtime must **not** create an invisible administrator automatically and must **not** print a customer credential to logs.

Instead:
- `GET /api/v1/system/setup-status` may be read without authentication only while no users exist, so the UI can detect factory state.
- `POST /api/v1/system/bootstrap-admin` creates the first local `admin` account only while `users.count() === 0`.
- The first-admin endpoint returns a normal session token so the UI can continue into the protected onboarding flow immediately.
- Once any user exists, the first-admin endpoint must reject further calls.

Development exception:
- If `HOMEPILOT_DEV_BOOTSTRAP=true`, the backend may create `admin/admin` on an empty DB for local developer speed only.
- This development path is forbidden for customer/production delivery.
- No generated production password should be printed to logs as the customer-facing setup mechanism.

## 5. Endpoints & Context Injection
### Auth Endpoints
- `POST /api/v1/auth/login` (body: `{ username, password }`)
- `POST /api/v1/system/bootstrap-admin` (public only while no users exist; body: `{ username, password, displayName? }`)
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password` (body: `{ currentPassword, newPassword }`)

### AuthGuard & Context
Guards/Middlewares will be decoupled into independent functions (`AuthGuard.ts`, `RoleGuard.ts` equivalents) and not scattered inline within `OperatorConsoleServer`.
1. Extracts `Authorization: Bearer <token>`.
2. Validates token format.
3. Looks up `sessions` in DB.
4. Validates fixed expiration limit. **(If Expired -> 401)**.
5. Looks up `users`.
6. Validates if user is active. **(If Inactive -> 403)**.
7. Mutates/Injects the verified user context onto the incoming HTTP connection: `req.user = { id, username, role }`.

*Handling Invalid Sessions*:
Logging out a garbage or already-expired token will elegantly skip failure and respond `200` to guarantee frontend state clearing without crashing.

## 6. Secure Accounting & Diagnostics Integration
Auth events logged:
- Login successful -> Tracks timestamp.
- Login failed -> Observability event logged.
- **CRITICAL**: Never log passwords (plain or hashed) in memory or disk. Never log raw session tokens in the log output or UI diagnostics. Token leakage is strictly guarded against.
- El servicio de autenticación no escribe en consola el nombre de usuario, la existencia o estado de una cuenta, ni el resultado de la verificación de contraseña, incluso en desarrollo.
- Failed and rate-limited logins are recorded without passwords, session tokens or account-existence information.

## 7. Security Acceptance Criteria
- **AC1**: After the configured failed-login threshold, the same username/source pair receives `429` with `Retry-After`; a successful login clears pending failures.
- **AC2**: API and UI responses include `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` headers.
- **AC3**: Unsupported, malformed, signature-mismatched or oversized avatar/background uploads are rejected before being written to disk, and media paths cannot escape the local media directory.
- **AC4**: Authentication responses use `Cache-Control: no-store`.

## 8. Model
**Users Table**
- `id`: UUID (Primary Key)
- `username`: String (Unique)
- `password_hash`: String
- `role`: String ('admin' | 'operator')
- `is_active`: Boolean
- `created_at`: DateTime
- `updated_at`: DateTime

**Sessions Table**
- `token`: String (Primary Key, Random Secure Bytes)
- `user_id`: UUID (Foreign Key)
- `expires_at`: DateTime
- `created_at`: DateTime
