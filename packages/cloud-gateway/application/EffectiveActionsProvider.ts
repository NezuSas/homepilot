import type { Device } from '../../devices/domain/types';
import type { BoardManifestV1 } from './BoardManifestV1';
import { manifestFreshness, type ManifestFreshness } from './ManifestSyncService';
import { resolveEffectiveActions, type EffectiveAction } from './EffectiveActionsResolver';

export interface EffectiveActionsProviderPorts {
  readonly cache: {
    getState(): { installationId: string; lastSuccessAt: string } | null;
    getByDeviceId(deviceId: string): BoardManifestV1 | null;
  };
  readonly devices: { findDeviceById(deviceId: string): Promise<Device | null> };
}

export class EffectiveActionsProvider {
  constructor(private readonly ports: EffectiveActionsProviderPorts, private readonly now: () => number = Date.now) {}

  getFreshness(): ManifestFreshness {
    return manifestFreshness(this.ports.cache.getState()?.lastSuccessAt ?? null, this.now());
  }

  async getForDeviceId(deviceId: string): Promise<ReadonlyArray<EffectiveAction>> {
    if (this.getFreshness() === 'EXPIRED') return [];
    const manifest = this.ports.cache.getByDeviceId(deviceId);
    if (!manifest) return [];
    const device = await this.ports.devices.findDeviceById(deviceId);
    return device ? resolveEffectiveActions(manifest, device) : [];
  }
}
