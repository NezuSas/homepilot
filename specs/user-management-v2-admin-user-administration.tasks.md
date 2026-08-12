# Tareas: User Management V2

## Implementado y verificado

- [x] Persistencia de usuarios y sesiones: `SqliteUserRepository` implementa listado, conteo de administradores y mutaciones atómicas de rol/estado; `SqliteSessionRepository` cuenta y revoca sesiones por usuario.
- [x] Servicio de aplicación: `packages/auth/application/UserManagementService.ts` devuelve DTOs públicos, crea cuentas con contraseña explícita, protege el mínimo de administradores, desactiva/revoca sesiones y restablece contraseñas sin auditar secretos.
- [x] Puertos y composición: `packages/auth/application/ports/UserManagementPorts.ts` mantiene el servicio independiente de SQLite y `infrastructure/assemblers/buildAuthModule.ts` compone las dependencias.
- [x] API administrativa: `apps/api/routes/AdminRoutes.ts` protege el directorio y las operaciones de crear usuario, cambiar rol, activar/desactivar, restablecer contraseña y revocar sesiones.
- [x] Perfil propio: `AuthRoutes` y `UserManagementService.updateProfile` persisten `displayName` y avatar; `UserProfileModal` y la shell de consola consumen el perfil persistido.
- [x] Consola administrativa: `UsersView`, `UsersTable` y `ResetUserPasswordModal` ofrecen creación, cambios de rol/estado, revocación, confirmaciones de riesgo y presentación responsive.

## Evidencia automatizada

- [x] `__tests__/UserManagement.test.ts` cubre DTO sanitizado, validación de creación, regla de mínimo admin, desactivación, revocación y reset de contraseña sin secretos.
- [x] `apps/api/__tests__/AdminRoutes.test.ts` cubre acceso exclusivamente administrativo y directorio con DTO público.
- [x] `npm run verify:quality` ejecuta estas suites junto con typecheck, builds y gates SDD/TDD/BDD/SOLID.