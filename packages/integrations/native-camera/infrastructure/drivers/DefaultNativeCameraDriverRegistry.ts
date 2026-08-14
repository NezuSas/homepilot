import type { NativeCameraSourceType } from '../../../../devices/domain/repositories/NativeCameraSourceRepository';
import type { NativeCameraDriver } from '../../application/ports/NativeCameraDriver';
import type { NativeCameraDriverRegistry } from '../../application/ports/NativeCameraDriverRegistry';

export class DefaultNativeCameraDriverRegistry implements NativeCameraDriverRegistry {
  private readonly drivers: ReadonlyMap<NativeCameraSourceType, NativeCameraDriver>;

  constructor(drivers: ReadonlyArray<NativeCameraDriver>) {
    this.drivers = new Map(drivers.map((driver) => [driver.sourceType, driver]));
  }

  public resolve(sourceType: NativeCameraSourceType): NativeCameraDriver {
    const driver = this.drivers.get(sourceType);
    if (!driver) {
      throw new Error(`No native camera driver registered for source type "${sourceType}"`);
    }
    return driver;
  }

  public discoverableDrivers(): ReadonlyArray<NativeCameraDriver> {
    return Array.from(this.drivers.values()).filter((driver) => driver.supportsDiscovery());
  }
}
