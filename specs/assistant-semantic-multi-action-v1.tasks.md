# Tareas: Assistant Semantic Multi-Action Plans V1

## Implementación

- [x] AC1/AC3/AC4: `AssistantPlannerV2ShadowService.attemptMultiActionResolution` — nuevo método
      privado, falla en bloque, reutiliza la forma de retorno "multi-objetivo guardado".
- [x] AC2: Validación de comando compartido entre todas las acciones antes de resolver ninguna.
- [x] AC5: Límite de 8 acciones en `attemptMultiActionResolution` y en `PlannerV2Validator`
      (`MAX_ACTIONS`), más `maxItems: 8` en `PLANNER_V2_SCHEMA`.

## Verificación

- [x] AC1-AC4: 5 tests nuevos en `assistant_planner_v2_shadow.test.ts` (plan multi-acción exitoso,
      comandos mixtos, fallo parcial descarta todo, referencia de contexto, más de 8 acciones).
- [x] AC1: Test de integración end-to-end en `assistant_bulk_confirmation.test.ts` — verifica
      explícitamente que el prompt de prueba llega de verdad al camino semántico (no queda
      interceptado por una compuerta determinista anterior), crea el ticket, y ejecuta ambos
      dispositivos al confirmar.
- [x] AC5: 2 tests nuevos en `assistant_planner_v2_foundation.test.ts` (rechaza 9 acciones, acepta
      exactamente 8).
- [x] AC6: `npx tsc --noEmit`, `npm run build`, suite completa (142 suites, 1183 tests) sin
      regresiones.
- [x] AC7: `docker build` + `docker run` con `ASSISTANT_PLANNER_V2_EXECUTION=true` explícito —
      `[PLANNER_V2_EXECUTION_INIT] {"enabled":true,...}` en logs, `/health` en verde. Contenedor,
      imagen y volumen de prueba eliminados al finalizar.
- [x] `check:spec-coverage`, `check:bdd-traceability`, `check:architecture-boundaries`,
      `check:no-production-any`, `check:module-test-coverage` — todos en verde (sin archivos nuevos
      que requieran actualizar el conteo, todos los cambios en archivos existentes).
