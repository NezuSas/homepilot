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
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  private connect(): void {
    if (this.stopped || this.socket) return;
    const socket = this.createSocket(this.config.url, { headers: { Authorization: `Bearer ${this.config.token}` } });
    this.socket = socket;
    socket.on('open', () => socket.send(JSON.stringify({ protocolVersion, type: 'edge.heartbeat', homeId: this.config.homeId, edgeId: this.config.edgeId })));
    socket.on('message', (data) => { void this.handleCloudMessage(socket, data.toString()); });
    socket.on('close', () => { if (this.socket === socket) this.socket = null; this.scheduleReconnect(); });
    socket.on('error', () => socket.close());
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
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect(); }, this.reconnectDelayMs);
    this.reconnectTimer.unref();
  }
}

export function isSecureGatewayUrl(value: string): boolean { try { return new URL(value).protocol === 'wss:'; } catch { return false; } }