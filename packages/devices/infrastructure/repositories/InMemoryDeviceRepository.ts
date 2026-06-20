import { DeviceRepository } from '../../domain/repositories/DeviceRepository';
import { Device, DeviceSemanticType } from '../../domain/types';

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

  async deleteDevice(deviceId: string): Promise<void> {
    this.devices.delete(deviceId);
  }

  async findDeviceById(deviceId: string): Promise<Device | null> {
    const device = this.devices.get(deviceId);
    if (!device) return null;
    return Object.freeze({ ...device });
  }

  async findInboxByHomeId(homeId: string): Promise<ReadonlyArray<Device>> {
    const inbox: Device[] = [];
    for (const device of this.devices.values()) {
      if (device.homeId === homeId && device.roomId === null && device.status === 'PENDING') {
        inbox.push(Object.freeze({ ...device }));
      }
    }
    return Object.freeze(inbox);
  }

  async findAll(): Promise<ReadonlyArray<Device>> {
    const all: Device[] = [];
    for (const device of this.devices.values()) {
      all.push(Object.freeze({ ...device }));
    }
    return Object.freeze(all);
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

  async findAllByHomeId(homeId: string): Promise<ReadonlyArray<Device>> {
    const all: Device[] = [];
    for (const device of this.devices.values()) {
      if (device.homeId === homeId) {
        all.push(Object.freeze({ ...device }));
      }
    }
    return Object.freeze(all);
  }

  async findAllOrderedByStatus(): Promise<ReadonlyArray<Device>> {
    const all = Array.from(this.devices.values()).map(d => Object.freeze({ ...d }));
    // Sort by status DESC (ASSIGNED > PENDING) then created_at DESC
    return all.sort((a, b) => {
      if (a.status !== b.status) {
        return b.status.localeCompare(a.status);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  async findAllExternalIdsByPrefix(prefix: string): Promise<ReadonlyArray<string>> {
    const ids: string[] = [];
    for (const device of this.devices.values()) {
      if (device.externalId.startsWith(prefix)) {
        ids.push(device.externalId);
      }
    }
    return Object.freeze(ids);
  }

  async updateSemanticType(deviceId: string, semanticType: DeviceSemanticType | null): Promise<void> {
    const device = this.devices.get(deviceId);
    if (device) {
      const updatedDevice = Object.freeze({
        ...device,
        semanticType,
        updatedAt: new Date().toISOString(),
      });
      this.devices.set(deviceId, updatedDevice);
    }
  }
}
