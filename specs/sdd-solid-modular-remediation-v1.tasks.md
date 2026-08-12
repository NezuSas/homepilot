# Tareas: SDD and SOLID Modular Remediation V1

## Implementación

- [x] AC1: Validar spec, estado y AC de la evidencia de PR.
- [x] AC2: Incluir specs primarias inválidas en el fallo de cobertura.
- [x] AC3: Inyectar `MediaService`, `LoginAttemptRateLimiter` y `SceneExecutionService` desde el composition root; CI prohíbe instanciarlos dentro de rutas HTTP.
- [x] AC4: Inyectar AssistantFastPathResolver en AssistantConversationService.
- [x] AC5: Reemplazar contratos `any` de rutas por tipos y validación explícita.

## Verificación

- [x] Ejecutar `npm run verify:quality`.
- [x] Validar casos aceptados y rechazados de `check-sdd-pr-reference.mjs`.