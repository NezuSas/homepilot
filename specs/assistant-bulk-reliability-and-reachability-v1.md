# SPEC: Assistant Bulk Reliability & Device Reachability V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-13

## Problema

El usuario reportó un caso real en producción: un "apaga todo" ejecutó 21 de 29 acciones, con 8
fallos "fetch failed" sobre dispositivos Sonoff, y el sistema mostró "No se pudo completar la
acción." pese a que la mayoría sí se ejecutó. Su pedido explícito fue: "debemos trabajar solo con
las cosas que funcionen [...] veo que usas [cosas] que no funcionan". Investigando se confirmaron
tres causas independientes:

- **Dispositivos nunca asignados entran en acciones masivas**: `PermissionGate`/`ScopeFilter` no
  filtraban por `device.status`. Un dispositivo recién descubierto por Sonoff y aún sin asignar a
  una habitación (`status: 'PENDING'`, sentado en el Inbox) se trataba exactamente igual que uno
  real y desplegado, y "apaga todo" intentaba controlarlo.
- **Sin señal de alcanzabilidad real**: `SonoffLanDiscoveryService.pollStates()` sondea cada
  dispositivo Sonoff cada 30s vía `fetch()` local, pero un fallo de red (`fetch failed`) se
  descartaba en un `catch` silencioso — nunca se marcaba el dispositivo como no disponible. Un
  Sonoff desconectado hace horas seguía pareciendo "disponible" para `ScopeFilter.isDeviceAvailable`
  (que sí revisa `lastKnownState.state !== 'unavailable'`, pero nadie lo alimentaba con ese valor).
- **Éxito parcial reportado como fallo total en la UI**: tanto la ruta de comando múltiple
  (`AssistantConversationService.ts`, resolución de `multi_command`) como la de aceptación de ticket
  de bulk (`handleBulkActionAccept`) calculaban `execution.status` como binario
  (`'success' | 'failed'`), nunca `'partial'` — pese a que `SceneExecutionResult['status']` ya
  soporta `'partial'` y `HomeConversationMessageBubble.tsx` ya tiene una píldora de advertencia
  dedicada (`execution_partial`) que nunca se activaba. Un run de 21/29 mostraba la píldora roja de
  "No se pudo completar" en vez de la de advertencia, haciendo parecer un éxito parcial como un
  fallo total.

## Alcance

- Ítem A: `ScopeFilter.isDeviceAvailable` exige `device.status === 'ASSIGNED'` además de la
  comprobación existente de `lastKnownState.state !== 'unavailable'`. Efecto en cascada: todo lo que
  ya depende de `isDeviceAvailable` (`isControllableForBulk`, `isControllableDevice`, listados de
  luces de habitación) excluye automáticamente dispositivos del Inbox.
- Ítem B: `SonoffLanDiscoveryService` gana seguimiento de fallos consecutivos por conexión
  (`SonoffConnectionRegistry.recordPollFailure`/`resetPollFailures`). Tras 3 fallos consecutivos
  (~90s), el dispositivo se marca `lastKnownState.state = 'unavailable'` vía
  `syncDeviceStateUseCase` (mismo mecanismo ya usado por el resto de la sincronización de estado,
  ver [[device-command-execution]]). Un sondeo exitoso posterior limpia la marca y restaura el
  estado real reportado.
- Ítem C: `AssistantConversationService` calcula `execution.status` como `'partial'` cuando hay una
  mezcla de éxitos y fallos, reservando `'failed'` para cuando ninguna acción tuvo éxito. Sin cambios
  en frontend: la píldora de advertencia ya existía y solo estaba muerta por falta de esta señal.

## Fuera de alcance

- No se toca la lógica de descubrimiento/emparejamiento de Sonoff en sí
  ([[sonoff-local-integration-v1]]), solo el seguimiento de alcanzabilidad post-descubrimiento.
- No se introduce un mecanismo de reintento activo (ping/keepalive) para dispositivos ya marcados
  `unavailable`; se apoya en el polling periódico ya existente (cada 30s) para la recuperación.
- El caso "Test 1" reportado junto con los fallos de Sonoff se determinó como dato de producción
  obsoleto (un dispositivo nombrado manualmente y nunca retirado), no un defecto de código — no se
  aborda aquí; se recomienda limpieza manual de datos.
- No se extiende el seguimiento de alcanzabilidad a otras integraciones (Home Assistant, cámaras
  nativas) en esta iteración; queda como candidato si se reporta el mismo síntoma en otro driver.

## Requisitos funcionales

