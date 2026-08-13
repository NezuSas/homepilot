# SPEC: Assistant Confirmation Tickets V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-13

## Problema

Las acciones masivas del asistente ("apaga todo", bulk por estancia, guardia multi-objetivo del
Planner V2) confirmaban su ejecución mediante un campo `pendingBulkAction` dentro del mismo blob JSON
compartido de `assistant_memory` (`short_term_context`). Esto arrastraba tres problemas concretos:

- **TTL inconsistente (H5)**: la fila SQLite expiraba a los 3600 s, pero el código validaba una
  ventana separada de 300000 ms codificada a mano. Dos fuentes de verdad para el mismo límite.
- **Sin revalidación (H6)**: al confirmar, se ejecutaban ciegamente los `deviceIds` guardados, sin
  comprobar que siguieran perteneciendo a un hogar autorizado ni que siguieran en el estado que
  justificó la propuesta original. Un "sí" tardío podía reencender dispositivos ya apagados por
  otro medio, o ejecutar sobre un hogar cuyo acceso fue revocado entre la propuesta y la
  confirmación.
- **Colisión entre confirmaciones (H7)**: `pendingBulkAction` compartía fila con `pendingIntent`,
  `pendingManagementAction`, `pendingAliasDelete`, `pendingDraft` y `pendingSuggestion`. Guardar una
  nueva confirmación pendiente podía pisar silenciosamente cualquiera de las otras.

## Alcance

- Ítem A: Persistencia dedicada de confirmaciones masivas en una tabla propia
  (`assistant_confirmation_tickets`), fuera del blob compartido de memoria conversacional.
- Ítem B: TTL único (120 s) enforced por la propia consulta del repositorio, no por una comparación
  de timestamps duplicada en la capa de aplicación.
- Ítem C: Nonce de un solo uso — un ticket consumido (aceptado o rechazado) no puede volver a
  actuarse, ni siquiera con una respuesta duplicada o tardía.
- Ítem D: Revalidación de permisos y de alcance al confirmar: el hogar del ticket debe seguir
  autorizado, y solo se ejecutan los dispositivos que siguen realmente necesitando el cambio en el
  momento de la confirmación.
- Ítem E: Los tres puntos de propuesta existentes (bulk global, bulk por estancia, guardia
  multi-objetivo del Planner V2) emiten tickets en vez de escribir `pendingBulkAction`.

## Fuera de alcance

- No se migran las demás confirmaciones (`pendingIntent`, `pendingManagementAction`,
  `pendingAliasDelete`, `pendingDraft`, `pendingSuggestion`) a tickets — siguen viviendo en el blob
  de `assistant_memory`. Solo `pendingBulkAction`, el único con TTL inconsistente y sin revalidación
  documentados, se reemplaza en esta iteración.
- No se rediseña `AssistantConfirmationPolicy` (la política basada en palabras clave para
  escenas/multi-comando/posición) para decidir por alcance resuelto; ese rediseño queda fuera de
  alcance de esta spec.
