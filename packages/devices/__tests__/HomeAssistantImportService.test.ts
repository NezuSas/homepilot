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

describe('Feature: Home Assistant device import', () => {
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

  it('rejects imports when the caller has no available home', async () => {
    mockHomeRepo.findHomesByUserId.mockResolvedValue([]);

    await expect(service.importDevice('light.luz_sala', 'user-1')).rejects.toThrow('HOME_NOT_FOUND');
    expect(mockHAConnectionProvider.getClient).not.toHaveBeenCalled();
  });

  it('rejects duplicates before querying Home Assistant', async () => {
    mockDeviceRepo.findByExternalIdAndHomeId.mockResolvedValue({ id: 'existing' } as never);

    await expect(service.importDevice('light.luz_sala', 'user-1')).rejects.toThrow('DEVICE_ALREADY_EXISTS');
    expect(mockHAConnectionProvider.getClient).not.toHaveBeenCalled();
  });

  it('rejects unknown Home Assistant entities before persisting a device', async () => {
    mockHAClient.getEntityState.mockResolvedValue(null);

    await expect(service.importDevice('light.missing', 'user-1')).rejects.toThrow('HA_ENTITY_NOT_FOUND');
    expect(mockDeviceRepo.saveDevice).not.toHaveBeenCalled();
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

  it('preserves media metadata provided by Home Assistant when importing a media player', async () => {
    mockHAClient.getEntityState.mockResolvedValue({
      entity_id: 'media_player.youtube',
      state: 'playing',
      attributes: {
        friendly_name: 'Reproductor Youtube',
        media_title: 'Video actual',
        media_artist: 'Canal',
        volume_level: 0.5,
        entity_picture: 'https://example.invalid/cover.jpg',
      },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z',
    });

    const device = await service.importDevice('media_player.youtube', 'user-1');

    expect(device.lastKnownState).toMatchObject({
      state: 'playing',
      attributes: {
        media_title: 'Video actual',
        media_artist: 'Canal',
        volume_level: 0.5,
        entity_picture: 'https://example.invalid/cover.jpg',
      },
    });
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

  it('HA entity cover.master imports as cover with cover semantic profile', async () => {
    mockHAClient.getEntityState.mockResolvedValue({
      entity_id: 'cover.master',
      state: 'closed',
      attributes: { friendly_name: 'Cortina Master', current_position: 0 },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z'
    });

    const device = await service.importDevice('cover.master', 'user-1');

    expect(device.type).toBe('cover');
    expect(device.semanticType).toBe('cover');
    expect(device.lastKnownState.current_position).toBe(0);
    expect(mockDeviceRepo.saveDevice).toHaveBeenCalledWith(device);
  });

  it('HA entity button.gate_release imports as a stateless button action', async () => {
    mockHAClient.getEntityState.mockResolvedValue({
      entity_id: 'button.gate_release',
      state: '2026-08-21T12:00:00Z',
      attributes: { friendly_name: 'Abrir portón' },
      last_changed: '2026-08-21T12:00:00Z',
      last_updated: '2026-08-21T12:00:00Z',
    });

    const device = await service.importDevice('button.gate_release', 'user-1');

    expect(device.type).toBe('button');
    expect(device.semanticType).toBe('button');
    expect(mockDeviceRepo.saveDevice).toHaveBeenCalledWith(device);
  });

  it('HA entity scene.tv_input imports as an activatable scene instead of a generic sensor', async () => {
    mockHAClient.getEntityState.mockResolvedValue({
      entity_id: 'scene.tv_input',
      state: '2026-08-21T12:00:00Z',
      attributes: { friendly_name: 'TV Input' },
      last_changed: '2026-08-21T12:00:00Z',
      last_updated: '2026-08-21T12:00:00Z',
    });

    const device = await service.importDevice('scene.tv_input', 'user-1');

    expect(device.type).toBe('scene');
    expect(device.semanticType).toBe('scene');
    expect(mockDeviceRepo.saveDevice).toHaveBeenCalledWith(device);
  });

  it('HA entity camera.ingreso imports as a read-only camera', async () => {
    mockHAClient.getEntityState.mockResolvedValue({
      entity_id: 'camera.ingreso',
      state: 'idle',
      attributes: { friendly_name: 'Camara de ingreso', supported_features: 2 },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z'
    });

    const device = await service.importDevice('camera.ingreso', 'user-1');

    expect(device.type).toBe('camera');
    expect(device.semanticType).toBeUndefined();
    expect(mockDeviceRepo.saveDevice).toHaveBeenCalledWith(device);
  });
  it('Scenario: Given a Tuya curtain in Home Assistant When it is imported Then it remains a Home Assistant device', async () => {
    mockHAClient.getEntityState.mockResolvedValue({
      entity_id: 'cover.tuya_curtain',
      state: 'open',
      attributes: { friendly_name: 'Cortina Tuya', current_position: 72 },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z'
    });

    const device = await service.importDevice('cover.tuya_curtain', 'user-1');

    expect(device.integrationSource).toBe('ha');
    expect(device.externalId).toBe('ha:cover.tuya_curtain');
    expect(device.semanticType).toBe('cover');
  });

  it('HA entity camera.matter_cam imports with vendor=platform when the entity registry reports Matter', async () => {
    mockHAClient.getEntityState.mockResolvedValue({
      entity_id: 'camera.matter_cam',
      state: 'idle',
      attributes: { friendly_name: 'Camara Matter' },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z'
    });
    const clientWithRegistry = mockHAClient as unknown as MockHAClient & { getEntityRegistryEntry: jest.Mock };
    clientWithRegistry.getEntityRegistryEntry = jest.fn().mockResolvedValue({ platform: 'matter' });

    const device = await service.importDevice('camera.matter_cam', 'user-1');

    expect(device.vendor).toBe('matter');
    expect(device.lastKnownState.haPlatform).toBe('matter');
    expect(clientWithRegistry.getEntityRegistryEntry).toHaveBeenCalledWith('camera.matter_cam');
  });

  it('import still succeeds with the legacy vendor when the entity registry lookup fails', async () => {
    mockHAClient.getEntityState.mockResolvedValue({
      entity_id: 'camera.ingreso',
      state: 'idle',
      attributes: { friendly_name: 'Camara de ingreso' },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z'
    });
    const clientWithRegistry = mockHAClient as unknown as MockHAClient & { getEntityRegistryEntry: jest.Mock };
    clientWithRegistry.getEntityRegistryEntry = jest.fn().mockRejectedValue(new Error('registry unavailable'));

    const device = await service.importDevice('camera.ingreso', 'user-1');

    expect(device.vendor).toBe('Home Assistant');
    expect(device.lastKnownState.haPlatform).toBeUndefined();
  });
});
