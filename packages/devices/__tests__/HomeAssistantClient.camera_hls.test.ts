import { EventEmitter } from 'events';

class FakeSocket extends EventEmitter {
  public send = jest.fn();
  public close = jest.fn();
}

let lastSocket: FakeSocket | null = null;

jest.mock('ws', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    lastSocket = new FakeSocket();
    return lastSocket;
  }),
}));

import { HomeAssistantClient } from '../infrastructure/adapters/HomeAssistantClient';

function emitMessage(payload: Record<string, unknown>): void {
  lastSocket?.emit('message', Buffer.from(JSON.stringify(payload)));
}

describe('Feature: Home Assistant camera HLS negotiation', () => {
  let client: HomeAssistantClient;

  beforeEach(() => {
    lastSocket = null;
    client = new HomeAssistantClient('https://homeassistant.local:8123/base', 'camera-token');
  });

  it('authenticates then returns only the Home Assistant HLS path', async () => {
    const result = client.getCameraHlsStreamPath('camera.front');

    emitMessage({ type: 'auth_required' });
    expect(lastSocket?.send).toHaveBeenCalledWith(JSON.stringify({ type: 'auth', access_token: 'camera-token' }));
    emitMessage({ type: 'auth_ok' });
    expect(lastSocket?.send).toHaveBeenCalledWith(JSON.stringify({ id: 1, type: 'camera/stream', entity_id: 'camera.front', format: 'hls' }));
    emitMessage({ id: 1, success: true, result: { url: '/api/hls/stream-token/master.m3u8' } });

    await expect(result).resolves.toBe('/api/hls/stream-token/master.m3u8');
    expect(lastSocket?.close).toHaveBeenCalledTimes(1);
  });

  it('returns null for a successful response that does not expose a safe HLS path', async () => {
    const result = client.getCameraHlsStreamPath('camera.front');
    emitMessage({ type: 'auth_required' });
    emitMessage({ type: 'auth_ok' });
    emitMessage({ id: 1, success: true, result: { url: 'https://untrusted.example/live.m3u8' } });

    await expect(result).resolves.toBeNull();
  });

  it('rejects invalid authentication, protocol failures and premature socket close with stable errors', async () => {
    const unauthorized = client.getCameraHlsStreamPath('camera.front');
    emitMessage({ type: 'auth_invalid' });
    await expect(unauthorized).rejects.toThrow('HA_CAMERA_STREAM_UNAUTHORIZED');

    const failure = client.getCameraHlsStreamPath('camera.front');
    emitMessage({ type: 'auth_required' });
    emitMessage({ type: 'auth_ok' });
    emitMessage({ id: 1, success: false, error: { code: 'unsupported' } });
    await expect(failure).rejects.toThrow('HA_CAMERA_STREAM_FAILED: unsupported');

    const closed = client.getCameraHlsStreamPath('camera.front');
    lastSocket?.emit('close');
    await expect(closed).rejects.toThrow('HA_CAMERA_STREAM_SOCKET_CLOSED');
  });

  it('ignores unrelated protocol messages and normalizes socket transport errors', async () => {
    const ignored = client.getCameraHlsStreamPath('camera.front');
    emitMessage({ id: 99, success: false, error: { code: 'irrelevant' } });
    emitMessage({ type: 'auth_required' });
    emitMessage({ type: 'auth_ok' });
    emitMessage({ id: 1, success: true, result: { url: '/api/hls/stream-token/master.m3u8' } });
    await expect(ignored).resolves.toBe('/api/hls/stream-token/master.m3u8');

    const socketFailure = client.getCameraHlsStreamPath('camera.front');
    lastSocket?.emit('error', new Error('connection refused'));
    await expect(socketFailure).rejects.toThrow('HA_CAMERA_STREAM_SOCKET_FAILED: connection refused');
  });
  it('rejects malformed WebSocket messages before they can be trusted', async () => {
    const result = client.getCameraHlsStreamPath('camera.front');
    lastSocket?.emit('message', Buffer.from('{not-json'));

    await expect(result).rejects.toThrow('HA_CAMERA_STREAM_INVALID_RESPONSE');
  });
});