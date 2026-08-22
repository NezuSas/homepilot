import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { Device } from '../../../packages/devices/domain/types';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { DeviceRoutes } from '../routes/DeviceRoutes';
import { ForbiddenOwnershipError } from '../../../packages/devices/application/errors';

const device: Device = {
  id: 'device-1', homeId: 'home-1', roomId: null, externalId: 'edge:device-1', name: 'Sensor', type: 'sensor', vendor: 'Edge', status: 'PENDING', integrationSource: 'native', invertState: false, lastKnownState: null, entityVersion: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

const response = () => ({ writeHead: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis() }) as unknown as http.ServerResponse;

function containerFor(stored: Device = device): BootstrapContainer {
  return {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true), requireRole: jest.fn().mockReturnValue(true) } },
    repositories: {
      deviceRepository: { findDeviceById: jest.fn().mockResolvedValue(stored), saveDevice: jest.fn().mockResolvedValue(undefined) },
      activityLogRepository: { saveActivity: jest.fn().mockResolvedValue(undefined), findRecentByDeviceId: jest.fn().mockResolvedValue([]) },
      homeRepository: { findHomeById: jest.fn().mockResolvedValue({ id: 'home-1', ownerId: 'owner-1' }), findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]) },
      roomRepository: { findRoomById: jest.fn() },
    },
    adapters: {
      deviceEventPublisher: { publish: jest.fn().mockResolvedValue(undefined) },
      topologyReferencePort: {
        validateHomeExists: jest.fn().mockResolvedValue(undefined),
        validateHomeOwnership: jest.fn(async (_homeId: string, userId: string) => {
          if (userId !== 'owner-1') throw new ForbiddenOwnershipError('Forbidden access to home home-1');
        }),
        validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined),
      },
    },
    services: {
      homeAssistantSettingsService: { updateStatusFromOperation: jest.fn() },
    },
  } as unknown as BootstrapContainer;
}

