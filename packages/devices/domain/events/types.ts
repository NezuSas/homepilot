/**
 * Contratos de Eventos de Dominio para el Módulo Devices.
 */

// Tipo base genérico para estructurar la emisión homogeneizada
export interface DomainEvent<T> {
  readonly eventId: string;
  readonly eventType: string;
  readonly schemaVersion: string;
  readonly source: string;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly payload: T;
}

export interface DeviceDiscoveredPayload {
  readonly deviceId: string;
  readonly homeId: string;
  readonly externalId: string;
  readonly type: string;
  readonly vendor: string;
  readonly name: string;
}

export interface DeviceAssignedToRoomPayload {
  readonly deviceId: string;
  readonly roomId: string;
  readonly previousState: 'PENDING';
}

// Cierre estricto resolviendo la ambigüedad del eventType genérico
export interface DeviceDiscoveredEvent extends DomainEvent<DeviceDiscoveredPayload> {
  readonly eventType: 'DeviceDiscoveredEvent';
}

export interface DeviceAssignedToRoomEvent extends DomainEvent<DeviceAssignedToRoomPayload> {
  readonly eventType: 'DeviceAssignedToRoomEvent';
}

// Unión cerrada y restrictiva de eventos válidos para la agregación Devices
export type DeviceDomainEvent = DeviceDiscoveredEvent | DeviceAssignedToRoomEvent;
