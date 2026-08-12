# Observability & Diagnostics V1

**Estado:** Implementado

## 1. Contexto y Problema

El sistema HomePilot es funcional y resiliente, pero carece de una capa explícita de observabilidad operativa. Un instalador u operador no puede determinar rápidamente si el sistema está sano, por qué falló una automatización, o cuándo ocurrió el último reconnect. Los datos existen dispersos en repositorios de logs y en estado interno de cada módulo, pero no están consolidados ni son consultables.

## 2. Objetivo

Proveer una primera capa real de observabilidad y diagnóstico local mediante:
1. Un modelo de salud del sistema derivado de reglas explícitas.
2. Un snapshot de diagnóstico consolidado en un endpoint REST.
3. Una vista de eventos operativos recientes filtrada para diagnóstico.
4. Una UI mínima en el Operator Console.

## 3. Alcance V1

### 3.1. Cubierto
- Modelo `SystemHealth` con `overallStatus` derivado de reglas.
- `DiagnosticsService` como capa única de consolidación.
- `GET /api/v1/system/diagnostics` → snapshot completo.
- `GET /api/v1/system/diagnostics/events` → timeline de eventos relevantes.
- UI de diagnóstico en el Operator Console (panel de salud + timeline).
- Instrumentación mínima en `RealtimeSyncManager` y `AutomationEngine` para exponer estado observable.

### 3.2. Fuera de Alcance
- Métricas distribuidas (Prometheus / Grafana / OpenTelemetry)
- Alerting push/email
- Analytics avanzados
- Dashboards multi-tenant
- Buffering de eventos históricos

## 4. Modelo de Salud

### 4.1. SystemHealth

```typescript
interface SystemHealth {
  overallStatus: 'healthy' | 'degraded' | 'offline';
  haConnectionStatus: 'reachable' | 'unreachable' | 'auth_error' | 'not_configured';
  websocketStatus: 'connected' | 'reconnecting' | 'stopped';
  automationEngineStatus: 'active' | 'idle' | 'error';
  reconciliationStatus: 'idle' | 'running' | 'failed';
  lastEventAt: string | null;
  lastReconnectAt: string | null;
  lastReconciliationAt: string | null;
  lastSuccessfulCommandAt: string | null;
  lastAutomationExecutionAt: string | null;
  counters: {
    recentReconnects: number;
    recentAutomationSuccess: number;
    recentAutomationFailures: number;
    recentReconciliations: number;
  };
  issues: SystemIssue[];
}

interface SystemIssue {
  code: IssueCode;
  severity: 'warning' | 'critical';
  message: string;
}
```

### 4.2. Reglas explícitas de derivación de `overallStatus`

| overallStatus | Condición |
|---|---|
| `offline` | `haConnectionStatus === 'unreachable'` OR `haConnectionStatus === 'auth_error'` |
| `degraded` | `overallStatus !== 'offline'` AND (`websocketStatus === 'reconnecting'` OR `counters.recentReconnects >= 3` OR `reconciliationStatus === 'failed'` OR `counters.recentAutomationFailures >= 1`) |
| `healthy` | Ninguna condición degradada ni offline |

### 4.3. Issue Codes

| Code | Severity | Condición de disparo |
|---|---|---|
| `HA_NOT_CONFIGURED` | critical | `haConnectionStatus === 'not_configured'` |
| `HA_AUTH_ERROR` | critical | `haConnectionStatus === 'auth_error'` |
| `HA_UNREACHABLE` | critical | `haConnectionStatus === 'unreachable'` |
| `WS_RECONNECTING` | warning | `websocketStatus === 'reconnecting'` |
| `RECENT_RECONNECTS` | warning | `counters.recentReconnects >= 3` |
| `RECONCILIATION_FAILED` | warning | `reconciliationStatus === 'failed'` |
| `AUTOMATION_FAILURES_PRESENT` | warning | `counters.recentAutomationFailures >= 1` |

## 5. DiagnosticsService

Responsabilidad única: consolidar estado desde múltiples fuentes y derivar el snapshot.

**Fuentes de datos:**
- `HomeAssistantSettingsService.getStatus()` → `haConnectionStatus`, `lastCheckedAt`
- `HomeAssistantRealtimeSyncManager.getObservableState()` → `websocketStatus`, `reconciliationStatus`, `lastEventAt`, `lastReconnectAt`, `lastReconciliationAt`
- `AutomationEngine.getObservableState()` → `automationEngineStatus`, `lastAutomationExecutionAt`
- `ActivityLogRepository.findAllRecent(100)` → contadores y timeline filtrada

**No depende de:** `DeviceRepository`, `OperatorConsoleServer`, SQL directo.

## 6. DiagnosticsSnapshot (shape del endpoint)

