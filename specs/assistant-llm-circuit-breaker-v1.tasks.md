# Tareas: Assistant LLM Circuit Breaker V1

## Implementación

- [x] AC1/AC2/AC3: `packages/assistant/application/LlmCircuitBreaker.ts` — máquina de estados
      aislada con recuperación half-open automática.
- [x] AC1: Conectado en `AssistantPlannerV2ShadowService.attemptHybridExecution` (gate `circuit_open`
      antes de la llamada a `interpretV2`; `recordFailure`/`recordSuccess` tras la respuesta).
- [x] AC3: `getStatus()` expone `circuitBreaker: { open, consecutiveFailures, openUntil }`.

## Verificación

- [x] AC1/AC2/AC3: 6 tests unitarios en `llm_circuit_breaker.test.ts` (umbral, reinicio por éxito,
      recuperación half-open, reapertura tras sonda fallida, estado observable).
- [x] AC1/AC2: 2 tests de integración en `assistant_planner_v2_shadow.test.ts` — confirman que tras
      3 fallos consecutivos la 4ª llamada no invoca `interpretV2`, y que un éxito intermedio
      reinicia el contador.
- [x] AC4: `npx tsc --noEmit`, suite completa (143 suites, 1191 tests) sin regresiones.
- [x] AC5: `docker build` + `docker run` con `ASSISTANT_PLANNER_V2_EXECUTION=true` — arranque
      correcto, `/health` en verde. Contenedor, imagen y volumen de prueba eliminados al finalizar.
- [x] `check:spec-coverage` (conteo actualizado 579→581), `check:bdd-traceability`,
      `check:architecture-boundaries`, `check:no-production-any`, `check:module-test-coverage` —
      todos en verde.
