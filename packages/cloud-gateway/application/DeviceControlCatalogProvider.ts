import type { Device } from '../../devices/domain/types';
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
  readonly executableInHomePilot: boolean;
  readonly dashboardEligible: boolean;
  readonly semanticAction?: string;
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
    if (!manifest) return null;
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
        const executableInHomePilot = Boolean(action)
          && command.implementationType === 'homepilot'
          && action?.controlType === command.controlType
          && action?.visibility === command.visibility
          && action?.safetyLevel === command.safetyLevel
          && action?.requiresConfirmation === command.requiresConfirmation;
        return {
          ...command,
          executableInHomePilot,
          dashboardEligible: executableInHomePilot && command.visibility === 'visible'
            && command.controlType === 'button' && command.requiresConfirmation === false,
          ...(executableInHomePilot && action ? { semanticAction: action.semanticAction } : {}),
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
