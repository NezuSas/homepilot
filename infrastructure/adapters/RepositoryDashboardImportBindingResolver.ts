import type { DashboardImportBindingResolver, DashboardImportTarget } from '../../packages/topology/domain/Dashboard';
import type { DeviceRepository } from '../../packages/devices/domain/repositories/DeviceRepository';
import type { RoomRepository } from '../../packages/topology/domain/repositories/RoomRepository';
import type { SceneRepository } from '../../packages/devices/domain/repositories/SceneRepository';
import type { AutomationRuleRepository } from '../../packages/devices/domain/repositories/AutomationRuleRepository';
import type { DeviceControlCatalogProvider } from '../../packages/cloud-gateway/application/DeviceControlCatalogProvider';
import type { Device } from '../../packages/devices/domain/types';
import type { CapabilityCommand } from '../../packages/devices/domain/capabilities';

function supports(device: Device, kind?: string): boolean {
  if (!kind) return true;
  const types = [device.type, device.semanticType];
  const has = (...values: string[]) => types.some((type) => type !== null && type !== undefined && values.includes(type));
  if (kind === 'camera') return has('camera');
  if (kind === 'cover') return has('cover');
  if (kind === 'light') return has('light', 'switch', 'outlet');
  if (kind === 'sensor') return has('sensor', 'binary_sensor');
  if (kind === 'media') return has('media_player');
  if (kind === 'device') return !has('camera', 'sensor', 'binary_sensor', 'media_player');
  if (kind === 'action') return device.capabilities?.some((capability) =>
    'commands' in capability && Array.isArray(capability.commands)
      && capability.commands.some((command: CapabilityCommand) => command.name === 'press' || command.name === 'activate')) ?? false;
  return false;
}

export class RepositoryDashboardImportBindingResolver implements DashboardImportBindingResolver {
  constructor(
    private readonly devices: DeviceRepository,
    private readonly rooms: RoomRepository,
    private readonly scenes: SceneRepository,
    private readonly automations: AutomationRuleRepository,
    private readonly controlCatalog: DeviceControlCatalogProvider,
  ) {}

  async exists(authorizedHomeIds: ReadonlySet<string>, target: DashboardImportTarget): Promise<boolean> {
    if (!target.id || authorizedHomeIds.size === 0) return false;
    if (target.type === 'device' || target.type === 'device-action') {
      const device = await this.devices.findDeviceById(target.id);
      if (!device || !authorizedHomeIds.has(device.homeId)) return false;
      if (target.type === 'device-action') {
        try {
          return Boolean(target.actionKey && this.controlCatalog.getForDevice(device)?.commands.some((command) =>
            command.key === target.actionKey && command.dashboardEligible));
        } catch {
          // A stale/unavailable commercial catalog cannot authorize an imported action.
          return false;
        }
      }
      return supports(device, target.cardKind);
    }
    if (target.type === 'room') {
      const room = await this.rooms.findRoomById(target.id);
      return Boolean(room && authorizedHomeIds.has(room.homeId));
    }
    if (target.type === 'scene' || target.type === 'action') {
      if (target.type === 'action') {
        const device = await this.devices.findDeviceById(target.id);
        if (device && authorizedHomeIds.has(device.homeId) && supports(device, 'action')) return true;
      }
      const scene = await this.scenes.findSceneById(target.id);
      return Boolean(scene && authorizedHomeIds.has(scene.homeId));
    }
    if (target.type === 'automation') {
      const automation = await this.automations.findById(target.id);
      return Boolean(automation && authorizedHomeIds.has(automation.homeId));
    }
    return false;
  }
}
