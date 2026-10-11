import { EventEmitter } from 'events';
import { HomeAssistantWebSocketClient } from './HomeAssistantWebSocketClient';
import { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import { ActivityLogRepository } from '../../../devices/domain/repositories/ActivityLogRepository';
import { HomeAssistantSettingsService } from './HomeAssistantSettingsService';
import { HomeAssistantStateReader } from './ports/HomeAssistantStateReader';
import { ObservableRealtimeSyncStateProvider, RealtimeSyncObservableState } from '../../../system-observability/domain/ObservableStateProviders';
import { INBOX_OBSERVATION_INTERVAL_MS } from '../../../devices/application/deviceAvailability';
import type { ExpiredInboxDeviceRemover } from '../../../devices/application/ports/ExpiredInboxDeviceRemover';
import { logRuntimeDiagnostic } from '../../../shared/config/runtimeEnvironment';
import type {
  CloseReason,
  HomeAssistantRealtimeSocket,
  HomeAssistantRealtimeSocketFactory,
  ResilienceEventLogger,
  SystemStateChangeEvent,
} from './sync/syncTypes';
import { computeBackoffStep } from './sync/reconnectPolicy';
import { getErrorMessage } from './sync/stateChangeMapping';
import { HomeAssistantStateEventProcessor } from './sync/StateEventProcessor';
import { HomeAssistantStateReconciler } from './sync/StateReconciler';
import { createResilienceEventLogger } from './sync/resilienceLogger';

export type { SystemStateChangeEvent, HomeAssistantRealtimeSocket, HomeAssistantRealtimeSocketFactory };

export class HomeAssistantRealtimeSyncManager extends EventEmitter implements ObservableRealtimeSyncStateProvider {
  private client: HomeAssistantRealtimeSocket | null = null;
  private currentUrl: string | null = null;
  private currentToken: string | null = null;

  // ─── Observability State ─────────────────────────────────────────────────────
  private lastEventAt: string | null = null;
  private lastReconnectAt: string | null = null;
  private lastReconciliationAt: string | null = null;

  // ─── Resilience State ────────────────────────────────────────────────────────
  /** Timer único activo para el siguiente reintento. null = sin retry pendiente. */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Índice en BACKOFF_DELAYS_MS para el próximo reintento. */
  private retryIndex: number = 0;
  /** Motivo del último cierre; controla si se debe reconectar. */
  private lastCloseReason: CloseReason = 'stop_manual';
  /** Número de intento acumulado (para logs). */
  private retryAttempt: number = 0;

  // ─── Reconciliation Guard ────────────────────────────────────────────────────
  /** Garantiza que solo una reconciliación corra a la vez. */
  private isReconciling: boolean = false;
  private reconciliationTimer: ReturnType<typeof setInterval> | null = null;

  // ─── Collaborators ───────────────────────────────────────────────────────────
  private readonly eventProcessor: HomeAssistantStateEventProcessor;
  private readonly reconciler: HomeAssistantStateReconciler | null;
  private readonly logResilienceEvent: ResilienceEventLogger;

  constructor(
    private readonly settingsService: HomeAssistantSettingsService,
    deviceRepository: DeviceRepository,
    activityLogRepository: ActivityLogRepository,
    /** Opcional: inyectado para reconciliación. Si no se proporciona, se omite. */
    haStateReader: HomeAssistantStateReader | null = null,
    private readonly socketFactory: HomeAssistantRealtimeSocketFactory = (baseUrl, token) => (
      new HomeAssistantWebSocketClient(baseUrl, token)
    ),
    private readonly expiredInboxDeviceRemover: ExpiredInboxDeviceRemover | null = null,
  ) {
    super();
    this.eventProcessor = new HomeAssistantStateEventProcessor(
      deviceRepository,
      activityLogRepository,
      expiredInboxDeviceRemover,
      {
        onEventAccepted: () => { this.lastEventAt = new Date().toISOString(); },
        publish: (systemEvent) => {
          this.emit('device_state_updated', systemEvent);
          this.emit('system_event', systemEvent);
        },
      },
    );
    this.reconciler = haStateReader
      ? new HomeAssistantStateReconciler(haStateReader, deviceRepository, activityLogRepository, expiredInboxDeviceRemover)
      : null;
    this.logResilienceEvent = createResilienceEventLogger(activityLogRepository);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Arranca o reconfigura la conexión WebSocket.
   * Cancela cualquier retry previo y comienza desde cero con las nuevas credenciales.
   */
  public reconnect(baseUrl: string, token: string): void {
    this._cancelRetry();
    this._destroySocket('reconfigure');

    if (!baseUrl || !token) return;

    this.currentUrl = baseUrl;
    this.currentToken = token;
    this.retryIndex = 0;
    this.retryAttempt = 0;

    this._openSocket();
  }

  /**
   * Detiene completamente el manager. No habrá reconexión.
   */
  public stop(): void {
    this._cancelRetry();
    this._destroySocket('stop_manual');
    this.currentUrl = null;
    this.currentToken = null;
  }

  // ─── Socket Lifecycle ────────────────────────────────────────────────────────

  /**
   * Destruye el socket actual de forma controlada sin borrar listeners externos.
   */
  private _destroySocket(reason: CloseReason): void {
    this._cancelReconciliationTimer();
    this.lastCloseReason = reason;
    if (this.client) {
      this.client.forceClose();
      this.client = null;
    }
  }

  private _cancelReconciliationTimer(): void {
    if (this.reconciliationTimer !== null) clearInterval(this.reconciliationTimer);
    this.reconciliationTimer = null;
  }

  /**
   * Cancela el único timer de reconexión si está activo.
   */
  private _cancelRetry(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Abre un socket nuevo y enlaza sus handlers.
   * Toda la lógica de reconexión fluye a través de este único método.
   */
  private _openSocket(): void {
    if (!this.currentUrl || !this.currentToken) return;

    const client = this.socketFactory(this.currentUrl, this.currentToken);
    this.client = client;

    client.on('error', (type: 'auth_error' | 'unreachable', err: Error) => {
      logRuntimeDiagnostic('error', `[HA-Sync] WS Error (${type}):`, err.message);
      this.settingsService.updateStatusFromOperation(type);

      if (type === 'auth_error') {
        // Cancelar CUALQUIER retry pendiente antes de destruir el socket.
        // Esto cubre el orden raro donde close llega antes que auth_error
        // y ya habría programado un reconnectTimer.
        this._cancelRetry();
        this._destroySocket('auth_error');
        this.logResilienceEvent('auth_error', 0, 0, `Permanent authentication failure with Home Assistant.`);
      } else if (this.client === client) {
        this._cancelReconciliationTimer();
        // HomeAssistantWebSocketClient can tear down its underlying socket before
        // emitting an unreachable error, so a subsequent `close` event is not
        // guaranteed. Release this manager reference and schedule the retry here.
        this.client = null;
        this.lastCloseReason = 'network_drop';
        this._scheduleReconnect();
      }
    });

    client.on('close', () => {
      if (this.client !== client) return;
      this._cancelReconciliationTimer();

      // Solo reconectar si el cierre fue por caída de red, no voluntario.
      if (this.lastCloseReason !== 'stop_manual'
        && this.lastCloseReason !== 'reconfigure'
        && this.lastCloseReason !== 'auth_error') {
        logRuntimeDiagnostic('warn', '[HA-Sync] WS cerrado inesperadamente. Iniciando backoff...');
        this.settingsService.updateStatusFromOperation('unreachable');
        this._scheduleReconnect();
      }
    });

    client.on('ready', () => {
      if (this.client !== client) return;
      // WS listo y suscrito.
      this.settingsService.updateStatusFromOperation('reachable');
      this._cancelRetry();
      this.retryIndex = 0;
      this.retryAttempt = 0;
      this.lastCloseReason = 'network_drop'; // Habilitar retrofit
      this.lastReconnectAt = new Date().toISOString();

      this.logResilienceEvent('reconnect', this.retryAttempt, 0, 'WebSocket connection established successfully.');

      // Secuencia de bootstrap: Conectar → Suscribir → Reconciliar
      this._runReconciliation();
      this._cancelReconciliationTimer();
      if (this.expiredInboxDeviceRemover) {
        this.reconciliationTimer = setInterval(() => {
          void this._runReconciliation().catch((error: unknown) =>
            logRuntimeDiagnostic('warn', '[HA-Sync] Periodic reconciliation failed:', getErrorMessage(error)));
        }, INBOX_OBSERVATION_INTERVAL_MS);
        this.reconciliationTimer.unref();
      }
    });

    client.on('event', async (data: unknown) => {
      this.settingsService.updateStatusFromOperation('reachable');
      await this.eventProcessor.process(data);
    });

    // Marcar el socket como "caída de red" antes de conectar,
    // para que onclose sepa que fue inesperado si falla en el intento inicial.
    this.lastCloseReason = 'network_drop';

    client.connect().catch((err: unknown) => {
      // El error ya fue emitido y procesado por client.on('error').
      logRuntimeDiagnostic('warn', '[HA-Sync] Connect rechazado (manejado por error event):', getErrorMessage(err));
    });
  }

  /**
   * Programa el siguiente reintento con backoff. Solo 1 timer activo a la vez.
   */
  private _scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      // Ya hay un retry programado, no apilar.
      return;
    }

    if (!this.currentUrl || !this.currentToken) {
      logRuntimeDiagnostic('warn', '[HA-Sync] No hay credenciales para reconectar.');
      return;
    }

    const { delayMs, nextRetryIndex } = computeBackoffStep(this.retryIndex);
    this.retryAttempt++;
    this.retryIndex = nextRetryIndex;

    logRuntimeDiagnostic('log', `[HA-Sync] Reintento #${this.retryAttempt} en ${delayMs}ms...`);
    this.settingsService.updateStatusFromOperation('unreachable');

    this.logResilienceEvent('reconnect', this.retryAttempt, delayMs, `Scheduling reconnection attempt #${this.retryAttempt} in ${delayMs}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._destroySocket('network_drop');
      this._openSocket();
    }, delayMs);
  }

  // ─── Silent State Reconciliation ─────────────────────────────────────────────

  /**
   * Realiza un fetch masivo de /api/states y parchea el DeviceRepository
   * de forma silenciosa (sin emitir system_event para no activar automatizaciones).
   */
  private async _runReconciliation(): Promise<void> {
    if (!this.reconciler) return;

    // Guard: solo 1 reconciliación activa a la vez.
    if (this.isReconciling) {
      // Reconciliación ya en curso. Omitiendo solapamiento.
      return;
    }

    this.isReconciling = true;

    try {
      const result = await this.reconciler.reconcile(() => this.client);

      if (result.status === 'aborted') return;

      if (result.status === 'fetch_failed') {
        this.logResilienceEvent('reconciliation', this.retryAttempt, 0,
          `Failed to fetch /api/states: ${result.errorMessage}`, 0, 0);
        return;
      }

      const { reconciledCount, unavailableCount, skippedCount } = result;
      logRuntimeDiagnostic('log', `[HA-Sync] Reconciliación completada: ${reconciledCount} actualizados, ${unavailableCount} no disponibles, ${skippedCount} omitidos.`);
      this.lastReconciliationAt = new Date().toISOString();
      this.logResilienceEvent('reconciliation', this.retryAttempt, 0,
        `State reconciliation completed: ${reconciledCount} updated, ${unavailableCount} unavailable, ${skippedCount} skipped`, reconciledCount, skippedCount);

    } finally {
      this.isReconciling = false;
    }
  }

  // ─── Observable State Provider ───────────────────────────────────────────────

  public getObservableState(): RealtimeSyncObservableState {
    let websocketStatus: 'connected' | 'reconnecting' | 'stopped' = 'stopped';
    if (this.reconnectTimer !== null) {
      websocketStatus = 'reconnecting';
    } else if (this.client) {
      websocketStatus = 'connected';
    }

    let reconciliationStatus: 'idle' | 'running' | 'failed' = 'idle';
    if (this.isReconciling) {
      reconciliationStatus = 'running';
    }

    return {
      websocketStatus,
      reconciliationStatus,
      lastEventAt: this.lastEventAt,
      lastReconnectAt: this.lastReconnectAt,
      lastReconciliationAt: this.lastReconciliationAt
    };
  }
}
