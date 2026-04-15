export interface EventBusEvent<TPayload = unknown> {
  readonly eventId: string;
  readonly eventType: string;
  readonly schemaVersion: string;
  readonly source: string;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly payload: TPayload;
}

export type Event = EventBusEvent;

export type EventBusHandler = (event: EventBusEvent) => void | Promise<void>;

export interface EventBus {
  publish(event: EventBusEvent): Promise<void>;
  subscribe(eventType: string, handler: EventBusHandler): () => void;
}
