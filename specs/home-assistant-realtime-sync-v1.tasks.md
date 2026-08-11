# Tasks: Home Assistant Real-Time Sync V1

- [x] Implementar `HomeAssistantWebSocketClient` con autenticación, validación de mensajes y timeout. Evidencia: `packages/integrations/home-assistant/__tests__/HomeAssistantWebSocketClient.test.ts`.
- [x] Conectar el manager a `DeviceRepository`, `ActivityLogRepository` y `HomeAssistantSettingsService`. Evidencia: `packages/integrations/home-assistant/__tests__/HomeAssistantRealtimeSyncManager.test.ts`.
- [x] Actualizar entidades vinculadas por `externalId: ha:<entity_id>` sin afectar eventos no vinculados. Evidencia: suite del manager.
- [x] Reiniciar explícitamente la conexión al guardar configuración. Evidencia: `packages/integrations/home-assistant/__tests__/HomeAssistantSettingsService.test.ts`.
- [x] Validar AC3, AC4 y AC5 de refresco manual y cierre durante `CONNECTING`. Evidencia: `apps/api/__tests__/DeviceRoutes.refresh.test.ts` y suite WebSocket.
- [x] Validar bridge autenticado en Docker Desktop. Evidencia runtime 2026-08-11: login real, setup y discovery resumen.

> La reconexión y reconciliación automáticas pertenecen exclusivamente a `home-assistant-sync-resilience-v2.md`.