describe('DeviceRoutes state sync', () => {
  const routes = new DeviceRoutes();
  const previousKey = process.env.HOMEPILOT_INTEGRATION_API_KEY;

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.HOMEPILOT_INTEGRATION_API_KEY;
      return;
    }
    process.env.HOMEPILOT_INTEGRATION_API_KEY = previousKey;
  });

  it('rejects anonymous state synchronization', async () => {
    process.env.HOMEPILOT_INTEGRATION_API_KEY = 'edge-secret';
    const res = response();
    await routes.handle({ headers: {}, _fastifyParsedBody: JSON.stringify({ deviceId: device.id, state: { power: 'on' } }) } as unknown as HomePilotRequest, res, '/api/v1/integrations/state-sync', 'POST', containerFor());
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
  });

  it('persists a state update authenticated with the integration key', async () => {
    process.env.HOMEPILOT_INTEGRATION_API_KEY = 'edge-secret';
    const container = containerFor();
    const res = response();
    await routes.handle({ headers: { 'x-homepilot-integration-key': 'edge-secret' }, _fastifyParsedBody: JSON.stringify({ deviceId: device.id, state: { power: 'on' } }) } as unknown as HomePilotRequest, res, '/api/v1/integrations/state-sync', 'POST', container);
    expect(container.repositories.deviceRepository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({ lastKnownState: { power: 'on' }, entityVersion: 2 }));
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('reads state only for the owning user', async () => {
    const res = response();
    await routes.handle({ headers: {}, user: { id: 'owner-1' } } as unknown as HomePilotRequest, res, '/api/v1/devices/device-1/state', 'GET', containerFor({ ...device, lastKnownState: { power: 'on' } }));
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ power: 'on' }));
  });
  it('rejects malformed state synchronization payloads before persistence', async () => {
    process.env.HOMEPILOT_INTEGRATION_API_KEY = 'edge-secret';
    const container = containerFor();
    const res = response();

    await routes.handle({ headers: { 'x-homepilot-integration-key': 'edge-secret' }, _fastifyParsedBody: JSON.stringify({ deviceId: 'device-1', state: [] }) } as unknown as HomePilotRequest, res, '/api/v1/integrations/state-sync', 'POST', container);

    expect(container.repositories.deviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
  });

  it('accepts an integration key supplied by a repeated header value', async () => {
    process.env.HOMEPILOT_INTEGRATION_API_KEY = 'edge-secret';
    const container = containerFor();
    const res = response();

    await routes.handle({ headers: { 'x-homepilot-integration-key': ['edge-secret', 'ignored'] }, _fastifyParsedBody: JSON.stringify({ deviceId: device.id, state: { power: 'off' } }) } as unknown as HomePilotRequest, res, '/api/v1/integrations/state-sync', 'POST', container);

    expect(container.repositories.deviceRepository.saveDevice).toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('rejects a supplied integration key when this installation has no configured key', async () => {
    delete process.env.HOMEPILOT_INTEGRATION_API_KEY;
    const container = containerFor();
    const res = response();

    await routes.handle({ headers: { 'x-homepilot-integration-key': 'untrusted' }, _fastifyParsedBody: JSON.stringify({ deviceId: device.id, state: { power: 'on' } }) } as unknown as HomePilotRequest, res, '/api/v1/integrations/state-sync', 'POST', container);

    expect(container.repositories.deviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
  });

  it('maps an unknown state-sync device to the stable not-found contract', async () => {
    process.env.HOMEPILOT_INTEGRATION_API_KEY = 'edge-secret';
    const container = containerFor();
    (container.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue(null);
    const res = response();

    await routes.handle({ headers: { 'x-homepilot-integration-key': 'edge-secret' }, _fastifyParsedBody: JSON.stringify({ deviceId: 'missing-device', state: { power: 'on' } }) } as unknown as HomePilotRequest, res, '/api/v1/integrations/state-sync', 'POST', container);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('DEVICE_NOT_FOUND'));
  });});

describe('Feature: Device discovery M2M boundary', () => {
  const routes = new DeviceRoutes();
  const previousKey = process.env.HOMEPILOT_INTEGRATION_API_KEY;
  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.HOMEPILOT_INTEGRATION_API_KEY;
      return;
    }
    process.env.HOMEPILOT_INTEGRATION_API_KEY = previousKey;
  });

  it('Scenario: Given no integration key When a gateway reports discovery Then it is rejected', async () => {
    process.env.HOMEPILOT_INTEGRATION_API_KEY = 'edge-secret';
    const res = response();
    await routes.handle({ headers: {}, _fastifyParsedBody: JSON.stringify({ homeId: 'home-1', externalId: 'edge:2', name: 'Sensor', type: 'sensor', vendor: 'Edge' }) } as unknown as HomePilotRequest, res, '/api/v1/integrations/discovery', 'POST', containerFor());
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
  });

  it('Scenario: Given a valid gateway payload When discovery is accepted Then it persists a pending device with 201', async () => {
    process.env.HOMEPILOT_INTEGRATION_API_KEY = 'edge-secret';
    const container = containerFor();
    container.repositories.deviceRepository.findByExternalIdAndHomeId = jest.fn().mockResolvedValue(null);
    const res = response();
    await routes.handle({ headers: { 'x-homepilot-integration-key': 'edge-secret' }, _fastifyParsedBody: JSON.stringify({ homeId: 'home-1', externalId: 'edge:2', name: 'Sensor', type: 'sensor', vendor: 'Edge' }) } as unknown as HomePilotRequest, res, '/api/v1/integrations/discovery', 'POST', container);
    expect(container.repositories.deviceRepository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING', roomId: null, externalId: 'edge:2' }));
    expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
  });
  it('Scenario: Given a duplicate external identifier When discovery is reported again Then it returns 409 without persisting', async () => {
    process.env.HOMEPILOT_INTEGRATION_API_KEY = 'edge-secret';
    const container = containerFor();
    container.repositories.deviceRepository.findByExternalIdAndHomeId = jest.fn().mockResolvedValue(device);
    const res = response();

    await routes.handle({ headers: { 'x-homepilot-integration-key': 'edge-secret' }, _fastifyParsedBody: JSON.stringify({ homeId: 'home-1', externalId: device.externalId, name: 'Sensor', type: 'sensor', vendor: 'Edge' }) } as unknown as HomePilotRequest, res, '/api/v1/integrations/discovery', 'POST', container);

    expect(container.repositories.deviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(409, expect.any(Object));
  });
  it('Scenario: Given an admin from another home When assigning a pending device Then it returns 403 without saving', async () => {
    const container = containerFor();
    const res = response();

    await routes.handle({ headers: {}, user: { id: 'other-admin' }, _fastifyParsedBody: JSON.stringify({ roomId: 'room-1' }) } as unknown as HomePilotRequest, res, '/api/v1/devices/device-1/assign', 'POST', container);

    expect(container.repositories.deviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
  });
});

describe('Feature: Device command route contract', () => {
  const routes = new DeviceRoutes();
  const commandDevice: Device = {
    ...device,
    id: 'light-1',
    type: 'light',
    status: 'ASSIGNED',
    capabilities: [],
  };

  const commandRequest = (body: unknown, userId = 'owner-1') => ({
    headers: {},
    user: { id: userId },
    _fastifyParsedBody: JSON.stringify(body),
  }) as unknown as HomePilotRequest;

  const commandContainer = (): BootstrapContainer => ({
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true), requireRole: jest.fn().mockReturnValue(true) } },
    repositories: {
      deviceRepository: { findDeviceById: jest.fn().mockResolvedValue(commandDevice) },
      activityLogRepository: { saveActivity: jest.fn().mockResolvedValue(undefined) },
    },
    adapters: {
      deviceEventPublisher: { publish: jest.fn().mockResolvedValue(undefined) },
      commandDispatcher: { dispatch: jest.fn().mockResolvedValue(undefined) },
      topologyReferencePort: {
        validateHomeOwnership: jest.fn(async (_homeId: string, userId: string) => {
          if (userId !== 'owner-1') throw new ForbiddenOwnershipError('Forbidden access to home home-1');
        }),
      },
    },
    services: { homeAssistantSettingsService: { updateStatusFromOperation: jest.fn() } },
  }) as unknown as BootstrapContainer;

  it('rejects missing or unsupported commands before dispatching a device command', async () => {
    const container = commandContainer();
    const missingResponse = response();
    const invalidResponse = response();

    await routes.handle(commandRequest({}), missingResponse, '/api/v1/devices/light-1/command', 'POST', container);
    await routes.handle(commandRequest({ command: 'launch_missiles' }), invalidResponse, '/api/v1/devices/light-1/command', 'POST', container);

    expect(container.adapters.commandDispatcher.dispatch).not.toHaveBeenCalled();
    expect(missingResponse.end).toHaveBeenCalledWith(expect.stringContaining('Missing command'));
    expect(invalidResponse.end).toHaveBeenCalledWith(expect.stringContaining('Invalid command'));
  });

  it('dispatches a valid parameterized command and reports bridge reachability', async () => {
    const container = commandContainer();
    const res = response();

    await routes.handle(
      commandRequest({ command: { name: 'turn_on', params: { brightness_pct: 50 } } }),
      res,
      '/api/v1/devices/light-1/command',
      'POST',
      container,
    );

    expect(container.adapters.commandDispatcher.dispatch).toHaveBeenCalledWith(
      'light-1',
      { name: 'turn_on', params: { brightness_pct: 50 } },
    );
    expect(container.services.homeAssistantSettingsService.updateStatusFromOperation).toHaveBeenCalledWith('reachable');
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('rejects a command on a device owned by another home without dispatching it', async () => {
    const container = commandContainer();
    const res = response();

    await routes.handle(
      commandRequest({ command: 'turn_off' }, 'other-admin'),
      res,
      '/api/v1/devices/light-1/command',
      'POST',
      container,
    );

    expect(container.adapters.commandDispatcher.dispatch).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('FORBIDDEN'));
  });

  it('marks the bridge unreachable when a Home Assistant command dispatch fails', async () => {
    const container = commandContainer();
    container.adapters.commandDispatcher.dispatch = jest.fn().mockRejectedValue(new Error('Home Assistant fetch failed'));
    const res = response();

    await routes.handle(commandRequest({ command: 'turn_off' }), res, '/api/v1/devices/light-1/command', 'POST', container);

    expect(container.services.homeAssistantSettingsService.updateStatusFromOperation).toHaveBeenCalledWith('unreachable');
    expect(res.writeHead).toHaveBeenCalledWith(502, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('COMMAND_DISPATCH_FAILED'));
  });
});

