import type { DeviceDriver, DeviceDriverCommand, DeviceDriverContext, DeviceDriverResult } from '../../../devices/domain/drivers/DeviceDriver';
import type { Device } from '../../../devices/domain/types';
import type { AndroidDisplaySourceRepository } from '../domain/AndroidDisplaySource';
import type { AndroidDisplayBridgePort, BridgeAction } from '../application/AndroidDisplayBridgePort';

export class AndroidDisplayDeviceDriver implements DeviceDriver {
  constructor(
    private readonly sources: AndroidDisplaySourceRepository,
    private readonly bridge: AndroidDisplayBridgePort,
  ) {}

  supports(device: Device): boolean {
    return device.integrationSource === 'android-display' && device.type === 'smart_display';
  }

  async executeCommand(device: Device, command: DeviceDriverCommand, _context: DeviceDriverContext): Promise<DeviceDriverResult> {
    if (!this.supports(device) || device.semanticType !== 'smart_display') {
      return { success: false, error: 'DISPLAY_NOT_SUPPORTED' };
    }
    const source = this.sources.findByDeviceId(device.id);
    if (!source || source.homeId !== device.homeId || !source.enabled || source.connectionState === 'identity_mismatch') {
      return { success: false, error: 'DISPLAY_UNAVAILABLE' };
    }
    if (command.name !== 'navigate_home' && command.name !== 'navigate_back' && command.name !== 'volume_set') {
      return { success: false, error: 'ACTION_UNSUPPORTED' };
    }
    const params = command.params ?? {};
    if (command.name === 'volume_set') {
      const value = params.volume;
      if (Object.keys(params).length !== 1 || typeof value !== 'number' || !Number.isInteger(value)
        || value < 0 || value > 100) return { success: false, error: 'INVALID_ACTION_PARAMS' };
    } else if (Object.keys(params).length) {
      return { success: false, error: 'INVALID_ACTION_PARAMS' };
    }
    try {
      const state = await this.bridge.connect(device.id, source.adbHost, source.adbPort);
      if (state !== 'online') return { success: false, error: 'DISPLAY_OFFLINE' };
      if (source.metadata.androidId) {
        const current = await this.bridge.inspect(device.id);
        if (!current.androidId || current.androidId !== source.metadata.androidId) {
          return { success: false, error: 'DISPLAY_IDENTITY_MISMATCH' };
        }
      }
      await this.bridge.execute(device.id, command.name as BridgeAction, params);
      return { success: true };
    } catch {
      return { success: false, error: 'DISPLAY_BRIDGE_UNAVAILABLE' };
    }
  }
}
