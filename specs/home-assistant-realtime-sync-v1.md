# Specification: Home Assistant Real-Time Sync V1 (WebSocket)

## 1. Objetivo
Implementar una conexión en tiempo real con Home Assistant utilizando su API de WebSocket nativa. El sistema escuchará los eventos `state_changed` y actualizará el inventario local reactivamente de forma robusta e integrada con el actual Configuration Management.

## 2. Alcance
- **Sí**: API `globalThis.WebSocket` nativa de Node.js v22 (Sin dependencias externas).
- **Sí**: Autenticación y flujos oficiales (`auth_required`, `auth_ok`, `auth_invalid`).
- **Sí**: Timeouts básicos de conexión (marcar `unreachable` si falla en abrir o autenticar a tiempo).
- **Sí**: Diferenciación precisa de errores (`auth_error` vs `unreachable`).
- **Sí**: Extracción de `lastKnownState.state` como string (agnóstico) y `attributes` para soportar climas, sensores, etc.
- **Sí**: Búsqueda por `externalId: ha:<entity_id>`. Actualización controlada de DeviceRepository y ActivityLog.
- **Sí**: Hot-Reload de la conexión desde `saveSettings` o `bootstrap`.
- **No**: Loops infinitos de auto-reconexión tras caídas esporádicas (Queda para V2).
- **No**: Bufferización de eventos perdidos, ni resincronización masiva histórica.
- **No**: Lógica de dominio pesada dentro del Manager.

## 3. Arquitectura Técnica

### 3.1. HomeAssistantWebSocketClient (Capa de Red)
- Constructor que instaure la escucha y manejo estricto de JSON.
- Implementa un Timeout timer para la fase de inicio; si vence, tira `.close()` y llama a callbacks de error.
- Callbacks inyectados:
  - `onReady()`: Invocado tras recibir `auth_ok`.
  - `onEvent(event)`: Invocado al decodificar suscripciones a `state_changed`.
  - `onError(type, error)`: Donde `type` puede derivar en `auth_error` (por Payload de HA) o `unreachable` (desconexión física/timeout).

### 3.2. HomeAssistantRealtimeSyncManager (Orquestador)
- Únicamente enlaza el tráfico entrante del WS Client hacia las interfaces lógicas. "Pegamento".
- Carece de while loops infinitos intentando reconectar si HA muere. Deja que el socket muera limpio y notifica a `SettingsService`.
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

## 4. Pruebas y Validación Específicas
Pese a no tener cobertura infinita, se implementarán los siguientes Unit/Integration tests:
1. **Test Procesamiento de Evento**: Probar invocación dummy del `state_changed` y validar el mapeo del objeto en `DeviceRepository`.
2. **Test Change Config Disconnects**: Probar que durante un Hot Swap se invoque efectivamente el teardown (`.close()`) explícito del WebSocket antiguo y reconecte o avise lo esperado sin causar solapamientos.

