# Tareas: User Management V2

- [ ] 1. **Data Layer Ampliación (Auth)**
  - [ ] Extender `SqliteUserRepository` con métodos auxiliares:
    - `countActiveAdmins()`
    - `findAll()` - devolviendo objetos de dominio sin exponer hash (o mapeo en capa superior)
    - `updateRole(id, role)`
    - `updateActiveState(id, isActive)`
  - [ ] Extender `SqliteSessionRepository` con métodos auxiliares:
    - `countActiveForUser(userId)`
    - `invalidateAllForUser(userId)`

- [ ] 2. **Capa de Dominio / Servicio (`UserManagementService.ts`)**
  - [ ] Proveer sanitización automática estructurando la respuesta en el **Public DTO** inmaculado dictado por la especificación.
  - [ ] Implementar `listUsers()` mapeando el chequeo de `hasActiveSessions`.
  - [ ] Implementar `createUser(username, password, role)`: Requerir password explícito (validaciones >8 caracteres) y validar Unique Hash localmente para devolver `USERNAME_TAKEN`.
  - [ ] Implementar `updateUserRole(adminUserId, targetUserId, newRole)` verificando y emitiendo explícitamente `MINIMUM_ADMINS_VIOLATED` de presentarse.
  - [ ] Implementar `setUserActiveState(adminUserId, targetUserId, isActive)` interceptando `CANNOT_DEACTIVATE_SELF_LAST_ADMIN` o `MINIMUM_ADMINS_VIOLATED` y forzando borrado de Sessions en desactivación positiva.
  - [ ] Implementar `revokeUserSessions(adminUserId, targetUserId)` (revoca incondicionalmente *all* target's tokens).
  - [ ] Disparar las 5 variantes de logs en `activityLogRepository` conteniendo `adminActorUserId`, `targetUserId`, `revokedSessionsCount`, etc en su `data` object.

- [ ] 3. **Capa HTTP (`OperatorConsoleServer.ts`)**
  - [ ] `GET /api/v1/admin/users`: Gated a Admin
  - [ ] `POST /api/v1/admin/users`: Gated a Admin
  - [ ] `PATCH /api/v1/admin/users/:id/role`: Gated a Admin
  - [ ] `PATCH /api/v1/admin/users/:id/active`: Gated a Admin
  - [ ] `POST /api/v1/admin/users/:id/revoke-sessions`: Gated a Admin
  - [ ] Wire service logic properly and handle standard Mapping errors `['MINIMUM_ADMINS_VIOLATED', 'USERNAME_TAKEN']`.

- [ ] 4. **Capa UI (`UsersView.tsx` | Front end)**
  - [ ] Crear el componente para consumir el GET request de manera pasiva.
  - [ ] UI de Creación conteniendo input password explícito provisto por Admins manualmente.
  - [ ] Deshabilitar anticipadamente botones sensitivos en Frontend donde sea trivial deducir que la acción resulta inválida, sin quitar las reglas Back-end.
  - [ ] Incorporar Prompts (Módales ó popovers de confirmación) obligatorias previas a llamar endpoint de Deactivation, Role Change o Revocation. 

- [ ] 5. **Pruebas y Verificación (`verify_user_management_v2.ts`)**
  - [ ] `create user success` probando el happy path.
  - [ ] `duplicate username rejected` (USERNAME_TAKEN logica).
  - [ ] `role change success`.
  - [ ] `minimum admin rule on role change` aislando el trigger por falta de miembros.
  - [ ] `deactivate user invalidates sessions` comprobando caidas locales.
  - [ ] `revoke sessions invalidates access` destruyendo un login token explícito y re-querying la DB.
  - [ ] `admin-only endpoint protection` evaluando rechazos HTTP locales y perimetrales en los paths.
  - [ ] `listUsers never exposes passwordHash` comprobando assertions en el Entity público in-memory.
