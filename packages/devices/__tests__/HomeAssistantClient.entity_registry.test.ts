import { EventEmitter } from 'events';

class FakeSocket extends EventEmitter {
  public send = jest.fn();
  public close = jest.fn();
  public terminate = jest.fn();
}

let lastSocket: FakeSocket | null = null;

jest.mock('ws', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    lastSocket = new FakeSocket();
    return lastSocket;
  }),
}));

// Imported after the mock so the class picks up the mocked constructor.
import { HomeAssistantClient } from '../infrastructure/adapters/HomeAssistantClient';

function emitMessage(payload: Record<string, unknown>): void {
  lastSocket?.emit('message', Buffer.from(JSON.stringify(payload)));
}

describe('HomeAssistantClient.getEntityRegistryEntry', () => {
  let client: HomeAssistantClient;

  beforeEach(() => {
    lastSocket = null;
    client = new HomeAssistantClient('http://homeassistant.local:8123', 'test-token');
  });

  it('resolves the integration platform after a successful auth + registry lookup', async () => {
    const resultPromise = client.getEntityRegistryEntry('camera.matter_cam');

    emitMessage({ type: 'auth_required' });
    expect(lastSocket?.send).toHaveBeenCalledWith(JSON.stringify({ type: 'auth', access_token: 'test-token' }));

    emitMessage({ type: 'auth_ok' });
    expect(lastSocket?.send).toHaveBeenCalledWith(JSON.stringify({
      id: 1, type: 'config/entity_registry/get', entity_id: 'camera.matter_cam'
    }));

    emitMessage({ id: 1, type: 'result', success: true, result: { platform: 'matter' } });

    await expect(resultPromise).resolves.toEqual({ platform: 'matter' });
    expect(lastSocket?.close).toHaveBeenCalled();
  });

  it('resolves null when authentication is rejected', async () => {
    const resultPromise = client.getEntityRegistryEntry('camera.matter_cam');

    emitMessage({ type: 'auth_required' });
    emitMessage({ type: 'auth_invalid' });

    await expect(resultPromise).resolves.toBeNull();
  });

  it('resolves null when the registry lookup itself fails', async () => {
    const resultPromise = client.getEntityRegistryEntry('camera.matter_cam');

    emitMessage({ type: 'auth_required' });
    emitMessage({ type: 'auth_ok' });
    emitMessage({ id: 1, type: 'result', success: false, error: { code: 'not_found' } });

    await expect(resultPromise).resolves.toBeNull();
  });

  it('resolves null on a socket error instead of rejecting', async () => {
    const resultPromise = client.getEntityRegistryEntry('camera.matter_cam');

    lastSocket?.emit('error', new Error('connection refused'));

    await expect(resultPromise).resolves.toBeNull();
  });

  it('resolves null when no platform is present in the result', async () => {
    const resultPromise = client.getEntityRegistryEntry('camera.matter_cam');

    emitMessage({ type: 'auth_required' });
    emitMessage({ type: 'auth_ok' });
    emitMessage({ id: 1, type: 'result', success: true, result: {} });

    await expect(resultPromise).resolves.toBeNull();
  });
});
