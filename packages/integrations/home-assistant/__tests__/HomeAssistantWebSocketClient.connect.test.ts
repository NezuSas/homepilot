import { EventEmitter } from 'events';

let throwOnConstruction = false;
const socketInstances: FakeSocket[] = [];

class FakeSocket extends EventEmitter {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  public readyState = FakeSocket.CONNECTING;
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: unknown }) => void) | null = null;
  public onerror: ((event: { message?: unknown }) => void) | null = null;
  public onclose: (() => void) | null = null;
  public readonly send = jest.fn();
  public readonly ping = jest.fn();
  public readonly terminate = jest.fn();

  public constructor(public readonly url: string) {
    super();
    if (throwOnConstruction) throw new Error('constructor failed');
    socketInstances.push(this);
  }
}

jest.mock('ws', () => ({ WebSocket: FakeSocket }));

import { HomeAssistantWebSocketClient } from '../application/HomeAssistantWebSocketClient';

describe('HomeAssistantWebSocketClient connect transport lifecycle', () => {
  beforeEach(() => {
    socketInstances.length = 0;
    throwOnConstruction = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('normalizes the URL and reports a transport error as unreachable', async () => {
    const client = new HomeAssistantWebSocketClient('http://ha.local:8123', 'token');
    const error = jest.fn();
    client.on('error', error);

    const connecting = client.connect();
    const socket = socketInstances[0];
    socket.onerror?.({ message: new Error('connection refused') });

    await expect(connecting).rejects.toThrow('WebSocket Error');
    expect(socket.url).toBe('ws://ha.local:8123/api/websocket');
    expect(socket.terminate).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('unreachable', expect.objectContaining({ message: 'connection refused' }));
  });

  it('fails a connection that never opens and emits the stable timeout event', async () => {
    jest.useFakeTimers();
    const client = new HomeAssistantWebSocketClient('https://ha.local', 'token');
    const error = jest.fn();
    client.on('error', error);

    const connecting = client.connect();
    const rejection = expect(connecting).rejects.toThrow('Connection timeout');
    const socket = socketInstances[0];
    await jest.advanceTimersByTimeAsync(8_000);

    await rejection;
    expect(socket.url).toBe('wss://ha.local/api/websocket');
    expect(socket.terminate).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('unreachable', expect.objectContaining({ message: 'Connection timeout' }));
  });

  it('cleans up and forwards the close signal from the native transport', async () => {
    const client = new HomeAssistantWebSocketClient('http://ha.local', 'token');
    const close = jest.fn();
    client.on('close', close);

    void client.connect();
    const socket = socketInstances[0];
    socket.onclose?.();

    expect(close).toHaveBeenCalledTimes(1);
    expect(socket.terminate).toHaveBeenCalledTimes(1);
  });

  it('normalizes synchronous WebSocket construction failures', async () => {
    throwOnConstruction = true;
    const client = new HomeAssistantWebSocketClient('http://ha.local', 'token');
    const error = jest.fn();
    client.on('error', error);

    await expect(client.connect()).rejects.toThrow('constructor failed');
    expect(error).toHaveBeenCalledWith('unreachable', expect.objectContaining({ message: 'constructor failed' }));
  });
});