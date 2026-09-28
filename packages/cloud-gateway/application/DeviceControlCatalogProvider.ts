import type { Device } from '../../devices/domain/types';
import type { DeviceCommandV1 } from '../../devices/domain/commands';
import type { BoardManifestV1, BoardManifestEntitlementCommandV1 } from './BoardManifestV1';
import { resolveEffectiveActions, type EffectiveAction } from './EffectiveActionsResolver';
import { manifestFreshness } from './ManifestSyncService';

export interface DeviceControlCatalogCommand {
  readonly key: string;
  readonly displayName: string;
  readonly implementationType: 'legacy_adb' | 'homepilot';
  readonly controlType: 'button' | 'slider';
  readonly visibility: 'visible' | 'hidden';
  readonly safetyLevel: 'normal' | 'sensitive';
  readonly requiresConfirmation: boolean;
  readonly executionRoute: 'homepilot' | 'intentflow' | null;
  readonly executableInHomePilot: boolean;
  readonly dashboardEligible: boolean;
  readonly semanticAction?: DeviceCommandV1;
}

export interface DeviceControlCatalog {
  readonly deviceId: string;
  readonly plan: { readonly id: number; readonly name: string | null; readonly type: string | null };
  readonly commands: ReadonlyArray<DeviceControlCatalogCommand>;
}

export interface DeviceControlCatalogPorts {
  readonly cache: {
    getState(): { installationId: string; lastSuccessAt: string } | null;
    getByDeviceId(deviceId: string): BoardManifestV1 | null;
  };
  readonly devices: { findDeviceById(deviceId: string): Promise<Device | null> };
}

export class DeviceControlCatalogProvider {
  constructor(private readonly ports: DeviceControlCatalogPorts, private readonly now: () => number = Date.now) {}

  async getForDeviceId(deviceId: string): Promise<DeviceControlCatalog | null> {
    const device = await this.ports.devices.findDeviceById(deviceId);
    return device ? this.getForDevice(device) : null;
  }

  getForDevice(device: Device): DeviceControlCatalog | null {
    const manifest = this.ports.cache.getByDeviceId(device.id);
    return manifest ? this.catalogFromManifest(device, manifest) : null;
  }

  resolveActionForDevice(device: Device, actionKey: string): {
    boardId: number; command: DeviceControlCatalogCommand;
  } | null {
    const manifest = this.ports.cache.getByDeviceId(device.id);
    if (!manifest) return null;
    const command = this.catalogFromManifest(device, manifest)?.commands.find((item) => item.key === actionKey);
    return command ? { boardId: manifest.boardId, command } : null;
  }

  private catalogFromManifest(device: Device, manifest: BoardManifestV1): DeviceControlCatalog | null {
    if (manifest.homePilotDeviceId !== device.id) return null;
    const fresh = manifestFreshness(this.ports.cache.getState()?.lastSuccessAt ?? null, this.now()) !== 'EXPIRED';
    let effective: ReadonlyArray<EffectiveAction> = [];
    if (fresh) {
      try { effective = resolveEffectiveActions(manifest, device); }
      catch { return null; }
    }
    const effectiveByKey = new Map(effective.map((action) => [action.key, action]));
    const commercial: ReadonlyArray<BoardManifestEntitlementCommandV1> = manifest.entitlement?.commands
      ?? manifest.actions.map(({ key, displayName, implementationType, controlType, visibility, safetyLevel, requiresConfirmation }) => ({
        key, displayName, implementationType, controlType, visibility, safetyLevel, requiresConfirmation,
      }));
    return {
      deviceId: device.id,
      plan: manifest.entitlement?.plan ?? { id: manifest.planId, name: null, type: null },
      commands: commercial.map((command) => {
        const action = effectiveByKey.get(command.key);
        const localMatch = Boolean(action)
          && action?.controlType === command.controlType
          && action?.visibility === command.visibility
          && action?.safetyLevel === command.safetyLevel
          && action?.requiresConfirmation === command.requiresConfirmation;
        const executionRoute: DeviceControlCatalogCommand['executionRoute'] = !fresh ? null : command.implementationType === 'legacy_adb'
          ? 'intentflow' : localMatch ? 'homepilot' : null;
        const executableInHomePilot = executionRoute !== null;
        return {
          ...command,
          executionRoute,
          executableInHomePilot,
          dashboardEligible: executableInHomePilot && command.visibility === 'visible'
            && command.controlType === 'button' && command.requiresConfirmation === false,
          ...(executionRoute === 'homepilot' && action ? { semanticAction: action.semanticAction } : {}),
        };
      }),
    };
  }

  listDashboardActionsForDevices(devices: ReadonlyArray<Device>): ReadonlyArray<{
    deviceId: string; actionKey: string; displayName: string; deviceName: string;
  }> {
    return devices.flatMap((device) => {
      if (device.integrationSource !== 'android-display') return [];
      const catalog = this.getForDevice(device);
      return catalog?.commands.filter((command) => command.dashboardEligible).map((command) => ({
        deviceId: device.id, actionKey: command.key,
        displayName: command.displayName, deviceName: device.name,
      })) ?? [];
    });
  }
}
