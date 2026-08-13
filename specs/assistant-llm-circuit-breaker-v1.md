# SPEC: Assistant LLM Circuit Breaker V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-13

## Problema

El camino semántico de ejecución (`AssistantPlannerV2ShadowService.attemptHybridExecution`) llamaba
a Ollama en cada turno de conversación que llegaba a esa compuerta, sin recordar fallos anteriores.
Si Ollama estaba caído, lento, o el modelo configurado no respondía, cada turno pagaba el timeout
completo de ejecución (por defecto 3.500 ms) antes de caer al camino determinista — repitiendo el
mismo costo de latencia en *cada* solicitud durante toda la duración de una caída, en contra del
requisito explícito de la arquitectura de no dejar al usuario esperando.

## Alcance

- Ítem A: `LlmCircuitBreaker` (`packages/assistant/application/LlmCircuitBreaker.ts`) — clase
  aislada y reutilizable que cuenta fallos consecutivos y, al alcanzar un umbral, deja de permitir
  llamadas durante un período de enfriamiento, con recuperación automática tipo "half-open" (la
  primera llamada tras el enfriamiento se permite como sonda; si falla, reabre; si tiene éxito,
  cierra por completo).
- Ítem B: Conectado únicamente en `attemptHybridExecution` (el camino que afecta directamente al
  usuario) — no en `runShadow`, que es diagnóstico y ya no bloquea ni retrasa la respuesta al
  usuario según su propio contrato ("Never delays or modifies the V1 response").
- Ítem C: Estado del circuit breaker expuesto en `getStatus()`, ya servido por
  `/api/v1/assistant/shadow/status`.

## Fuera de alcance

- No se conecta el circuit breaker a `runShadow` ni a `LlmIntentInterpreter.interpret` (V1) — ambos
  quedan fuera del alcance de esta iteración.
- No se persiste el estado del circuit breaker entre reinicios del proceso — es un contador en
  memoria, coherente con que un reinicio del proceso es en sí mismo una señal razonable para
  reintentar desde cero.
- No se expone configuración por variable de entorno para el umbral (3 fallos) ni el enfriamiento
  (60 s) en esta iteración — quedan como constantes con valores por defecto razonables, ajustables
  luego si la operación real lo exige.

## Requisitos funcionales

- **REQ-01**: Tras 3 fallos consecutivos de `interpretV2` (error o plan vacío) en el camino de
  ejecución, el circuit breaker se abre y las siguientes llamadas se saltan sin siquiera intentar
  contactar a Ollama, hasta que expire el enfriamiento de 60 s.
- **REQ-02**: Una llamada exitosa reinicia el contador de fallos a cero y cierra el breaker por
  completo, incluso si había fallos previos por debajo del umbral.
- **REQ-03**: Al expirar el enfriamiento, la siguiente llamada se permite como sonda; si falla,
  el breaker reabre inmediatamente (respetando el mismo umbral); si tiene éxito, cierra del todo.

## Requisitos no funcionales

- **NFR-01**: El circuit breaker es una clase sin dependencias externas, testeable de forma
  completamente aislada (sin mocks de Ollama/HTTP).
- **NFR-02**: Regresión cero — el camino de una sola acción y el camino multi-acción no cambian su
  lógica de resolución; el circuit breaker solo decide si se intenta la llamada al LLM en absoluto.

## Criterios de aceptación

- [x] AC1: Tras 3 fallos consecutivos, una cuarta llamada no invoca `interpretV2` en absoluto y
      devuelve `null` de inmediato (razón de skip `circuit_open`).
- [x] AC2: Un éxito entre fallos (2 fallos, 1 éxito, 2 fallos más) nunca abre el breaker, porque el
      éxito reinicia el contador.
- [x] AC3: `getStatus().circuitBreaker` expone `open`, `consecutiveFailures` y `openUntil`.
- [x] AC4: Suite completa sin regresiones (143 suites, 1191 tests).
- [x] AC5: Validado en contenedor Docker limpio con `ASSISTANT_PLANNER_V2_EXECUTION=true` — arranque
      correcto, `/health` en verde.

## Notas técnicas y arquitectura

`LlmCircuitBreaker` es una máquina de estados mínima: `consecutiveFailures: number`,
`openUntil: number | null`. `isOpen()` cierra automáticamente el breaker (permitiendo una sonda) en
la primera llamada posterior a `openUntil`. Instanciado como campo privado de
`AssistantPlannerV2ShadowService`; conectado en `attemptHybridExecution` inmediatamente después de
las comprobaciones de prompt vacío/selección interna/override de idioma, y antes de la llamada real
a `interpretV2`.

## Preguntas abiertas y TODOs

- TODO: Evaluar conectar el mismo circuit breaker a `runShadow` si se detecta que las llamadas de
  diagnóstico durante una caída de Ollama generan carga innecesaria en hardware de gama baja.
- TODO: Exponer umbral y enfriamiento por variable de entorno si la operación real en instalaciones
  de clientes muestra que 3 fallos / 60 s no es el punto correcto para todo hardware.
