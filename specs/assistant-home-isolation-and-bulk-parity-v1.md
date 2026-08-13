# SPEC: Assistant Home Isolation & Bulk Parity V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-12

## Problema

El pipeline conversacional del asistente (`AssistantConversationService`, `AssistantContextBuilder`,
`PlannerV2Resolver`, `IntentInterpreterService`) resolvía dispositivos, estancias, escenas y
automatizaciones mediante `findAll()` sin filtrar por hogar autorizado. Un usuario con acceso a un
solo hogar podía, en la práctica, ver conteos, nombres de estancias y devolver resultados que
incluían entidades de otros hogares — incluyendo el *home map* que se construye para el modelo de
lenguaje. Adicionalmente, el flujo de acciones masivas ("apaga todo") tenía tres inconsistencias de
seguridad y correctitud:

- El bulk por estancia (`handleRoomBulkFastPath`) ejecutaba directamente sin confirmación cuando
  `interactionMode === 'voice'`, mientras que el bulk global siempre exigía confirmación.
- El bulk por estancia no aplicaba el filtro "solo dispositivos que realmente necesitan el cambio"
  (`requiresBulkStateChange`), a diferencia del bulk global.
- `requiresBulkStateChange` asumía que un dispositivo con estado desconocido o no binario
  (`unavailable`, `open`, `playing`, o sin `lastKnownState`) ya satisfacía el estado objetivo,
  excluyéndolo silenciosamente incluso de `turn_on`.

## Alcance

- Ítem A: Todo el flujo del asistente (chat y voz) resuelve dispositivos, estancias, escenas y
  automatizaciones exclusivamente dentro de los hogares autorizados del usuario que envía la
  petición.
- Ítem B: El bulk por estancia exige confirmación explícita en voz y en chat por igual.
- Ítem C: El bulk por estancia aplica el mismo filtro de cambio de estado real que el bulk global.
- Ítem D: Un estado de dispositivo desconocido/no binario nunca se asume como "ya en el estado
  objetivo".

## Fuera de alcance

- No se implementa en esta iteración un mecanismo de confirmación con ticket/nonce persistido en
  tabla dedicada (queda como trabajo futuro; hoy la confirmación sigue viviendo en el blob JSON de
  `assistant_memory`).
- No se modifica el modelo de datos de "hogar" (`homes`) ni se introduce membresía multiusuario por
  hogar; el alcance sigue siendo el actual (un hogar, un propietario, `findHomesByUserId`).
- No se toca la capa `packages/topology/api` (guardia legacy basada en `x-user-id`).

## Requisitos funcionales

- **REQ-01**: `AssistantConversationService` resuelve dispositivos, estancias, escenas y
  automatizaciones a través de helpers scoped por hogar (`getAuthorizedDevices`,
  `getAuthorizedRooms`, `getAuthorizedScenes`, `getAuthorizedAutomations`) en lugar de
  `deviceRepository.findAll()` / `roomRepository.findAll()` / `sceneRepository.findAll()` /
  `automationRepository.findAll()`.
- **REQ-02**: `AssistantContextBuilder` construye el *home map* (los cuatro métodos `build*`) solo
  con entidades de los hogares del `userId` recibido.
- **REQ-03**: `PlannerV2Resolver` (usado por el hybrid execution del Planner V2) resuelve
  `TargetReference` únicamente dentro del hogar del usuario.
- **REQ-04**: `IntentInterpreterService` (parser determinista V1 y su fallback LLM) resuelve
  dispositivos y escenas únicamente dentro del hogar del usuario; `interpret()` y el
  `LlmIntentInterpreterPort` propagan `userId` de extremo a extremo.
- **REQ-05**: Cuando no hay `homeRepository` configurado (contextos de test legado), los
  colaboradores anteriores caen de vuelta al comportamiento sin restricción, preservando
  compatibilidad.
