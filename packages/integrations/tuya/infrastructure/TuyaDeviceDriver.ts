import { DeviceDriver, DeviceDriverCommand, DeviceDriverContext, DeviceDriverResult } from '../../../devices/domain/drivers/DeviceDriver';
import { Device } from '../../../devices/domain/types';
import { TuyaIntegrationService } from '../application/TuyaIntegrationService';

export class TuyaDeviceDriver implements DeviceDriver {
  constructor(private readonly service: TuyaIntegrationService) {}
  public supports(device: Device): boolean { return device.integrationSource === 'tuya'; }
  public async executeCommand(device: Device, command: DeviceDriverCommand, _context: DeviceDriverContext): Promise<DeviceDriverResult> {
    if (!['open', 'close', 'stop', 'set_position'].includes(command.name)) return { success: false, error: 'TUYA_COMMAND_UNSUPPORTED' };
    const position = command.params?.position;
    if (command.name === 'set_position' && (typeof position !== 'number' || position < 0 || position > 100)) return { success: false, error: 'TUYA_POSITION_INVALID' };
    try {
      await this.service.executeCoverCommand(device, command.name, position as number | undefined);
      const next = { ...(device.lastKnownState || {}) };
      if (command.name === 'open') Object.assign(next, { state: 'open', current_position: 100 });
      if (command.name === 'close') Object.assign(next, { state: 'closed', current_position: 0 });
      if (command.name === 'set_position') Object.assign(next, { state: position === 0 ? 'closed' : 'open', current_position: position });
      return { success: true, newState: next };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'TUYA_COMMAND_FAILED' }; }
  }
}