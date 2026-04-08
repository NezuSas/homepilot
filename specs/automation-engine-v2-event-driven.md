# Specification: Automation Engine V2 (Sistema Event-Driven)

## 1. Objetivo
Convertir a HomePilot en un sistema verdaderamente reactivo. Desarrollar el **Automation Engine V2** como el cerebro de automatización del sistema global. Éste consumirá eventos de estado general (normalizados) provenientes de cualquier origen (actualmente V1 provenientes de Home Assistant), evaluará las reglas activas de automatización (`AutomationRule`), y despachará mecánicas sin bloquear el EventLoop.

## 2. Forma del Evento Normalizado del Sistema
El AutomationEngine consume componentes nativos, exigiendo a sus llamadores enviar eventos agnósticos. No recibe objetos de HA. Recibe explícitamente:
```typescript
interface SystemStateChangeEvent {
  eventId: string; // Ej: crypto.randomUUID()
  occurredAt: string; // ISO 8601
  source: "home_assistant" | "local_sensor" | "other";
  deviceId: string; // UUID local del motor de dispositivos
  externalId: string; // Ej: ha:light.living_room
  previousState?: {
    state?: string;
    attributes?: Record<string, unknown>;
  };
  newState: {
    state?: string;
    attributes?: Record<string, unknown>;
  };
}
```

## 3. Arquitectura del Motor (AutomationEngine.ts)

### 3.1. Ubicación y API Primaria
- Ubicación: `packages/automation/application/AutomationEngine.ts`
- Método base único: `public async handleSystemEvent(event: SystemStateChangeEvent): Promise<void>`

### 3.2. Selección Limpia de Reglas
1. Evitar lectura en bruto excesiva. Idealmente (si el Repositorio lo soporta u obliga extenderse): `findEnabledRulesByTriggerDevice(deviceId)`.
2. Si el Repositorio actual carece del contrato filtrado en base de datos, cargar todas vía `findAll()` pero ejecutar filtro explicito In-Memory: `rules.filter(r => r.enabled && r.trigger.deviceId === event.deviceId)`. Esta deuda técnica queda documentada para V3.

### 3.3. Contrato Exacto de Dispatch y Acción
Al cruzar reglas, la validación se hace dinámicamente frente al root del state o en atributos: `newState[rule.trigger.stateKey] == expectedValue`. Las acciones soportadas (`action.command`) en esta fase son rigurosas:
- `turn_on`
- `turn_off`
- `toggle`
El target a operar se extrae de `rule.action.targetDeviceId`. La firma abstracta de disparo asume: `dispatcher.dispatch(homeId, targetDeviceId, action.command)`.

### 3.4. Prevención Robusta de Loops (Rebotes)
No basta con asomarnos al DB local porque existen rebotes de milisegundos en peticiones de domótica asíncrona. 
1. **Deduplicación Temporal (In-Memory)**: Mantener un Set o Map primitivo rastreando firmas únicas: `[ruleId]-[targetDeviceId]-[command]-[expectedValue]`. Si la firma ocurrió hace menos de *N* segundos (Ej. 2 segundos window cache), se bloquea con Status oficial `skipped_loop_prevention`. Se limpia la caché periódicamente o con timer.
2. **Revisión Terminal por Target**: Validar pasivamente (luego de brincar la ventana de tiempo corta) mediante `DeviceRepository` si el target ya luce el estado final derivado de la orden. Se bloquea con Status oficial `skipped_target_state_match`.

### 3.5. Logging Estructurado Obligatorio
El `ActivityLogRepository` documenta obligatoriamente el formato serializado. Dado que el Schema depende de Readonly Arrays, metemos el estructurado real en un objeto bajo `.data`:
```typescript
{
  deviceId: event.deviceId, // Trigger del suceso
  type: "AUTOMATION_EVALUATED", // O Action dispatched/failed
  timestamp: Date.now(),
  description: "Automation Engine execution",
  data: {
    ruleId: string,
    targetDeviceId: string,
    command: string,
    status: "success" | "error" | "skipped_loop_prevention" | "skipped_target_state_match" | "skipped_no_match",
    executedAt: string,
    eventId: string // Traza cruzada con el evento padre
  }
}
```

### 3.6. Seguridad Anti-Crashes (Error Handling Explícito)
Si fallan pasos intermedios, Node.js atrapará el error individual del batch y el resto progresará.
1. Target Device Inexistente: Retorna `status: error`, hace log. Salta a la próxima regla.
2. Atributos Inexistentes en Payload: No detiene la red, saluda como `skipped_no_match`.
3. Dispatcher Caído/Errores de red LAN: `catch` que inserta en Log `error: "Network/Dispatcher failed"` impidiendo que el motor se congele.

## 4. Bootstrapping Impecable
Al regenerarse (`bootstrap.ts` o reconfiguraciones):
- `syncManager.removeAllListeners('system_event')` asegurará eliminar binds previos para matar duplicidades de escucha concurrentes.
- `syncManager.on('system_event', event => engine.handleSystemEvent(event))` forjará el puente.

## 5. Pruebas Funcionales Requeridas (V2)
1. Match Exitoso (Ejecución real atada).
2. Negative Match (Condiciones erradas que resultan en skip).
3. Deduplicación Corta (Prueba de estrés lanzando 3 eventos simultáneos: 1 pasa, 2 caen en `loop_prevention`).
4. Prevención Lógica Base (Saltar porque el target ya estaba prendido).
5. Error Handling Continuo (Prueba que si `dispatch()` escupe una falla masiva temporal, se atrape silenciosamente y la Regla N° 2 siga su curso).
6. StateKey Anidado (Busca un key en payload `.attributes.brightness == 255`).
