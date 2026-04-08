# Observability & Diagnostics V1

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
**Excluidos de la vista:** entradas `STATE_CHANGED` crudas (demasiado volumen para diagnóstico).

## 8. Instrumentación Mínima Requerida

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
