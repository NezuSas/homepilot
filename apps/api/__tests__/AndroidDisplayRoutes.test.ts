import * as http from 'http';
import type { BootstrapContainer } from '../../../bootstrap';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';
import type { AndroidDisplayService } from '../../../packages/integrations/android-display/application/AndroidDisplayService';
import { AndroidDisplayServiceError } from '../../../packages/integrations/android-display/application/AndroidDisplayService';
import { AndroidDisplayBridgeError } from '../../../packages/integrations/android-display/application/AndroidDisplayBridgePort';
import { AndroidDisplayRoutes } from '../routes/AndroidDisplayRoutes';

const display = { deviceId: '11111111-1111-4111-8111-111111111111', homeId: 'home-1',
  adbHost: '192.168.1.37', adbPort: 5555, connectionState: 'online', metadata: { screenState: 'asleep' } };

function response() {
  const res = { writeHead: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis() };
  return res as unknown as http.ServerResponse & typeof res;
}

function request(body?: object, url = '/api/v1/android-displays'): HomePilotRequest {
  return { url, _fastifyParsedBody: JSON.stringify(body ?? {}),
    user: { id: 'user-1', username: 'admin', role: 'admin', displayName: null, avatarDataUri: null },
    headers: {}, } as HomePilotRequest;
}

describe('AndroidDisplayRoutes', () => {
  const service = {
    test: jest.fn().mockResolvedValue({ connectionState: 'online', metadata: display.metadata }),
    adopt: jest.fn().mockResolvedValue(display), list: jest.fn().mockReturnValue([display]),
    get: jest.fn().mockReturnValue(display), refresh: jest.fn().mockResolvedValue(display),
  };
  const guards = { protect: jest.fn().mockResolvedValue(true), requireRole: jest.fn().mockReturnValue(true) };
  const homes = { findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]) };
  const container = { guards: { authGuard: guards }, repositories: { homeRepository: homes } } as unknown as BootstrapContainer;
  const routes = new AndroidDisplayRoutes(service as unknown as AndroidDisplayService);

  beforeEach(() => { jest.clearAllMocks(); guards.protect.mockResolvedValue(true);
    guards.requireRole.mockReturnValue(true); homes.findHomesByUserId.mockResolvedValue([{ id: 'home-1' }]); });

  it('restricts adoption to an authenticated administrator who owns the home', async () => {
    const payload = { homeId: 'home-1', name: 'Pizarra', host: '192.168.1.37', port: 5555 };
    const res = response();
    await routes.handle(request(payload), res, '/api/v1/android-displays', 'POST', container);
    expect(service.adopt).toHaveBeenCalledWith(payload);
    expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));

    homes.findHomesByUserId.mockResolvedValueOnce([{ id: 'other-home' }]);
    const foreign = response();
    await routes.handle(request(payload), foreign, '/api/v1/android-displays', 'POST', container);
    expect(foreign.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(service.adopt).toHaveBeenCalledTimes(1);
  });

  it('rejects client-supplied bridge URL and raw shell in adoption payload', async () => {
    const res = response();
    await routes.handle(request({ homeId: 'home-1', name: 'Pizarra', host: '192.168.1.37',
      bridgeUrl: 'http://attacker', shell: 'input keyevent 26' }), res,
    '/api/v1/android-displays', 'POST', container);
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(service.adopt).not.toHaveBeenCalled();
  });

  it('lists and refreshes only displays in the owned home', async () => {
    const listed = response();
    await routes.handle(request({}, '/api/v1/android-displays?homeId=home-1'), listed,
      '/api/v1/android-displays', 'GET', container);
    expect(service.list).toHaveBeenCalledWith('home-1');
    const refreshed = response();
    await routes.handle(request(), refreshed,
      `/api/v1/android-displays/${display.deviceId}/refresh`, 'POST', container);
    expect(service.refresh).toHaveBeenCalledWith(display.deviceId);
    homes.findHomesByUserId.mockResolvedValueOnce([{ id: 'other-home' }]);
    const denied = response();
    await routes.handle(request(), denied, `/api/v1/android-displays/${display.deviceId}`, 'GET', container);
    expect(denied.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
  });

  it('tests only endpoints for an owned home without persisting them', async () => {
    const body = { homeId: 'home-1', host: '192.168.1.37', port: 5555 };
    const res = response();
    await routes.handle(request(body), res, '/api/v1/android-displays/test', 'POST', container);
    expect(service.test).toHaveBeenCalledWith({ host: body.host, port: 5555 });
    expect(service.adopt).not.toHaveBeenCalled();
    homes.findHomesByUserId.mockResolvedValueOnce([{ id: 'other-home' }]);
    const denied = response();
    await routes.handle(request(body), denied, '/api/v1/android-displays/test', 'POST', container);
    expect(denied.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
  });

  it('does not call the bridge when authentication fails', async () => {
    guards.protect.mockResolvedValueOnce(false);
    const res = response();
    await routes.handle(request({ homeId: 'home-1', host: '192.168.1.37' }), res, '/api/v1/android-displays/test', 'POST', container);
    expect(service.test).not.toHaveBeenCalled();
  });

  it('requires the administrative role and reports an authorization-pending display safely', async () => {
    guards.requireRole.mockReturnValueOnce(false);
    await routes.handle(request({ homeId: 'home-1', host: '192.168.1.37' }), response(),
      '/api/v1/android-displays/test', 'POST', container);
    expect(service.test).not.toHaveBeenCalled();
    service.adopt.mockRejectedValueOnce(new AndroidDisplayServiceError('DISPLAY_NEEDS_AUTHORIZATION'));
    const res = response();
    await routes.handle(request({ homeId: 'home-1', name: 'Pizarra', host: '192.168.1.37' }), res,
      '/api/v1/android-displays', 'POST', container);
    expect(res.writeHead).toHaveBeenCalledWith(409, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('DISPLAY_NEEDS_AUTHORIZATION'));
  });

  it('does not mislabel a rejected internal bridge token as a user-session error', async () => {
    service.test.mockRejectedValueOnce(new AndroidDisplayBridgeError('UNAUTHORIZED'));
    const res = response();
    await routes.handle(request({ homeId: 'home-1', host: '192.168.1.37' }), res,
      '/api/v1/android-displays/test', 'POST', container);
    expect(res.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('BRIDGE_UNAVAILABLE'));
  });
});
