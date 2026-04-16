import { DeviceCommandDispatcherPort } from '../../packages/devices/application/ports/DeviceCommandDispatcherPort';
import { DeviceCommandV1 } from '../../packages/devices/domain/commands';
import { DeviceRepository } from '../../packages/devices/domain/repositories/DeviceRepository';

/**
 * IntegrationCommandRouter
 * 
 * Multiplexor que enruta la ejecución de comandos (Side-Effects) 
 * hacia el dispatcher adecuado basado en el 'integrationSource' del Device.
 */
export class IntegrationCommandRouter implements DeviceCommandDispatcherPort {
  private routes: Map<string, DeviceCommandDispatcherPort> = new Map();

  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly defaultDispatcher: DeviceCommandDispatcherPort
  ) {}

  public registerRoute(integrationSource: string, dispatcher: DeviceCommandDispatcherPort): void {
    this.routes.set(integrationSource, dispatcher);
  }

  public async dispatch(deviceId: string, command: DeviceCommandV1): Promise<void> {
    const device = await this.deviceRepository.findDeviceById(deviceId);
    if (!device) throw new Error(`Dispositivo ${deviceId} no encontrado`);

    const specificDispatcher = this.routes.get(device.integrationSource);
    
    if (specificDispatcher) {
      return specificDispatcher.dispatch(deviceId, command);
    }

    // Por defecto usar el fallback (ej. local / genérico)
    return this.defaultDispatcher.dispatch(deviceId, command);
  }
}
