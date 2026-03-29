import { DeviceCommandV1 } from '../../domain/commands';

/**
 * Puerto hexagonal para aislar a HomePilot de implementaciones físicas reales (Zigbee, Matter, etc.).
 * La capa de infraestructura deberá inyectar adaptadores obedeciendo esta interfaz de contrato síncrono.
 */
export interface DeviceCommandDispatcherPort {
  /**
   * Instiga físicamente la alteración binaria sobre la red IoT conectada.
   * Si la promesa se resuelve limpiamente transacciona el éxito (202 Local), 
   * caso contrario debe aventar una excepción nativa interceptada por el Core resituando en fallo formal (502).
   */
  dispatch(deviceId: string, command: DeviceCommandV1): Promise<void>;
}
