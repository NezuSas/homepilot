# HomePilot API — colección Bruno

Esta colección documenta las rutas HTTP implementadas por `apps/api/routes`. Ábrala en Bruno con
**Import collection** y seleccione `bruno/homepilot-api`. Duplica o crea un entorno local a partir
de `environments/Local.example.bru`; nunca complete ni suba secretos al archivo de ejemplo.

## Seguridad

- `sessionToken` y credenciales son variables locales y nunca se versionan.
- No guarde respuestas: pueden incluir sesiones, datos de usuarios, topología del hogar o medios.
- Los nombres `MUTANTE` identifican solicitudes que cambian estado. No las ejecute en lote ni CI.
- Las rutas de cámara, multimedia e integraciones pueden acceder a sistemas Edge: requieren una
  instalación de prueba autorizada.

## Catálogo de rutas verificado en código

| Grupo | Rutas |
| --- | --- |
| Sistema | `GET /health`; `GET /api/v1/system/setup-status`, `/diagnostics`, `/diagnostics/events`, `/timezone`, `/backups`; `POST /api/v1/system/bootstrap-admin`, `/setup-status/complete`, `/timezone`, `/backups` |
| Autenticación | `POST /api/v1/auth/login`, `/logout`, `/change-password`, `/sso/directory`, `/sso/directory/consume-browser`; `POST /api/v1/auth/sso/directory/browser`; `GET /api/v1/auth/me`, `/sso/links`; `PATCH /api/v1/auth/me`; `DELETE /api/v1/auth/sso/links/:directoryAccountId` |
| Topología | `GET /api/v1/homes`, `/rooms`, `/homes/:homeId/rooms`; `POST /api/v1/homes`, `/homes/:homeId/rooms`, `/rooms/:roomId/action`; `PATCH /api/v1/homes/:homeId`, `/rooms/:roomId`; `DELETE /api/v1/rooms/:roomId` |
| Dispositivos e integraciones | `GET /api/v1/devices`, `/devices/:deviceId`, `/devices/:deviceId/state`, `/history`, `/activity-logs`, `/activity-logs`, `/ha/entities`; `POST /api/v1/integrations/discovery`, `/integrations/state-sync`, `/ha/import`, `/devices/:deviceId/refresh`, `/assign`, `/command`; `PATCH /api/v1/devices/:deviceId`, `/semantic-type`; `DELETE /api/v1/devices/:deviceId` |
| Automatizaciones | `GET /api/v1/automations`; `POST /api/v1/automations`, `/automations/:automationId/run`; `PATCH /api/v1/automations/:automationId`, `/:automationId/enable`, `/:automationId/disable`; `DELETE /api/v1/automations/:automationId` |
| Escenas | `GET /api/v1/scenes`; `POST /api/v1/scenes`, `/scenes/:sceneId/execute`; `PATCH /api/v1/scenes/:sceneId`; `DELETE /api/v1/scenes/:sceneId` |
| Asistente | `GET /api/v1/assistant/shadow/status`, `/shadow/metrics`, `/findings`, `/summary`; `POST /api/v1/assistant/scan`, `/actions`, `/converse`, `/tts`, `/stt`, `/findings/:findingId/dismiss`, `/:findingId/resolve` |
| Cámaras y multimedia | `GET /api/v1/native-cameras/discover`, `/native-cameras`, `/devices/:deviceId/camera/session`, `/camera/snapshot`, `/camera/stream`, `/camera/hls/master.m3u8`, `/camera/hls/resource/:resource`, `/devices/:deviceId/media/session`, `/media/artwork`; `POST /api/v1/native-cameras`; `PUT` y `DELETE /api/v1/native-cameras/:cameraId`; `GET /media/:path` |
| Tableros | `GET /api/v1/dashboards`, `/:dashboardId/export`, `/:dashboardId/history`; `POST /api/v1/dashboards`, `/import`, `/:dashboardId/history/:revisionId/restore`; `PATCH` y `DELETE /api/v1/dashboards/:dashboardId` |
| Variables | `GET /api/v1/system-variables`, `/:variableKey`; `POST /api/v1/system-variables`; `DELETE /api/v1/system-variables/:variableKey` |
| Ejecuciones | `GET /api/v1/executions/recent`, `/:source/:sourceId`; `POST /api/v1/executions/:executionId/actions/:actionId/retry` |
| Configuración | `GET /api/v1/settings/home-assistant`, `/status`; `POST /api/v1/settings/home-assistant`, `/test-ha-connection`, `/home-assistant/test` |
| Administración | `GET /api/v1/admin/users`; `POST /api/v1/admin/users`, `/:userId/revoke-sessions`; `PATCH /api/v1/admin/users/:userId/role`, `/:userId/active`, `/:userId/password` |

El detalle de cuerpos y respuestas debe leerse desde el `RouteHandler` correspondiente antes de
ejecutar una solicitud mutante. Esta regla previene que la documentación se convierta en un
contrato inventado o que accione equipos físicos por accidente.
