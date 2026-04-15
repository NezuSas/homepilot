import { TopologyEventPublisher } from '../../domain/events/TopologyEventPublisher';
import { TopologyDomainEvent } from '../../domain/events/types';
import { EventBus } from '../../../shared/domain/events/EventBus';

export class EventBusTopologyEventPublisher implements TopologyEventPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publish(event: TopologyDomainEvent): Promise<void> {
    await this.eventBus.publish(event);
  }
}
