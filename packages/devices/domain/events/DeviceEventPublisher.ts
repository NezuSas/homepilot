import { DeviceDomainEvent } from './types';

/**
 * Puerto de Salida (Outbound Port) para la publicación asíncrona de eventos de Devices.
 */
export interface DeviceEventPublisher {
  publish(event: DeviceDomainEvent): Promise<void>;
}
