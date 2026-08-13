# Tareas: Assistant Scope Filter & Permission Gate Extraction V1

## Implementación

- [x] AC1: `packages/assistant/application/ScopeFilter.ts` — extracción de 6 métodos, 22 sitios de
      llamada migrados en `AssistantConversationService`.
- [x] AC2: `packages/assistant/application/PermissionGate.ts` — extracción de 6 métodos, 47 sitios
      de llamada migrados en `AssistantConversationService`.
- [x] Imports huérfanos (`resolveCapabilitiesForDevice`, `validateDeviceCommand`) eliminados de
      `AssistantConversationService.ts` tras la extracción.

## Verificación

- [x] AC1: `scope_filter.test.ts` (8 casos).
- [x] AC2: `permission_gate.test.ts` (5 casos).
- [x] AC3: `npx jest` completo — 142 suites, 1175 tests, sin regresiones.
- [x] AC4: `npx tsc --noEmit` y `npm run build` limpios.
- [x] `check:spec-coverage` (conteo actualizado 575→579), `check:bdd-traceability`,
      `check:architecture-boundaries`, `check:no-production-any`, `check:module-test-coverage` —
      todos en verde.
