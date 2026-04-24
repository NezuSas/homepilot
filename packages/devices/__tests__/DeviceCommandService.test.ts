import { DeviceCommandService } from '../application/DeviceCommandService';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { DeviceDriverRegistry } from '../domain/drivers/DeviceDriverRegistry';
import { SyncDeviceStateDependencies } from '../application/syncDeviceStateUseCase';
import { DeviceDriver } from '../domain/drivers/DeviceDriver';
import { Device } from '../domain/types';

// Mock dependency
jest.mock('../application/syncDeviceStateUseCase', () => ({
  syncDeviceStateUseCase: jest.fn().mockResolvedValue(undefined)
}));

import { syncDeviceStateUseCase } from '../application/syncDeviceStateUseCase';

describe('DeviceCommandService', () => {
  let service: DeviceCommandService;
  let mockRepo: jest.Mocked<DeviceRepository>;
  let mockRegistry: jest.Mocked<DeviceDriverRegistry>;
  let mockDriver: jest.Mocked<DeviceDriver>;
  let mockSyncDeps: SyncDeviceStateDependencies;

  const mockDevice: Device = {
    id: 'd1',
    homeId: 'h1',
    roomId: null,
    externalId: 'ha:light.test',
    name: 'Test',
    type: 'LIGHT',
    vendor: 'test',
    status: 'ASSIGNED',
    integrationSource: 'ha',
    invertState: false,
    lastKnownState: {},
    entityVersion: 1,
    createdAt: '',
    updatedAt: ''
  };

  beforeEach(() => {
    mockRepo = {
      findDeviceById: jest.fn().mockResolvedValue(mockDevice)
    } as unknown as jest.Mocked<DeviceRepository>;

    mockDriver = {
      supports: jest.fn().mockReturnValue(true),
      executeCommand: jest.fn().mockResolvedValue({ success: true, newState: { on: true } })
    } as unknown as jest.Mocked<DeviceDriver>;

    mockRegistry = {
      resolve: jest.fn().mockReturnValue(mockDriver),
      register: jest.fn()
    } as unknown as jest.Mocked<DeviceDriverRegistry>;

    mockSyncDeps = {} as SyncDeviceStateDependencies;

    service = new DeviceCommandService(mockRepo, mockRegistry, mockSyncDeps);
  });

  it('should delegate execution to the resolved driver (legacy string)', async () => {
    await service.dispatch('d1', 'turn_on');

    expect(mockRepo.findDeviceById).toHaveBeenCalledWith('d1');
    expect(mockRegistry.resolve).toHaveBeenCalledWith('ha');
    expect(mockDriver.executeCommand).toHaveBeenCalledWith(
      mockDevice,
      { name: 'turn_on', params: undefined },
      expect.objectContaining({
        userId: 'system',
        correlationId: 'device-command:d1:turn_on'
      })
    );
  });

  it('should delegate execution with params (DeviceCommandRequest)', async () => {
    await service.dispatch('d1', { 
      name: 'set_position', 
      params: { position: 50 } 
    });

    expect(mockDriver.executeCommand).toHaveBeenCalledWith(
      mockDevice,
      { name: 'set_position', params: { position: 50 } },
      expect.any(Object)
    );
  });

  it('should propagate metadata to driver context', async () => {
    await service.dispatch('d1', { 
      name: 'turn_on', 
      metadata: { userId: 'user-123', correlationId: 'corr-456' } 
    });

    expect(mockDriver.executeCommand).toHaveBeenCalledWith(
      mockDevice,
      expect.any(Object),
      expect.objectContaining({
        userId: 'user-123',
        correlationId: 'corr-456'
      })
    );
  });

  it('should call syncDeviceStateUseCase if driver returns newState', async () => {
    await service.dispatch('d1', 'turn_on');

    expect(syncDeviceStateUseCase).toHaveBeenCalledWith(
      'd1',
      { on: true },
      'device-command-service',
      mockSyncDeps
    );
  });

  it('should throw error if device not found', async () => {
    mockRepo.findDeviceById.mockResolvedValue(null);
    await expect(service.dispatch('d2', 'turn_on')).rejects.toThrow('Dispositivo d2 no encontrado');
  });

  it('should throw error if driver execution fails', async () => {
    mockDriver.executeCommand.mockResolvedValue({ success: false, error: 'Physical failure' });
    await expect(service.dispatch('d1', 'turn_on')).rejects.toThrow('Physical failure');
  });
});