```json
{
  "overallStatus": "degraded",
  "haConnectionStatus": "reachable",
  "websocketStatus": "reconnecting",
  "automationEngineStatus": "active",
  "reconciliationStatus": "idle",
  "lastEventAt": "2026-04-07T22:00:00.000Z",
  "lastReconnectAt": "2026-04-07T21:58:00.000Z",
  "lastReconciliationAt": "2026-04-07T21:58:05.000Z",
  "lastSuccessfulCommandAt": null,
  "lastAutomationExecutionAt": "2026-04-07T22:01:00.000Z",
  "counters": {
    "recentReconnects": 2,
    "recentAutomationSuccess": 8,
    "recentAutomationFailures": 1,
    "recentReconciliations": 1
  },
  "issues": [
    { "code": "WS_RECONNECTING", "severity": "warning", "message": "WebSocket is currently reconnecting" },
    { "code": "AUTOMATION_FAILURES_PRESENT", "severity": "warning", "message": "Automation failures detected in recent history" }
  ]
}
```

## 7. DiagnosticEvents (shape del endpoint)

```json
[
  {
    "occurredAt": "2026-04-07T22:01:00.000Z",
    "category": "automation",
    "eventType": "automation_success",
    "description": "Automation executed successfully",
    "data": { "ruleId": "...", "command": "turn_on" }
  },
  {
    "occurredAt": "2026-04-07T21:58:05.000Z",
    "category": "resilience",
    "eventType": "reconciliation_completed",
    "description": "State reconciliation completed: 12 updated, 2 skipped",
    "data": { "reconciledDevices": 12, "skippedDevices": 2 }
  }
]
```

**Categorías filtradas:** `resilience`, `automation`, `auth`, `command`.
**Reducción de ruido en la vista:** las entradas consecutivas `STATE_CHANGED` y `DEVICE_SYNC` del mismo dispositivo se agrupan dentro de una ventana de diez minutos. El resumen muestra el total y la última hora; fallos, comandos, automatizaciones y acciones de usuario se muestran de forma individual.

## 8. Instrumentación Mínima Requerida

### 8.1. Política de registros de diagnóstico

Las métricas de depuración de rutas de ejecución deben estar disponibles en desarrollo local, pero no deben emitir ruido durante pruebas automatizadas. La detección del entorno de pruebas debe reconocer tanto `NODE_ENV=test` como los workers de Jest. Los errores y alertas operativos reales en runtime no se eliminan ni se degradan por esta política. `logRuntimeDiagnostic` centraliza esta política; `ApiGateway`, `ApiRoutes`, `DatabaseBackupService`, `getDatabasePath`, `SqliteDatabaseManager`, `HomeAssistantRealtimeSyncManager`, `HomeAssistantWebSocketClient`, `InMemoryEventBus` y `LocalDeviceDriver` la aplican a sus diagnósticos operativos y no añaden ruido a Jest.

### `HomeAssistantRealtimeSyncManager`
Añadir método público: `getObservableState()` retornando `{ websocketStatus, reconciliationStatus, lastEventAt, lastReconnectAt, lastReconciliationAt }`.

### `AutomationEngine`
Añadir método público: `getObservableState()` retornando `{ lastExecutionAt, totalSuccesses, totalFailures }`.

Estos datos se mantienen en variables privadas actualizadas en cada operación relevante. No se expone lógica interna.

## 9. UI del Operator Console

Añadir vista "Sistema" o tab "Diagnóstico" en el Operator Console con:
- Tarjeta de estado general (HealthBadge: healthy/degraded/offline)
- Estado de HA Connection y WebSocket
- Estado del motor de automatización
- Última reconciliación
- Lista de issues activos
- Timeline de eventos recientes (últimos 20)

## 10. Estado del sistema para clientes

La ruta existente de estado del sistema presenta información comprensible para clientes finales. No sustituye el diagnóstico técnico, que permanece dentro de **Sistema > Diagnóstico** para administradores.

### 10.1 Datos visibles

- Estado de conexión de los servicios de HomePilot.
- Total de dispositivos disponibles.
- Total de espacios organizados en los hogares registrados.
- Total de rutinas, expresado como escenas y automatizaciones disponibles.
- Hora de la última comprobación satisfactoria.
- Mensaje de privacidad y operación local.

### 10.2 Reglas de experiencia

- No se debe mostrar un porcentaje de autonomía ni terminología interna como *Edge*, *malla*, *bridge* o nombres de infraestructura.
- Una comprobación fallida muestra una indicación breve para revisar, sin ocultar el último inventario disponible.
- Durante una actualización, la vista conserva los datos ya mostrados y evita skeletons o reinicios visuales.
- La vista debe funcionar en móvil, tableta y escritorio con tarjetas en una, dos o cuatro columnas según el ancho disponible.
- Todos los textos se publican mediante i18n en español e inglés.

### 10.3 Criterios de aceptación

1. Un sistema funcional nunca se presenta como `0%` ni como una falla por métricas internas no disponibles.
2. La vista distingue entre conexión disponible y comprobación pendiente mediante texto, icono y color accesibles.
3. Si la carga de escenas, automatizaciones o snapshot falla, la interfaz conserva los conteos previos y muestra el estado de revisión.
4. Los detalles de eventos, sincronización y conectores continúan disponibles exclusivamente en Diagnóstico.
- [x] AC16: Estados de sondas y categorías de línea de tiempo usan la misma escala técnica explícita de 9px; el payload de Resilience conserva contraste legible con superficie sólida en modo claro y oscuro, sin sangría excesiva en móvil.
