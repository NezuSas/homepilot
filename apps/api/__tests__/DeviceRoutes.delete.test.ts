import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { Device } from '../../../packages/devices/domain/types';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { DeviceRoutes } from '../routes/DeviceRoutes';

const device: Device = {
  id: 'cover-old',
  homeId: 'home-1',
  roomId: 'room-1',
  externalId: 'ha:cover.old',
  name: 'Cortina antigua',
  type: 'cover',
  semanticType: 'cover',
  vendor: 'Home Assistant',
  status: 'ASSIGNED',
  integrationSource: 'ha',
  invertState: false,
  lastKnownState: null,
  entityVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Feature: Local device deletion integrity', () => {
  const routes = new DeviceRoutes();
  const request = { user: { id: 'owner-1' }, headers: {} } as unknown as HomePilotRequest;
  const createResponse = () => ({
    writeHead: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  }) as unknown as http.ServerResponse;

  const createContainer = (scenes: unknown[] = [], automations: unknown[] = [], storedDevice: Device | null = device) => {
    const deleteDevice = jest.fn().mockResolvedValue(undefined);
    const container = {
      guards: {
        authGuard: {
          protect: jest.fn().mockResolvedValue(true),
          requireRole: jest.fn().mockReturnValue(true),
        },
      },
      repositories: {
        deviceRepository: {
          findDeviceById: jest.fn().mockResolvedValue(storedDevice),
          deleteDevice,
        },
        homeRepository: {
          findHomeById: jest.fn().mockResolvedValue({ id: device.homeId, ownerId: 'owner-1' }),
        },
        sceneRepository: { findAll: jest.fn().mockResolvedValue(scenes) },
        automationRuleRepository: { findAll: jest.fn().mockResolvedValue(automations) },
      },
    } as unknown as BootstrapContainer;
    return { container, deleteDevice };
  };

  it('Scenario: Given an unreferenced owned device When it is removed locally Then Home Assistant is not modified and deletion succeeds', async () => {
    const { container, deleteDevice } = createContainer();
    const response = createResponse();

    await routes.handle(request, response, '/api/v1/devices/cover-old', 'DELETE', container);

    expect(deleteDevice).toHaveBeenCalledWith(device.id);
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"deleted":true'));
  });

  it('Scenario: Given a device referenced by a scene When local deletion is requested Then DEVICE_IN_USE is returned', async () => {
    const { container, deleteDevice } = createContainer([{
      id: 'scene-1',
      actions: [{ deviceId: device.id, command: 'close' }],
    }]);
    const response = createResponse();

    await routes.handle(request, response, '/api/v1/devices/cover-old', 'DELETE', container);

    expect(deleteDevice).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(409, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('DEVICE_IN_USE'));
  });  it('Scenario: Given a device referenced by an automation When local deletion is requested Then DEVICE_IN_USE is returned', async () => {
    const { container, deleteDevice } = createContainer([], [{
      id: 'automation-1',
      trigger: { type: 'device_state_changed', deviceId: device.id },
      action: { type: 'device_command', targetDeviceId: device.id, command: 'close' },
    }]);
    const response = createResponse();

    await routes.handle(request, response, '/api/v1/devices/cover-old', 'DELETE', container);

    expect(deleteDevice).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(409, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('DEVICE_IN_USE'));
  });

  it('Scenario: Given an unknown device identifier When local deletion is requested Then DEVICE_NOT_FOUND is returned without side effects', async () => {
    const { container, deleteDevice } = createContainer([], [], null);
    const response = createResponse();

    await routes.handle(request, response, '/api/v1/devices/missing-device', 'DELETE', container);

    expect(deleteDevice).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('DEVICE_NOT_FOUND'));
  });
});
