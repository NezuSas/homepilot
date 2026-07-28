import { HomeAssistantWebSocketClient } from '../application/HomeAssistantWebSocketClient';

interface TestSocket {
  readyState: number;
  onopen: null;
  onmessage: null;
  onerror: null;
  onclose: null;
  send: jest.Mock;
  ping: jest.Mock;
  on: jest.Mock;
  terminate: jest.Mock;
}

interface TestableHomeAssistantWebSocketClient {
  ws: TestSocket | null;
  handleMessage(dataRaw: string, resolve: () => void, reject: (error: Error) => void): void;
}

describe('HomeAssistantWebSocketClient', () => {
  it('ignores malformed messages and completes the authenticated subscription flow', async () => {
    const client = new HomeAssistantWebSocketClient('http://homeassistant.local:8123', 'token');
    const onReady = jest.fn();
    const socket: TestSocket = {
      readyState: 1,
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      send: jest.fn(),
      ping: jest.fn(),
      on: jest.fn(),
      terminate: jest.fn(),
    };
    const testableClient = client as unknown as TestableHomeAssistantWebSocketClient;
    testableClient.ws = socket;
    client.on('ready', onReady);

    const resolve = jest.fn();
    const reject = jest.fn();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      testableClient.handleMessage('not-json', resolve, reject);
      expect(errorSpy).toHaveBeenCalledWith('[HA WebSocket] Message parsing error', expect.any(String));

      testableClient.handleMessage(JSON.stringify({ type: 'auth_required' }), resolve, reject);
      expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'auth', access_token: 'token' }));

      testableClient.handleMessage(JSON.stringify({ type: 'auth_ok' }), resolve, reject);

      expect(onReady).toHaveBeenCalledTimes(1);
      expect(resolve).toHaveBeenCalledTimes(1);
      expect(reject).not.toHaveBeenCalled();
      expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('subscribe_events'));
    } finally {
      errorSpy.mockRestore();
      client.forceClose();
    }
  });
});
