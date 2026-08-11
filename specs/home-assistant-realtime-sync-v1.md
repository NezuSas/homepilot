# Specification: Home Assistant Real-Time Sync V1 (WebSocket)

**Estado:** Borrador

> **Nota de evolución:** la reconexión automática y la reconciliación se especifican y verifican exclusivamente en `home-assistant-sync-resilience-v2.md`. Este documento conserva el contrato fundacional de WebSocket y no debe introducir un comportamiento contradictorio.

## 1. Objetivo
Implementar una conexión en tiempo real con Home Assistant utilizando su API de WebSocket nativa. El sistema escuchará los eventos `state_changed` y actualizará el inventario local reactivamente de forma robusta e integrada con el actual Configuration Management.

## 2. Alcance
- **Sí**: cliente WebSocket basado en la librería `ws`, conforme al stack vigente.
- **Sí**: Autenticación y flujos oficiales (`auth_required`, `auth_ok`, `auth_invalid`).
- **Sí**: Timeouts básicos de conexión (marcar `unreachable` si falla en abrir o autenticar a tiempo).
- **Sí**: Diferenciación precisa de errores (`auth_error` vs `unreachable`).
- **Sí**: Extracción de `lastKnownState.state` como string (agnóstico) y `attributes` para soportar climas, sensores, etc.
- **Sí**: Búsqueda por `externalId: ha:<entity_id>`. Actualización controlada de DeviceRepository y ActivityLog.
- **Sí**: Hot-Reload de la conexión desde `saveSettings` o `bootstrap`.
- **No definido en V1**: la política de auto-reconexión y reconciliación; `home-assistant-sync-resilience-v2.md` es la única autoridad para ese comportamiento.
- **No**: Bufferización de eventos perdidos, ni resincronización masiva histórica.
- **No**: Lógica de dominio pesada dentro del Manager.

## 3. Arquitectura Técnica

### 3.1. HomeAssistantWebSocketClient (Capa de Red)
- Constructor que instaure la escucha y manejo estricto de JSON.
- Implementa un Timeout timer para la fase de inicio; si vence, tira `.close()` y llama a callbacks de error.
- El cierre forzado de un socket que todavía está en fase de conexión debe consumir su error nativo posterior. Una caída o timeout de Home Assistant degrada únicamente el bridge (`unreachable`) y nunca termina el proceso de HomePilot Edge.
- Valida que cada mensaje JSON tenga una estructura de objeto y un `type` de texto antes de procesarlo. Mensajes malformados se descartan sin derribar el cliente ni emitir cambios de estado.
- Callbacks inyectados:
  - `onReady()`: Invocado tras recibir `auth_ok`.
  - `onEvent(event)`: Invocado al decodificar suscripciones a `state_changed`.
  - `onError(type, error)`: Donde `type` puede derivar en `auth_error` (por Payload de HA) o `unreachable` (desconexión física/timeout).

### 3.2. HomeAssistantRealtimeSyncManager (Orquestador)
- Únicamente enlaza el tráfico entrante del WS Client hacia las interfaces lógicas. "Pegamento".
- En V1 enlaza el socket, actualiza `SettingsService` y no define política de reintentos; la resiliencia posterior pertenece a V2.
- Su reinicio es puramente reactivo y explícito (p.ej., invocado por `SettingsService` durante un `saveSettings` de usuario).

### 3.3. Sincronización Inyectada y Lógica de Eventos
Cuando se recibe `type: "event", event_type: "state_changed"`:
1. Extraer `entity_id` de la data de payload.
2. Identificador: `externalId = 'ha:' + entity_id`.
3. Búsqueda al `DeviceRepository`.
4. Si NO existe: Se ignora silenciosamente o con un mero trace log `"Unlinked device event: <id> ... ignorado"`.
5. Si SÍ existe, inyectar el payload:
   - Preservar compatibilidad: setear `lastKnownState.state = new_state.state` (Como String genérico, no parseamos boolean estricto) e incluir `new_state.attributes`.
   - Alterar `device.updatedAt`.
   - Propagar `ActivityLog`.

### 3.4. Rastreabilidad Exacta en SettingsService
Los indicadores vitales en el Configuration Manager se enriquecerán en exactitud, modificando flag y `lastCheckedAt` en cada latido:
- Fase de éxito `auth_ok` -> `reachable`.
- Almacenamiento válido de Evento -> `reachable` (Latido Confirmado).
- Evento de timeout nativo, close code o parse failure -> `unreachable`.
- Validación payload fallida "auth_invalid" devuelta por HA -> `auth_error`.
- Los fallos de transporte, repositorio o auditoría pueden llegar como valores no tipados; se normalizan para diagnóstico y no interrumpen el ciclo de reconciliación ni el WebSocket activo.

## Evidencia de aceptación

- AC3: `apps/api/__tests__/DeviceRoutes.refresh.test.ts` verifica estado, atributos y `current_position` de un `cover`.
- AC4: la misma suite verifica `404 HA_ENTITY_NOT_FOUND` sin degradar la conectividad global.
- AC5: `packages/integrations/home-assistant/__tests__/HomeAssistantWebSocketClient.test.ts` verifica el cierre forzado durante `CONNECTING` y que el error nativo queda manejado.
- El bridge autenticado se validó en Docker Desktop el 2026-08-11 mediante login real y discovery resumen.

## 4. Pruebas y Validación Específicas
Pese a no tener cobertura infinita, se implementarán los siguientes Unit/Integration tests:
1. **Test Procesamiento de Evento**: Probar invocación dummy del `state_changed` y validar el mapeo del objeto en `DeviceRepository`.
2. **Test Change Config Disconnects**: Probar que durante un Hot Swap se invoque efectivamente el teardown (`.close()`) explícito del WebSocket antiguo y reconecte o avise lo esperado sin causar solapamientos.

## 5. Sincronización Manual de una Entidad

El endpoint `POST /api/v1/devices/:id/refresh` debe aplicar el mismo contrato de estado agnóstico utilizado por la sincronización en tiempo real:

- Persistir `lastKnownState.state` y `lastKnownState.attributes` completos.
- Mantener los campos de compatibilidad `on` para estados `on/off/open/closed` y `current_position` cuando Home Assistant lo reporte.
- Si Home Assistant responde `404` para la entidad, devolver `404 HA_ENTITY_NOT_FOUND` sin marcar la conexión global como `unreachable`.
- Marcar `unreachable` únicamente cuando la consulta falle por comunicación, timeout o error HTTP distinto de entidad inexistente.

### Criterios de aceptación

- **AC3 — Covers:** al refrescar un `cover` abierto con posición reportada, el dispositivo local conserva `state: "open"`, sus atributos y `current_position`.
- **AC4 — Entidad eliminada:** una entidad ausente devuelve `404 HA_ENTITY_NOT_FOUND` y no degrada el estado global de conectividad de Home Assistant.
- **AC5 — Bridge no disponible:** si el timeout fuerza el cierre de un WebSocket aún en `CONNECTING`, el error nativo de `ws` queda manejado y la API continúa disponible para autenticación y operación local.

