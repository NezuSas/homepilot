import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { RouteHandler } from '../RouteHandler';
import { ApiRoutes } from '../routes/ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';

class TestApiRoutes extends ApiRoutes {
  async handle(
    _req: HomePilotRequest,
    _res: http.ServerResponse,
    _pathname: string,
    _method: string,
    _container: BootstrapContainer
  ): Promise<boolean> {
    return false;
  }

  exposeSendError(res: http.ServerResponse, status: number, code: string, internalMessage: string): void {
    this.sendError(res, status, code, internalMessage);
  }

  exposeParseBody<T>(req: HomePilotRequest): Promise<T> { return this.parseBody<T>(req); }
  exposeSendJson(res: http.ServerResponse, data: unknown, status?: number): void { this.sendJson(res, data, status); }
  exposeErrorDetails(error: unknown): { name: string; message: string } { return this.getErrorDetails(error); }
}

const response = () => ({ writeHead: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis() }) as unknown as http.ServerResponse;

describe('Feature: Public API error sanitization', () => {
  const routes = new TestApiRoutes();
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('Scenario: Given an internal production failure When the API responds Then it does not expose exception details', () => {
    process.env.NODE_ENV = 'production';
    const res = response();

    routes.exposeSendError(res, 500, 'INTERNAL_ERROR', 'sqlite://C:/private/homepilot.db password=secret');

    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(
      expect.stringContaining('Error interno del sistema. Contacte a soporte.')
    );
    expect(res.end).not.toHaveBeenCalledWith(expect.stringContaining('password=secret'));
  });

  it('Scenario: Given an invalid request When the API responds Then it preserves its safe validation message', () => {
    process.env.NODE_ENV = 'production';
    const res = response();

    routes.exposeSendError(res, 400, 'VALIDATION_ERROR', 'Payload validation failed');

    expect(res.end).toHaveBeenCalledWith(
      expect.stringContaining('Los datos proporcionados no son válidos.')
    );
  });
  it('parses buffered Fastify payloads and rejects malformed JSON without reading the stream', async () => {
    const request = { _fastifyParsedBody: '{"name":"HomePilot"}', on: jest.fn() } as unknown as HomePilotRequest;
    await expect(routes.exposeParseBody<{ name: string }>(request)).resolves.toEqual({ name: 'HomePilot' });
    await expect(routes.exposeParseBody({ _fastifyParsedBody: '{bad', on: jest.fn() } as unknown as HomePilotRequest)).rejects.toThrow('INVALID_JSON');
    expect(request.on).not.toHaveBeenCalled();
  });

  it('parses stream payloads, serializes JSON responses, and normalizes non-Error failures', async () => {
    const listeners: Record<string, (value?: Buffer) => void> = {};
    const request = { on: jest.fn((event: string, callback: (value?: Buffer) => void) => { listeners[event] = callback; return request; }) } as unknown as HomePilotRequest;
    const parsed = routes.exposeParseBody<{ enabled: boolean }>(request);
    listeners.data(Buffer.from('{"enabled":true}'));
    listeners.end();
    await expect(parsed).resolves.toEqual({ enabled: true });
    const invalidListeners: Record<string, (value?: Buffer) => void> = {};
    const invalidRequest = { on: jest.fn((event: string, callback: (value?: Buffer) => void) => { invalidListeners[event] = callback; return invalidRequest; }) } as unknown as HomePilotRequest;
    const invalid = routes.exposeParseBody(invalidRequest);
    invalidListeners.data(Buffer.from('{invalid'));
    invalidListeners.end();
    await expect(invalid).rejects.toThrow('INVALID_JSON');

    const res = response();
    routes.exposeSendJson(res, { ok: true }, 201);
    expect(res.writeHead).toHaveBeenCalledWith(201, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith('{"ok":true}');
    expect(routes.exposeErrorDetails('unexpected')).toEqual({ name: 'UnknownError', message: 'unexpected' });
  });
});
