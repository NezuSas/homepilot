import { DeviceCommandDispatcherPort } from '../../packages/devices/application/ports/DeviceCommandDispatcherPort';
import { DeviceCommandV1 } from '../../packages/devices/domain/commands';
import { DeviceRepository } from '../../packages/devices/domain/repositories/DeviceRepository';

/**
 * CompositeCommandDispatcher
 * 
 * Capa de ruteo que decide qué despachador usar basado en el tipo de dispositivo
 * o su configuración (ej. prefijo "ha:" en externalId).
 */
export class CompositeCommandDispatcher implements DeviceCommandDispatcherPort {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly localDispatcher: DeviceCommandDispatcherPort,
    private readonly haDispatcher: DeviceCommandDispatcherPort
  ) {}

  public async dispatch(deviceId: string, command: DeviceCommandV1): Promise<void> {
    const device = await this.deviceRepository.findDeviceById(deviceId);
    if (!device) throw new Error(`Dispositivo ${deviceId} no encontrado`);

    // Ruteo V1 basado en prefijo de externalId
    if (device.externalId.startsWith('ha:')) {
      return this.haDispatcher.dispatch(deviceId, command);
    }

    // Por defecto usar el dispatcher local
    return this.localDispatcher.dispatch(deviceId, command);
  }
}
