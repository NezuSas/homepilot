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
});
