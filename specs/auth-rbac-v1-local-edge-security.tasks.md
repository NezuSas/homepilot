# Tareas: Auth & RBAC V1

## Implementado

- [x] Persistencia: `packages/auth/domain/User.ts`, repositorios SQLite de usuarios y sesiones, y migraciones locales gestionan usuarios activos, roles y sesiones opacas con expiración.
- [x] Aplicación: `AuthService` autentica, cierra sesión, verifica token, cambia contraseña y permite primer administrador únicamente cuando no existen usuarios; `CryptoService` usa `scrypt` y tokens aleatorios locales.
- [x] Protección de abuso: `LoginAttemptRateLimiter` limita intentos por usuario/origen y `AuthRoutes` devuelve el estado de bloqueo sin revelar credenciales.
- [x] HTTP/RBAC: `AuthGuard` inyecta el usuario autenticado; `AuthRoutes`, `AdminRoutes` y las rutas protegidas aplican autorización y roles desde el contenedor.
- [x] Primer uso: `SystemRoutes` expone setup-status y bootstrap-admin de forma pública solo mientras no hay usuarios; el perfil de desarrollo `HOMEPILOT_DEV_BOOTSTRAP=true` mantiene `admin/admin` limitado a desarrollo.
- [x] Consola: `LoginView`, `useSession`, navegación y perfil permiten login local, persistencia del token, logout, identidad del usuario y cambio de contraseña/perfil.
- [x] Hardening: respuestas de auth sin caché, cabeceras de seguridad, rate limiting y validación de imágenes/medios se mantienen en rutas y servicios dedicados.

## Evidencia automatizada

- [x] `apps/api/__tests__/AuthRoutes.security.test.ts` cubre bloqueo por intentos fallidos, `Retry-After` y dependencias inyectadas de la ruta.
- [x] `packages/auth/application/AuthService.bootstrapFirstAdmin.test.ts` cubre creación del primer administrador y su perfil inicial.
- [x] `packages/auth/application/LoginAttemptRateLimiter.test.ts` cubre límite, ventana de bloqueo y limpieza tras éxito.
- [x] `apps/api/__tests__/AdminRoutes.test.ts` cubre denegación por RBAC y DTO público sin secretos.
- [x] `npm run verify:quality` ejecuta estas pruebas junto con typecheck, builds y gates SDD/TDD/BDD/SOLID.