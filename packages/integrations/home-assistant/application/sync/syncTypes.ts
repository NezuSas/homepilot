/**
 * Tipos compartidos de la sincronización en tiempo real con Home Assistant.
 */

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
export type CloseReason = 'stop_manual' | 'reconfigure' | 'auth_error' | 'network_drop';

export interface HomeAssistantRealtimeSocket {
  on(event: 'error', listener: (type: 'auth_error' | 'unreachable', error: Error) => void): this;
  on(event: 'close' | 'ready', listener: () => void): this;
  on(event: 'event', listener: (data: unknown) => void): this;
  connect(): Promise<void>;
  forceClose(): void;
}

export type HomeAssistantRealtimeSocketFactory = (
  baseUrl: string,
  token: string,
) => HomeAssistantRealtimeSocket;

export type ResilienceEventSource = 'reconnect' | 'reconciliation' | 'auth_error';

/** Registra un evento de resiliencia estructurado (fire-and-forget). */
export type ResilienceEventLogger = (
  source: ResilienceEventSource,
  attempt: number,
  delayMs: number,
  reason: string,
  reconciledDevices?: number,
  skippedDevices?: number,
) => void;
