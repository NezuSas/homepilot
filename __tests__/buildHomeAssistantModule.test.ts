import { buildHomeAssistantModule } from '../infrastructure/assemblers/buildHomeAssistantModule';
import { HomeAssistantRealtimeSyncManager } from '../packages/integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';

describe('buildHomeAssistantModule', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalInternalUrl = process.env.INTERNAL_HA_URL;
  const originalPublicUrl = process.env.HOME_ASSISTANT_URL;
  const originalToken = process.env.HOME_ASSISTANT_TOKEN;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalInternalUrl === undefined) delete process.env.INTERNAL_HA_URL;
    else process.env.INTERNAL_HA_URL = originalInternalUrl;
    if (originalPublicUrl === undefined) delete process.env.HOME_ASSISTANT_URL;
    else process.env.HOME_ASSISTANT_URL = originalPublicUrl;
    if (originalToken === undefined) delete process.env.HOME_ASSISTANT_TOKEN;
    else process.env.HOME_ASSISTANT_TOKEN = originalToken;
  });

  const deps = (settings: unknown = null) => ({
    settingsRepository: { getSettings: jest.fn().mockResolvedValue(settings) },
    deviceRepository: {},
    activityLogRepository: {},
    homeRepository: {},
  });

  it('builds a safe no-configuration proxy that returns deterministic fallbacks', async () => {
    process.env.NODE_ENV = 'coverage';
    delete process.env.INTERNAL_HA_URL;
    delete process.env.HOME_ASSISTANT_URL;
    delete process.env.HOME_ASSISTANT_TOKEN;

    const assembled = await buildHomeAssistantModule(deps() as never);

    expect(await assembled.haClientProxy.getEntityState('light.office')).toBeNull();
    expect(await assembled.haClientProxy.callService('light', 'turn_on', 'light.office')).toBeUndefined();
    expect(await assembled.haClientProxy.getAllStates()).toEqual([]);
    expect((await assembled.haClientProxy.getCameraMedia('camera.driveway', 'snapshot')).status).toBe(503);
    expect((await assembled.haClientProxy.getMediaArtwork('/cover.jpg')).status).toBe(503);
    expect(await assembled.haClientProxy.getCameraHlsStreamPath('camera.driveway')).toBeNull();
    expect((await assembled.haClientProxy.getCameraHlsMedia('/api/hls/driveway')).status).toBe(503);
    expect(assembled.settingsService).toBeDefined();
    expect(assembled.haImportService).toBeDefined();
  });

  it('loads saved Home Assistant settings and reconnects the realtime manager', async () => {
    process.env.NODE_ENV = 'coverage';
    const saved = { baseUrl: 'http://ha.local:8123', accessToken: 'saved-token' };
    const reconnect = jest.spyOn(HomeAssistantRealtimeSyncManager.prototype, 'reconnect').mockImplementation(() => undefined);

    const assembled = await buildHomeAssistantModule(deps(saved) as never);

    expect(assembled.connectionProvider.hasClient()).toBe(true);
    expect(reconnect).toHaveBeenCalledWith(saved.baseUrl, saved.accessToken);
    reconnect.mockRestore();
  });
});