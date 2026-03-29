import { HomeCreatedEvent, RoomCreatedEvent, HomeCreatedEventPayload, RoomCreatedEventPayload } from './types';
import { IdGenerator, Clock } from '../types';

/**
 * Dependencias requeridas para la inyección determinista en la
 * creación de eventos de dominio inmutables de forma pura.
 */
export interface EventFactoryDependencies {
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

/**
 * Función de fábrica pura para inicializar el evento HomeCreatedEvent.
 *
 * @param correlationId Identificador en cadena que mapea la petición externa original.
 * @param payload Datos estructurados consolidados post-guardado.
 * @param dependencies Inyección para extraer UUIDs de evento y Ticks limpios.
 * @returns El objeto de evento estructurado cerrado.
 */
export function createHomeCreatedEvent(
  correlationId: string,
  payload: HomeCreatedEventPayload,
  dependencies: EventFactoryDependencies
): HomeCreatedEvent {
  return Object.freeze({
    eventId: dependencies.idGenerator.generate(),
    eventType: 'HomeCreatedEvent',
    schemaVersion: '1.0',
    source: 'domain:topology:edge',
    timestamp: dependencies.clock.now(),
    correlationId,
    payload: Object.freeze({ ...payload })
  });
}

/**
 * Función de fábrica pura para inicializar el evento RoomCreatedEvent.
 *
 * @param correlationId Identificador trazable de la petición original de origen HTTP/CLI.
 * @param payload Datos guardados del Room respectivo.
 * @param dependencies Generadores externos purificados sin librerías Node/Web nativas.
 * @returns Evento estructurado cerrado y read-only.
 */
export function createRoomCreatedEvent(
  correlationId: string,
  payload: RoomCreatedEventPayload,
  dependencies: EventFactoryDependencies
): RoomCreatedEvent {
  return Object.freeze({
    eventId: dependencies.idGenerator.generate(),
    eventType: 'RoomCreatedEvent',
    schemaVersion: '1.0',
    source: 'domain:topology:edge',
    timestamp: dependencies.clock.now(),
    correlationId,
    payload: Object.freeze({ ...payload })
  });
}