- No se añade un segundo turno de confirmación cuando el alcance revalidado cambia (p. ej. "ahora
  son 3 en vez de 5") — en su lugar, se ejecuta sobre el subconjunto revalidado y se informa cuántos
  dispositivos se omitieron en el mismo mensaje de resultado.

## Requisitos funcionales

- **REQ-01**: Toda propuesta de acción masiva (`handleBulkFastPath`, `handleRoomBulkFastPath`, el
  guardián multi-objetivo de `attemptV2HybridExecution`) persiste un `ConfirmationTicket` vía
  `ConfirmationTicketRepository.create`, con `homeId` derivado del dispositivo real resuelto (nunca
  de client input).
- **REQ-02**: La detección de "¿hay algo pendiente de confirmar?" en `converse()` consulta
  `ConfirmationTicketRepository.findActiveByUserId`, que excluye tickets expirados o ya consumidos
  directamente en la consulta SQL.
- **REQ-03**: Confirmar ("sí") consume el ticket atómicamente (`consume()`, `UPDATE ... WHERE
  consumed_at IS NULL AND expires_at > now`); un `consume()` que falla (ya consumido o expirado)
  responde que la confirmación ya no está disponible, sin ejecutar nada.
- **REQ-04**: Tras consumir, se revalida `assertHomeAuthorized(userId, ticket.homeId)`; si el acceso
  fue revocado, se responde con un error de autorización y no se ejecuta ninguna acción.
- **REQ-05**: Tras la revalidación de permisos, se recalculan los dispositivos elegibles
  (`getAuthorizedDevices` + `isControllableForBulk`/`isControllableDevice` +
  `requiresBulkStateChange` cuando el comando no es `toggle`), intersectados con
  `ticket.deviceIds`. Solo se ejecuta sobre ese subconjunto revalidado.
- **REQ-06**: Si el subconjunto revalidado es vacío, se responde que no hay nada que hacer y no se
  ejecuta ningún comando. Si es menor que el original, el resumen final indica cuántos dispositivos
  se omitieron.
- **REQ-07**: Rechazar ("no") también consume el ticket, para que no pueda reutilizarse.
- **REQ-08**: `AssistantMemoryState` ya no declara `pendingBulkAction`; `clearPendingAction` ya no lo
  referencia.

## Requisitos no funcionales

- **NFR-01**: TTL único: 120000 ms, definido una sola vez
  (`AssistantConversationService.CONFIRMATION_TICKET_TTL_MS`) y enforced también por la columna
  `expires_at` de la tabla — nunca una segunda comparación de timestamps en el código de aplicación.
- **NFR-02**: Sin `ConfirmationTicketRepository` configurado (contextos de test legados), el sistema
  degrada a "proponer pero nunca poder confirmarse" — nunca a "ejecutar sin confirmación".
- **NFR-03**: Regresión cero sobre el comportamiento de mensajes/terminología existente para bulk
  ("Encontré N luces/dispositivos...", resúmenes de ejecución).

## Criterios de aceptación

- [x] AC1: Un ticket consumido no puede volver a aceptarse ni rechazarse (segundo "sí" no ejecuta
      nada).
- [x] AC2: Un ticket expirado (más de 120 s) no aparece en `findActiveByUserId` y un "sí" tardío cae
      al flujo normal de interpretación en vez de ejecutar la acción.
- [x] AC3: Si el hogar del ticket deja de estar autorizado entre la propuesta y la confirmación, se
      responde con un error de autorización y no se ejecuta ningún comando.
- [x] AC4: Si algunos dispositivos ya cambiaron de estado entre la propuesta y la confirmación, solo
      se ejecuta sobre los que siguen necesitando el cambio, y el resumen final lo refleja.
- [x] AC5: Los tres puntos de propuesta (bulk global, bulk por estancia, guardián V2) crean tickets
      con `homeId`, `command`, `bulkType` y `deviceIds` correctos.
- [x] AC6: La suite completa pasa (1153 tests, 139 suites), `tsc --noEmit` y `npm run build` limpios.
- [x] AC7: La migración `025_create_assistant_confirmation_tickets.sql` se aplica correctamente en un
      contenedor Docker limpio (`docker build` + `docker run` contra un volumen SQLite nuevo),
      confirmado por inspección directa del esquema y por `/health`.

## Notas técnicas y arquitectura

```typescript
// packages/assistant/domain/ConfirmationTicket.ts
export interface ConfirmationTicket {
  readonly id: string;              // nonce
  readonly userId: string;
  readonly homeId: string;
  readonly command: 'turn_on' | 'turn_off' | 'toggle';
  readonly bulkType?: 'all' | 'lights';
  readonly deviceIds: string[];
  readonly originalPrompt: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
}
```

Repositorio (`packages/assistant/domain/repositories/ConfirmationTicketRepository.ts`):
`create`, `findActiveByUserId` (excluye consumidos/expirados en la propia query),
`consume` (UPDATE condicional atómico, retorna `boolean`), `deleteExpired` (limpieza best-effort,
nunca requerida para la corrección ya que `findActiveByUserId` ya filtra expirados).

Implementación SQLite (`SQLiteConfirmationTicketRepository`) sigue el mismo patrón de comparación de
timestamps ISO-8601 vía `STRFTIME` que `SQLiteAssistantMemoryRepository`, para comparación lexical
correcta.

Migración: `migrations/025_create_assistant_confirmation_tickets.sql`. Wiring:
`infrastructure/assemblers/buildRepositories.ts` → `bootstrap.ts` → último parámetro (opcional) del
constructor de `AssistantConversationService`.

## Preguntas abiertas y TODOs

- TODO: Si en el futuro se decide dar una segunda vuelta de confirmación cuando el alcance
  revalidado cambia sustancialmente (en vez de ejecutar sobre el subconjunto y solo informarlo),
  extender `handleBulkActionAccept` para devolver una nueva `clarification` con un ticket
  reemplazante en ese caso.
- TODO: Migrar `pendingIntent`/`pendingManagementAction`/`pendingAliasDelete`/`pendingDraft`/
  `pendingSuggestion` a tickets dedicados si se detecta el mismo patrón de colisión (H7) fuera del
  camino bulk.
