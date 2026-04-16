import * as http from 'http';
import Fastify, { FastifyInstance } from 'fastify';
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
 * ApiGateway — thin HTTP gateway backed by Fastify that delegates to modular
 * route handlers.
 *
 * Migration notes (node:http → Fastify):
 *  - Public API (start/stop) is unchanged — OperatorConsoleServer and main.ts
 *    require no modification.
 *  - RouteHandler interface is unchanged — all existing handlers work as-is.
 *  - Fastify buffers request bodies and attaches them to request.raw via
 *    _fastifyParsedBody so ApiRoutes.parseBody can read them without
 *    re-consuming the stream.
 *  - CORS headers are set inline (reply.hijack bypasses Fastify's lifecycle,
 *    so external plugins cannot inject headers after hijack).
 *  - WebSocket upgrade is attached to fastify.server (the underlying
 *    http.Server), preserving the existing ws upgrade logic exactly.
 */
export class ApiGateway {
  private readonly fastify: FastifyInstance;
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
    this.fastify = Fastify({ logger: false });
    this.wsServer = new WebSocketServer({ noServer: true });

    this.registerContentTypeParsers();
    this.registerCatchAllRoute();
    this.setupWebSocketServer();
    this.setupRealtimeBridge();
  }

  public start(): void {
    this.fastify
      .listen({ port: this.port, host: '0.0.0.0' })
      .then(() => {
        console.log(`[ApiGateway] API local en http://localhost:${this.port}`);
      })
      .catch((err) => {
        console.error('[ApiGateway] Failed to start server:', err);
        process.exit(1);
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
        this.fastify.close().then(() => resolve()).catch(() => resolve());
      });
    });
  }

  /**
   * Register content type parsers that buffer request bodies as raw strings.
   * This makes request.body available in our catch-all handler so we can
   * attach it to request.raw._fastifyParsedBody for ApiRoutes.parseBody.
   */
  private registerContentTypeParsers(): void {
    this.fastify.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (_req, body, done) => done(null, body)
    );

    // Accept any other Content-Type without transformation
    this.fastify.addContentTypeParser(
      '*',
      { parseAs: 'string' },
      (_req, body, done) => done(null, body)
    );
  }

  /**
   * Register a single wildcard route that receives every HTTP request and
   * delegates to the chain of RouteHandlers.
   *
   * reply.hijack() transfers response ownership to our code so we can write
   * directly to reply.raw (http.ServerResponse). Fastify will not attempt to
   * finalize the response after hijack.
   */
  private registerCatchAllRoute(): void {
    this.fastify.all('/*', async (request, reply) => {
      // Transfer response ownership — Fastify will not touch headers or body.
      reply.hijack();

      const rawReq = request.raw as http.IncomingMessage & { _fastifyParsedBody?: string };
      const rawRes = reply.raw;

      // CORS — set before any handler writes to the response.
      rawRes.setHeader('Access-Control-Allow-Origin', '*');
      rawRes.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      rawRes.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (request.method === 'OPTIONS') {
        rawRes.writeHead(204).end();
        return;
      }

      // Expose the Fastify-buffered body to ApiRoutes.parseBody.
      // Avoids re-reading an already-consumed IncomingMessage stream.
      rawReq._fastifyParsedBody = typeof request.body === 'string' ? request.body : '';

      const pathname = new URL(
        request.url ?? '',
        `http://${request.headers.host ?? 'localhost'}`
      ).pathname;
      const method = request.method ?? 'GET';

      try {
        for (const handler of this.handlers) {
          const claimed = await handler.handle(rawReq, rawRes, pathname, method, this.container);
          if (claimed) return;
        }

        // 404 fallback — no handler claimed this request.
        rawRes.writeHead(404, { 'Content-Type': 'application/json' });
        rawRes.end(
          JSON.stringify({
            error: {
              code: 'NOT_FOUND',
              message: 'Not Found',
              timestamp: new Date().toISOString(),
            },
          })
        );
      } catch (error: any) {
        console.error('[ApiGateway] Critical handler error:', error);
        if (!rawRes.writableEnded) {
          rawRes.writeHead(500, { 'Content-Type': 'application/json' });
          rawRes.end(
            JSON.stringify({
              error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Internal Server Error',
                timestamp: new Date().toISOString(),
              },
            })
          );
        }
      }
    });
  }

  /**
   * Attach WebSocket upgrade handling to fastify.server (the underlying
   * http.Server). Logic is identical to the previous node:http implementation.
   */
  private setupWebSocketServer(): void {
    this.fastify.server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(
        request.url || '',
        `http://${request.headers.host || 'localhost'}`
      ).pathname;

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
        console.warn(
          '[ApiGateway] Failed to send realtime event:',
          error instanceof Error ? error.message : error
        );
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
}
