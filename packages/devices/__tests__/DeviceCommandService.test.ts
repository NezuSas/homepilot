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

describe('DeviceCommandService with Validation', () => {
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
    type: 'light', // lowercase for validation
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

  it('should delegate execution if validation passes', async () => {
    await service.dispatch('d1', 'turn_on');

    expect(mockDriver.executeCommand).toHaveBeenCalled();
  });

  it('should throw error and NOT call driver if validation fails', async () => {
    // sensor rejects turn_on. We use a neutral externalId so the resolver uses the type 'sensor'.
    mockRepo.findDeviceById.mockResolvedValue({ 
      ...mockDevice, 
      type: 'sensor', 
      externalId: 'local:sensor.test' 
    });

    await expect(service.dispatch('d1', 'turn_on')).rejects.toThrow('tipo sensor');
    expect(mockDriver.executeCommand).not.toHaveBeenCalled();
  });

  it('should allow unknown devices (conservative fallback)', async () => {
    // We use a type and externalId that cannot be resolved to any capability
    mockRepo.findDeviceById.mockResolvedValue({ 
      ...mockDevice, 
      type: 'weird', 
      externalId: 'local:unknown.device' 
    });

    await service.dispatch('d1', 'turn_on');
    expect(mockDriver.executeCommand).toHaveBeenCalled();
  });

  it('should validate set_position parameters before driver', async () => {
    // cover supports set_position
    mockRepo.findDeviceById.mockResolvedValue({ 
      ...mockDevice, 
      type: 'cover', 
      externalId: 'local:cover.test' 
    });

    // Invalid position (101)
    await expect(service.dispatch('d1', { name: 'set_position', params: { position: 101 } }))
      .rejects.toThrow('excede el máximo');
    
    expect(mockDriver.executeCommand).not.toHaveBeenCalled();
  });
});
