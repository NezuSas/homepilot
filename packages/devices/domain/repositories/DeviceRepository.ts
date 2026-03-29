import { Device } from '../types';

/**
 * Puerto de Salida (Outbound Port) para la persistencia del Dominio de Devices.
 */
export interface DeviceRepository {
  /**
   * Persiste un dispositivo en el almacenamiento transaccional.
   */
  saveDevice(device: Device): Promise<void>;

  /**
   * Recupera un dispositivo por su identificador interno único.
   */
  findDeviceById(deviceId: string): Promise<Device | null>;

  /**
   * Recupera la bandeja de entrada (Inbox) de un hogar.
   * Selecciona estrictamente los dispositivos pendientes (roomId === null).
   */
  findInboxByHomeId(homeId: string): Promise<ReadonlyArray<Device>>;

  /**
   * Localiza un dispositivo basándose en la llave compuesta inmutable
   * provista por la interacción de hardware para garantizar la idempotencia.
   */
  findByExternalIdAndHomeId(externalId: string, homeId: string): Promise<Device | null>;
}
