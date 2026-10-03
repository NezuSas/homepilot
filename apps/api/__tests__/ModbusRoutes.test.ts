import type { ServerResponse } from 'node:http';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';
import type { BootstrapContainer } from '../../../bootstrap';
import type { ModbusService } from '../../../packages/integrations/modbus/application/ModbusService';
import { ModbusError } from '../../../packages/integrations/modbus/domain/Modbus';
import { ModbusRoutes } from '../routes/ModbusRoutes';
import { EventEmitter } from 'node:events';
import { AuthGuard } from '../../../packages/auth/infrastructure/AuthGuard';
import type { AuthService } from '../../../packages/auth/application/AuthService';

describe('Feature: Real Modbus Admin authorization (AC19)', () => {
  it.each(['anonymous', 'guest', 'child', 'parent', 'operator', 'admin'])('Scenario: Real guard verifies %s before administrative access', async role => {
    const verifyToken = jest.fn().mockResolvedValue({ isValid: true, user: { id: 'u', username: 'u', role, displayName: 'U', avatarDataUri: null } });
    const guard = new AuthGuard({ verifyToken } as unknown as AuthService);
    const service = { list: jest.fn().mockResolvedValue([]) };
    const routes = new ModbusRoutes(service as unknown as ModbusService);
    const request = Object.assign(new EventEmitter(), { url: '/api/v1/modbus/connections?homeId=h', headers: role === 'anonymous' ? {} : { authorization: 'Bearer simulated-session' } }) as HomePilotRequest;
    const res = Object.assign(new EventEmitter(), { writeHead: jest.fn(), end: jest.fn() });
    res.writeHead.mockReturnValue(res);
    await routes.handle(request, res as unknown as ServerResponse, '/api/v1/modbus/connections', 'GET', { guards: { authGuard: guard } } as unknown as BootstrapContainer);
    if (role === 'admin') expect(service.list).toHaveBeenCalledWith('u', 'h');
    else { expect(service.list).not.toHaveBeenCalled(); expect(res.writeHead.mock.calls[0][0]).toBe(role === 'anonymous' ? 401 : 403); }
    if (role !== 'anonymous') expect(verifyToken).toHaveBeenCalledWith('simulated-session');
  });
});

describe('Feature: Admin-only native Modbus routes (AC2)', () => {
  const service = { list: jest.fn(), saveConnection: jest.fn(), saveVariable: jest.fn(), probe: jest.fn(), deleteConnection: jest.fn(), deleteVariable: jest.fn() };
  const routes = new ModbusRoutes(service as unknown as ModbusService);
  const protect = jest.fn();
  const container = { guards: { authGuard: { protect } } } as unknown as BootstrapContainer;
  const req = (url: string, body?: unknown): HomePilotRequest => Object.assign(new EventEmitter(), { url, headers: {}, user: { id: 'admin', role: 'admin' }, _fastifyParsedBody: body === undefined ? undefined : JSON.stringify(body) }) as HomePilotRequest;
  const response = () => Object.assign(new EventEmitter(), { writeHead: jest.fn(), end: jest.fn(), writableEnded: false });
  beforeEach(() => { jest.resetAllMocks(); protect.mockResolvedValue(true); service.list.mockResolvedValue([]); service.saveConnection.mockResolvedValue({ enabled: false }); service.saveVariable.mockResolvedValue({ writable: false }); });
  it.each(['GET', 'POST', 'PUT', 'DELETE'])('Scenario: Given non-Admin access When %s requests config Then the Admin guard blocks the service', async method => {
    protect.mockResolvedValue(false); const res = response();
    await routes.handle(req('/api/v1/modbus/connections?homeId=h'), res as unknown as ServerResponse, '/api/v1/modbus/connections', method, container);
    expect(protect).toHaveBeenCalledWith(expect.anything(), expect.anything(), true); expect(service.list).not.toHaveBeenCalled(); expect(service.saveConnection).not.toHaveBeenCalled();
    expect(service.deleteConnection).not.toHaveBeenCalled(); expect(service.deleteVariable).not.toHaveBeenCalled();
  });
  it('Scenario: Given an Admin When listing Then actor and home are forwarded for ownership validation', async () => {
    const res = response(); await routes.handle(req('/api/v1/modbus/connections?homeId=h'), res as unknown as ServerResponse, '/api/v1/modbus/connections', 'GET', container);
    expect(service.list).toHaveBeenCalledWith('admin', 'h'); expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({ connections: [] });
  });
  it('Scenario: DELETE forwards the authenticated actor and actual mapping (AC18)', async () => {
    const res = response();
    await routes.handle(req('/api/v1/modbus/connections/c/variables/v'), res as unknown as ServerResponse, '/api/v1/modbus/connections/c/variables/v', 'DELETE', container);
    expect(service.deleteVariable).toHaveBeenCalledWith('admin', 'c', 'v');
    await routes.handle(req('/api/v1/modbus/connections/c'), response() as unknown as ServerResponse, '/api/v1/modbus/connections/c', 'DELETE', container);
    expect(service.deleteConnection).toHaveBeenCalledWith('admin', 'c');
  });
  it('Scenario: Linked variable deletion returns a safe conflict (AC18)', async () => {
    service.deleteVariable.mockRejectedValue(new ModbusError('IN_USE', 'private references'));
    const res = response();
    await routes.handle(req('/api/v1/modbus/connections/c/variables/v'), res as unknown as ServerResponse, '/api/v1/modbus/connections/c/variables/v', 'DELETE', container);
    expect(res.writeHead.mock.calls[0][0]).toBe(409); expect(res.end.mock.calls[0][0]).not.toContain('private references');
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
  it('Scenario: Given a read test When posted Then Admin and home are checked and only probe runs', async () => {
    const body = { homeId: 'h', host: '192.168.1.5', area: 'holding_register', start: 100, end: 120 }, res = response();
    service.probe.mockResolvedValue({ rows: [] });
    await routes.handle(req('/api/v1/modbus/probe', body), res as unknown as ServerResponse, '/api/v1/modbus/probe', 'POST', container);
    expect(protect).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
    expect(service.probe).toHaveBeenCalledWith('admin', 'h', body, expect.any(AbortSignal));
    expect(service.saveConnection).not.toHaveBeenCalled(); expect(service.saveVariable).not.toHaveBeenCalled();
  });
  it('Scenario: Given a closed client When probing Then read cancellation is forwarded and listeners cleaned', async () => {
    const request = req('/api/v1/modbus/probe', { homeId: 'h' }), res = response();
    service.probe.mockImplementation(async (_user, _home, _body, signal: AbortSignal) => { res.emit('close'); expect(signal.aborted).toBe(true); return { rows: [] }; });
    await routes.handle(request, res as unknown as ServerResponse, '/api/v1/modbus/probe', 'POST', container);
    expect(res.end).not.toHaveBeenCalled(); expect(res.listenerCount('close')).toBe(0); expect(request.listenerCount('aborted')).toBe(0);
  });
  it('Scenario: Given non-Admin When probing Then no read is attempted', async () => {
    protect.mockResolvedValue(false); const res = response();
    await routes.handle(req('/api/v1/modbus/probe', { homeId: 'h' }), res as unknown as ServerResponse, '/api/v1/modbus/probe', 'POST', container);
    expect(service.probe).not.toHaveBeenCalled();
  });
});
