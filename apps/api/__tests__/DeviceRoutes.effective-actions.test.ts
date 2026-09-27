import * as http from 'http';
import type { BootstrapContainer } from '../../../bootstrap';
import type { Device } from '../../../packages/devices/domain/types';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';
import { ForbiddenOwnershipError } from '../../../packages/devices/application/errors';
import { executeDeviceCommandUseCase } from '../../../packages/devices/application/executeDeviceCommandUseCase';
import { DeviceRoutes } from '../routes/DeviceRoutes';

jest.mock('../../../packages/devices/application/executeDeviceCommandUseCase', () => ({
  executeDeviceCommandUseCase: jest.fn().mockResolvedValue(undefined),
}));

const display = {
  id: 'display-1', homeId: 'home-1', roomId: null, externalId: 'android:display-1',
  name: 'Pizarra', type: 'smart_display', semanticType: 'smart_display', vendor: 'Droidlogic',
  status: 'ASSIGNED', integrationSource: 'android-display', invertState: false,
  lastKnownState: { connectionState: 'online' }, entityVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
} as Device;

const allowed = { key: 'hp_navigate_home', displayName: 'Home', semanticAction: 'navigate_home',
  controlType: 'button', visibility: 'visible', safetyLevel: 'low', requiresConfirmation: false };

function response() {
  const res = { setHeader: jest.fn(), writeHead: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis() };
  return res as unknown as http.ServerResponse & typeof res;
}

function request(command?: unknown): HomePilotRequest {
  return { headers: {}, user: { id: 'owner-1' },
    _fastifyParsedBody: JSON.stringify({ command }) } as HomePilotRequest;
}

function containerFor(device: Device = display): BootstrapContainer {
  return {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } },
    repositories: { deviceRepository: { findDeviceById: jest.fn().mockResolvedValue(device) } },
    adapters: { topologyReferencePort: { validateHomeOwnership: jest.fn().mockResolvedValue(undefined) } },
    services: {
      effectiveActionsProvider: { getForDeviceId: jest.fn().mockResolvedValue([allowed]) },
      homeAssistantSettingsService: { updateStatusFromOperation: jest.fn() },
    },
  } as unknown as BootstrapContainer;
}

describe('DeviceRoutes effective actions for Android displays', () => {
  const routes = new DeviceRoutes();
  beforeEach(() => jest.clearAllMocks());

  it('requires authentication before consulting the provider', async () => {
    const container = containerFor();
    (container.guards.authGuard.protect as jest.Mock).mockResolvedValue(false);
    await routes.handle(request(), response(), '/api/v1/devices/display-1/effective-actions', 'GET', container);
    expect(container.services.effectiveActionsProvider.getForDeviceId).not.toHaveBeenCalled();
  });

  it('requires home ownership and returns only safe presentation fields', async () => {
    const container = containerFor();
    const res = response();
    await routes.handle(request(), res, '/api/v1/devices/display-1/effective-actions', 'GET', container);
    expect(container.adapters.topologyReferencePort.validateHomeOwnership).toHaveBeenCalledWith('home-1', 'owner-1');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ deviceId: 'display-1', actions: [{
      semanticAction: 'navigate_home', controlType: 'button', visibility: 'visible',
      safetyLevel: 'low', requiresConfirmation: false,
    }] }));

    (container.adapters.topologyReferencePort.validateHomeOwnership as jest.Mock)
      .mockRejectedValueOnce(new ForbiddenOwnershipError('Forbidden'));
    const denied = response();
    await routes.handle(request(), denied, '/api/v1/devices/display-1/effective-actions', 'GET', container);
    expect(denied.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(container.services.effectiveActionsProvider.getForDeviceId).toHaveBeenCalledTimes(1);
  });

  it('denies unavailable display commands before physical dispatch', async () => {
    const container = containerFor();
    const res = response();
    await routes.handle(request('navigate_back'), res, '/api/v1/devices/display-1/command', 'POST', container);
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(executeDeviceCommandUseCase).not.toHaveBeenCalled();
  });

  it('returns an empty list and denies execution when no actions are effective', async () => {
    const container = containerFor();
    (container.services.effectiveActionsProvider.getForDeviceId as jest.Mock).mockResolvedValue([]);
    const listed = response();
    await routes.handle(request(), listed, '/api/v1/devices/display-1/effective-actions', 'GET', container);
    expect(listed.end).toHaveBeenCalledWith(JSON.stringify({ deviceId: 'display-1', actions: [] }));
    const denied = response();
    await routes.handle(request('navigate_home'), denied, '/api/v1/devices/display-1/command', 'POST', container);
    expect(denied.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(executeDeviceCommandUseCase).not.toHaveBeenCalled();
  });

  it('passes effective commands through the existing execution pipeline', async () => {
    const container = containerFor();
    await routes.handle(request('navigate_home'), response(), '/api/v1/devices/display-1/command', 'POST', container);
    expect(executeDeviceCommandUseCase).toHaveBeenCalledWith('display-1', 'navigate_home',
      'owner-1', expect.any(String), expect.any(Object), expect.any(Object));
  });

  it('keeps volume parameters in the existing command contract', async () => {
    const container = containerFor();
    (container.services.effectiveActionsProvider.getForDeviceId as jest.Mock).mockResolvedValue([
      { ...allowed, semanticAction: 'volume_set', controlType: 'slider' },
    ]);
    await routes.handle(request({ name: 'volume_set', params: { volume: 70 } }), response(),
      '/api/v1/devices/display-1/command', 'POST', container);
    expect(executeDeviceCommandUseCase).toHaveBeenCalledWith('display-1',
      { name: 'volume_set', params: { volume: 70 } }, 'owner-1',
      expect.any(String), expect.any(Object), expect.any(Object));
  });

  it('does not consult commercial actions for another device type', async () => {
    const container = containerFor({ ...display, type: 'light', integrationSource: 'home-assistant' });
    await routes.handle(request('turn_on'), response(), '/api/v1/devices/display-1/command', 'POST', container);
    expect(container.services.effectiveActionsProvider.getForDeviceId).not.toHaveBeenCalled();
    expect(executeDeviceCommandUseCase).toHaveBeenCalled();
  });

  it('does not bypass the gate if an Android display has inconsistent type metadata', async () => {
    const container = containerFor({ ...display, type: 'unknown' });
    await routes.handle(request('navigate_back'), response(), '/api/v1/devices/display-1/command', 'POST', container);
    expect(container.services.effectiveActionsProvider.getForDeviceId).toHaveBeenCalledWith('display-1');
    expect(executeDeviceCommandUseCase).not.toHaveBeenCalled();
  });
});
