import { HomeAssistantImportService } from '../application/HomeAssistantImportService';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { HomeRepository } from '../../topology/domain/repositories/HomeRepository';
import { HomeAssistantConnectionProvider } from '../../integrations/home-assistant/application/HomeAssistantConnectionProvider';
import { HomeAssistantClient } from '../infrastructure/adapters/HomeAssistantClient';

type MockHAClient = Pick<HomeAssistantClient, 'getEntityState' | 'callService'>;
type MockHAConnectionProvider = Pick<HomeAssistantConnectionProvider, 'getClient' | 'hasClient'>;

function createMockHAConnectionProvider(client: MockHAClient): HomeAssistantConnectionProvider {
  const provider = Object.create(HomeAssistantConnectionProvider.prototype);
  provider.getClient = jest.fn().mockReturnValue(client);
  provider.hasClient = jest.fn().mockReturnValue(true);
  return provider as HomeAssistantConnectionProvider;
}

describe('HomeAssistantImportService', () => {
  let service: HomeAssistantImportService;
  let mockDeviceRepo: jest.Mocked<DeviceRepository>;
  let mockHomeRepo: jest.Mocked<HomeRepository>;
  let mockHAClient: jest.Mocked<MockHAClient>;
  let mockHAConnectionProvider: jest.Mocked<MockHAConnectionProvider>;

  beforeEach(() => {
    mockDeviceRepo = {
      saveDevice: jest.fn().mockResolvedValue(undefined),
      deleteDevice: jest.fn().mockResolvedValue(undefined),
      findDeviceById: jest.fn(),
      findInboxByHomeId: jest.fn(),
      findAll: jest.fn(),
      findAllOrderedByStatus: jest.fn(),
      findAllByHomeId: jest.fn(),
      findAllExternalIdsByPrefix: jest.fn(),
      findByExternalIdAndHomeId: jest.fn().mockResolvedValue(null),
      findByExternalId: jest.fn(),
      updateSemanticType: jest.fn().mockResolvedValue(undefined)
    };

    mockHomeRepo = {
      saveHome: jest.fn(),
      findHomeById: jest.fn(),
      findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]),
      findAll: jest.fn()
    };

    mockHAClient = {
      getEntityState: jest.fn(),
      callService: jest.fn()
    };

    mockHAConnectionProvider = {
      getClient: jest.fn().mockReturnValue(mockHAClient),
      hasClient: jest.fn().mockReturnValue(true)
    };

    service = new HomeAssistantImportService({
      deviceRepository: mockDeviceRepo,
      homeRepository: mockHomeRepo,
      haConnectionProvider: createMockHAConnectionProvider(mockHAClient)
    });
  });

  it('HA entity light.luz_sala imports as type light and semanticType light', async () => {
    mockHAClient.getEntityState.mockResolvedValue({
      entity_id: 'light.luz_sala',
      state: 'off',
      attributes: { friendly_name: 'Luz Sala' },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z'
    });

    const device = await service.importDevice('light.luz_sala', 'user-1');

    expect(device.type).toBe('light');
    expect(device.semanticType).toBe('light');
    expect(mockDeviceRepo.saveDevice).toHaveBeenCalledWith(device);
  });

  it('HA entity switch.sonoff_x imports as type switch and semanticType undefined (not light)', async () => {
    mockHAClient.getEntityState.mockResolvedValue({
      entity_id: 'switch.sonoff_x',
      state: 'on',
      attributes: { friendly_name: 'Sonoff X (Luz)' },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z'
    });

    const device = await service.importDevice('switch.sonoff_x', 'user-1');

    expect(device.type).toBe('switch');
    expect(device.semanticType).toBeUndefined();
    expect(mockDeviceRepo.saveDevice).toHaveBeenCalledWith(device);
  });

  it('HA entity binary_sensor.motion imports as type binary_sensor and semanticType sensor', async () => {
    mockHAClient.getEntityState.mockResolvedValue({
      entity_id: 'binary_sensor.motion',
      state: 'on',
      attributes: { friendly_name: 'Motion' },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z'
    });

    const device = await service.importDevice('binary_sensor.motion', 'user-1');

    expect(device.type).toBe('binary_sensor');
    expect(device.semanticType).toBe('sensor');
    expect(mockDeviceRepo.saveDevice).toHaveBeenCalledWith(device);
  });
});
