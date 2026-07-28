import { EventBusEvent } from '../../../domain/events/EventBus';
import { InMemoryEventBus } from '../InMemoryEventBus';

const event: EventBusEvent = {
  eventId: 'event-01',
  eventType: 'device.state.updated',
  schemaVersion: '1.0',
  source: 'test',
  timestamp: '2026-07-27T00:00:00.000Z',
  correlationId: 'correlation-01',
  payload: { deviceId: 'device-01' },
};

describe('InMemoryEventBus', () => {
  it('delivers an event to subscribed handlers and stops after unsubscribe', async () => {
    const bus = new InMemoryEventBus();
    const handler = jest.fn();
    const unsubscribe = bus.subscribe(event.eventType, handler);

    await bus.publish(event);
    unsubscribe();
    await bus.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('isolates a failed subscriber without blocking healthy handlers or test output', async () => {
    const bus = new InMemoryEventBus();
    const healthyHandler = jest.fn();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    bus.subscribe(event.eventType, async () => {
      throw new Error('subscriber failure');
    });
    bus.subscribe(event.eventType, healthyHandler);

    try {
      await expect(bus.publish(event)).resolves.toBeUndefined();
      expect(healthyHandler).toHaveBeenCalledWith(event);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
