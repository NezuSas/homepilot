import { DeviceRepository } from '../../domain/repositories/DeviceRepository';
import { Device } from '../../domain/types';

/**
 * Adaptador de persistencia temporal en memoria para desarrollo local y pruebas E2E.
 * Garantiza determinismo y aísla el comportamiento relacional de la Base de Datos real.
 */
export class InMemoryDeviceRepository implements DeviceRepository {
  private devices: Map<string, Device> = new Map();

  async saveDevice(device: Device): Promise<void> {
    // Almacenamiento hermético aislando apuntadores mediante una copia congelada
    const frozenDevice = Object.freeze({ ...device });
    this.devices.set(device.id, frozenDevice);
  }

  async findDeviceById(deviceId: string): Promise<Device | null> {
    const device = this.devices.get(deviceId);
    if (!device) return null;
    return Object.freeze({ ...device });
  }

  async findInboxByHomeId(homeId: string): Promise<ReadonlyArray<Device>> {
    const inbox: Device[] = [];
    
    // Filtrado funcional estricto demandado por el Spec
    for (const device of this.devices.values()) {
      if (device.homeId === homeId && device.roomId === null && device.status === 'PENDING') {
        inbox.push(Object.freeze({ ...device }));
      }
    }
    
    return Object.freeze(inbox);
  }

  async findByExternalIdAndHomeId(externalId: string, homeId: string): Promise<Device | null> {
    for (const device of this.devices.values()) {
      if (device.externalId === externalId && device.homeId === homeId) {
        return Object.freeze({ ...device });
      }
    }
    return null;
  }

  async findByExternalId(externalId: string): Promise<Device | null> {
    for (const device of this.devices.values()) {
      if (device.externalId === externalId) {
        return Object.freeze({ ...device });
      }
    }
    return null;
  }
}
