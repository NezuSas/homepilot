import { EventEmitter } from 'events';
import { HomeAssistantWebSocketClient } from './HomeAssistantWebSocketClient';
import { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import { ActivityLogRepository } from '../../../devices/domain/repositories/ActivityLogRepository';
import { HomeAssistantSettingsService } from './HomeAssistantSettingsService';
import { HomeAssistantClient } from '../../../devices/infrastructure/adapters/HomeAssistantClient';

export interface SystemStateChangeEvent {
  eventId: string;
  occurredAt: string;
  source: 'home_assistant' | 'local_sensor' | 'other';
  deviceId: string;
  externalId: string;
  previousState?: {
    state?: string;
    attributes?: Record<string, unknown>;
  };
  newState: {
    state?: string;
    attributes?: Record<string, unknown>;
  };
}

/**
 * Motivo de cierre del WebSocket.
 * Determina si la estrategia de reconexión actúa.
 */
type CloseReason = 'stop_manual' | 'reconfigure' | 'auth_error' | 'network_drop';

/** Secuencia de backoff en milisegundos: 1s → 2s → 5s → 10s (fijo) */
const BACKOFF_DELAYS_MS = [1000, 2000, 5000, 10000];

export class HomeAssistantRealtimeSyncManager extends EventEmitter {
  private client: HomeAssistantWebSocketClient | null = null;
  private currentUrl: string | null = null;
  private currentToken: string | null = null;

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

  constructor(
    private readonly settingsService: HomeAssistantSettingsService,
    private readonly deviceRepository: DeviceRepository,
    private readonly activityLogRepository: ActivityLogRepository,
    /** Opcional: inyectado para reconciliación. Si no se proporciona, se omite. */
    private readonly haClient: HomeAssistantClient | null = null
  ) {
    super();
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
    this.lastCloseReason = reason;
    if (this.client) {
      this.client.forceClose();
      this.client = null;
    }
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

    const client = new HomeAssistantWebSocketClient(this.currentUrl, this.currentToken);
    this.client = client;

    client.on('error', (type: 'auth_error' | 'unreachable', err: Error) => {
      console.error(`[HA-Sync] WS Error (${type}):`, err.message);
      this.settingsService.updateStatusFromOperation(type);

      if (type === 'auth_error') {
        // Cancelar CUALQUIER retry pendiente antes de destruir el socket.
        // Esto cubre el orden raro donde close llega antes que auth_error
        // y ya habría programado un reconnectTimer.
        this._cancelRetry();
        this._destroySocket('auth_error');
        this._logResilienceEvent('auth_error', 0, 0, `Auth failed permanently: ${err.message}`);
      }
      // 'unreachable' es manejado por onclose que se disparará también.
    });

    client.on('close', () => {
      // Solo reconectar si el cierre fue por caída de red, no voluntario.
      if (this.lastCloseReason !== 'stop_manual'
        && this.lastCloseReason !== 'reconfigure'
        && this.lastCloseReason !== 'auth_error') {
        console.warn('[HA-Sync] WS cerrado inesperadamente. Iniciando backoff...');
        this.settingsService.updateStatusFromOperation('unreachable');
        this._scheduleReconnect();
      }
    });

    client.on('ready', () => {
      console.log('[HA-Sync] WS listo y suscrito.');
      this.settingsService.updateStatusFromOperation('reachable');
      this._cancelRetry();
      this.retryIndex = 0;
      this.retryAttempt = 0;
      this.lastCloseReason = 'network_drop'; // Habilitar retrofit

      this._logResilienceEvent('reconnect', this.retryAttempt, 0, 'WebSocket connection established.');

      // Secuencia de bootstrap: Conectar → Suscribir → Reconciliar
      this._runReconciliation();
    });

    client.on('event', async (data: any) => {
      this.settingsService.updateStatusFromOperation('reachable');
      await this.processEvent(data);
    });

    // Marcar el socket como "caída de red" antes de conectar,
    // para que onclose sepa que fue inesperado si falla en el intento inicial.
    this.lastCloseReason = 'network_drop';

    client.connect().catch((err: Error) => {
      // El error ya fue emitido y procesado por client.on('error').
      console.warn('[HA-Sync] Connect rechazado (manejado por error event):', err.message);
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
      console.warn('[HA-Sync] No hay credenciales para reconectar.');
      return;
    }

    const delayMs = BACKOFF_DELAYS_MS[Math.min(this.retryIndex, BACKOFF_DELAYS_MS.length - 1)];
    this.retryAttempt++;
    this.retryIndex = Math.min(this.retryIndex + 1, BACKOFF_DELAYS_MS.length - 1);

    console.log(`[HA-Sync] Reintento #${this.retryAttempt} en ${delayMs}ms...`);
    this.settingsService.updateStatusFromOperation('unreachable');

    this._logResilienceEvent('reconnect', this.retryAttempt, delayMs, `Scheduling reconnect attempt #${this.retryAttempt}.`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._destroySocket('network_drop');
      this._openSocket();
    }, delayMs);
  }

  // ─── Event Processing ────────────────────────────────────────────────────────

  private async processEvent(data: any): Promise<void> {
    if (!data || !data.entity_id || !data.new_state) return;

    try {
      const entityId = data.entity_id as string;
      const externalId = `ha:${entityId}`;
      const newState = data.new_state.state;
      const attributes = data.new_state.attributes || {};

      const device = await this.deviceRepository.findByExternalId(externalId);
      if (!device) return;

      const previousState = device.lastKnownState
        ? { state: device.lastKnownState.state as string, attributes: device.lastKnownState.attributes as Record<string, unknown> }
        : undefined;

      const updatedDevice = {
        ...device,
        lastKnownState: {
          state: String(newState),
          attributes: attributes
        },
        updatedAt: new Date().toISOString()
      };

      await this.deviceRepository.saveDevice(updatedDevice);

      try {
        const cryptoRandom = typeof crypto !== 'undefined' ? crypto : (await import('crypto')).webcrypto;
        const systemEvent: SystemStateChangeEvent = {
          eventId: cryptoRandom.randomUUID(),
          occurredAt: new Date().toISOString(),
          source: 'home_assistant',
          deviceId: device.id,
          externalId: externalId,
          previousState,
          newState: {
            state: String(newState),
            attributes: attributes
          }
        };

        this.emit('system_event', systemEvent);

        await this.activityLogRepository.saveActivity({
          timestamp: new Date().toISOString(),
          deviceId: device.id,
          type: 'STATE_CHANGED',
          description: `Device sync from HA WebSocket`,
          data: { new_state: String(newState), attributes }
        });
      } catch (logErr: any) {
        console.error(`[HA-Sync] No se pudo guardar el activity log:`, logErr.message);
      }

    } catch (e: any) {
      console.error(`[HA-Sync] Exception procesando el evento WS:`, e.message);
    }
  }

  // ─── Silent State Reconciliation ─────────────────────────────────────────────

  /**
   * Realiza un fetch masivo de /api/states y parchea el DeviceRepository
   * de forma silenciosa (sin emitir system_event para no activar automatizaciones).
   */
  private async _runReconciliation(): Promise<void> {
    if (!this.haClient) return;

    // Guard: solo 1 reconciliación activa a la vez.
    if (this.isReconciling) {
      console.log('[HA-Sync] Reconciliación ya en curso. Omitiendo solapamiento.');
      return;
    }

    this.isReconciling = true;

    try {
      console.log('[HA-Sync] Iniciando reconciliación de estado...');

      let allStates;
      try {
        allStates = await this.haClient.getAllStates();
      } catch (fetchErr: any) {
        // /api/states falló: log de warning pero NO cerrar el WS.
        console.warn('[HA-Sync] Reconciliation: fallo al obtener /api/states. WS sigue activo.', fetchErr.message);
        this._logResilienceEvent('reconciliation', this.retryAttempt, 0,
          `Failed to fetch /api/states: ${fetchErr.message}`, 0, 0);
        return;
      }

      let reconciledCount = 0;
      let skippedCount = 0;

      for (const haState of allStates) {
        try {
          // Ignorar entidades con state nulo o raro
          if (!haState.entity_id || haState.state === null || haState.state === undefined) {
            skippedCount++;
            continue;
          }

          const externalId = `ha:${haState.entity_id}`;
          const device = await this.deviceRepository.findByExternalId(externalId);

          if (!device) {
            // Entidad no registrada localmente: ignorar, no crear nuevos devices.
            skippedCount++;
            continue;
          }

          // SILENT APPLY: actualizar lastKnownState y updatedAt sin emitir system_event.
          await this.deviceRepository.saveDevice({
            ...device,
            lastKnownState: {
              state: String(haState.state),
              attributes: haState.attributes || {}
            },
            updatedAt: new Date().toISOString()
          });

          reconciledCount++;
        } catch (entityErr: any) {
          skippedCount++;
          console.warn(`[HA-Sync] Reconciliation: error parcheando ${haState.entity_id}:`, entityErr.message);
        }
      }

      console.log(`[HA-Sync] Reconciliación completada: ${reconciledCount} actualizados, ${skippedCount} omitidos.`);
      this._logResilienceEvent('reconciliation', this.retryAttempt, 0,
        `State reconciliation completed.`, reconciledCount, skippedCount);

    } finally {
      this.isReconciling = false;
    }
  }

  // ─── Structured Logging ──────────────────────────────────────────────────────

  private _logResilienceEvent(
    source: 'reconnect' | 'reconciliation' | 'auth_error',
    attempt: number,
    delayMs: number,
    reason: string,
    reconciledDevices?: number,
    skippedDevices?: number
  ): void {
    this.activityLogRepository.saveActivity({
      timestamp: new Date().toISOString(),
      deviceId: 'system',
      type: 'HA_RESILIENCE',
      description: reason,
      data: {
        source,
        attempt,
        delayMs,
        reconciledDevices,
        skippedDevices,
        reason
      }
    }).catch(e => console.warn('[HA-Sync] Log de resiliencia falló:', e.message));
  }
}
