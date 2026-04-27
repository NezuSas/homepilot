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
});