- **REQ-06**: `handleRoomBulkFastPath` nunca ejecuta directamente en modo voz; siempre persiste
  `pendingBulkAction` y devuelve una aclaración, igual que en chat.
- **REQ-07**: `handleRoomBulkFastPath` filtra candidatos con `isControllableForBulk` **y**
  `requiresBulkStateChange`, igual que `handleBulkFastPath`.
- **REQ-08**: `requiresBulkStateChange` solo excluye un dispositivo cuando su estado confirma
  positivamente que ya está en el estado objetivo; cualquier otro estado (desconocido, no binario,
  ausente) se considera que requiere el cambio.

## Requisitos no funcionales

- **NFR-01**: Ningún cambio de esta spec debe alterar el comportamiento observable para un usuario
  con un solo hogar autorizado (regresión cero sobre la suite existente).
- **NFR-02**: La resolución scoped por hogar no debe añadir más de una consulta adicional por
  colección (`findHomesByUserId` + N × `findAllByHomeId`/`findRoomsByHomeId`) respecto al `findAll()`
  previo.

## Criterios de aceptación

- [x] AC1: Un usuario del Hogar A nunca ve, cuenta ni resuelve dispositivos, estancias, escenas o
      automatizaciones del Hogar B (chat, voz, home map del LLM, y confirmación de bulk).
- [x] AC2: Un usuario sin hogares autorizados no cae de vuelta a datos globales; resuelve a "no
      encontrado" en vez de filtrar por lista vacía silenciosamente incorrecta.
- [x] AC3: "apaga todo en la sala" por voz devuelve una aclaración pendiente de confirmación, nunca
      ejecuta directamente.
- [x] AC4: "apaga todo en la sala" solo propone dispositivos que están realmente encendidos y
      controlables, igual que "apaga todo".
- [x] AC5: Un dispositivo con `lastKnownState` nulo o con un `state` no reconocido se incluye en
      "prende todo"/"apaga todo" en vez de excluirse silenciosamente.
- [x] AC6: La suite completa (`packages/assistant/__tests__`) pasa, incluyendo los nuevos casos de
      regresión de aislamiento (`assistant_home_isolation.test.ts`) y de paridad bulk/estancia
      (`assistant_bulk_room_parity.test.ts`).

## Notas técnicas y arquitectura

Patrón aplicado en los cuatro colaboradores (`AssistantConversationService`,
`AssistantContextBuilder`, `PlannerV2Resolver`, `IntentInterpreterService`):

```typescript
private async getAuthorizedDevices(userId: string): Promise<Device[]> {
  if (!this.homeRepository) return this.deviceRepository.findAll(); // fallback de test legado
  const homes = await this.homeRepository.findHomesByUserId(userId);
  if (homes.length === 0) return [];
  const perHome = await Promise.all(homes.map(h => this.deviceRepository.findAllByHomeId(h.id)));
  return perHome.flat();
}
```

`HomeRepository` se inyecta como dependencia opcional adicional en el constructor de cada
colaborador y se resuelve desde `bootstrap.ts` con `repos.homeRepository` (ya existente, sin cambios
de esquema). `DeviceRepository.findAllByHomeId`, `RoomRepository.findRoomsByHomeId`,
`SceneRepository.findScenesByHomeId` y `AutomationRuleRepository.findByHomeId` ya existían en los
puertos de dominio y no requirieron cambios.

Corrección de `requiresBulkStateChange`:

```typescript
// Antes: command === 'turn_off' ? isOn : command === 'turn_on' ? isOff : false;
// Ahora:
if (command === 'turn_off') return !isOff;
if (command === 'turn_on') return !isOn;
return false;
```

## Preguntas abiertas y TODOs

- Resuelto en `specs/assistant-confirmation-tickets-v1.md` (2026-08-13): la confirmación de
  acciones masivas se migró de `assistant_memory.pendingBulkAction` a
  `assistant_confirmation_tickets`, con nonce de un solo uso, TTL único y revalidación de
  permisos/alcance al confirmar.
