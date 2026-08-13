# Tareas: Assistant Confirmation Tickets V1

## Implementación

- [x] AC5: Migración `025_create_assistant_confirmation_tickets.sql` (tabla + índice por `user_id`).
- [x] AC5: Dominio `ConfirmationTicket` + puerto `ConfirmationTicketRepository`.
- [x] AC7: `SQLiteConfirmationTicketRepository` (create, findActiveByUserId, consume atómico,
      deleteExpired).
- [x] AC5: Wiring en `buildRepositories.ts` y `bootstrap.ts`.
- [x] AC1/AC2/AC3/AC4: Reescritura de `handleBulkActionAccept`/`handleBulkActionReject` — consumo
      atómico, revalidación de permisos (`assertHomeAuthorized`) y de alcance
      (`isControllableForBulk`/`requiresBulkStateChange`/`isControllableDevice` para toggle).
- [x] AC5: Los tres puntos de propuesta (`handleBulkFastPath`, `handleRoomBulkFastPath`,
      `attemptV2HybridExecution`) crean tickets vía `createConfirmationTicket` en vez de escribir
      `pendingBulkAction`.
- [x] AC2: Compuerta de confirmación en `converse()` consulta `findActiveByUserId` en vez de leer
      `memory.pendingBulkAction` con ventana de tiempo manual.
- [x] REQ-08: `pendingBulkAction` eliminado de `AssistantMemoryState` y de `clearPendingAction`.

## Verificación

- [x] AC6: `npx tsc --noEmit` sin errores.
- [x] AC6: Suite completa (`npx jest`) — 139 suites, 1153 tests, sin regresiones.
- [x] AC1: Test "a confirmation cannot be replayed after it was already consumed"
      (`assistant_bulk_confirmation.test.ts`).
- [x] AC2: Test "confirmation: should NOT execute an expired confirmation ticket (TTL)"
      (`assistant_ux_v2.test.ts`).
- [x] AC3: Test "rejects a confirmed bulk command outside the authenticated user home"
      (`assistant_bulk_confirmation.test.ts`) — ahora responde con error en vez de lanzar excepción.
- [x] `npm run build` limpio.
- [x] AC7: Validación Docker — `docker build` de la imagen API, `docker run` contra un volumen SQLite
      nuevo, confirmación de logs de migración, inspección directa del esquema de
      `assistant_confirmation_tickets` y verificación de `/health`. Contenedor/imagen/volumen de
      prueba eliminados al finalizar.
- [x] `npm run check:spec-coverage` — actualizado el conteo (570→573 por los 3 archivos nuevos de
      dominio/infraestructura); sin nuevos hallazgos atribuibles a este cambio.
- [x] `check:bdd-traceability`, `check:architecture-boundaries`, `check:no-production-any`,
      `check:module-test-coverage`, `check:tuya-policy`, `check:docker-profiles` — todos en verde.
