# Tasks: Home Assistant Sync Resilience V2

- [x] Especificar la reconexión, reconciliación y reglas de conectividad V2.
- [x] Implementar `stop()`, `reconnect()`, cancelación del timer y corte por `auth_error`.
- [x] Implementar backoff único `1s → 2s → 5s → 10s` y recreación segura del socket sin `removeAllListeners()`.
- [x] Implementar la secuencia conectar → autenticar → suscribir → reconciliar.
- [x] Integrar `HomeAssistantClient.getAllStates()` para reconciliación silenciosa y marcar entidades ausentes como no disponibles.
- [x] Preservar el WebSocket ante fallos de `/api/states` y registrar eventos `HA_RESILIENCE` estructurados.
- [x] Actualizar la conectividad y `lastCheckedAt` mediante `HomeAssistantSettingsService`.
- [x] Cubrir con pruebas automatizadas el timer único, backoff, reconfiguración, autenticación fatal, reconciliación silenciosa y fallo recuperable.