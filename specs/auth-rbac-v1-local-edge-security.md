# Auth & RBAC V1 (Local Edge Security)

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
**Safe Bootstrap Execution:** 
Upon system startup (`bootstrap()`), if the `users` table is entirely empty, the system will create an `admin` user with a **strong generated random password** (e.g. 16 chars). 
- This password will be printed **once** to the terminal securely and visibly (e.g. `[SECURITY] Initial admin password generated: Yt6&Gk...`). 
- No hardcoded `admin/admin` logic will exist in the final codebase. 
- It guarantees the system is never unrecoverably locked out while maintaining zero guessability.

## 5. Endpoints & Context Injection
### Auth Endpoints
- `POST /api/v1/auth/login` (body: `{ username, password }`)
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

## 7. Model
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
