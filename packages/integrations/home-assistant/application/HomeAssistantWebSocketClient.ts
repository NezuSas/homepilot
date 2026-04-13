import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

export type HAWebSocketEvent = {
  type: string;
  [key: string]: any;
};

export class HomeAssistantWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private messageId = 1;
  private connectionTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private handshakeTimer: NodeJS.Timeout | null = null;

  // ─── Pong Tracking (dead-connection detection) ──────────────────────────────
  /** Timestamp of the last pong received. null = no ping sent yet. */
  private lastPongAt: number | null = null;
  /** How long we wait for a pong before declaring the connection dead (ms). */
  private static readonly HEARTBEAT_INTERVAL_MS = 30000;
  private static readonly PONG_TIMEOUT_MS = HomeAssistantWebSocketClient.HEARTBEAT_INTERVAL_MS * 2; // 60s

  constructor(private baseUrl: string, private token: string) {
    super();
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/api/websocket';
        this.ws = new WebSocket(wsUrl);

        this.connectionTimer = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            console.error('[HA WebSocket] Connection timeout - failing gracefully');
            this.forceClose();
            this.emit('error', 'unreachable', new Error('Connection timeout'));
            reject(new Error('Connection timeout'));
          }
        }, 8000); // Increased slightly for slower networks/Docker

        this.ws.onopen = () => {
          // Se espera 'auth_required' desde el onmessage
        };

        this.ws.onmessage = (event: any) => {
          const rawData = String(event.data);
          this.handleMessage(rawData, resolve, reject);
        };

        this.ws.onerror = (errorEvent: any) => {
          this.forceClose();
          // Error nativo del WebSocket, típicamente caída de red o puerto no bindeado
          this.emit('error', 'unreachable', new Error(errorEvent.message || 'WebSocket Error'));
          reject(new Error('WebSocket Error'));
        };

        this.ws.onclose = () => {
          this.forceClose();
          this.emit('close');
        };

      } catch (err: any) {
        this.forceClose();
        this.emit('error', 'unreachable', err);
        reject(err);
      }
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // Initialize lastPongAt so the first interval doesn't immediately trigger
    this.lastPongAt = Date.now();

    // Listen for pong responses from HA
    this.ws?.on('pong', () => {
      this.lastPongAt = Date.now();
    });

    this.heartbeatInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      // Dead-connection detection: if last pong was too long ago, the TCP connection is silently dead
      const elapsed = Date.now() - (this.lastPongAt ?? Date.now());
      if (elapsed > HomeAssistantWebSocketClient.PONG_TIMEOUT_MS) {
        console.error(
          `[HA WebSocket] Pong timeout — no pong received in ${elapsed}ms. ` +
          'Dead connection detected. Forcing close to trigger reconnect.'
        );
        this.forceClose();
        this.emit('close'); // Triggers reconnect backoff in HomeAssistantRealtimeSyncManager
        return;
      }

      // Send keep-alive ping
      this.ws.ping();
    }, HomeAssistantWebSocketClient.HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.lastPongAt = null;
  }

  private startHandshakeTimeout(reject: (err: Error) => void) {
    this.stopHandshakeTimeout();
    this.handshakeTimer = setTimeout(() => {
      console.error('[HA WebSocket] Handshake timeout (no auth_ok received)');
      this.forceClose();
      this.emit('error', 'auth_error', new Error('Handshake timeout'));
      reject(new Error('handshake_timeout'));
    }, 5000);
  }

  private stopHandshakeTimeout() {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }

  public forceClose() {
    this.stopHeartbeat();
    this.stopHandshakeTimeout();
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
    this.lastPongAt = null;
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.terminate(); // Terminate is safer than close for hanging connections
      }
      this.ws = null;
    }
  }

  private handleMessage(dataRaw: string, resolve: () => void, reject: (err: Error) => void) {
    try {
      const data = JSON.parse(dataRaw);

      if (data.type === 'auth_required') {
        this.startHandshakeTimeout(reject);
        this.ws?.send(JSON.stringify({ type: 'auth', access_token: this.token }));
      } else if (data.type === 'auth_ok') {
        if (this.connectionTimer) clearTimeout(this.connectionTimer);
        this.stopHandshakeTimeout();
        this.startHeartbeat();
        this.emit('ready');
        this.subscribeEvents();
        resolve();
      } else if (data.type === 'auth_invalid') {
        if (this.connectionTimer) clearTimeout(this.connectionTimer);
        this.stopHandshakeTimeout();
        this.forceClose();
        this.emit('error', 'auth_error', new Error(data.message || 'Invalid token'));
        reject(new Error('auth_invalid'));
      } else if (data.type === 'event' && data.event?.event_type === 'state_changed') {
        this.emit('event', data.event.data);
      }

    } catch (err) {
      console.error('[HA WebSocket] Message parsing error', err);
    }
  }

  private subscribeEvents() {
    this.ws?.send(JSON.stringify({
      id: this.messageId++,
      type: 'subscribe_events',
      event_type: 'state_changed'
    }));
  }
}
