import { EventEmitter } from 'events';

const clients: MockRedis[] = [];
class MockRedis extends EventEmitter {
  public readonly publish = jest.fn().mockResolvedValue(1);
  public readonly subscribe = jest.fn().mockResolvedValue(1);
  public readonly unsubscribe = jest.fn().mockResolvedValue(1);
  public readonly quit = jest.fn().mockResolvedValue('OK');
  constructor(..._args: unknown[]) { super(); clients.push(this); }
}

jest.mock('ioredis', () => MockRedis);

import { RedisEventBus } from '../RedisEventBus';

const event = { eventId: 'event-1', eventType: 'DEVICE_UPDATED', schemaVersion: '1', source: 'test', timestamp: '2026-08-17T12:00:00.000Z', correlationId: 'corr-1', payload: { id: 'device-1' } };

describe('RedisEventBus', () => {
  beforeEach(() => { clients.splice(0); jest.restoreAllMocks(); });

  it('publishes namespaced events and dispatches remote messages to handlers', async () => {
    const bus = new RedisEventBus('redis://test');
    const handler = jest.fn().mockResolvedValue(undefined);
    const unsubscribe = bus.subscribe('DEVICE_UPDATED', handler);
    const [publisher, subscriber] = clients;

    expect(subscriber.subscribe).toHaveBeenCalledWith('homepilot:DEVICE_UPDATED');
    await bus.publish(event);
    expect(publisher.publish).toHaveBeenCalledWith('homepilot:DEVICE_UPDATED', JSON.stringify(event));

    subscriber.emit('message', 'homepilot:DEVICE_UPDATED', JSON.stringify(event));
    await new Promise(process.nextTick);
    expect(handler).toHaveBeenCalledWith(event);

    unsubscribe();
    expect(subscriber.unsubscribe).toHaveBeenCalledWith('homepilot:DEVICE_UPDATED');
    await bus.close();
    expect(publisher.quit).toHaveBeenCalled();
    expect(subscriber.quit).toHaveBeenCalled();
  });


  it('tracks Redis connection diagnostics and keeps a channel subscribed until its final handler is removed', async () => {
    const info = jest.spyOn(console, 'log').mockImplementation();
    const error = jest.spyOn(console, 'error').mockImplementation();
    const bus = new RedisEventBus('redis://test');
    const [publisher, subscriber] = clients;
    const first = bus.subscribe('DEVICE_UPDATED', jest.fn());
    const second = bus.subscribe('DEVICE_UPDATED', jest.fn());

    publisher.emit('ready');
    publisher.emit('error', new Error('publisher offline'));
    subscriber.emit('ready');
    subscriber.emit('error', new Error('subscriber offline'));
    first();

    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
    expect(subscriber.unsubscribe).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('[RedisEventBus] Publisher connected.');
    expect(info).toHaveBeenCalledWith('[RedisEventBus] Subscriber connected.');
    expect(error).toHaveBeenCalledWith('[RedisEventBus] Publisher error:', 'publisher offline');
    expect(error).toHaveBeenCalledWith('[RedisEventBus] Subscriber error:', 'subscriber offline');

    second();
    expect(subscriber.unsubscribe).toHaveBeenCalledWith('homepilot:DEVICE_UPDATED');
    await bus.close();
  });  it('falls back to local dispatch when Redis publishing fails and isolates failed handlers', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    const error = jest.spyOn(console, 'error').mockImplementation();
    const bus = new RedisEventBus('redis://test');
    const [publisher] = clients;
    publisher.publish.mockRejectedValue(new Error('offline'));
    const successful = jest.fn().mockResolvedValue(undefined);
    const failed = jest.fn().mockRejectedValue(new Error('handler failed'));
    bus.subscribe('DEVICE_UPDATED', successful);
    bus.subscribe('DEVICE_UPDATED', failed);

    await bus.publish(event);

    expect(successful).toHaveBeenCalledWith(event);
    expect(failed).toHaveBeenCalledWith(event);
    expect(warn).toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('[RedisEventBus] Local fallback handler failed:', expect.any(Error));
  });

  it('ignores invalid remote messages and logs rejected remote handlers', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation();
    const bus = new RedisEventBus('redis://test');
    const [, subscriber] = clients;
    bus.subscribe('DEVICE_UPDATED', jest.fn().mockRejectedValue(new Error('broken')));

    subscriber.emit('message', 'homepilot:DEVICE_UPDATED', '{broken');
    subscriber.emit('message', 'DEVICE_UPDATED', JSON.stringify(event));
    await new Promise(process.nextTick);

    expect(error).toHaveBeenCalledWith(expect.stringContaining('Failed to parse message'), '{broken');
    expect(error).toHaveBeenCalledWith('[RedisEventBus] Handler failed:', expect.any(Error));
  });
});