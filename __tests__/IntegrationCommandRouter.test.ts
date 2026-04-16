import { IntegrationCommandRouter } from '../apps/api/IntegrationCommandRouter';
import { DeviceCommandDispatcherPort } from '../packages/devices/application/ports/DeviceCommandDispatcherPort';
import { DeviceRepository } from '../packages/devices/domain/repositories/DeviceRepository';
import { Device } from '../packages/devices/domain/types';

describe('IntegrationCommandRouter', () => {
  let defaultDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  let haDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  let deviceRepository: jest.Mocked<DeviceRepository>;
  let router: IntegrationCommandRouter;

  beforeEach(() => {
    defaultDispatcher = { dispatch: jest.fn() };
    haDispatcher = { dispatch: jest.fn() };
    deviceRepository = {
      findDeviceById: jest.fn(),
      findAll: jest.fn(),
      saveDevice: jest.fn(),
      findAllByHomeId: jest.fn()
    } as any;
    
    router = new IntegrationCommandRouter(deviceRepository, defaultDispatcher);
    router.registerRoute('ha', haDispatcher);
  });

  it('should route to HA dispatcher if integrationSource is ha', async () => {
    const device: Partial<Device> = { id: 'd1', integrationSource: 'ha' };
    deviceRepository.findDeviceById.mockResolvedValue(device as Device);

    await router.dispatch('d1', 'turn_on');

    expect(haDispatcher.dispatch).toHaveBeenCalledWith('d1', 'turn_on');
    expect(defaultDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should route to fallback dispatcher if integrationSource is unknown', async () => {
    const device: Partial<Device> = { id: 'd1', integrationSource: 'sonoff' };
    deviceRepository.findDeviceById.mockResolvedValue(device as Device);

    await router.dispatch('d1', 'turn_on');

    expect(defaultDispatcher.dispatch).toHaveBeenCalledWith('d1', 'turn_on');
    expect(haDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should throw error if device not found', async () => {
    deviceRepository.findDeviceById.mockResolvedValue(null);

    await expect(router.dispatch('d-none', 'turn_on')).rejects.toThrow('Dispositivo d-none no encontrado');
  });
});
