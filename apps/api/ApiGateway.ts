import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { BootstrapContainer } from '../../bootstrap';
import { RouteHandler } from './RouteHandler';

interface RealtimeEventMessage {
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

const REALTIME_PATHNAME = '/ws';
const BRIDGED_EVENT_TYPES = [
  'DeviceDiscoveredEvent',
  'HomeCreatedEvent',
  'RoomCreatedEvent',
  'DeviceAssignedToRoomEvent',
] as const;

/**
 * ApiGateway — thin HTTP gateway that delegates to modular route handlers.
 * Replaces the monolithic OperatorConsoleServer while preserving the same
 * public API contract (same port, same start/stop methods, same CORS).
 */
export class ApiGateway {
  private readonly server: http.Server;
  private readonly wsServer: WebSocketServer;
  private readonly wsClients = new Set<WebSocket>();
  private readonly eventBusUnsubscribers: Array<() => void> = [];
  private readonly port: number;

  constructor(
    private readonly container: BootstrapContainer,
    private readonly dbPath: string,
    private readonly handlers: RouteHandler[],
    port: number = 3000
  ) {
    this.port = port;
    this.server = http.createServer((req, res) => this.route(req, res));
    this.wsServer = new WebSocketServer({ noServer: true });

    this.setupWebSocketServer();
    this.setupRealtimeBridge();
  }

  public start(): void {
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`[ApiGateway] API local en http://localhost:${this.port}`);
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const unsubscribe of this.eventBusUnsubscribers) {
        unsubscribe();
      }

      for (const client of this.wsClients) {
        try {
          client.close();
        } catch {
          client.terminate();
        }
      }

      this.wsServer.close(() => {
        this.server.close(() => resolve());
      });
    });
  }

  private setupWebSocketServer(): void {
    this.server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`).pathname;

      if (pathname !== REALTIME_PATHNAME) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wsServer.handleUpgrade(request, socket, head, (ws) => {
        this.wsServer.emit('connection', ws, request);
      });
    });

    this.wsServer.on('connection', (ws) => {
      this.wsClients.add(ws);

      ws.on('close', () => {
        this.wsClients.delete(ws);
      });

      ws.on('error', (error) => {
        console.warn('[ApiGateway] WebSocket client error:', error.message);
        this.wsClients.delete(ws);
      });
    });
  }

  private setupRealtimeBridge(): void {
    for (const eventType of BRIDGED_EVENT_TYPES) {
      const unsubscribe = this.container.eventBus.subscribe(eventType, async (event) => {
        await this.broadcastRealtimeEvent({
          type: event.eventType,
          timestamp: event.timestamp,
          payload: this.normalizePayload(event.payload),
        });
      });

      this.eventBusUnsubscribers.push(unsubscribe);
    }
  }

  private async broadcastRealtimeEvent(message: RealtimeEventMessage): Promise<void> {
    if (this.wsClients.size === 0) {
      return;
    }

    const serializedMessage = JSON.stringify(message);

    for (const client of this.wsClients) {
      if (client.readyState !== WebSocket.OPEN) {
        this.wsClients.delete(client);
        continue;
      }

      try {
        client.send(serializedMessage);
      } catch (error) {
        console.warn('[ApiGateway] Failed to send realtime event:', error instanceof Error ? error.message : error);
        this.wsClients.delete(client);
        client.terminate();
      }
    }
  }

  private normalizePayload(payload: unknown): Record<string, unknown> {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return payload as Record<string, unknown>;
    }

    return { value: payload };
  }

  private async route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    const { url = '', method = 'GET' } = req;
    const pathname = new URL(url, `http://${req.headers.host || 'localhost'}`).pathname;

    for (const handler of this.handlers) {
      const claimed = await handler.handle(req, res, pathname, method, this.container);
      if (claimed) return;
    }

    // 404 fallback — no handler claimed this request
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: {
          code: 'NOT_FOUND',
          message: 'Not Found',
          timestamp: new Date().toISOString(),
        },
      })
    );
  }
}