describe('Feature: Device read and update route contracts', () => {
  const routes = new DeviceRoutes();
  const request = (body?: unknown) => ({
    headers: {},
    user: { id: 'owner-1', role: 'admin' },
    _fastifyParsedBody: JSON.stringify(body ?? {}),
  }) as unknown as HomePilotRequest;

  it('rejects malformed discovery payloads without reaching persistence', async () => {
    process.env.HOMEPILOT_INTEGRATION_API_KEY = 'edge-secret';
    const container = containerFor() as any;
    const res = response();

    await routes.handle(
      { headers: { 'x-homepilot-integration-key': 'edge-secret' }, _fastifyParsedBody: JSON.stringify({ homeId: 'home-1', externalId: '', name: 'Sensor', type: 'sensor', vendor: 'Edge' }) } as unknown as HomePilotRequest,
      res,
      '/api/v1/integrations/discovery',
      'POST',
      container,
    );

    expect(container.repositories.deviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('VALIDATION_ERROR'));
    delete process.env.HOMEPILOT_INTEGRATION_API_KEY;
  });

  it('lists enriched devices and reports repository failures without leaking raw responses', async () => {
    const listContainer = containerFor() as any;
    listContainer.repositories.deviceRepository.findAllOrderedByStatus = jest.fn().mockResolvedValue([device]);
    const listResponse = response();
    await routes.handle(request(), listResponse, '/api/v1/devices', 'GET', listContainer);
    expect(listResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(listResponse.end).toHaveBeenCalledWith(expect.stringContaining('"profile"'));

    const failingContainer = containerFor() as any;
    failingContainer.repositories.deviceRepository.findAllOrderedByStatus = jest.fn().mockRejectedValue(new Error('db offline'));
    const errorResponse = response();
    await routes.handle(request(), errorResponse, '/api/v1/devices', 'GET', failingContainer);
    expect(errorResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(errorResponse.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));
  });

  it('returns DEVICE_NOT_FOUND for a missing device detail', async () => {
    const container = containerFor() as any;
    container.repositories.deviceRepository.findDeviceById.mockResolvedValue(null);
    const res = response();

    await routes.handle(request(), res, '/api/v1/devices/missing-device', 'GET', container);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('DEVICE_NOT_FOUND'));
  });

  it('returns activity records and maps activity repository failures to DB_ERROR', async () => {
    const successContainer = containerFor() as any;
    successContainer.repositories.activityLogRepository.findAllRecent = jest.fn().mockResolvedValue([{ id: 'activity-1' }]);
    const successResponse = response();
    await routes.handle(request(), successResponse, '/api/v1/activity-logs', 'GET', successContainer);
    expect(successResponse.end).toHaveBeenCalledWith(JSON.stringify([{ id: 'activity-1' }]));

    const failingContainer = containerFor() as any;
    failingContainer.repositories.activityLogRepository.findAllRecent = jest.fn().mockRejectedValue(new Error('audit offline'));
    const errorResponse = response();
    await routes.handle(request(), errorResponse, '/api/v1/activity-logs', 'GET', failingContainer);
    expect(errorResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(errorResponse.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));
  });

  it('returns the existing device without saving when a patch changes no supported fields', async () => {
    const container = containerFor({ ...device, status: 'ASSIGNED' }) as any;
    container.repositories.homeRepository.findHomesByUserId = jest.fn().mockResolvedValue([{ id: 'home-1' }]);
    const res = response();

    await routes.handle(request({}), res, '/api/v1/devices/device-1', 'PATCH', container);

    expect(container.repositories.deviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('"id":"device-1"'));
  });

  it('returns false after protected routing for unknown device paths', async () => {
    const res = response();

    const handled = await routes.handle(request(), res, '/api/v1/unmatched', 'GET', containerFor());

    expect(handled).toBe(false);
  });
});
describe('Feature: Home Assistant discovery and import route contracts', () => {
  const routes = new DeviceRoutes();
  const request = (url: string, body?: unknown) => ({
    url,
    headers: {},
    user: { id: 'owner-1', role: 'admin' },
    _fastifyParsedBody: JSON.stringify(body ?? {}),
  }) as unknown as HomePilotRequest;

  function haContainer(): BootstrapContainer {
    const container = containerFor() as unknown as {
      guards: { authGuard: { protect: jest.Mock; requireRole: jest.Mock } };
      repositories: Record<string, Record<string, jest.Mock>>;
      adapters: Record<string, Record<string, jest.Mock>>;
      services: Record<string, Record<string, jest.Mock>>;
    };
    container.repositories.deviceRepository.findAllExternalIdsByPrefix = jest.fn().mockResolvedValue(['ha:light.existing']);
    container.adapters.homeAssistantClient = { getAllStates: jest.fn() };
    container.services.homeAssistantSettingsService = { updateStatusFromOperation: jest.fn() };
    container.services.haImportService = { importDevice: jest.fn() };
    return container as unknown as BootstrapContainer;
  }

  it('returns only unimported supported entities in summary mode', async () => {
    const container = haContainer();
    (container.adapters.homeAssistantClient.getAllStates as jest.Mock).mockResolvedValue([
      { entity_id: 'light.existing', state: 'on', attributes: { friendly_name: 'Existing' } },
      { entity_id: 'light.office', state: 'off', attributes: { friendly_name: 'Office Light' } },
      { entity_id: 'unsupported.hidden', state: 'on', attributes: {} },
    ]);
    const res = response();

    await routes.handle(request('/api/v1/ha/entities?view=summary'), res, '/api/v1/ha/entities', 'GET', container);

    expect(container.services.homeAssistantSettingsService.updateStatusFromOperation).toHaveBeenCalledWith('reachable');
    const entities = JSON.parse((res.end as jest.Mock).mock.calls[0][0]) as Array<{ entityId: string; state?: string; profile: Record<string, unknown> }>;
    expect(entities).toEqual([expect.objectContaining({ entityId: 'light.office', profile: expect.objectContaining({ supportedCommandCount: expect.any(Number) }) })]);
    expect(entities[0]).not.toHaveProperty('state');
  });

  it('maps authentication failures from Home Assistant discovery and records the bridge state', async () => {
    const container = haContainer();
    (container.adapters.homeAssistantClient.getAllStates as jest.Mock).mockRejectedValue(new Error('401 auth_invalid'));
    const res = response();

    await routes.handle(request('/api/v1/ha/entities'), res, '/api/v1/ha/entities', 'GET', container);

    expect(container.services.homeAssistantSettingsService.updateStatusFromOperation).toHaveBeenCalledWith('auth_error');
    expect(res.writeHead).toHaveBeenCalledWith(502, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('HA_DISCOVERY_ERROR'));
  });

  it('imports a Home Assistant entity and exposes the enriched created device', async () => {
    const imported = { ...device, id: 'ha-light-1', externalId: 'ha:light.office', type: 'light', status: 'PENDING' as const };
    const container = haContainer();
    (container.services.haImportService.importDevice as jest.Mock).mockResolvedValue(imported);
    const res = response();

    await routes.handle(request('/api/v1/ha/import', { entityId: 'light.office', name: 'Office Light' }), res, '/api/v1/ha/import', 'POST', container);

    expect(container.services.haImportService.importDevice).toHaveBeenCalledWith('light.office', 'owner-1', 'Office Light');
    expect(container.services.homeAssistantSettingsService.updateStatusFromOperation).toHaveBeenCalledWith('reachable');
    expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
  });
});
describe('Feature: Device state, history, and semantic type contracts', () => {
  const routes = new DeviceRoutes();
  const request = (url: string, body?: unknown, userId = 'owner-1') => ({
    url,
    headers: {},
    user: { id: userId, role: 'admin' },
    _fastifyParsedBody: JSON.stringify(body ?? {}),
  }) as unknown as HomePilotRequest;

  it('maps absent device state and history requests to a stable not-found contract', async () => {
    const container = containerFor();
    const stateResponse = response();
    const historyResponse = response();
    (container.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue(null);

    await routes.handle(request('/api/v1/devices/missing/state'), stateResponse, '/api/v1/devices/missing/state', 'GET', container);
    await routes.handle(request('/api/v1/devices/missing/history'), historyResponse, '/api/v1/devices/missing/history', 'GET', container);

    expect(stateResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(stateResponse.end).toHaveBeenCalledWith(expect.stringContaining('DEVICE_NOT_FOUND'));
    expect(historyResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(historyResponse.end).toHaveBeenCalledWith(expect.stringContaining('DEVICE_NOT_FOUND'));
  });

  it('rejects invalid semantic type values before loading or modifying the device', async () => {
    const container = containerFor();
    const res = response();

    await routes.handle(
      request('/api/v1/devices/device-1/semantic-type', { semanticType: 'thermostat' }),
      res,
      '/api/v1/devices/device-1/semantic-type',
      'PATCH',
      container,
    );

    expect(container.repositories.deviceRepository.findDeviceById).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));
  });

  it('updates an owned device semantic type and returns its enriched response', async () => {
    const updatedDevice = { ...device, semanticType: 'light' as const };
    const container = containerFor();
    const res = response();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock) = jest.fn().mockResolvedValue([{ id: 'home-1' }]);
    (container.repositories.deviceRepository.updateSemanticType as jest.Mock) = jest.fn().mockResolvedValue(undefined);
    (container.repositories.deviceRepository.findDeviceById as jest.Mock)
      .mockResolvedValueOnce(device)
      .mockResolvedValueOnce(updatedDevice);

    await routes.handle(
      request('/api/v1/devices/device-1/semantic-type', { semanticType: 'light' }),
      res,
      '/api/v1/devices/device-1/semantic-type',
      'PATCH',
      container,
    );

    expect(container.repositories.deviceRepository.updateSemanticType).toHaveBeenCalledWith('device-1', 'light');
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('"semanticType":"light"'));
  });
});
describe('Feature: Device activity and import failure contracts', () => {
  const routes = new DeviceRoutes();
  const request = (url: string, body?: unknown) => ({
    url,
    headers: {},
    user: { id: 'owner-1', role: 'admin' },
    _fastifyParsedBody: JSON.stringify(body ?? {}),
  }) as unknown as HomePilotRequest;

  it('returns device activity and maps repository failures to DB_ERROR', async () => {
    const success = containerFor();
    const successResponse = response();
    await routes.handle(request('/api/v1/devices/device-1/activity-logs'), successResponse, '/api/v1/devices/device-1/activity-logs', 'GET', success);
    expect(success.repositories.activityLogRepository.findRecentByDeviceId).toHaveBeenCalledWith('device-1', 20);
    expect(successResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

    const failure = containerFor();
    (failure.repositories.activityLogRepository.findRecentByDeviceId as jest.Mock).mockRejectedValue(new Error('audit unavailable'));
    const failureResponse = response();
    await routes.handle(request('/api/v1/devices/device-1/activity-logs'), failureResponse, '/api/v1/devices/device-1/activity-logs', 'GET', failure);
    expect(failureResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(failureResponse.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));
  });

  it('maps Home Assistant import validation and missing entity errors to stable client contracts', async () => {
    const container = containerFor() as unknown as BootstrapContainer;
    const serviceDoubles = container.services as unknown as {
      haImportService: { importDevice: jest.Mock };
      homeAssistantSettingsService: { updateStatusFromOperation: jest.Mock };
    };
    serviceDoubles.haImportService = { importDevice: jest.fn().mockRejectedValue(new Error('HA_ENTITY_NOT_FOUND')) };
    serviceDoubles.homeAssistantSettingsService = { updateStatusFromOperation: jest.fn() };

    const missingEntity = response();
    await routes.handle(request('/api/v1/ha/import', { entityId: 'light.missing' }), missingEntity, '/api/v1/ha/import', 'POST', container);
    expect(missingEntity.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(missingEntity.end).toHaveBeenCalledWith(expect.stringContaining('HA_ENTITY_NOT_FOUND'));
    expect(container.services.homeAssistantSettingsService.updateStatusFromOperation).toHaveBeenCalledWith('unreachable');

    const invalid = response();
    await routes.handle(request('/api/v1/ha/import', {}), invalid, '/api/v1/ha/import', 'POST', container);
    expect(invalid.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(invalid.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));
  });
});
describe('Feature: device presentation update contract', () => {
  const routes = new DeviceRoutes();
  const request = (body: unknown) => ({
    headers: {},
    user: { id: 'owner-1', role: 'admin' },
    _fastifyParsedBody: JSON.stringify(body),
  }) as unknown as HomePilotRequest;

  it('persists a meaningful name and inversion update only for the owning installation', async () => {
    const container = containerFor();
    const serviceDoubles = container.repositories as unknown as {
      homeRepository: { findHomesByUserId: jest.Mock };
      deviceRepository: { saveDevice: jest.Mock };
    };
    serviceDoubles.homeRepository.findHomesByUserId = jest.fn().mockResolvedValue([{ id: 'home-1' }]);
    serviceDoubles.deviceRepository.saveDevice = jest.fn().mockResolvedValue(undefined);
    const res = response();

    await routes.handle(request({ name: 'Sensor patio', invertState: true }), res, '/api/v1/devices/device-1', 'PATCH', container);

    expect(serviceDoubles.deviceRepository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sensor patio', invertState: true, entityVersion: 2 }));
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('returns the existing device without persistence when no presentation field changes', async () => {
    const container = containerFor();
    const serviceDoubles = container.repositories as unknown as {
      homeRepository: { findHomesByUserId: jest.Mock };
      deviceRepository: { saveDevice: jest.Mock };
    };
    serviceDoubles.homeRepository.findHomesByUserId = jest.fn().mockResolvedValue([{ id: 'home-1' }]);
    serviceDoubles.deviceRepository.saveDevice = jest.fn();
    const res = response();

    await routes.handle(request({ name: 'Sensor', invertState: false }), res, '/api/v1/devices/device-1', 'PATCH', container);

    expect(serviceDoubles.deviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });
});
describe('Feature: Device metadata update contracts', () => {
  const routes = new DeviceRoutes();
  const request = (body: unknown, userId = 'owner-1') => ({
    headers: {},
    user: { id: userId, role: 'admin' },
    _fastifyParsedBody: JSON.stringify(body),
  }) as unknown as HomePilotRequest;

  it('returns the existing device without persisting when a metadata patch has no effective changes', async () => {
    const container = containerFor();
    const res = response();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock) = jest.fn().mockResolvedValue([{ id: 'home-1' }]);

    await routes.handle(request({}), res, '/api/v1/devices/device-1', 'PATCH', container);

    expect(container.repositories.deviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('\"name\":\"Sensor\"'));
  });

  it('persists trimmed names and explicit invert-state changes for an owned device', async () => {
    const container = containerFor();
    const res = response();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock) = jest.fn().mockResolvedValue([{ id: 'home-1' }]);

    await routes.handle(request({ name: '  Entrance Sensor  ', invertState: true }), res, '/api/v1/devices/device-1', 'PATCH', container);

    expect(container.repositories.deviceRepository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Entrance Sensor', invertState: true, entityVersion: 2,
    }));
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('rejects semantic and metadata updates outside the active home', async () => {
    const container = containerFor();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock) = jest.fn().mockResolvedValue([{ id: 'another-home' }]);
    (container.repositories.deviceRepository.updateSemanticType as jest.Mock) = jest.fn();

    const semanticResponse = response();
    await routes.handle(request({ semanticType: 'light' }), semanticResponse, '/api/v1/devices/device-1/semantic-type', 'PATCH', container);
    expect(container.repositories.deviceRepository.updateSemanticType).not.toHaveBeenCalled();
    expect(semanticResponse.writeHead).toHaveBeenCalledWith(403, expect.any(Object));

    const metadataResponse = response();
    await routes.handle(request({ name: 'No permission' }), metadataResponse, '/api/v1/devices/device-1', 'PATCH', container);
    expect(container.repositories.deviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(metadataResponse.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
  });
});
describe('Feature: Home Assistant discovery and import route contracts', () => {
  const routes = new DeviceRoutes();
  const haRequest = (url: string, body?: unknown) => ({
    url,
    headers: {},
    user: { id: 'owner-1', role: 'admin' },
    _fastifyParsedBody: JSON.stringify(body ?? {}),
  }) as unknown as HomePilotRequest;

  const haContainer = (): BootstrapContainer => {
    const container = containerFor() as any;
    container.repositories.deviceRepository.findAllExternalIdsByPrefix = jest.fn().mockResolvedValue(['ha:light.existing']);
    container.adapters.homeAssistantClient = {
      getAllStates: jest.fn().mockResolvedValue([
        { entity_id: 'light.existing', state: 'on', attributes: { friendly_name: 'Existing' } },
        { entity_id: 'light.kitchen', state: 'off', attributes: { friendly_name: 'Kitchen' } },
        { entity_id: 'unsupported.hidden', state: 'idle', attributes: {} },
      ]),
    };
    container.services.haImportService = { importDevice: jest.fn().mockResolvedValue({ ...device, externalId: 'ha:light.kitchen' }) };
    return container;
  };

  it('keeps HA discovery administrator-only and excludes existing or unsupported entities by default', async () => {
    const denied = haContainer();
    (denied.guards.authGuard.requireRole as jest.Mock).mockReturnValue(false);
    await routes.handle(haRequest('/api/v1/ha/entities'), response(), '/api/v1/ha/entities', 'GET', denied);
    expect(denied.adapters.homeAssistantClient.getAllStates).not.toHaveBeenCalled();

    const container = haContainer();
    const res = response();
    await routes.handle(haRequest('/api/v1/ha/entities'), res, '/api/v1/ha/entities', 'GET', container);
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('light.kitchen'));
    expect(res.end).not.toHaveBeenCalledWith(expect.stringContaining('light.existing'));
    expect(res.end).not.toHaveBeenCalledWith(expect.stringContaining('unsupported.hidden'));
  });

  it('exposes summary/all discovery intentionally and classifies Home Assistant communication failures', async () => {
    const successful = haContainer();
    const summary = response();
    await routes.handle(haRequest('/api/v1/ha/entities?mode=all&view=summary'), summary, '/api/v1/ha/entities', 'GET', successful);
    expect(summary.end).toHaveBeenCalledWith(expect.stringContaining('unsupported.hidden'));
    expect(summary.end).toHaveBeenCalledWith(expect.not.stringContaining('"attributes"'));

    const unavailable = haContainer();
    (unavailable.adapters.homeAssistantClient.getAllStates as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
    const unavailableResponse = response();
    await routes.handle(haRequest('/api/v1/ha/entities'), unavailableResponse, '/api/v1/ha/entities', 'GET', unavailable);
    expect(unavailable.services.homeAssistantSettingsService.updateStatusFromOperation).toHaveBeenCalledWith('unreachable');
    expect(unavailableResponse.end).toHaveBeenCalledWith(expect.stringContaining('HA_DISCOVERY_ERROR'));
  });

  it('validates import input and maps typed import outcomes without marking failed imports reachable', async () => {
    const missing = haContainer();
    const missingResponse = response();
    await routes.handle(haRequest('/api/v1/ha/import'), missingResponse, '/api/v1/ha/import', 'POST', missing);
    expect(missing.services.haImportService.importDevice).not.toHaveBeenCalled();
    expect(missingResponse.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));

    for (const [message, code] of [
      ['DEVICE_ALREADY_EXISTS', 'DEVICE_ALREADY_EXISTS'],
      ['HOME_NOT_FOUND', 'HOME_NOT_FOUND'],
      ['HA_ENTITY_NOT_FOUND', 'HA_ENTITY_NOT_FOUND'],
    ]) {
      const failing = haContainer();
      (failing.services.haImportService.importDevice as jest.Mock).mockRejectedValue(new Error(message));
      const failedResponse = response();
      await routes.handle(haRequest('/api/v1/ha/import', { entityId: 'light.kitchen' }), failedResponse, '/api/v1/ha/import', 'POST', failing);
      expect(failedResponse.end).toHaveBeenCalledWith(expect.stringContaining(code));
      expect(failing.services.homeAssistantSettingsService.updateStatusFromOperation).not.toHaveBeenCalledWith('reachable');
    }
  });
  it('rejects malformed integration discovery payloads before invoking discovery', async () => {
    process.env.HOMEPILOT_INTEGRATION_API_KEY = 'edge-secret';
    const container = containerFor();
    const res = response();

    await routes.handle({
      headers: { 'x-homepilot-integration-key': 'edge-secret' },
      _fastifyParsedBody: JSON.stringify({ homeId: 'home-1', externalId: 'edge-1', name: 'Lamp', type: 'light' })
    } as unknown as HomePilotRequest, res, '/api/v1/integrations/discovery', 'POST', container);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('VALIDATION_ERROR'));
  });
});
describe('Feature: device read route boundaries', () => {
  const routes = new DeviceRoutes();
  const readRequest = (userId = 'owner-1') => ({ headers: {}, user: { id: userId, role: 'admin' } }) as unknown as HomePilotRequest;

  it('returns early when authentication rejects a protected device route', async () => {
    const container = containerFor();
    (container.guards.authGuard.protect as jest.Mock).mockResolvedValue(false);
    const res = response();

    await expect(routes.handle(readRequest(), res, '/api/v1/devices', 'GET', container)).resolves.toBe(true);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('maps missing and repository failures for a device detail to stable read contracts', async () => {
    const missing = containerFor();
    (missing.repositories.deviceRepository.findDeviceById as jest.Mock).mockResolvedValue(null);
    const missingResponse = response();

    await routes.handle(readRequest(), missingResponse, '/api/v1/devices/missing-device', 'GET', missing);
    expect(missingResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(missingResponse.end).toHaveBeenCalledWith(expect.stringContaining('DEVICE_NOT_FOUND'));

    const failing = containerFor();
    (failing.repositories.deviceRepository.findDeviceById as jest.Mock).mockRejectedValue(new Error('read unavailable'));
    const failingResponse = response();

    await routes.handle(readRequest(), failingResponse, '/api/v1/devices/device-1', 'GET', failing);
    expect(failingResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(failingResponse.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));
  });

  it('lists enriched devices and maps list repository failures without leaking errors', async () => {
    const successful = containerFor();
    const successfulRepositories = successful.repositories as unknown as {
      deviceRepository: { findAllOrderedByStatus: jest.Mock };
    };
    successfulRepositories.deviceRepository.findAllOrderedByStatus = jest.fn().mockResolvedValue([device]);
    const successfulResponse = response();

    await routes.handle(readRequest(), successfulResponse, '/api/v1/devices', 'GET', successful);
    expect(successfulResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(successfulResponse.end).toHaveBeenCalledWith(expect.stringContaining('"profile"'));

    const failing = containerFor();
    const failingRepositories = failing.repositories as unknown as {
      deviceRepository: { findAllOrderedByStatus: jest.Mock };
    };
    failingRepositories.deviceRepository.findAllOrderedByStatus = jest.fn().mockRejectedValue(new Error('database offline'));
    const failingResponse = response();

    await routes.handle(readRequest(), failingResponse, '/api/v1/devices', 'GET', failing);
    expect(failingResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(failingResponse.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));
  });

  it('keeps activity log failures within the API error contract and leaves unrelated paths unhandled', async () => {
    const failing = containerFor();
    const failingRepositories = failing.repositories as unknown as {
      activityLogRepository: { findAllRecent: jest.Mock };
    };
    failingRepositories.activityLogRepository.findAllRecent = jest.fn().mockRejectedValue(new Error('history unavailable'));
    const failingResponse = response();

    await routes.handle(readRequest(), failingResponse, '/api/v1/activity-logs', 'GET', failing);
    expect(failingResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(failingResponse.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));

    const unrelated = containerFor();
    await expect(routes.handle(readRequest(), response(), '/api/v1/not-a-device-route', 'GET', unrelated)).resolves.toBe(false);
  });
});
describe('Feature: device administration patch contracts', () => {
  const routes = new DeviceRoutes();

  function patchRequest(payload: Record<string, unknown>, userId = 'owner-1'): HomePilotRequest {
    return {
      headers: {},
      user: { id: userId },
      _fastifyParsedBody: JSON.stringify(payload),
    } as unknown as HomePilotRequest;
  }

  it('returns the existing device without persistence when a patch does not change it', async () => {
    const container = containerFor({ ...device, name: 'Desk light', invertState: false, entityVersion: 7 });
    const res = response();

    await routes.handle(patchRequest({ name: '   ', invertState: false }), res, '/api/v1/devices/device-1', 'PATCH', container);

    expect(container.repositories.deviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Desk light'));
  });

  it('trims a new name, persists the requested inversion and increments the entity version', async () => {
    const container = containerFor({ ...device, name: 'Desk light', invertState: false, entityVersion: 7 });
    const res = response();

    await routes.handle(patchRequest({ name: '  Hall light  ', invertState: true }), res, '/api/v1/devices/device-1', 'PATCH', container);

    expect(container.repositories.deviceRepository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      id: 'device-1',
      name: 'Hall light',
      invertState: true,
      entityVersion: 8,
    }));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Hall light'));
  });

  it('refuses an administrator from another home before changing a device', async () => {
    const container = containerFor();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock).mockResolvedValue([{ id: 'other-home' }]);
    const res = response();

    await routes.handle(patchRequest({ name: 'Unauthorized' }), res, '/api/v1/devices/device-1', 'PATCH', container);

    expect(container.repositories.deviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('FORBIDDEN'));
  });

  it('keeps the update error contract when persistence fails', async () => {
    const container = containerFor();
    (container.repositories.deviceRepository.saveDevice as jest.Mock).mockRejectedValue(new Error('database unavailable'));
    const res = response();

    await routes.handle(patchRequest({ name: 'Kitchen light' }), res, '/api/v1/devices/device-1', 'PATCH', container);

    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('UPDATE_ERROR'));
  });
});
