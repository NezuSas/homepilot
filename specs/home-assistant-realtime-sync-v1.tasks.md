# Tasks: Home Assistant Real-Time Sync V1

- [ ] 1. Preparar Cliente WebSocket (`HomeAssistantWebSocketClient`)
  - [ ] Implementar cliente nativo sobre `globalThis.WebSocket`.
  - [ ] Añadir validación / timeout de conexión para notificar caídas proactivas.
  - [ ] Implementar decodificación diferencial (separar explícitamente el payload de `auth_invalid` de `socket_close` / error general).

- [ ] 2. Core Integration (`HomeAssistantRealtimeSyncManager`)
  - [ ] Implementar como orquestador "pegamento". Cero lógica de dominio adentro.
  - [ ] Garantizar reconexión estrictamente accionada. Dejar morir el socket sin retry-loops infinitos si ocurre falla de red/Auth repentino.
  - [ ] Intercepciones directas al `SettingsService` en suceso (`auth_ok` -> reachable, `auth_invalid` -> auth_error, evento_real -> reachable, cierre -> unreachable, todo con el TS exacto actualizando el CheckedAt).

- [ ] 3. Reglas de Topología y Mapeo Extensible
  - [ ] Recuperar genéricamente `new_state.state` (como String, sin asumir booleanos on/off ciegos) e inyectar `.attributes`.
  - [ ] Pre-buscar con restricción pasiva por `externalId: ha:<entity_id>`.
  - [ ] Si existe: Propagar Update Local a lastKnownState, createdAt y activityLogs.
  - [ ] Si no existe: Ignorar limpiamente bajo categoría formativa ("unlinked device").

- [ ] 4. Lifecycle Binding
  - [ ] Inicializar en `bootstrap.ts` únicamente bajo `if (configuration === 'configured')`.
  - [ ] Integrar el Hook en `HomeAssistantSettingsService.saveSettings()` para asegurar regeneración manual y el desguace (teardown) del proceso WS antiguo.

- [ ] 5. Validación Pragmática de Pruebas Reales
  - [ ] Configurar Test Automatizado A: Mutación de estado funcional (Transformaciones genéricas e isCorrectlyLogged).
  - [ ] Configurar Test Automatizado B: Caídas en Config Change (Comprobar que se desvincula el cliente sin fugas).

