import { Device, DeviceSemanticType } from '../types';

/**
 * Puerto de Salida (Outbound Port) para la persistencia del Dominio de Devices.
 */
export interface DeviceRepository {
  /**
   * Persiste un dispositivo en el almacenamiento transaccional.
   */
  saveDevice(device: Device): Promise<void>;

  /**
   * Elimina exclusivamente la representación local del dispositivo.
   * La integración física externa permanece intacta y puede reimportarse.
   */
  deleteDevice(deviceId: string): Promise<void>;

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
  /**
   * Localiza un dispositivo basándose en su external_id independientemente de su hogar.
   */
  findByExternalId(externalId: string): Promise<Device | null>;
  /**
   * Recupera todos los dispositivos de todos los hogares.
   */
  findAll(): Promise<ReadonlyArray<Device>>;

  /**
   * Recupera todos los dispositivos ordenados por status y fecha de creación.
   */
  findAllOrderedByStatus(): Promise<ReadonlyArray<Device>>;

  /**
   * Recupera todos los dispositivos de un hogar.
   */
  findAllByHomeId(homeId: string): Promise<ReadonlyArray<Device>>;

  /**
   * Recupera los external_ids que coinciden con un prefijo (e.g. 'ha:').
   */
  findAllExternalIdsByPrefix(prefix: string): Promise<ReadonlyArray<string>>;

  /**
   * Actualiza el tipo semántico de un dispositivo sin sobreescribir el resto de sus propiedades.
   */
  updateSemanticType(deviceId: string, semanticType: DeviceSemanticType | null): Promise<void>;
}
