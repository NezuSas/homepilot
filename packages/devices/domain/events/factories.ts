import { IdGenerator, Clock } from '../../../shared/domain/types';
import { 
  DeviceDiscoveredEvent, 
  DeviceAssignedToRoomEvent, 
  DeviceCommandDispatchedEvent,
  DeviceCommandFailedEvent,
  DeviceStateUpdatedEvent,
  DeviceDiscoveredPayload, 
  DeviceAssignedToRoomPayload,
  DeviceCommandDispatchedPayload,
  DeviceCommandFailedPayload,
  DeviceStateUpdatedPayload
} from './types';

const SCHEMA_VERSION = '1.0';

// Estandarización del origen basada en convención de namespaces del sistema
const EVENT_SOURCE = 'domain:devices:edge';

export interface EventDependencies {
  idGenerator: IdGenerator;
  clock: Clock;
}

/**
 * Factoría pura para generar el evento de descubrimiento inicial.
 * Preserva pureza inyectando dependencias compartidas explícitamente sin invocar Node.
 */
export function createDeviceDiscoveredEvent(
  payload: DeviceDiscoveredPayload,
  correlationId: string,
  deps: EventDependencies
): DeviceDiscoveredEvent {
  return {
    eventId: deps.idGenerator.generate(),
    eventType: 'DeviceDiscoveredEvent',
    schemaVersion: SCHEMA_VERSION,
    source: EVENT_SOURCE,
    timestamp: deps.clock.now(),
    correlationId,
    payload
  };
}

/**
 * Factoría pura para generar el evento de mutación de asignación de habitación.
 */
export function createDeviceAssignedToRoomEvent(
  payload: DeviceAssignedToRoomPayload,
  correlationId: string,
  deps: EventDependencies
): DeviceAssignedToRoomEvent {
  return {
    eventId: deps.idGenerator.generate(),
    eventType: 'DeviceAssignedToRoomEvent',
    schemaVersion: SCHEMA_VERSION,
    source: EVENT_SOURCE,
    timestamp: deps.clock.now(),
    correlationId,
    payload
  };
}

/**
 * Factoría pura para generar el evento de confirmación de despacho exitoso hacia red externa.
 */
export function createDeviceCommandDispatchedEvent(
  payload: DeviceCommandDispatchedPayload,
  correlationId: string,
  deps: EventDependencies
): DeviceCommandDispatchedEvent {
  return {
    eventId: deps.idGenerator.generate(),
    eventType: 'DeviceCommandDispatchedEvent',
    schemaVersion: SCHEMA_VERSION,
    source: EVENT_SOURCE,
    timestamp: deps.clock.now(),
    correlationId,
    payload
  };
}

/**
 * Factoría pura para registrar el rebote o rechazo frontal de comunicaciones con el dispatcher remoto.
 */
export function createDeviceCommandFailedEvent(
  payload: DeviceCommandFailedPayload,
  correlationId: string,
  deps: EventDependencies
): DeviceCommandFailedEvent {
  return {
    eventId: deps.idGenerator.generate(),
    eventType: 'DeviceCommandFailedEvent',
    schemaVersion: SCHEMA_VERSION,
    source: EVENT_SOURCE,
    timestamp: deps.clock.now(),
    correlationId,
    payload
  };
}

/**
 * Factoría pura para generar el evento de actualización de estado atómico.
 */
export function createDeviceStateUpdatedEvent(
  payload: DeviceStateUpdatedPayload,
  correlationId: string,
  deps: EventDependencies
): DeviceStateUpdatedEvent {
  return {
    eventId: deps.idGenerator.generate(),
    eventType: 'DeviceStateUpdatedEvent',
    schemaVersion: SCHEMA_VERSION,
    source: EVENT_SOURCE,
    timestamp: deps.clock.now(),
    correlationId,
    payload
  };
}
