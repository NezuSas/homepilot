# Tasks: Home Assistant Settings & Connection Management V1 (REVISADO)

## 1. Infraestructura y Persistencia
- [ ] Crear migración `002_add_ha_settings.sql` (tabla `ha_settings`).
- [ ] Crear nuevo paquete/módulo `packages/integrations/home-assistant`.
- [ ] Definir `SettingsRepository` en el nuevo paquete.
- [ ] Implementar `SQLiteSettingsRepository` en el nuevo paquete.
- [ ] Registrar `SettingsRepository` en `bootstrap.ts` y añadirlo al `BootstrapContainer`.

## 2. Gestión Dinámica de Conexión (Backend)
- [ ] Implementar `HomeAssistantConnectionProvider` (maneja ciclo de vida del cliente).
- [ ] Modificar `bootstrap.ts` para usar el `Provider` en lugar de instanciar el cliente directamente.
- [ ] Asegurar que el `Provider` soporte re-configuración en caliente (hot reload de settings).
- [ ] Actualizar `HomeAssistantCommandDispatcher` y otros consumidores para usar el cliente provisto por el `Provider`.

## 3. Lógica de Aplicación (Backend)
- [ ] Crear `HomeAssistantSettingsService` (extrae lógica de `OperatorConsoleServer`).
- [ ] Implementar validación de URL (esquema, parseability, normalización).
- [ ] Implementar lógica de enmascaramiento de token para respuestas GET.
- [ ] Implementar lógica de persistencia selectiva (no sobreescribir token si viene vacío en POST).

## 4. Endpoints API
- [ ] `GET /api/v1/settings/home-assistant` (masking y status extendido).
- [ ] `POST /api/v1/settings/home-assistant` (actualizar y notificar al Provider).
- [ ] `POST /api/v1/settings/home-assistant/test` (test manual sin persistir).
- [ ] `GET /api/v1/settings/home-assistant/status` (estado actual).

## 5. UI (Operator Console)
- [ ] Crear `HomeAssistantSettingsView.tsx` (integrado sin Router adicional).
- [ ] Implementar formulario con feedback visual de URL válida.
- [ ] Implementar botones independientes de `Test` y `Save`.
- [ ] Mostrar estados `configurationStatus`, `connectivityStatus` y `activeSource`.

## 6. Pruebas y Validación (Backend)
- [ ] Tests de `SQLiteSettingsRepository`.
- [ ] Tests de `HomeAssistantConnectionProvider` (verificar hot swap de cliente).
- [ ] Tests de API (verificar enmascaramiento y lógica de estados).
- [ ] Verificar que `Discovery` y `Command Dispatch` usan la nueva config inmediatamente.
