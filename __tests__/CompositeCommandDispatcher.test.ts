import { CompositeCommandDispatcher } from '../apps/api/CompositeCommandDispatcher';
import { DeviceCommandDispatcherPort } from '../packages/devices/application/ports/DeviceCommandDispatcherPort';
import { DeviceRepository } from '../packages/devices/domain/repositories/DeviceRepository';
import { Device } from '../packages/devices/domain/types';

describe('CompositeCommandDispatcher', () => {
  let localDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  let haDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  let deviceRepository: jest.Mocked<DeviceRepository>;
  let composite: CompositeCommandDispatcher;

  beforeEach(() => {
    localDispatcher = { dispatch: jest.fn() };
    haDispatcher = { dispatch: jest.fn() };
    deviceRepository = {
      findDeviceById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      findDevicesByHomeId: jest.fn(),
      findDevicesByRoomId: jest.fn()
    } as any;
    
    composite = new CompositeCommandDispatcher(deviceRepository, localDispatcher, haDispatcher);
  });

  it('should route to HA dispatcher if externalId starts with ha:', async () => {
    const device: Partial<Device> = { id: 'd1', externalId: 'ha:light.kitchen' };
    deviceRepository.findDeviceById.mockResolvedValue(device as Device);

    await composite.dispatch('d1', 'turn_on');

    expect(haDispatcher.dispatch).toHaveBeenCalledWith('d1', 'turn_on');
    expect(localDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should route to local dispatcher if externalId does NOT start with ha:', async () => {
    const device: Partial<Device> = { id: 'd1', externalId: 'zigbee:0x123' };
    deviceRepository.findDeviceById.mockResolvedValue(device as Device);

    await composite.dispatch('d1', 'turn_on');

    expect(localDispatcher.dispatch).toHaveBeenCalledWith('d1', 'turn_on');
    expect(haDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should throw error if device not found', async () => {
    deviceRepository.findDeviceById.mockResolvedValue(null);

    await expect(composite.dispatch('d-none', 'turn_on')).rejects.toThrow('Dispositivo d-none no encontrado');
  });
});
