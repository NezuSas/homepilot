import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { Device } from '../../../packages/devices/domain/types';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { DeviceRoutes } from '../routes/DeviceRoutes';

const createDevice = (): Device => ({
  id: 'cover-1',
  homeId: 'home-1',
  roomId: 'room-1',
  externalId: 'ha:cover.cortina_cuarto',
  name: 'Cortina Cuarto',
  type: 'cover',
  semanticType: 'cover',
  vendor: 'Home Assistant',
  status: 'ASSIGNED',
  integrationSource: 'ha',
  invertState: false,
  lastKnownState: { state: 'closed', current_position: 0 },
  entityVersion: 1,
  createdAt: '2026-06-19T00:00:00.000Z',
  updatedAt: '2026-06-19T00:00:00.000Z',
});

describe('DeviceRoutes - Home Assistant device refresh', () => {
  const routes = new DeviceRoutes('test.db');
  const request = {
    user: { id: 'admin-1' },
    headers: {},
  } as unknown as HomePilotRequest;

  const createResponse = () => ({
    writeHead: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  }) as unknown as http.ServerResponse;

  const createContainer = (getEntityState: jest.Mock) => {
    let storedDevice = createDevice();
    const updateStatusFromOperation = jest.fn();
    const saveDevice = jest.fn(async (device: Device) => {
      storedDevice = device;
    });

    const container = {
      guards: {
        authGuard: {
          protect: jest.fn().mockResolvedValue(true),
          requireRole: jest.fn().mockReturnValue(true),
        },
      },
      repositories: {
        deviceRepository: {
          findDeviceById: jest.fn(async () => storedDevice),
          saveDevice,
        },
        activityLogRepository: {
          saveActivity: jest.fn().mockResolvedValue(undefined),
        },
      },
      adapters: {
        homeAssistantClient: { getEntityState },
        deviceEventPublisher: { publish: jest.fn().mockResolvedValue(undefined) },
      },
      services: {
        homeAssistantSettingsService: { updateStatusFromOperation },
      },
    } as unknown as BootstrapContainer;

    return { container, saveDevice, updateStatusFromOperation };
  };

  it('synchronizes cover state, attributes and current position', async () => {
    const getEntityState = jest.fn().mockResolvedValue({
      entity_id: 'cover.cortina_cuarto',
      state: 'open',
      attributes: { current_position: 73, friendly_name: 'Cortina Cuarto' },
      last_changed: '2026-06-19T10:00:00.000Z',
      last_updated: '2026-06-19T10:00:00.000Z',
    });
    const { container, saveDevice, updateStatusFromOperation } = createContainer(getEntityState);
    const response = createResponse();

    await routes.handle(
      request,
      response,
      '/api/v1/devices/cover-1/refresh',
      'POST',
      container,
    );

    expect(saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      lastKnownState: {
        state: 'open',
        on: true,
        current_position: 73,
        attributes: { current_position: 73, friendly_name: 'Cortina Cuarto' },
      },
    }));
    expect(updateStatusFromOperation).toHaveBeenCalledWith('reachable');
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('marks a missing Home Assistant entity unavailable without marking HA unreachable', async () => {
    const { container, saveDevice, updateStatusFromOperation } = createContainer(jest.fn().mockResolvedValue(null));
    const response = createResponse();

    await routes.handle(
      request,
      response,
      '/api/v1/devices/cover-1/refresh',
      'POST',
      container,
    );

    expect(saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      lastKnownState: expect.objectContaining({
        state: 'unavailable',
        availabilityReason: 'entity_missing',
      }),
      entityVersion: 2,
    }));
    expect(updateStatusFromOperation).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });
});
