import { EventBus, EventBusEvent, EventBusHandler } from '../../domain/events/EventBus';

export class InMemoryEventBus implements EventBus {
  private readonly subscribers = new Map<string, EventBusHandler[]>();

  async publish(event: EventBusEvent): Promise<void> {
    const handlers = this.subscribers.get(event.eventType) || [];
    const results = await Promise.allSettled(handlers.map((handler) => handler(event)));

    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[EventBus] Subscriber failed:', result.reason);
      }
    }
  }

  subscribe(eventType: string, handler: EventBusHandler): () => void {
    const handlers = this.subscribers.get(eventType) || [];
    handlers.push(handler);
    this.subscribers.set(eventType, handlers);

    return () => {
      const currentHandlers = this.subscribers.get(eventType) || [];
      const nextHandlers = currentHandlers.filter((currentHandler) => currentHandler !== handler);

      if (nextHandlers.length === 0) {
        this.subscribers.delete(eventType);
        return;
      }

      this.subscribers.set(eventType, nextHandlers);
    };
  }
}

export default InMemoryEventBus;
