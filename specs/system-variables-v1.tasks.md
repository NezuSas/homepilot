# Tareas: System Variables V1

## Implementado

- [x] Persistencia SQLite por ámbito global/hogar.
- [x] Rutas de administración, validación y autorización.
- [x] Integración con auditoría de cambios.

## Verificación obligatoria ante cambios

- [x] Probar aislamiento por hogar y validación de datos directamente en `SystemVariableService.test.ts`.
- [x] Probar autorización de ruta para escritura administrativa en `apps/api/__tests__/SystemVariableRoutes.test.ts`.
- [x] Probar persistencia SQLite y aislamiento por hogar después de reinicio en `SqliteSystemVariableRepository.test.ts`.

