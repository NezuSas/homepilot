import { HomeAssistantClient, HomeAssistantState } from '../packages/devices/infrastructure/adapters/HomeAssistantClient';

describe('HomeAssistantClient', () => {
  const baseUrl = 'http://ha.local:8123';
  const token = 'test-token';
  let client: HomeAssistantClient;

  beforeEach(() => {
    client = new HomeAssistantClient(baseUrl, token);
    // Mock global fetch
    global.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('getEntityState: should fetch and type state correctly', async () => {
    const mockState: HomeAssistantState = { 
      entity_id: 'light.test', 
      state: 'on', 
      attributes: {},
      last_changed: '2023-01-01T00:00:00Z',
      last_updated: '2023-01-01T00:00:00Z'
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockState
    });

    const state = await client.getEntityState('light.test');
    
    expect(global.fetch).toHaveBeenCalledWith(`${baseUrl}/api/states/light.test`, expect.objectContaining({
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: expect.any(AbortSignal)
    }));
    expect(state).toEqual(mockState);
  });

  it('callService: should call HA service correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true
    });

    await client.callService('light', 'turn_on', 'light.test');

    expect(global.fetch).toHaveBeenCalledWith(`${baseUrl}/api/services/light/turn_on`, expect.objectContaining({
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entity_id: 'light.test' }),
      signal: expect.any(AbortSignal)
    }));
  });

  it('getEntityState: should return null on 404', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    const state = await client.getEntityState('non_existent');
    expect(state).toBeNull();
  });

  it('should throw timeout error when request hangs', async () => {
    process.env.HA_COMMAND_TIMEOUT_MS = '100';
    
    // Mock fetch that never resolves until we abort
    (global.fetch as jest.Mock).mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    await expect(client.callService('light', 'turn_on', 'light.test'))
      .rejects.toThrow(/HA_SERVICE_CALL_TIMEOUT/);
    
    delete process.env.HA_COMMAND_TIMEOUT_MS;
  });
  it('gets camera media using the correct endpoint and restricted authorization header', async () => {
    const signal = new AbortController().signal;
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    await client.getCameraMedia('camera.front door', 'snapshot', signal);

    expect(global.fetch).toHaveBeenCalledWith(`${baseUrl}/api/camera_proxy/camera.front%20door`, expect.objectContaining({
      signal,
      headers: { Authorization: `Bearer ${token}`, Accept: 'image/jpeg' },
    }));
  });

  it('rejects artwork paths that do not belong to the Home Assistant API origin', async () => {
    await expect(client.getMediaArtwork('https://untrusted.example/image.jpg')).rejects.toThrow('MEDIA_ARTWORK_PATH_INVALID');
    await expect(client.getMediaArtwork('/local/image.jpg')).rejects.toThrow('MEDIA_ARTWORK_PATH_INVALID');
  });

  it('gets allowed artwork and HLS media while rejecting invalid HLS paths', async () => {
    const signal = new AbortController().signal;
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true });

    await client.getMediaArtwork('/api/media_player_proxy/media_player.living', signal);
    await client.getCameraHlsMedia('/api/hls/stream.m3u8', signal);

    expect((global.fetch as jest.Mock).mock.calls[0][0].toString()).toBe(`${baseUrl}/api/media_player_proxy/media_player.living`);
    expect((global.fetch as jest.Mock).mock.calls[0][1].signal).toBe(signal);
    expect((global.fetch as jest.Mock).mock.calls[1][0].toString()).toBe(`${baseUrl}/api/hls/stream.m3u8`);
    expect((global.fetch as jest.Mock).mock.calls[1][1].signal).toBe(signal);
    await expect(client.getCameraHlsMedia('/api/not-hls/file')).rejects.toThrow('HA_CAMERA_HLS_PATH_INVALID');
  });

  it('wraps non-successful service responses in the stable service error contract', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Unavailable' });

    await expect(client.callService('light', 'turn_on', 'light.test')).rejects.toThrow('HA_SERVICE_CALL_FAILED: Home Assistant Service Error: 503 Unavailable');
  });
  it('surfaces non-404 state errors with the Home Assistant response details', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' });

    await expect(client.getEntityState('light.failing')).rejects.toThrow('Home Assistant API Error: 500 Internal Server Error');
  });

  it('merges optional service data into the Home Assistant command payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    await client.callService('cover', 'set_cover_position', 'cover.office', { position: 65 });

    expect(global.fetch).toHaveBeenCalledWith(`${baseUrl}/api/services/cover/set_cover_position`, expect.objectContaining({
      body: JSON.stringify({ entity_id: 'cover.office', position: 65 }),
    }));
  });

  it('retrieves all remote states and translates reconciliation timeouts into a stable error', async () => {
    const allStates: HomeAssistantState[] = [{
      entity_id: 'switch.office',
      state: 'off',
      attributes: {},
      last_changed: '2026-08-17T00:00:00.000Z',
      last_updated: '2026-08-17T00:00:00.000Z',
    }];
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => allStates });

    await expect(client.getAllStates()).resolves.toEqual(allStates);

    process.env.HA_RECONCILIATION_TIMEOUT_MS = '10';
    (global.fetch as jest.Mock).mockImplementationOnce((_url: string, options: { signal: AbortSignal }) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));
    try {
      await expect(client.getAllStates()).rejects.toThrow('getAllStates() timed out after 10ms');
    } finally {
      delete process.env.HA_RECONCILIATION_TIMEOUT_MS;
    }
  });
  it('requests camera streams with the browser-safe multipart accept header', async () => {
    const signal = new AbortController().signal;
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    await client.getCameraMedia('camera.front', 'stream', signal);

    expect(global.fetch).toHaveBeenCalledWith(`${baseUrl}/api/camera_proxy_stream/camera.front`, expect.objectContaining({
      signal,
      headers: { Authorization: `Bearer ${token}`, Accept: 'multipart/x-mixed-replace,image/jpeg' },
    }));
  });
  it('rejects HLS URLs that escape the configured Home Assistant origin', async () => {
    await expect(client.getCameraHlsMedia('https://untrusted.example/api/hls/stream.m3u8')).rejects.toThrow('HA_CAMERA_HLS_PATH_INVALID');
  });

  it('surfaces non-successful reconciliation responses with the upstream status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' });

    await expect(client.getAllStates()).rejects.toThrow('Home Assistant API Error: 503 Service Unavailable');
  });
  it('uses the dedicated state timeout and clears it after an aborted state request', async () => {
    jest.useFakeTimers();
    process.env.HA_STATE_TIMEOUT_MS = '250';
    (global.fetch as jest.Mock).mockImplementationOnce((_url: string, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));

    const pending = client.getEntityState('light.timeout');
    jest.advanceTimersByTime(250);

    await expect(pending).rejects.toThrow('getEntityState(light.timeout) timed out after 250ms');
    delete process.env.HA_STATE_TIMEOUT_MS;
    jest.useRealTimers();
  });
});
