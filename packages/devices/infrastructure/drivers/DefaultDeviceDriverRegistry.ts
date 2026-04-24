import { DeviceDriver } from '../../domain/drivers/DeviceDriver';
import { DeviceDriverRegistry, DriverNotFoundError } from '../../domain/drivers/DeviceDriverRegistry';

/**
 * Implementación por defecto del registro de drivers.
 */
export class DefaultDeviceDriverRegistry implements DeviceDriverRegistry {
  private drivers = new Map<string, DeviceDriver>();

  public register(integrationSource: string, driver: DeviceDriver): void {
    this.drivers.set(integrationSource, driver);
  }

  /**
   * Resuelve el driver basado en el integrationSource.
   * NOTA: En el futuro se podrá usar driver.supports(device) para una resolución
   * más dinámica basada en capacidades o estados específicos del dispositivo.
   */
  public resolve(integrationSource: string): DeviceDriver {
    const driver = this.drivers.get(integrationSource);
    
    if (!driver) {
      throw new DriverNotFoundError(integrationSource);
    }

    return driver;
  }
}
