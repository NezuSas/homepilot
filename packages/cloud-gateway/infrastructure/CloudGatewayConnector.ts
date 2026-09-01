import WebSocket from 'ws';
import { EdgeRelayProtocolError, type EdgeRelayRequest, parseEdgeRelayRequest } from '../application/EdgeRelayProtocol';
import type { EdgeRelayExecutor } from '../application/EdgeGatewayRelayExecutor';

export interface CloudGatewayConnectorConfig { url: string; token: string; homeId: string; edgeId: string; }
export interface CloudGatewaySocket {
  close(): void;
  send(data: string): void;
  on(event: 'open' | 'close' | 'error', listener: () => void): void;
  on(event: 'message', listener: (data: { toString(): string }) => void): void;
}
export type CloudGatewaySocketFactory = (url: string, options: { headers: { Authorization: string } }) => CloudGatewaySocket;
const protocolVersion = 1;
const replayWindowSize = 4_096;
const unavailableExecutor: EdgeRelayExecutor = { execute: async () => ({ status: 501 }) };

/** Outbound-only Edge channel; it stays inert when Cloud configuration is absent. */
export class CloudGatewayConnector {
  private socket: CloudGatewaySocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private polling = false;
  private readonly processedRequestIds = new Set<string>();

  constructor(
    private readonly config: CloudGatewayConnectorConfig,
    private readonly reconnectDelayMs = 5_000,
    private readonly createSocket: CloudGatewaySocketFactory = (url, options) => new WebSocket(url, options),
    private readonly relayExecutor: EdgeRelayExecutor = unavailableExecutor,
  ) {}

  static fromEnvironment(relayExecutor: EdgeRelayExecutor = unavailableExecutor): CloudGatewayConnector | null {
    const url = process.env.HOMEPILOT_CLOUD_GATEWAY_URL?.trim();
    const token = process.env.HOMEPILOT_CLOUD_EDGE_TOKEN?.trim();
    const homeId = process.env.HOMEPILOT_CLOUD_HOME_ID?.trim();
    const edgeId = process.env.HOMEPILOT_CLOUD_EDGE_ID?.trim();
    if (!url || !token || !homeId || !edgeId || !isSecureGatewayUrl(url)) return null;
    return new CloudGatewayConnector({ url, token, homeId, edgeId }, 5_000, (gatewayUrl, options) => new WebSocket(gatewayUrl, options), relayExecutor);
  }

  start(): void { this.stopped = false; this.connect(); }
  stop(): void {
    this.stopped = true;
    this.polling = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  private connect(): void {
    if (this.stopped || this.socket) return;
    const socket = this.createSocket(this.config.url, { headers: { Authorization: `Bearer ${this.config.token}` } });
    this.socket = socket;
    socket.on('open', () => {
      console.log('[CloudGateway] Canal seguro conectado.');
      socket.send(JSON.stringify({ protocolVersion, type: 'edge.heartbeat', homeId: this.config.homeId, edgeId: this.config.edgeId }));
    });
    socket.on('message', (data) => { void this.handleCloudMessage(socket, data.toString()); });
    socket.on('close', () => {
      if (this.socket === socket) this.socket = null;
      console.warn('[CloudGateway] Canal desconectado; se reintentará.');
      this.scheduleReconnect();
    });
    socket.on('error', () => { console.warn('[CloudGateway] WebSocket no disponible; se usará sondeo seguro.'); this.startPolling(); socket.close(); });
  }

  private async handleCloudMessage(socket: CloudGatewaySocket, data: string): Promise<void> {
    let requestId: string | undefined;
    try {
      const request = parseEdgeRelayRequest(JSON.parse(data) as unknown, this.config);
      requestId = request.requestId;
      if (this.processedRequestIds.has(request.requestId)) throw new EdgeRelayProtocolError('GATEWAY_MESSAGE_INVALID');
      this.rememberRequest(request.requestId);
      const result = await this.relayExecutor.execute(request);
      socket.send(JSON.stringify({ protocolVersion, type: 'edge.response', homeId: this.config.homeId, edgeId: this.config.edgeId, requestId, status: result.status, payload: result.payload }));
    } catch (error) {
      const status = error instanceof EdgeRelayProtocolError && error.code === 'GATEWAY_OPERATION_FORBIDDEN' ? 403 : error instanceof EdgeRelayProtocolError && error.code === 'GATEWAY_REQUEST_EXPIRED' ? 408 : 400;
      if (requestId) socket.send(JSON.stringify({ protocolVersion, type: 'edge.response', homeId: this.config.homeId, edgeId: this.config.edgeId, requestId, status }));
    }
  }

  private rememberRequest(requestId: string): void {
    this.processedRequestIds.add(requestId);
    if (this.processedRequestIds.size > replayWindowSize) this.processedRequestIds.delete(this.processedRequestIds.values().next().value as string);
  }
  private scheduleReconnect(): void {
    if (this.stopped || this.polling || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect(); }, this.reconnectDelayMs);
    this.reconnectTimer.unref();
  }

  private startPolling(): void {
    if (this.polling || this.stopped) return;
    this.polling = true;
    void this.poll();
  }

  private async poll(): Promise<void> {
    while (!this.stopped && this.polling) {
      try {
        const url = new URL(this.config.url);
        url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
        url.pathname = '/gateway/edge/poll';
        const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${this.config.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ homeId: this.config.homeId, edgeId: this.config.edgeId }) });
        if (!response.ok) throw new Error(`poll ${response.status}`);
        await this.handlePollMessage(await response.json() as unknown);
      } catch {
        await new Promise<void>((resolve) => setTimeout(resolve, this.reconnectDelayMs));
      }
    }
  }

  private async handlePollMessage(message: unknown): Promise<void> {
    let requestId: string | undefined;
    try {
      const request = parseEdgeRelayRequest(message, this.config);
      requestId = request.requestId;
      if (this.processedRequestIds.has(request.requestId)) throw new EdgeRelayProtocolError('GATEWAY_MESSAGE_INVALID');
      this.rememberRequest(request.requestId);
      const result = await this.relayExecutor.execute(request);
      await this.postPollResponse({ protocolVersion, type: 'edge.response', homeId: this.config.homeId, edgeId: this.config.edgeId, requestId, status: result.status, payload: result.payload });
    } catch (error) {
      const status = error instanceof EdgeRelayProtocolError && error.code === 'GATEWAY_OPERATION_FORBIDDEN' ? 403 : error instanceof EdgeRelayProtocolError && error.code === 'GATEWAY_REQUEST_EXPIRED' ? 408 : 400;
      if (requestId) await this.postPollResponse({ protocolVersion, type: 'edge.response', homeId: this.config.homeId, edgeId: this.config.edgeId, requestId, status });
    }
  }

  private async postPollResponse(message: unknown): Promise<void> {
    const url = new URL(this.config.url);
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.pathname = '/gateway/edge/response';
    await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${this.config.token}`, 'content-type': 'application/json' }, body: JSON.stringify(message) });
  }}

export function isSecureGatewayUrl(value: string): boolean { try { return new URL(value).protocol === 'wss:'; } catch { return false; } }