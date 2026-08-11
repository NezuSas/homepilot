import { HomeAssistantConnectionProvider } from '../application/HomeAssistantConnectionProvider';
import { HomeAssistantSettingsService } from '../application/HomeAssistantSettingsService';
import { SettingsRepository } from '../domain/SettingsRepository';

describe('HomeAssistantSettingsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a controlled unreachable result when fetch rejects a non-Error value', async () => {
    const repository: SettingsRepository = {
      getSettings: async () => null,
      saveSettings: async () => undefined,
    };
    const service = new HomeAssistantSettingsService(
      repository,
      new HomeAssistantConnectionProvider({ create: () => { throw new Error('not used'); } }),
      {},
    );
    jest.spyOn(global, 'fetch').mockRejectedValue('network unavailable');

    await expect(service.testConnection('http://homeassistant.local:8123', 'token')).resolves.toEqual({
      success: false,
      status: 'unreachable',
      error: 'network unavailable',
    });
  });
});
