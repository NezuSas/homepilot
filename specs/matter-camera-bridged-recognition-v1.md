# SPEC: Matter Camera Bridged Recognition V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-13

## Problema

El usuario pidió que la integración de cámaras esté "disponible para cámaras tipo Matter". Un
commissioning y streaming Matter genuinamente nativos (PASE/CASE, fabric, `Camera AV Stream
Management`, WebRTC) requerirían un SDK Matter propio en un ecosistema Node donde el soporte del
clúster de cámara Matter es reciente e inmaduro — una decisión de alto riesgo/esfuerzo,
explícitamente descartada por el usuario a favor de un enfoque más simple: reconocer y gestionar
cámaras Matter como dispositivos nativos de HomePilot en la UI, delegando el commissioning y
streaming de bajo nivel a Home Assistant (que ya sabe hacerlo) a través del puente genérico
`camera.*` ya funcional (`specs/home-assistant-camera-streaming-v1.md`).

## Alcance

- Ítem A: `HomeAssistantClient` (implementación concreta de `HomeAssistantClientPort`) gana
  `getEntityRegistryEntry(entityId): Promise<{platform: string} | null>` — una consulta WebSocket
  best-effort (`config/entity_registry/get`) que abre una conexión de un solo uso (mismo patrón ya
  existente en `getCameraHlsStreamPath`: conectar, autenticar, enviar comando con id, esperar
  respuesta correlacionada, cerrar), nunca lanza, siempre resuelve `null` ante cualquier fallo
  (timeout, error de socket, credenciales rechazadas, respuesta sin `platform`).
- Ítem B: `HomeAssistantClientPort.getEntityRegistryEntry` se agrega como método **opcional** (no
  todos los fakes/mocks existentes del puerto necesitan implementarlo).
- Ítem C: `HomeAssistantImportService.importDevice` consulta la plataforma antes de construir el
  dispositivo: `vendor = platform || 'Home Assistant'`, y espeja la plataforma en
  `lastKnownState.haPlatform` cuando se conoce. La consulta está envuelta en `try/catch` — un fallo
  del registro nunca bloquea el import, solo deja el vendor legado.
- Ítem D: UI — chip "Matter" (`StatusPill` variant `primary`) en `CameraDeviceTile.tsx` junto al
  nombre del dispositivo cuando `device.vendor === 'matter'`. Claves i18n `camera.matter_badge` en
  ambos locales.
- Ítem E: Cero cambios en `packages/integrations/native-camera`, cero migración de base de datos,
  cero `source_type` nuevo. Una cámara Matter importada por HA ya tiene `integrationSource: 'ha'` y
  fluye por el proxy HLS/snapshot/MJPEG existente sin ninguna rama nueva en `CameraRoutes.ts`.

## Fuera de alcance

- SDK Matter propio, descubrimiento mDNS `_matterc._udp`/`_matter._tcp`, PASE/CASE, gestión de
  fabric, streaming WebRTC — explícitamente rechazado por el usuario en la decisión de alcance.
- No se crea una fila `native_camera_sources` ni un `source_type: 'matter-bridged'`: cada columna de
  esa tabla (host, puertos, usuario, contraseña, ruta RTSP) sería irrelevante para un transporte que
  HomePilot nunca toca directamente — habría sido una tabla de unión sin contenido, arriesgando
  además la ruta HA que ya funciona.
- No se expone control PTZ para cámaras Matter en esta fase — si HA reporta soporte PTZ para un
  dispositivo Matter en el futuro, se evaluaría por separado; no hay ningún dispositivo confirmado
  para probar esto hoy.
- No se valida contra una instancia de Home Assistant con integración Matter real — ver
  Verificación manual pendiente.

## Requisitos funcionales

- **REQ-01**: `getEntityRegistryEntry` nunca lanza una excepción no capturada; toda condición de
  error (timeout, `auth_invalid`, error de socket, `success: false`, ausencia de `platform` en el
  resultado) resuelve `null`.
- **REQ-02**: `HomeAssistantImportService.importDevice` funciona idéntico a antes cuando el cliente
  HA no implementa `getEntityRegistryEntry` (compatibilidad con fakes/mocks existentes) o cuando la
  consulta falla — `vendor: 'Home Assistant'`, sin `lastKnownState.haPlatform`.
- **REQ-03**: Cuando el registro de entidades reporta `platform: 'matter'`, el dispositivo importado
  tiene `vendor: 'matter'` y `lastKnownState.haPlatform: 'matter'`.
- **REQ-04**: La UI muestra el chip "Matter" únicamente cuando `device.vendor === 'matter'` — ningún
  otro vendor dispara el badge.

## Requisitos no funcionales

- **NFR-01**: Regresión cero: los 6 tests preexistentes de `HomeAssistantImportService.test.ts`
  pasan sin modificación (el mock del cliente no implementa `getEntityRegistryEntry`, por lo que el
  optional chaining resuelve a `undefined` → `platform: null` → comportamiento idéntico al previo).
- **NFR-02**: `check:i18n`/`check:ui-primitives` en verde — el badge usa `StatusPill` existente y
  claves de traducción en ambos locales.

## Criterios de aceptación

- [x] AC1: `getEntityRegistryEntry` resuelve `{platform}` tras una autenticación y consulta exitosas.
- [x] AC2: Resuelve `null` ante `auth_invalid`, error de socket, `success: false`, o ausencia de
      `platform` en el resultado — nunca rechaza la promesa.
- [x] AC3: Un registro que reporta `platform: 'matter'` produce `vendor: 'matter'` +
      `lastKnownState.haPlatform: 'matter'` en el dispositivo importado.
- [x] AC4: Un fallo de la consulta del registro (excepción, o método ausente en el mock) no bloquea
      el import — el dispositivo se crea con el vendor legado `'Home Assistant'`.
- [x] AC5: El chip "Matter" aparece solo cuando `vendor === 'matter'`.
- [x] AC6: Suite completa sin regresiones (153 suites, 1283 tests), typecheck y build (backend +
      operator-console) limpios, `check:i18n`/`check:ui-primitives`/`check:spec-coverage` (conteo
      actualizado a 608) y el resto de quality gates en verde.
- [x] AC7: Contenedor Docker reconstruido arranca correctamente y `/health` en verde.

## Notas técnicas y arquitectura

`packages/devices/infrastructure/adapters/HomeAssistantClient.ts` — `getEntityRegistryEntry` sigue
exactamente el patrón ya establecido por `getCameraHlsStreamPath` (WebSocket de un solo uso,
auth → comando con `id` → respuesta correlacionada → cierre), difiriendo solo en que nunca rechaza:
toda condición de fallo resuelve `null` en vez de propagar un error, porque esta consulta es
puramente informativa y nunca debe convertirse en un motivo de fallo del import.
`packages/integrations/home-assistant/application/ports/HomeAssistantClientPort.ts` —
`getEntityRegistryEntry?` opcional. `packages/devices/application/HomeAssistantImportService.ts` —
un `try/catch` adicional antes de construir el objeto `device`.
`apps/operator-console/src/components/CameraDeviceTile.tsx` — chip condicionado a `vendor`.

## Preguntas abiertas y TODOs

- TODO: validar contra una instancia de Home Assistant real con la integración Matter activa y al
  menos una cámara Matter comisionada — ningún test automatizado sustituye esta verificación.
- TODO: si en el futuro se necesita reconocer otras plataformas HA relevantes para HomePilot (más
  allá de Matter) de la misma manera, este mecanismo ya generaliza sin cambios — `vendor` refleja
  cualquier `platform` que HA reporte.
