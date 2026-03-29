/**
 * Interfaz base genérica para todos los eventos de dominio.
 * Asegura que cualquier evento de salida cumpla con el contrato mínimo (NFR-04).
 */
export interface DomainEvent<T> {
  readonly eventId: string;
  readonly eventType: string;
  readonly schemaVersion: string;
  readonly source: string;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly payload: T;
}

/**
 * Payload específico para la creación de un Hogar.
 */
export interface HomeCreatedEventPayload {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
}

/**
 * Contrato estricto para el evento HomeCreatedEvent.
 */
export interface HomeCreatedEvent extends DomainEvent<HomeCreatedEventPayload> {
  readonly eventType: 'HomeCreatedEvent';
}

/**
 * Payload específico para la creación de una Habitación.
 */
export interface RoomCreatedEventPayload {
  readonly id: string;
  readonly homeId: string;
  readonly name: string;
}

/**
 * Contrato estricto para el evento RoomCreatedEvent.
 */
export interface RoomCreatedEvent extends DomainEvent<RoomCreatedEventPayload> {
  readonly eventType: 'RoomCreatedEvent';
}

/**
 * Unión explícita cerrada que restringe los tipos de eventos válidos
 * que pueden ser emitidos exclusivamente por el Dominio Topológico.
 */
export type TopologyDomainEvent = HomeCreatedEvent | RoomCreatedEvent;
