# Tareas: Assistant Home Isolation & Bulk Parity V1

## Implementación

- [x] AC1/AC2: Scoped por hogar en `AssistantConversationService` (25+ sitios de `findAll()`
      sustituidos), `AssistantContextBuilder` (los 4 `build*HomeMap`), `PlannerV2Resolver`
      (`resolveDevice`/`resolveRoom`/`resolveCategory`/`resolveScene`), `IntentInterpreterService`
      (`interpretDeterministic`).
- [x] AC1: Propagación de `userId` a través de `IntentInterpreterPort.interpret` y
      `LlmIntentInterpreterPort.interpret`.
- [x] AC3: Eliminado el bypass de confirmación en voz de `handleRoomBulkFastPath`.
- [x] AC4: `handleRoomBulkFastPath` aplica `requiresBulkStateChange` además de
      `isControllableForBulk`.
- [x] AC5: `requiresBulkStateChange` corregido para no asumir "ya satisfecho" ante estado
      desconocido/no binario.
- [x] Inyección de `HomeRepository` (opcional) en `bootstrap.ts` para los cuatro colaboradores.

## Verificación

- [x] AC6: `npx tsc --noEmit` sin errores.
- [x] AC6: Suite completa (`npx jest`) — 139 suites, 1152 tests, sin regresiones.
- [x] AC6: Nuevos tests — `assistant_home_isolation.test.ts` (5 casos),
      `assistant_bulk_room_parity.test.ts` (4 casos, cubren H2/H3/H9).
- [x] `npm run check:spec-coverage` — sin nuevos hallazgos atribuibles a este cambio (el único
      hallazgo restante, `voice-catalog-v1.md`, es preexistente y fuera de alcance).
