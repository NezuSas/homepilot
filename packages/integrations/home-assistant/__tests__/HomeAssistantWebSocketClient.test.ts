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
  once: jest.Mock;
  terminate: jest.Mock;
}

interface TestableHomeAssistantWebSocketClient {
  ws: TestSocket | null;
  handleMessage(dataRaw: string, resolve: () => void, reject: (error: Error) => void): void;
  startHandshakeTimeout(reject: (error: Error) => void): void;
}

describe('Feature: Home Assistant WebSocket connection', () => {
  it('Scenario: Given a valid handshake When Home Assistant accepts it Then the state stream is subscribed', async () => {
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
      once: jest.fn(),
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
      expect(errorSpy).not.toHaveBeenCalled();

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

  it('classifies a missing handshake response as unreachable so the manager can retry', () => {
    jest.useFakeTimers();
    const client = new HomeAssistantWebSocketClient('http://homeassistant.local:8123', 'token');
    const socket: TestSocket = {
      readyState: 1,
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      send: jest.fn(),
      ping: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      terminate: jest.fn(),
    };
    const testableClient = client as unknown as TestableHomeAssistantWebSocketClient;
    testableClient.ws = socket;
    const onError = jest.fn();
    const reject = jest.fn();
    client.on('error', onError);

    try {
      testableClient.startHandshakeTimeout(reject);
      jest.advanceTimersByTime(5000);

      expect(onError).toHaveBeenCalledWith('unreachable', expect.any(Error));
      expect(reject).toHaveBeenCalledWith(expect.objectContaining({ message: 'handshake_timeout' }));
    } finally {
      client.forceClose();
      jest.useRealTimers();
    }
  });
  it('handles the native error emitted when a connecting socket is force-closed', () => {
    const client = new HomeAssistantWebSocketClient('http://homeassistant.local:8123', 'token');
    const socket: TestSocket = {
      readyState: 0,
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      send: jest.fn(),
      ping: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      terminate: jest.fn(),
    };
    const testableClient = client as unknown as TestableHomeAssistantWebSocketClient;
    testableClient.ws = socket;

    client.forceClose();

    expect(socket.once).toHaveBeenCalledWith('error', expect.any(Function));
    expect(socket.terminate).toHaveBeenCalledTimes(1);
  });
});
