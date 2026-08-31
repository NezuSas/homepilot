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
});