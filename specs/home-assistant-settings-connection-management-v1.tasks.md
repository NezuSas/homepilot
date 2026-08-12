# Tareas: Home Assistant Settings & Connection Management V1

## Implementado

- [x] Persistencia local: `SQLiteSettingsRepository`, migraciones y `buildRepositories` registran `SettingsRepository` dentro del contenedor.
- [x] Conexión dinámica: `HomeAssistantConnectionProvider` y `HomeAssistantSettingsService` reconfiguran el cliente y el sincronizador en memoria después de guardar.
- [x] Lógica de aplicación: normalización de URL, token opcional conservado al guardar, estado separado de configuración/conectividad y token enmascarado para lectura.
- [x] API: `SettingsRoutes` protege las rutas, expone lectura segura, guardado administrativo, prueba canónica `POST /api/v1/settings/home-assistant/test`, estado `GET /api/v1/settings/home-assistant/status` y conserva el endpoint heredado `POST /api/v1/settings/test-ha-connection`.
- [x] Consola: `HomeAssistantSettingsView` y onboarding usan la configuración persistida con acciones independientes de prueba y guardado.

## Evidencia automatizada

- [x] `packages/integrations/home-assistant/__tests__/HomeAssistantSettingsService.test.ts` verifica error de red no-Error como resultado controlado `unreachable`.
- [x] `apps/api/__tests__/SettingsRoutes.test.ts` verifica prueba sin persistencia, guardado con token opcional, respuesta enmascarada y endpoint de estado reducido.
- [x] `npm run verify:quality` ejecuta los gates SDD/TDD/BDD/SOLID, tests y builds.