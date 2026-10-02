import type { ServerResponse } from 'node:http';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';
import type { BootstrapContainer } from '../../../bootstrap';
import type { ModbusService } from '../../../packages/integrations/modbus/application/ModbusService';
import { ModbusError } from '../../../packages/integrations/modbus/domain/Modbus';
import { ModbusRoutes } from '../routes/ModbusRoutes';

describe('Feature: Admin-only native Modbus routes (AC2)', () => {
  const service = { list: jest.fn(), saveConnection: jest.fn(), saveVariable: jest.fn() };
  const routes = new ModbusRoutes(service as unknown as ModbusService);
  const protect = jest.fn();
  const container = { guards: { authGuard: { protect } } } as unknown as BootstrapContainer;
  const req = (url: string, body?: unknown): HomePilotRequest => ({ url, headers: {}, user: { id: 'admin', role: 'admin' }, _fastifyParsedBody: body === undefined ? undefined : JSON.stringify(body) }) as HomePilotRequest;
  const response = () => ({ writeHead: jest.fn(), end: jest.fn() });
  beforeEach(() => { jest.resetAllMocks(); protect.mockResolvedValue(true); service.list.mockResolvedValue([]); service.saveConnection.mockResolvedValue({ enabled: false }); service.saveVariable.mockResolvedValue({ writable: false }); });
  it.each(['GET', 'POST', 'PUT'])('Scenario: Given non-Admin access When %s requests config Then the Admin guard blocks the service', async method => {
    protect.mockResolvedValue(false); const res = response();
    await routes.handle(req('/api/v1/modbus/connections?homeId=h'), res as unknown as ServerResponse, '/api/v1/modbus/connections', method, container);
    expect(protect).toHaveBeenCalledWith(expect.anything(), expect.anything(), true); expect(service.list).not.toHaveBeenCalled(); expect(service.saveConnection).not.toHaveBeenCalled();
  });
  it('Scenario: Given an Admin When listing Then actor and home are forwarded for ownership validation', async () => {
    const res = response(); await routes.handle(req('/api/v1/modbus/connections?homeId=h'), res as unknown as ServerResponse, '/api/v1/modbus/connections', 'GET', container);
    expect(service.list).toHaveBeenCalledWith('admin', 'h'); expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({ connections: [] });
  });
  it('Scenario: Given another home When listing Then forbidden is preserved without leaking config', async () => {
    service.list.mockRejectedValue(new ModbusError('FORBIDDEN', 'private address'));
    const res = response(); await routes.handle(req('/api/v1/modbus/connections?homeId=other'), res as unknown as ServerResponse, '/api/v1/modbus/connections', 'GET', container);
    expect(res.writeHead.mock.calls[0][0]).toBe(403); expect(res.end.mock.calls[0][0]).not.toContain('private address');
  });
  it('Scenario: Given a Fastify captured body When saving Then the modular parser preserves configuration', async () => {
    const body = { homeId: 'h', name: 'PLC', host: '192.168.1.5' }, res = response();
    await routes.handle(req('/api/v1/modbus/connections', body), res as unknown as ServerResponse, '/api/v1/modbus/connections', 'POST', container);
    expect(service.saveConnection).toHaveBeenCalledWith('admin', 'h', body, undefined);
  });
  it('Scenario: Given an existing variable When updated Then its actual connection and device binding are forwarded', async () => {
    const res = response(); await routes.handle(req('/api/v1/modbus/connections/c/variables/v', { writable: false }), res as unknown as ServerResponse, '/api/v1/modbus/connections/c/variables/v', 'PUT', container);
    expect(service.saveVariable).toHaveBeenCalledWith('admin', 'c', { writable: false }, 'v');
  });
  it('Scenario: Given invalid connection input When posted Then configuration is rejected without invoking the service', async () => {
    const res = response(); await routes.handle(req('/api/v1/modbus/connections', []), res as unknown as ServerResponse, '/api/v1/modbus/connections', 'POST', container);
    expect(res.writeHead.mock.calls[0][0]).toBe(400); expect(service.saveConnection).not.toHaveBeenCalled();
  });
});
