import { EventBusTopologyEventPublisher } from '../infrastructure/adapters/EventBusTopologyEventPublisher';
import { EventBus } from '../../shared/domain/events/EventBus';
import { TopologyDomainEvent } from '../domain/events/types';

describe('EventBusTopologyEventPublisher', () => {
  it('publishes the exact topology domain event through the configured event bus', async () => {
    const event: TopologyDomainEvent = {
      eventId: 'event-1',
      eventType: 'HomeCreatedEvent',
      schemaVersion: 'v1',
      source: 'topology',
      timestamp: '2026-08-17T00:00:00.000Z',
      correlationId: 'correlation-1',
      payload: { id: 'home-1', ownerId: 'owner-1', name: 'Home' },
    };
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as EventBus;

    await new EventBusTopologyEventPublisher(eventBus).publish(event);

    expect(eventBus.publish).toHaveBeenCalledWith(event);
  });
});