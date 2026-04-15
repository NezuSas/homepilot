import { DeviceEventPublisher } from '../../domain/events/DeviceEventPublisher';
import { DeviceDomainEvent } from '../../domain/events/types';
import { EventBus } from '../../../shared/domain/events/EventBus';

export class EventBusDeviceEventPublisher implements DeviceEventPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publish(event: DeviceDomainEvent): Promise<void> {
    await this.eventBus.publish(event);
  }
}