- **REQ-01**: Un dispositivo con `status !== 'ASSIGNED'` nunca aparece en el alcance de una acción
  masiva del asistente ("apaga todo", "todas las luces de la sala", exclusiones, categorías/zona),
  independientemente de su `lastKnownState`.
- **REQ-02**: Tres fallos consecutivos de sondeo LAN (`pollStates`) marcan el dispositivo Sonoff como
  `unavailable`; un fallo aislado o dos no lo hacen.
- **REQ-03**: Una vez marcado `unavailable`, el dispositivo no se vuelve a guardar en cada sondeo
  fallido subsiguiente (evita escritura y ruido de eventos redundante).
- **REQ-04**: Un sondeo exitoso posterior a fallos (marcado unavailable o no) resetea el contador de
  fallos y, si estaba marcado `unavailable`, restaura `lastKnownState` al valor real reportado.
- **REQ-05**: `execution.status` de una ejecución de comando múltiple o de ticket de bulk es
  `'partial'` cuando al menos una acción tuvo éxito y al menos una falló; `'failed'` solo cuando
  ninguna tuvo éxito; `'success'` solo cuando todas tuvieron éxito.

## Requisitos no funcionales

- **NFR-01**: Regresión cero sobre el comportamiento observable ya cubierto por
  `assistant_context_room_fast_path.test.ts`, `assistant_bulk_ux.test.ts` y
  `assistant_multi_command.test.ts` salvo el cambio de comportamiento intencional (dispositivos
  PENDING excluidos, status `partial` correcto).
- **NFR-02**: El registro de fallos de sondeo es en memoria (proceso único, ya es el modelo existente
  de `SonoffConnectionRegistry`); no requiere persistencia adicional.

## Criterios de aceptación

- [x] AC1: Un dispositivo `status: 'PENDING'` con `lastKnownState` aparentemente normal se excluye de
      `isDeviceAvailable`, `isControllableForBulk` e `isControllableDevice`.
- [x] AC2: Tras exactamente 3 fallos consecutivos de `pollStates`, el dispositivo se marca
      `unavailable`; tras 1 o 2 fallos no.
- [x] AC3: Tras marcarse `unavailable`, sondeos fallidos adicionales no producen escrituras
      redundantes (`saveDevice` se llama una sola vez).
- [x] AC4: Un sondeo exitoso resetea el contador de fallos y, si estaba marcado `unavailable`,
      restaura el estado real.
- [x] AC5: Un resultado de ejecución con éxitos y fallos mixtos reporta `execution.status: 'partial'`;
      un resultado con solo fallos reporta `'failed'`.
- [x] AC6: Regresión cero: suite completa sin fallos (145 suites, 1214 tests), typecheck y build
      limpios.

## Notas técnicas y arquitectura

`packages/assistant/application/ScopeFilter.ts:18-23` — `isDeviceAvailable` ahora es la única
verificación de "¿este dispositivo es real y funcional ahora mismo?", combinando asignación
(`status`) y alcanzabilidad reportada (`lastKnownState.state`).

`packages/integrations/sonoff/application/SonoffLanDiscoveryService.ts` — `SonoffConnectionRegistry`
gana `recordPollFailure`/`resetPollFailures` (contador en memoria por `externalIdMatch`,
`UNAVAILABLE_THRESHOLD = 3`). `pollStates()` resetea el contador tras cualquier `fetch()` que no
lance excepción (incluso si `res.ok` es falso: el dispositivo respondió, está vivo en la red); un
`fetch()` que lanza (`fetch failed`, timeout, `AbortError`) incrementa el contador y, al alcanzar el
umbral, invoca el nuevo método privado `markUnreachable()`, que reutiliza `syncDeviceStateUseCase`
igual que cualquier otra sincronización de estado del dominio.

`packages/assistant/application/AssistantConversationService.ts` — dos sitios de cálculo de
`execution.status` (resolución de `multi_command` y `handleBulkActionAccept`) pasan de un ternario
binario a una comparación de tres vías basada en el conteo de éxitos/fallos.

## Preguntas abiertas y TODOs

- TODO: Si el patrón "fetch failed silencioso" se repite en otra integración local (Home Assistant,
  cámaras nativas), extraer el seguimiento de fallos consecutivos (`recordPollFailure`/
  `resetPollFailures`/umbral) a una utilidad compartida en vez de duplicarlo por integración.
- TODO (fuera de código): limpieza de datos de producción — el dispositivo "Test 1" reportado por el
  usuario debería eliminarse o reasignarse manualmente; ningún cambio de código resuelve datos
  obsoletos.
