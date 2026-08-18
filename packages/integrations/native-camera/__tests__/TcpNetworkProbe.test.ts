import { EventEmitter } from 'events';

const socketMock = jest.fn();
jest.mock('net', () => ({ Socket: socketMock }));

import { TcpNetworkProbe } from '../infrastructure/TcpNetworkProbe';

type FakeSocket = EventEmitter & { setTimeout: jest.Mock; connect: jest.Mock; destroy: jest.Mock };

function socket(): FakeSocket {
  const value = new EventEmitter() as FakeSocket;
  value.setTimeout = jest.fn();
  value.connect = jest.fn();
  value.destroy = jest.fn();
  return value;
}

describe('TcpNetworkProbe', () => {
  afterEach(() => jest.clearAllMocks());

  it.each(['connect', 'timeout', 'error'] as const)('settles and destroys the socket on %s', async (event) => {
    const fake = socket();
    socketMock.mockReturnValue(fake);
    const probe = new TcpNetworkProbe();
    const result = probe.isReachable('192.168.1.20', 554, 500);

    expect(fake.setTimeout).toHaveBeenCalledWith(500);
    expect(fake.connect).toHaveBeenCalledWith(554, '192.168.1.20');
    fake.emit(event);

    await expect(result).resolves.toBe(event === 'connect');
    expect(fake.destroy).toHaveBeenCalledTimes(1);
  });

  it('does not resolve a second network event after completion', async () => {
    const fake = socket();
    socketMock.mockReturnValue(fake);
    const result = new TcpNetworkProbe().isReachable('host', 80, 50);
    fake.emit('connect');
    fake.emit('error');

    await expect(result).resolves.toBe(true);
    expect(fake.destroy).toHaveBeenCalledTimes(1);
  });
});
