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
  startHeartbeat(): void;
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
  it('emits a stable authentication error when Home Assistant rejects the token', () => {
    const client = new HomeAssistantWebSocketClient('http://homeassistant.local:8123', 'invalid-token');
    const socket: TestSocket = { readyState: 1, onopen: null, onmessage: null, onerror: null, onclose: null, send: jest.fn(), ping: jest.fn(), on: jest.fn(), once: jest.fn(), terminate: jest.fn() };
    const testableClient = client as unknown as TestableHomeAssistantWebSocketClient;
    testableClient.ws = socket;
    const onError = jest.fn();
    const reject = jest.fn();
    client.on('error', onError);

    testableClient.handleMessage(JSON.stringify({ type: 'auth_invalid', message: 'bad access token' }), jest.fn(), reject);

    expect(onError).toHaveBeenCalledWith('auth_error', expect.objectContaining({ message: 'bad access token' }));
    expect(reject).toHaveBeenCalledWith(expect.objectContaining({ message: 'auth_invalid' }));
    expect(socket.terminate).toHaveBeenCalled();
  });

  it('forwards Home Assistant state changes and closes a heartbeat with no pong response', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
    const client = new HomeAssistantWebSocketClient('http://homeassistant.local:8123', 'token');
    const socket: TestSocket = { readyState: 1, onopen: null, onmessage: null, onerror: null, onclose: null, send: jest.fn(), ping: jest.fn(), on: jest.fn(), once: jest.fn(), terminate: jest.fn() };
    const testableClient = client as unknown as TestableHomeAssistantWebSocketClient;
    testableClient.ws = socket;
    const onEvent = jest.fn();
    const onClose = jest.fn();
    client.on('event', onEvent);
    client.on('close', onClose);

    try {
      testableClient.handleMessage(JSON.stringify({ type: 'event', event: { event_type: 'state_changed', data: { entity_id: 'light.office' } } }), jest.fn(), jest.fn());
      testableClient.startHeartbeat();
      jest.advanceTimersByTime(30000);
      expect(onEvent).toHaveBeenCalledWith({ entity_id: 'light.office' });
      expect(socket.ping).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(60001);
      expect(socket.terminate).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      client.forceClose();
      jest.useRealTimers();
    }
  });
});

it('keeps an open Home Assistant stream alive when heartbeat pongs are received', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
  const client = new HomeAssistantWebSocketClient('http://homeassistant.local:8123', 'token');
  let pongListener: (() => void) | undefined;
  const socket: TestSocket = {
    readyState: 1,
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    send: jest.fn(),
    ping: jest.fn(),
    on: jest.fn((event: string, listener: () => void) => {
      if (event === 'pong') pongListener = listener;
    }),
    once: jest.fn(),
    terminate: jest.fn(),
  };
  const testableClient = client as unknown as TestableHomeAssistantWebSocketClient;
  testableClient.ws = socket;

  try {
    testableClient.startHeartbeat();
    jest.advanceTimersByTime(30000);
    pongListener?.();
    jest.advanceTimersByTime(30000);
    pongListener?.();
    jest.advanceTimersByTime(30000);

    expect(socket.ping).toHaveBeenCalledTimes(3);
    expect(socket.terminate).not.toHaveBeenCalled();
  } finally {
    client.forceClose();
    jest.useRealTimers();
  }
});
describe('Feature: Home Assistant WebSocket defensive protocol handling', () => {
  it('keeps malformed and incomplete protocol messages from resolving a connection', () => {
    const client = new HomeAssistantWebSocketClient('http://homeassistant.local:8123', 'token');
    const socket: TestSocket = { readyState: 1, onopen: null, onmessage: null, onerror: null, onclose: null, send: jest.fn(), ping: jest.fn(), on: jest.fn(), once: jest.fn(), terminate: jest.fn() };
    const testableClient = client as unknown as TestableHomeAssistantWebSocketClient;
    testableClient.ws = socket;
    const resolve = jest.fn();
    const reject = jest.fn();

    try {
      testableClient.handleMessage('[]', resolve, reject);
      testableClient.handleMessage(JSON.stringify({}), resolve, reject);
      expect(resolve).not.toHaveBeenCalled();
      expect(reject).not.toHaveBeenCalled();
      expect(socket.send).not.toHaveBeenCalled();
    } finally {
      client.forceClose();
    }
  });

  it('uses the stable invalid-token fallback and does not ping a closed transport', () => {
    jest.useFakeTimers();
    const client = new HomeAssistantWebSocketClient('http://homeassistant.local:8123', 'token');
    const socket: TestSocket = { readyState: 3, onopen: null, onmessage: null, onerror: null, onclose: null, send: jest.fn(), ping: jest.fn(), on: jest.fn(), once: jest.fn(), terminate: jest.fn() };
    const testableClient = client as unknown as TestableHomeAssistantWebSocketClient;
    testableClient.ws = socket;
    const onError = jest.fn();
    client.on('error', onError);

    try {
      testableClient.handleMessage(JSON.stringify({ type: 'auth_invalid' }), jest.fn(), jest.fn());
      expect(onError).toHaveBeenCalledWith('auth_error', expect.objectContaining({ message: 'Invalid token' }));

      testableClient.ws = socket;
      testableClient.startHeartbeat();
      jest.advanceTimersByTime(30000);
      expect(socket.ping).not.toHaveBeenCalled();
    } finally {
      client.forceClose();
      jest.useRealTimers();
    }
  });
});