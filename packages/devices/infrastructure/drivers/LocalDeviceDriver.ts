import { DeviceDriver, DeviceDriverCommand, DeviceDriverContext, DeviceDriverResult } from '../../domain/drivers/DeviceDriver';
import { Device } from '../../domain/types';

/**
 * LocalDeviceDriver
 * 
 * Driver simulado para dispositivos locales o en desarrollo.
 * Útil para pruebas y para la consola local.
 */
export class LocalDeviceDriver implements DeviceDriver {
  public supports(device: Device): boolean {
    return device.integrationSource === 'local';
  }

  public async executeCommand(
    device: Device,
    command: DeviceDriverCommand,
    context: DeviceDriverContext
  ): Promise<DeviceDriverResult> {
    console.log(`[LocalDriver] Ejecutando comando: ${command.name} en ${device.id}`);

    let newState: Record<string, unknown> = { ...device.lastKnownState as Record<string, unknown> };

    switch (command.name) {
      case 'turn_on':
        newState.on = true;
        newState.state = 'on';
        break;
      case 'turn_off':
        newState.on = false;
        newState.state = 'off';
        break;
      case 'toggle':
        const currentStatus = newState.on === true;
        newState.on = !currentStatus;
        newState.state = newState.on ? 'on' : 'off';
        break;
    }

    return {
      success: true,
      newState
    };
  }
}
