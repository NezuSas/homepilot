import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { Device } from '../../../packages/devices/domain/types';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { DeviceRoutes } from '../routes/DeviceRoutes';

const device: Device = {
  id: 'device-1', homeId: 'home-1', roomId: null, externalId: 'edge:device-1', name: 'Sensor', type: 'sensor', vendor: 'Edge', status: 'PENDING', integrationSource: 'native', invertState: false, lastKnownState: null, entityVersion: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

const response = () => ({ writeHead: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis() }) as unknown as http.ServerResponse;

function containerFor(stored: Device = device): BootstrapContainer {
  return {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } },
    repositories: {
      deviceRepository: { findDeviceById: jest.fn().mockResolvedValue(stored), saveDevice: jest.fn().mockResolvedValue(undefined) },
      activityLogRepository: { saveActivity: jest.fn().mockResolvedValue(undefined), findRecentByDeviceId: jest.fn().mockResolvedValue([]) },
      homeRepository: { findHomeById: jest.fn().mockResolvedValue({ id: 'home-1', ownerId: 'owner-1' }) },
      roomRepository: { findRoomById: jest.fn() },
    },
    adapters: { deviceEventPublisher: { publish: jest.fn().mockResolvedValue(undefined) } },
  } as unknown as BootstrapContainer;
}

describe('DeviceRoutes state sync', () => {
  const routes = new DeviceRoutes('test.db');
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
});
describe('Feature: Device discovery M2M boundary', () => {
  const routes = new DeviceRoutes('test.db');
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

  it('creates a discovered device with a valid integration key', async () => {
    process.env.HOMEPILOT_INTEGRATION_API_KEY = 'edge-secret';
    const container = containerFor();
    container.repositories.deviceRepository.findByExternalIdAndHomeId = jest.fn().mockResolvedValue(null);
    const res = response();
    await routes.handle({ headers: { 'x-homepilot-integration-key': 'edge-secret' }, _fastifyParsedBody: JSON.stringify({ homeId: 'home-1', externalId: 'edge:2', name: 'Sensor', type: 'sensor', vendor: 'Edge' }) } as unknown as HomePilotRequest, res, '/api/v1/integrations/discovery', 'POST', container);
    expect(container.repositories.deviceRepository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING', roomId: null, externalId: 'edge:2' }));
    expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
  });
});