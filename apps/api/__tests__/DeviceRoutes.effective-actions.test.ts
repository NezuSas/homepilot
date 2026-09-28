import * as http from 'http';
import type { BootstrapContainer } from '../../../bootstrap';
import type { Device } from '../../../packages/devices/domain/types';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';
import { ForbiddenOwnershipError } from '../../../packages/devices/application/errors';
import { executeDeviceCommandUseCase } from '../../../packages/devices/application/executeDeviceCommandUseCase';
import { IntentFlowCommandError } from '../../../packages/cloud-gateway/infrastructure/IntentFlowCommandClient';
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
  controlType: 'button', visibility: 'visible', safetyLevel: 'normal', requiresConfirmation: false };
const localCommand = { ...allowed, executionRoute: 'homepilot', executableInHomePilot: true,
  dashboardEligible: true };
const remoteCommand = { key: 'go_home', displayName: 'Home', implementationType: 'legacy_adb',
  controlType: 'button', visibility: 'visible', safetyLevel: 'normal', requiresConfirmation: false,
  executionRoute: 'intentflow', executableInHomePilot: true, dashboardEligible: true };

function response() {
  const res = { setHeader: jest.fn(), writeHead: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis() };
  return res as unknown as http.ServerResponse & typeof res;
}

function request(command?: unknown): HomePilotRequest {
  return { headers: {}, user: { id: 'owner-1' },
    _fastifyParsedBody: JSON.stringify({ command }) } as HomePilotRequest;
}

function actionRequest(body?: unknown): HomePilotRequest {
  return { headers: {}, user: { id: 'owner-1' },
    _fastifyParsedBody: body === undefined ? '' : JSON.stringify(body) } as HomePilotRequest;
}

