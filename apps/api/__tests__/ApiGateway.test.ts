import { ApiGateway } from '../ApiGateway';
import { WebSocket } from 'ws';
import type { BootstrapContainer } from '../../../bootstrap';
import type { RouteHandler } from '../RouteHandler';

interface TestGateway {
  fastify: {
    inject(options: { method: string; url: string; headers?: Record<string, string>; payload?: string }): Promise<{
      statusCode: number;
      headers: Record<string, string | string[] | undefined>;
      json(): unknown;
    }>;
    close(): Promise<void>;
  };
  wsClients: Set<{ readyState: number; send(payload: string): void; terminate(): void; }>;
  broadcastRealtimeEvent(message: { type: string; timestamp: string; payload: Record<string, unknown> }): Promise<void>;
  normalizePayload(payload: unknown): Record<string, unknown>;
  stop(): Promise<void>;
}

function createContainer(): BootstrapContainer {
  return {
    eventBus: { subscribe: jest.fn().mockReturnValue(jest.fn()) },
    services: { authService: { verifyToken: jest.fn() } },
  } as unknown as BootstrapContainer;
}

describe('ApiGateway HTTP transport contracts', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalCorsOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = originalCorsOrigin;
  });

  it('returns a CORS preflight response with security headers before handlers execute', async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGIN = 'https://console.homepilot.test';
    const handler: RouteHandler = { handle: jest.fn() };
    const gateway = new ApiGateway(createContainer(), ':memory:', [handler], 0);

    try {
      const response = await (gateway as unknown as TestGateway).fastify.inject({
        method: 'OPTIONS',
        url: '/api/v1/devices',
        headers: { origin: 'https://console.homepilot.test' },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('https://console.homepilot.test');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(handler.handle).not.toHaveBeenCalled();
    } finally {
      await (gateway as unknown as TestGateway).fastify.close();
    }
  });

  it('returns a stable not-found error when no route handler claims a request', async () => {
    const gateway = new ApiGateway(createContainer(), ':memory:', [{ handle: jest.fn().mockResolvedValue(false) }], 0);

    try {
      const response = await (gateway as unknown as TestGateway).fastify.inject({ method: 'GET', url: '/api/v1/not-a-route' });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(expect.objectContaining({ error: expect.objectContaining({ code: 'NOT_FOUND' }) }));
      expect(response.headers['referrer-policy']).toBe('no-referrer');
    } finally {
      await (gateway as unknown as TestGateway).fastify.close();
    }
  });

  it('contains handler failures behind the internal-server-error contract', async () => {
    const gateway = new ApiGateway(createContainer(), ':memory:', [{ handle: jest.fn().mockRejectedValue(new Error('repository unavailable')) }], 0);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const response = await (gateway as unknown as TestGateway).fastify.inject({ method: 'GET', url: '/api/v1/failing-route' });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual(expect.objectContaining({ error: expect.objectContaining({ code: 'INTERNAL_SERVER_ERROR', message: 'Internal Server Error' }) }));
    } finally {
      errorSpy.mockRestore();
      await (gateway as unknown as TestGateway).fastify.close();
    }
  });
  it.each([
    ['a non-realtime path', '/api/v1/other?token=session-token', undefined, 'HTTP/1.1 404 Not Found'],
    ['a missing token', '/ws', undefined, 'HTTP/1.1 401 Unauthorized'],
    ['an invalid token', '/ws?token=invalid-token', { isValid: false }, 'HTTP/1.1 401 Unauthorized'],
  ] as const)('rejects websocket upgrades with %s before opening a realtime client', async (_scenario, url, verification, expectedStatus) => {
    const container = createContainer();
    (container.services.authService.verifyToken as jest.Mock).mockResolvedValue(verification);
    const gateway = new ApiGateway(container, ':memory:', [], 0);
    const socket = { write: jest.fn(), destroy: jest.fn() };
    const server = (gateway as unknown as { fastify: { server: { emit(event: string, request: unknown, socket: unknown, head: Buffer): void } } }).fastify.server;

    try {
      server.emit('upgrade', { url, headers: {} }, socket, Buffer.alloc(0));
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(socket.write).toHaveBeenCalledWith(expect.stringContaining(expectedStatus));
      expect(socket.destroy).toHaveBeenCalledTimes(1);
      if (verification === undefined || url.startsWith('/api/v1/other')) {
        expect(container.services.authService.verifyToken).not.toHaveBeenCalled();
      } else {
        expect(container.services.authService.verifyToken).toHaveBeenCalledWith('invalid-token');
      }
    } finally {
      await (gateway as unknown as TestGateway).fastify.close();
    }
  });
  it('accepts a valid websocket token and registers the upgraded realtime client', async () => {
    const container = createContainer();
    (container.services.authService.verifyToken as jest.Mock).mockResolvedValue({ isValid: true });
    const gateway = new ApiGateway(container, ':memory:', [], 0);
    const socket = { write: jest.fn(), destroy: jest.fn() };
    const client = { on: jest.fn(), readyState: WebSocket.OPEN, send: jest.fn(), close: jest.fn(), terminate: jest.fn() };
    const internals = gateway as unknown as {
      fastify: { server: { emit(event: string, request: unknown, socket: unknown, head: Buffer): void } };
      wsServer: { handleUpgrade: jest.Mock };
      wsClients: Set<unknown>;
    };
    const upgradeSpy = jest.spyOn(internals.wsServer, 'handleUpgrade').mockImplementation((_request, _socket, _head, callback) => {
      callback(client);
    });

    try {
      internals.fastify.server.emit('upgrade', { url: '/ws?token=session-token', headers: {} }, socket, Buffer.alloc(0));
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(container.services.authService.verifyToken).toHaveBeenCalledWith('session-token');
      expect(upgradeSpy).toHaveBeenCalledTimes(1);
      expect(internals.wsClients.has(client)).toBe(true);
      expect(socket.write).not.toHaveBeenCalled();
    } finally {
      upgradeSpy.mockRestore();
      await (gateway as unknown as TestGateway).fastify.close();
    }
  });
  it('returns an internal-server rejection when websocket token verification fails unexpectedly', async () => {
    const container = createContainer();
    (container.services.authService.verifyToken as jest.Mock).mockRejectedValue(new Error('session store unavailable'));
    const gateway = new ApiGateway(container, ':memory:', [], 0);
    const socket = { write: jest.fn(), destroy: jest.fn() };
    const server = (gateway as unknown as { fastify: { server: { emit(event: string, request: unknown, socket: unknown, head: Buffer): void } } }).fastify.server;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      server.emit('upgrade', { url: '/ws?token=session-token', headers: {} }, socket, Buffer.alloc(0));
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 500 Internal Server Error'));
      expect(socket.destroy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
      await (gateway as unknown as TestGateway).fastify.close();
    }
  });
  it('releases bridge subscriptions and closes every realtime client during shutdown', async () => {
    const firstUnsubscribe = jest.fn();
    const secondUnsubscribe = jest.fn();
    const container = createContainer();
    (container.eventBus.subscribe as jest.Mock)
      .mockReturnValueOnce(firstUnsubscribe)
      .mockReturnValue(secondUnsubscribe);
    const gateway = new ApiGateway(container, ':memory:', [], 0) as unknown as TestGateway;
    const closableClient = { readyState: WebSocket.OPEN, send: jest.fn(), close: jest.fn(), terminate: jest.fn() };
    const failingClient = { readyState: WebSocket.OPEN, send: jest.fn(), close: jest.fn(() => { throw new Error('close failure'); }), terminate: jest.fn() };
    gateway.wsClients.add(closableClient);
    gateway.wsClients.add(failingClient);

    await gateway.stop();

    expect(firstUnsubscribe).toHaveBeenCalledTimes(1);
    expect(secondUnsubscribe).toHaveBeenCalledTimes(6);
    expect(closableClient.close).toHaveBeenCalledTimes(1);
    expect(failingClient.terminate).toHaveBeenCalledTimes(1);
  });
  it('normalizes scalar realtime payloads without changing object payloads', async () => {
    const gateway = new ApiGateway(createContainer(), ':memory:', [], 0) as unknown as TestGateway;
    try {
      expect(gateway.normalizePayload({ deviceId: 'device-1' })).toEqual({ deviceId: 'device-1' });
      expect(gateway.normalizePayload('offline')).toEqual({ value: 'offline' });
      expect(gateway.normalizePayload(['not', 'an', 'object'])).toEqual({ value: ['not', 'an', 'object'] });
    } finally {
      await gateway.fastify.close();
    }
  });


  it('does not reflect an unapproved browser origin while preserving the parsed JSON payload for the claimed route handler', async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGIN = 'https://approved.homepilot.test';
    const handler: RouteHandler = {
      handle: jest.fn(async (request, response) => {
        expect(request._fastifyParsedBody).toBe('{"command":"refresh"}');
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end('{"ok":true}');
        return true;
      }),
    };
    const gateway = new ApiGateway(createContainer(), ':memory:', [handler], 0);

    try {
      const response = await (gateway as unknown as TestGateway).fastify.inject({
        method: 'POST',
        url: '/api/v1/claimed-route',
        headers: { origin: 'https://unapproved.example.test', 'content-type': 'application/json' },
        payload: '{"command":"refresh"}',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['permissions-policy']).toContain('camera=()');
      expect(handler.handle).toHaveBeenCalledTimes(1);
    } finally {
      await (gateway as unknown as TestGateway).fastify.close();
    }
  });  it('broadcasts only to open websocket clients and removes disconnected or failed clients', async () => {
    const gateway = new ApiGateway(createContainer(), ':memory:', [], 0) as unknown as TestGateway;
    const openClient = { readyState: WebSocket.OPEN, send: jest.fn(), terminate: jest.fn() };
    const closedClient = { readyState: WebSocket.CLOSED, send: jest.fn(), terminate: jest.fn() };
    const failedClient = { readyState: WebSocket.OPEN, send: jest.fn(() => { throw new Error('socket closed'); }), terminate: jest.fn() };
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    gateway.wsClients.add(openClient);
    gateway.wsClients.add(closedClient);
    gateway.wsClients.add(failedClient);
    try {
      await gateway.broadcastRealtimeEvent({ type: 'DeviceStateUpdatedEvent', timestamp: '2026-08-17T00:00:00.000Z', payload: { id: 'device-1' } });
      expect(openClient.send).toHaveBeenCalledWith(expect.stringContaining('DeviceStateUpdatedEvent'));
      expect(closedClient.send).not.toHaveBeenCalled();
      expect(failedClient.terminate).toHaveBeenCalledTimes(1);
      expect(gateway.wsClients.has(closedClient)).toBe(false);
      expect(gateway.wsClients.has(failedClient)).toBe(false);
    } finally {
      warningSpy.mockRestore();
      await gateway.fastify.close();
    }
  });
  it('does not serialize or send a realtime event when there are no connected clients', async () => {
    const gateway = new ApiGateway(createContainer(), ':memory:', [], 0) as unknown as TestGateway;
    try {
      await expect(gateway.broadcastRealtimeEvent({ type: 'DeviceStateUpdatedEvent', timestamp: '2026-08-17T00:00:00.000Z', payload: { id: 'device-1' } })).resolves.toBeUndefined();
      expect(gateway.wsClients.size).toBe(0);
    } finally {
      await gateway.fastify.close();
    }
  });

  it('stops route dispatch immediately after the first handler claims the request', async () => {
    const claimingHandler: RouteHandler = {
      handle: jest.fn(async (_request, response) => {
        response.writeHead(204);
        response.end();
        return true;
      }),
    };
    const laterHandler: RouteHandler = { handle: jest.fn().mockResolvedValue(true) };
    const gateway = new ApiGateway(createContainer(), ':memory:', [claimingHandler, laterHandler], 0);

    try {
      const response = await (gateway as unknown as TestGateway).fastify.inject({ method: 'GET', url: '/api/v1/claimed' });

      expect(response.statusCode).toBe(204);
      expect(claimingHandler.handle).toHaveBeenCalledTimes(1);
      expect(laterHandler.handle).not.toHaveBeenCalled();
    } finally {
      await (gateway as unknown as TestGateway).fastify.close();
    }
  });

  it('allows the explicit local development origin while preserving the wildcard body parser contract', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CORS_ORIGIN;
    const handler: RouteHandler = {
      handle: jest.fn(async (request, response) => {
        expect(request._fastifyParsedBody).toBe('mode=local');
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end('{"ok":true}');
        return true;
      }),
    };
    const gateway = new ApiGateway(createContainer(), ':memory:', [handler], 0);

    try {
      const response = await (gateway as unknown as TestGateway).fastify.inject({
        method: 'POST',
        url: '/api/v1/local-form',
        headers: { origin: 'http://localhost:5173', 'content-type': 'text/plain' },
        payload: 'mode=local',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(handler.handle).toHaveBeenCalledTimes(1);
    } finally {
      await (gateway as unknown as TestGateway).fastify.close();
    }
  });
});
it('does not attempt a second response when a handler fails after ending its response', async () => {
  const handler: RouteHandler = {
    handle: jest.fn(async (_request, response) => {
      response.writeHead(202, { 'Content-Type': 'application/json' });
      response.end('{"accepted":true}');
      throw new Error('late failure');
    }),
  };
  const gateway = new ApiGateway(createContainer(), ':memory:', [handler], 0);
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  try {
    const response = await (gateway as unknown as TestGateway).fastify.inject({ method: 'POST', url: '/api/v1/late-failure' });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: true });
  } finally {
    errorSpy.mockRestore();
    await (gateway as unknown as TestGateway).fastify.close();
  }
});