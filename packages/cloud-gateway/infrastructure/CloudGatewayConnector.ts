import WebSocket from 'ws';
import { EdgeRelayProtocolError, type EdgeRelayRequest, parseEdgeRelayRequest } from '../application/EdgeRelayProtocol';
import type { EdgeRelayExecutor } from '../application/EdgeGatewayRelayExecutor';
import { readCloudEdgeConfig } from './CloudEdgeConfigProvider';

export type { CloudGatewayConnectorConfig } from './CloudEdgeConfigProvider';
import type { CloudGatewayConnectorConfig } from './CloudEdgeConfigProvider';
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
    private readonly gatewayTimeoutMs = 15_000,
  ) {}

  static fromEnvironment(relayExecutor: EdgeRelayExecutor = unavailableExecutor): CloudGatewayConnector | null {
    const config = readCloudEdgeConfig();
    if (!config || !isSecureGatewayUrl(config.url)) return null;
    return new CloudGatewayConnector(config, 5_000, (gatewayUrl, options) => new WebSocket(gatewayUrl, options), relayExecutor);
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

  /**
   * Polling is the fallback when the WebSocket is unavailable. Three things keep it from misbehaving:
   * the request has a timeout, so a cloud endpoint that accepts the connection and never answers cannot
   * leave the loop pending forever; every iteration waits, because a 200 that carries no pending request
   * resolves at once and the loop would otherwise spin at full speed; and the WebSocket is retried
   * afterwards instead of staying abandoned for the life of the process.
   */
  private async poll(): Promise<void> {
    while (!this.stopped && this.polling) {
      let cycleSucceeded = false;
      try {
        const url = new URL(this.config.url);
        url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
        url.pathname = '/gateway/edge/poll';
        const response = await this.gatewayFetch(url, { homeId: this.config.homeId, edgeId: this.config.edgeId });
        if (!response.ok) throw new Error(`poll ${response.status}`);
        await this.handlePollMessage(await response.json() as unknown);
        cycleSucceeded = true;
      } catch {
        // Not logged on purpose: a cloud outage must not flood the appliance log once per cycle.
      }
      await new Promise<void>((resolve) => { const timer = setTimeout(resolve, this.reconnectDelayMs); timer.unref(); });
      // Once the cloud answers again, hand the channel back to the WebSocket. If it still fails, its error
      // handler returns here, so the two alternate instead of the socket being abandoned for good.
      if (cycleSucceeded) this.polling = false;
    }
    if (!this.stopped) this.scheduleReconnect();
  }

  /** A gateway request that cannot outlive one polling cycle. */
  private async gatewayFetch(url: URL, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.gatewayTimeoutMs);
    timeoutId.unref();
    try {
      return await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.config.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } finally {
      clearTimeout(timeoutId);
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
    await this.gatewayFetch(url, message);
  }}

export function isSecureGatewayUrl(value: string): boolean { try { return new URL(value).protocol === 'wss:'; } catch { return false; } }
