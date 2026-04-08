# Home Assistant Sync Resilience V2 (Reconnect + State Reconciliation)

## 1. Contexto y Problema

El sistema integra Real-Time Sync V1 y Automation Engine V2. Sin embargo, no existe recuperación automática tras una caída de red o de Home Assistant, ni compensación de cambios físicos ocurridos durante la desconexión (State Drift), lo que desalinea la topología local con la realidad y rompe las subsecuentes lógicas de automatización.

## 2. Objetivo

Hacer el sistema completamente resiliente mediante:
1. Reconexión autómata estructurada sin intervención manual.
2. Reconciliación robusta (State Patching) silenciosa para emparejar la topología inmediatamente después de reconectar, previendo edge cases y evadiendo colapsar el AutomationEngine.

## 3. Comportamiento Exacto de Reconexión

No todo cierre amerita reconexión. El gestor evaluará el motivo del desconecte:
- **Cierre esperado por `stop()` manual**: NO hay reconexión. Se vacían timers.
- **Cierre por `reconfigure()`**: NO hay reconexión del remanente. Se cancela cualquier retry/delay en curso y se lanza instanciación 100% limpia bajo nuevas credenciales.
- **Cierre por `auth_error`**: NO hay backoff. Se rompee la rutina de retries, se alerta `auth_error` a Settings y el socket queda muerto a la espera de intervención humana.
- **Caída real de red o HA indisponible (`network/unreachable`)**: SÍ aplica reconnect con Backoff.

### 3.1. Backoff Controlado (Escalón Incremental)
El delay crece estáticamente para evitar DDOS local: `1s → 2s → 5s → 10s → 10s (fijo hasta éxito)`.
- Existirá solo **UN (1) timer activo** por instancia manager (`this.reconnectTimer`).
- Cualquier llamada asíncrona a `reconfigure()`, `stop()`, o un éxito repentino deberá forzar `clearTimeout(this.reconnectTimer)`.

## 4. Re-suscripción Automática

Al arrancar un retry:
1. Se abre socket de zero.
2. Identificación formal `auth`.
3. Re-suscripción obligatoria al tópico `state_changed` utilizando el ID secuencial correcto del protocolo interno de HA.
4. **Solo después de suscribirse exitosamente**, arranca la Reconciliación. (Justificación: al suscribirnos primero garantizamos no perder eventos concurrentes que caigan simultáneamente mientras ejecutamos el fetch costoso de la reconciliación).

## 5. Reconciliación de Estado (State Drift Patch)

**Fuente y Contrato:** 
Se reciclará obligatoriamente el cliente nativo existente `HomeAssistantClient` a través del puerto exportador `haClient.getStates()`. (Se expondrá o usará si no está, un método que ejecute `GET /api/states` consumiendo la URL base y token activos).

El pipeline demandará mapear el Payload HA a:
- `entity_id`
- `state`
- `attributes`

### 5.1. Comportamiento Silencioso (Silent Apply)
Durante la sincronización de las entidades driftadas extraídas vía HTTP:
- **SÍ**: Se actualiza `device.lastKnownState.state` y `device.lastKnownState.attributes`.
- **SÍ**: Se actualiza el `device.updatedAt` en el Repositorio.
- **SÍ**: Se registra Log en la base `ActivityLogRepository`.
- **NO**: Emite `system_event`.
- **NO**: Dispara reactividad en el AutomationEngine.

**Mecanismo Concreto de Supresión:**
El `RealtimeSyncManager` poseerá un método estricto particular privado `silentApplyState(device, state)` o ignorará intencionalmente llamar a `this.emit('system_event')` al iterar el array recolectado de la API REST, guardando en BD a pura directiva de repositorio. Un event-driven update regular pasa por el parser WebSocket que LLAMA invariablemente al emit. La vía de reconciliación nunca rozará ese emisor.

## 6. Estado de Conectividad (`SettingsService`)

- Al entrar en retries (Backoff loop): `connectivityStatus = 'unreachable'`. Se actualiza `lastCheckedAt` en CADA tic del reintento de conexión.
- Al chocar con permisos denegados post-conexión: `connectivityStatus = 'auth_error'`. Se frena todo pipeline.
- Tras reconciliar exitosamente: `connectivityStatus = 'reachable'`.

## 7. Prevención de Riesgos y Edge Cases

- **Manejo de Listeners**: NO se usará globalmente `removeAllListeners()`. El socket viejo será destruido de raíz con `.close()` re-instanciando la variable de WebSocket limpia sin barrer dependencias colaterales ajenas al websocket node subyacente.
- **/api/states Falla Post-WS Ready**: Se omite la reconciliación en dicho ciclo atrapando el error silenciosamente sin romper el WebSocket ni cerrar el canal stream, registrando un log de warning.
- **Entidades Raras o Null**: Si el fetch trae entidades sin estado, se descartan silenciosamente por entidad.
- **Desincronización de BD Local**: Si la entidad HA capturada *"ha:sensor.old"* NO existe en el `DeviceRepository` local, se omite limpiamente no haciendo updates.
- **Caída de WS durante Reconciliación**: El fetch y DB update progresivo sigue su curso pero el error de WebSocket disparado en background reactivará el flag de reconexión tras finalizar. No habiendo colisión o degradando estrepitosamente.

## 8. Logging Estructurado

El shape exacto en `ActivityLogRepository` exige contratos uniformados:

```typescript
{
  type: "HA_RESILIENCE",
  timestamp: string,
  deviceId: null, // Sistema en lugar de dispositivo aislado
  description: string,
  data: {
    source: "reconnect" | "reconciliation" | "auth",
    attempt?: number,           // Nivel del ping (1, 2, 3...)
    delayMs?: number,           // Cuanto tiempo esperó el step
    reconciledDevices?: number, // Cantidad arreglada
    skippedDevices?: number,    // Fallos o no locales encontrados
    reason?: string             // Errores JSON parse, red perdida, etc.
  }
}
```

## 9. Criterios de Aceptación y Tests Demandados

No bastan scripts visuales. El código exigirá test unitarios automatizados formales cubriendo:
- **Backoff & Scheduling**: Testeando si el Timer incrementa propiamente, y más importante, si llamar a reconfigure() tumba el timer anterior.
- **Reconciliation Applier**: Test mockeando `/api/states` donde la data falsa llega y las llamadas a BD se verifican que ocurren sin lanzar el Node Event Emitter internamente.
- **Auth Fatal Drop**: Test para certificar que retornar un HTTP 401 Unauthorized paraliza netamente el Retry.
- **Recovering Gracefully**: Test garantizando que si `/api/states` explota a Exception, el Event Listener sigue atado al WebSocket intacto.
