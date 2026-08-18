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
  it('prefers database settings, masks tokens, and reports source/configuration state', async () => {
    const repository: SettingsRepository = {
      getSettings: async () => ({ baseUrl: 'http://database:8123', accessToken: 'abcdefgh1234', updatedAt: '2026-01-01T00:00:00.000Z' }),
      saveSettings: async () => undefined,
    };
    const service = new HomeAssistantSettingsService(
      repository,
      new HomeAssistantConnectionProvider({ create: () => { throw new Error('not used'); } }),
      { baseUrl: 'http://environment:8123', token: 'environment-token' },
    );
    service.updateStatusFromOperation('reachable');

    await expect(service.getStatus()).resolves.toEqual(expect.objectContaining({
      baseUrl: 'http://database:8123', hasToken: true, maskedToken: 'abcd••••1234',
      configurationStatus: 'configured', connectivityStatus: 'reachable', activeSource: 'database',
    }));
  });

  it.each([
    [200, 'OK', { success: true, status: 'reachable' }],
    [401, 'Unauthorized', { success: false, status: 'auth_error', error: 'Invalid access token' }],
    [503, 'Unavailable', { success: false, status: 'unreachable', error: 'HA error: 503 Unavailable' }],
  ])('maps HA HTTP response %s to its documented connectivity status', async (status, statusText, expected) => {
    const repository: SettingsRepository = { getSettings: async () => null, saveSettings: async () => undefined };
    const service = new HomeAssistantSettingsService(
      repository,
      new HomeAssistantConnectionProvider({ create: () => { throw new Error('not used'); } }),
      {},
    );
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status, statusText }));

    await expect(service.testConnection('http://homeassistant.local:8123/', 'token')).resolves.toEqual(expected);
    expect(global.fetch).toHaveBeenCalledWith('http://homeassistant.local:8123/api/', {
      headers: { 'Authorization': 'Bearer token' }
    });
  });

  it('saves sanitized settings, retains an existing token, and hot-reloads the provider and sync manager', async () => {
    const saved: Array<{ baseUrl: string; accessToken: string }> = [];
    const repository: SettingsRepository = {
      getSettings: async () => ({ baseUrl: 'http://old:8123', accessToken: 'retained-token', updatedAt: '2026-01-01T00:00:00.000Z' }),
      saveSettings: async (settings) => { saved.push(settings); },
    };
    const provider = new HomeAssistantConnectionProvider({ create: () => ({}) as never });
    const reconfigure = jest.spyOn(provider, 'reconfigure');
    const syncManager = { reconnect: jest.fn() };
    const service = new HomeAssistantSettingsService(repository, provider, {});
    service.setRealtimeSyncManager(syncManager as never);
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    await service.saveSettings(' http://new:8123/ ');

    expect(saved).toEqual([expect.objectContaining({ baseUrl: 'http://new:8123', accessToken: 'retained-token' })]);
    expect(reconfigure).toHaveBeenCalledWith('http://new:8123', 'retained-token');
    expect(syncManager.reconnect).toHaveBeenCalledWith('http://new:8123', 'retained-token');
  });
});
