import { EventEmitter } from 'events';
import { CloudGatewayConnector, CloudGatewaySocket, isSecureGatewayUrl } from './CloudGatewayConnector';

class FakeSocket extends EventEmitter implements CloudGatewaySocket {
  readonly sent: string[] = [];
  closed = false;
  send(data: string): void { this.sent.push(data); }
  close(): void { this.closed = true; this.emit('close'); }
}

describe('CloudGatewayConnector', () => {
  const config = { url: 'wss://cloud.example.test/gateway/edge', token: 'not-logged', homeId: 'home-1', edgeId: 'edge-1' };

  it('identifies only the configured edge over its outbound channel', () => {
    const socket = new FakeSocket();
    const createSocket = jest.fn(() => socket);
    const connector = new CloudGatewayConnector(config, 5_000, createSocket);

    connector.start();
    socket.emit('open');

    expect(createSocket).toHaveBeenCalledWith(config.url, { headers: { Authorization: 'Bearer not-logged' } });
    expect(JSON.parse(socket.sent[0])).toEqual({ protocolVersion: 1, type: 'edge.heartbeat', homeId: 'home-1', edgeId: 'edge-1' });
    connector.stop();
  });

  it('does not schedule reconnect work after it is stopped', () => {
    jest.useFakeTimers();
    const first = new FakeSocket();
    const createSocket = jest.fn(() => first);
    const connector = new CloudGatewayConnector(config, 10, createSocket);
    connector.start();
    connector.stop();
    jest.advanceTimersByTime(10);

    expect(createSocket).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('accepts only WSS gateway URLs', () => {
    expect(isSecureGatewayUrl('wss://cloud.example.test/gateway/edge')).toBe(true);
    expect(isSecureGatewayUrl('ws://localhost:3000/gateway/edge')).toBe(false);
    expect(isSecureGatewayUrl('not-a-url')).toBe(false);
  });

  describe('polling fallback', () => {
    const originalFetch = global.fetch;
    afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

    // A 200 that carries no pending request resolves at once. With the delay only on the failure path the
    // loop span at full speed, pegging a core and flooding the gateway.
    it('waits between cycles even when the cloud answers right away', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      global.fetch = fetchMock as unknown as typeof fetch;
      const socket = new FakeSocket();
      const connector = new CloudGatewayConnector(config, 50, () => socket);

      connector.start();
      socket.emit('error', new Error('handshake failed'));
      await new Promise((resolve) => setTimeout(resolve, 30));
      const afterFirstCycle = fetchMock.mock.calls.length;
      connector.stop();

      // One cycle inside the 50 ms delay, not a hot loop of hundreds.
      expect(afterFirstCycle).toBe(1);
    });

    it('gives every gateway request a timeout so a silent endpoint cannot stall it forever', async () => {
      const signals: (AbortSignal | undefined)[] = [];
      global.fetch = jest.fn((_url: unknown, options?: { signal?: AbortSignal }) => {
        signals.push(options?.signal);
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      }) as unknown as typeof fetch;
      const socket = new FakeSocket();
      const connector = new CloudGatewayConnector(config, 50, () => socket, undefined, 10);

      connector.start();
      socket.emit('error', new Error('handshake failed'));
      await new Promise((resolve) => setTimeout(resolve, 30));
      connector.stop();

      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0]).toBeInstanceOf(AbortSignal);
    });

    // A single blip during the WebSocket handshake used to downgrade the Edge to polling for the whole
    // life of the process: startPolling left its flag set and scheduleReconnect returned early forever.
    it('retries the WebSocket once the cloud answers again', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
      const sockets = [new FakeSocket(), new FakeSocket()];
      let created = 0;
      const createSocket = jest.fn((): CloudGatewaySocket => sockets[Math.min(created++, sockets.length - 1)]);
      const connector = new CloudGatewayConnector(config, 10, createSocket);

      connector.start();
      sockets[0].emit('error', new Error('handshake failed'));
      await new Promise((resolve) => setTimeout(resolve, 80));
      connector.stop();

      expect(createSocket.mock.calls.length).toBeGreaterThan(1);
    });
  });
});