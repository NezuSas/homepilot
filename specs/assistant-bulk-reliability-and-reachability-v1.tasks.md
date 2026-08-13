# Tareas: Assistant Bulk Reliability & Device Reachability V1

## Implementación

- [x] AC1: `ScopeFilter.isDeviceAvailable` exige `device.status === 'ASSIGNED'` además de la
      comprobación de `lastKnownState.state !== 'unavailable'`.
- [x] AC2/AC3/AC4: `SonoffConnectionRegistry.recordPollFailure`/`resetPollFailures`
      (`UNAVAILABLE_THRESHOLD = 3`); `pollStates()` resetea el contador tras cualquier `fetch()` sin
      excepción, incrementa tras una excepción, y marca `unavailable` vía el nuevo método privado
      `markUnreachable()` al alcanzar el umbral (evita escrituras redundantes si ya está marcado).
- [x] AC5: `AssistantConversationService` — dos sitios de cálculo de `execution.status` (resolución
      de `multi_command` y `handleBulkActionAccept`) usan una comparación de tres vías
      (éxitos === total → `success`; éxitos === 0 → `failed`; en cualquier otro caso → `partial`).

## Verificación

- [x] AC1: test nuevo en `scope_filter.test.ts` ("excludes PENDING (Inbox, never assigned to a
      room) devices from availability").
- [x] AC1 (regresión intencional): `assistant_context_room_fast_path.test.ts` test #8 actualizado —
      un dispositivo PENDING adicional (`d3`) se agrega para cubrir explícitamente la nueva exclusión,
      manteniendo la cobertura previa de exclusión por `lastKnownState.state === 'unavailable'`.
- [x] AC2-AC4: 4 tests nuevos en `SonoffLanDiscoveryService.test.ts` (marca tras 3 fallos no antes,
      sin escrituras redundantes tras marcarse, un sondeo exitoso resetea el contador, restauración
      de disponibilidad tras volver a responder).
- [x] AC5: test nuevo en `assistant_multi_command.test.ts` ("Total failure reports status 'failed',
      not 'partial'") + assertion añadida al test #8 existente de fallo parcial; 2 assertions nuevas
      en `assistant_bulk_ux.test.ts` (partial en fallo parcial, failed en fallo total del flujo de
      ticket de bulk).
- [x] AC6: `npx tsc --noEmit`, `npm run build`, suite completa (145 suites, 1214 tests) sin
      regresiones no intencionales.
- [x] `check:spec-coverage` (conteo actualizado a 583), `check:bdd-traceability`,
      `check:architecture-boundaries`, `check:no-production-any`, `check:module-test-coverage` —
      todos en verde.
