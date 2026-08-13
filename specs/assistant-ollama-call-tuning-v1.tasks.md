# Tareas: Assistant Ollama Call Tuning V1

## Implementación

- [x] AC1/AC2: `OllamaGenerateOptions` en `ports/OllamaClientPort.ts`; `OllamaClient.generateJson`
      aplica `keep_alive`, `options.temperature`/`num_predict`/`num_ctx`/`top_k`/`top_p`.
- [x] AC3: `LlmIntentInterpreter.interpretV2` pasa `format: PLANNER_V2_SCHEMA`.

## Verificación

- [x] AC1/AC2: 3 tests nuevos en `ollama_client.test.ts` (keep_alive + options por defecto, schema
      personalizado como format, override de temperature/numPredict).
- [x] AC3: 1 test nuevo en `llm_intent_interpreter.test.ts` verificando que `interpretV2` pasa el
      schema real como `format`.
- [x] AC4: `npx tsc --noEmit`, `npm run build`, suite completa (143 suites, 1195 tests) sin
      regresiones.
- [x] AC5: `docker build` + `docker run` con `ASSISTANT_PLANNER_V2_EXECUTION=true` — arranque
      correcto, `/health` en verde. Contenedor, imagen y volumen de prueba eliminados al finalizar.
- [x] `check:spec-coverage` (sin cambio de conteo, solo ediciones), `check:bdd-traceability`,
      `check:architecture-boundaries`, `check:no-production-any`, `check:module-test-coverage` —
      todos en verde.