function containerFor(device: Device = display): BootstrapContainer {
  return {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } },
    repositories: {
      deviceRepository: { findDeviceById: jest.fn().mockResolvedValue(device), findAllByHomeId: jest.fn().mockResolvedValue([device]) },
      homeRepository: { findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]) },
    },
    adapters: { topologyReferencePort: { validateHomeOwnership: jest.fn().mockResolvedValue(undefined) } },
    services: {
      effectiveActionsProvider: { getForDeviceId: jest.fn().mockResolvedValue([allowed]) },
      deviceControlCatalogProvider: {
        getForDevice: jest.fn().mockReturnValue({ deviceId: device.id, plan: { id: 2, name: 'Premium', type: 'PREMIUM' }, commands: [] }),
        resolveActionForDevice: jest.fn().mockImplementation((_device: Device, key: string) =>
          key === localCommand.key ? { boardId: 5, command: localCommand } : null),
        listDashboardActionsForDevices: jest.fn().mockReturnValue([]),
      },
      intentFlowCommandExecutionService: { execute: jest.fn().mockResolvedValue(undefined) },
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
      key: 'hp_navigate_home', displayName: 'Home', semanticAction: 'navigate_home',
      controlType: 'button', visibility: 'visible', safetyLevel: 'normal', requiresConfirmation: false,
    }] }));

    (container.adapters.topologyReferencePort.validateHomeOwnership as jest.Mock)
      .mockRejectedValueOnce(new ForbiddenOwnershipError('Forbidden'));
    const denied = response();
    await routes.handle(request(), denied, '/api/v1/devices/display-1/effective-actions', 'GET', container);
    expect(denied.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(container.services.effectiveActionsProvider.getForDeviceId).toHaveBeenCalledTimes(1);
  });

  it('protects the control catalog and the batch dashboard target list', async () => {
    const container = containerFor();
    const catalog = response();
    await routes.handle(request(), catalog, '/api/v1/devices/display-1/control-catalog', 'GET', container);
    expect(container.adapters.topologyReferencePort.validateHomeOwnership).toHaveBeenCalledWith('home-1', 'owner-1');
    expect(catalog.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(catalog.end).toHaveBeenCalledWith(JSON.stringify({
      deviceId: 'display-1', plan: { id: 2, name: 'Premium', type: 'PREMIUM' }, commands: [],
    }));

    (container.adapters.topologyReferencePort.validateHomeOwnership as jest.Mock)
      .mockRejectedValueOnce(new ForbiddenOwnershipError('Forbidden'));
    const denied = response();
    await routes.handle(request(), denied, '/api/v1/devices/display-1/control-catalog', 'GET', container);
    expect(denied.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(container.services.deviceControlCatalogProvider.getForDevice).toHaveBeenCalledTimes(1);

    await routes.handle(request(), response(), '/api/v1/dashboard-action-targets', 'GET', container);
    expect(container.services.deviceControlCatalogProvider.listDashboardActionsForDevices).toHaveBeenCalledWith([display]);
  });

  it('does not expose executionRoute or boardId in the catalog response', async () => {
    const container = containerFor();
    (container.services.deviceControlCatalogProvider.getForDevice as jest.Mock).mockReturnValue({
      deviceId: display.id, plan: { id: 2, name: 'Premium', type: 'PREMIUM' },
      commands: [remoteCommand],
    });
    const res = response();
    await routes.handle(request(), res, '/api/v1/devices/display-1/control-catalog', 'GET', container);
    const body = String((res.end as jest.Mock).mock.calls[0][0]);
    expect(body).toContain('go_home');
    expect(body).not.toContain('executionRoute');
    expect(body).not.toContain('boardId');
    expect(body).not.toContain('semanticAction');
  });

  it('does not read catalog or batch targets without authentication or an accessible home', async () => {
    const container = containerFor();
    (container.guards.authGuard.protect as jest.Mock).mockResolvedValueOnce(false);
    await routes.handle(request(), response(), '/api/v1/devices/display-1/control-catalog', 'GET', container);
    expect(container.services.deviceControlCatalogProvider.getForDevice).not.toHaveBeenCalled();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock).mockResolvedValueOnce([]);
    await routes.handle(request(), response(), '/api/v1/dashboard-action-targets', 'GET', container);
    expect(container.repositories.deviceRepository.findAllByHomeId).not.toHaveBeenCalled();
    expect(container.services.deviceControlCatalogProvider.listDashboardActionsForDevices).toHaveBeenCalledWith([]);
  });

  it.each([undefined, {}])('executes an effective action key with an empty body (%p)', async (body) => {
    const container = containerFor();
    const res = response();
    await routes.handle(actionRequest(body), res, '/api/v1/devices/display-1/actions/hp_navigate_home/execute', 'POST', container);
    expect(executeDeviceCommandUseCase).toHaveBeenCalledWith('display-1', 'navigate_home',
      'owner-1', expect.any(String), expect.any(Object), expect.any(Object));
    expect(container.services.intentFlowCommandExecutionService.execute).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it.each([
    { semanticAction: 'navigate_home' },
    { params: {} },
    null,
    [],
    'navigate_home',
    1,
  ])('rejects nonempty or nonobject action-key bodies (%p)', async (body) => {
    const container = containerFor();
    const res = response();
    await routes.handle(actionRequest(body), res,
      '/api/v1/devices/display-1/actions/hp_navigate_home/execute', 'POST', container);
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_COMMAND'));
    expect(executeDeviceCommandUseCase).not.toHaveBeenCalled();
  });

  it('rejects missing, slider and confirmation-required keys without dispatching', async () => {
    const container = containerFor();
    for (const [actionKey, command] of [
      ['revoked', null],
      ['hp_volume_set', { ...localCommand, key: 'hp_volume_set', controlType: 'slider', dashboardEligible: false }],
      ['hp_navigate_home', { ...localCommand, visibility: 'hidden', dashboardEligible: false }],
      ['hp_navigate_home', { ...localCommand, requiresConfirmation: true, dashboardEligible: false }],
    ] as const) {
      (container.services.deviceControlCatalogProvider.resolveActionForDevice as jest.Mock)
        .mockReturnValueOnce(command ? { boardId: 5, command } : null);
      const res = response();
      await routes.handle(request(), res, `/api/v1/devices/display-1/actions/${actionKey}/execute`, 'POST', container);
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    }
    expect(executeDeviceCommandUseCase).not.toHaveBeenCalled();
  });

  it('executes a remote button with the manifest boardId and never dispatches locally', async () => {
    const container = containerFor();
    (container.services.deviceControlCatalogProvider.resolveActionForDevice as jest.Mock)
      .mockReturnValue({ boardId: 5, command: remoteCommand });
    const res = response();
    await routes.handle(actionRequest(), res, '/api/v1/devices/display-1/actions/go_home/execute', 'POST', container);
    expect(container.services.intentFlowCommandExecutionService.execute).toHaveBeenCalledWith(5, 'go_home');
    expect(executeDeviceCommandUseCase).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('revalidates a saved remote target and blocks revocation before S2S', async () => {
    const container = containerFor();
    (container.services.deviceControlCatalogProvider.resolveActionForDevice as jest.Mock).mockReturnValue(null);
    const res = response();
    await routes.handle(actionRequest(), res, '/api/v1/devices/display-1/actions/go_home/execute', 'POST', container);
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(container.services.intentFlowCommandExecutionService.execute).not.toHaveBeenCalled();
  });

  it.each([
    ['INTENTFLOW_COMMAND_FORBIDDEN', 403],
    ['INTENTFLOW_COMMAND_CONFIRMATION_REQUIRED', 409],
    ['INTENTFLOW_COMMAND_ROUTE_MISMATCH', 502],
    ['INTENTFLOW_COMMAND_EXECUTION_FAILED', 502],
  ] as const)('never falls back to local execution after remote failure %s', async (code, status) => {
    const container = containerFor();
    (container.services.deviceControlCatalogProvider.resolveActionForDevice as jest.Mock)
      .mockReturnValue({ boardId: 5, command: remoteCommand });
    (container.services.intentFlowCommandExecutionService.execute as jest.Mock)
      .mockRejectedValue(new IntentFlowCommandError(code));
    const res = response();
    await routes.handle(actionRequest(), res, '/api/v1/devices/display-1/actions/go_home/execute', 'POST', container);
    expect(res.writeHead).toHaveBeenCalledWith(status, expect.any(Object));
    expect(executeDeviceCommandUseCase).not.toHaveBeenCalled();
  });

  it('rejects foreign ownership and arbitrary client command parameters on action-key execution', async () => {
    const container = containerFor();
    (container.adapters.topologyReferencePort.validateHomeOwnership as jest.Mock)
      .mockRejectedValueOnce(new ForbiddenOwnershipError('Forbidden'));
    const foreign = response();
    await routes.handle(request(), foreign, '/api/v1/devices/display-1/actions/hp_navigate_home/execute', 'POST', container);
    expect(foreign.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    const supplied = response();
    await routes.handle(request({ semanticAction: 'navigate_back' }), supplied,
      '/api/v1/devices/display-1/actions/hp_navigate_home/execute', 'POST', container);
    expect(supplied.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(executeDeviceCommandUseCase).not.toHaveBeenCalled();
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
