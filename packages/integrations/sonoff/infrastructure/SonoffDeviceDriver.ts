import { DeviceDriver, DeviceDriverCommand, DeviceDriverContext, DeviceDriverResult } from '../../../devices/domain/drivers/DeviceDriver';
import { Device } from '../../../devices/domain/types';
import { SonoffConnectionRegistry } from '../application/SonoffLanDiscoveryService';

/**
 * SonoffDeviceDriver
 * 
 * Driver para controlar dispositivos Sonoff a través de la red local (LAN mode).
 */
export class SonoffDeviceDriver implements DeviceDriver {
  private logInfo(message: string): void {
    if (process.env.NODE_ENV !== 'test') {
      console.log(message);
    }
  }

  public supports(device: Device): boolean {
    return device.integrationSource === 'sonoff';
  }

  public async executeCommand(
    device: Device,
    command: DeviceDriverCommand,
    context: DeviceDriverContext
  ): Promise<DeviceDriverResult> {
    if (!device.externalId.startsWith('sonoff:')) {
      return { success: false, error: `ExternalId inválido para Sonoff: ${device.externalId}` };
    }

    const externalIdMatch = device.externalId.split(':')[1];
    let targetState = 'on';

    const cmdName = command.name;

    if (cmdName === 'turn_on') {
      targetState = 'on';
    } else if (cmdName === 'turn_off') {
      targetState = 'off';
    } else if (cmdName === 'toggle') {
      const isCurrentlyOn = device.lastKnownState?.on === true || device.lastKnownState?.state === 'on';
      targetState = isCurrentlyOn ? 'off' : 'on';
    } else {
      return { success: false, error: `Comando ${cmdName} no soportado para Sonoff LAN` };
    }

    let targetIp = SonoffConnectionRegistry.getIp(externalIdMatch);
    if (!targetIp) {
      targetIp = typeof device.lastKnownState?.ip === 'string' ? device.lastKnownState.ip : null;
    }
    
    if (!targetIp) {
      return { success: false, error: `Dirección IP no encontrada para ${externalIdMatch}` };
    }

    this.logInfo(`[Sonoff-LAN] Ejecutando comando LAN: ${targetState} en ${targetIp}`);

    try {
      await this.dispatchWithRetry(targetIp, externalIdMatch, targetState);
      
      // Verificación de estado post-comando
      const finalState = await this.verifyState(targetIp, externalIdMatch, targetState);
      
      const newState: Record<string, unknown> = { ...device.lastKnownState as Record<string, unknown> };
      newState.on = (finalState === 'on');
      newState.state = finalState;

      if (finalState === 'off') {
        if ('brightness' in newState) newState.brightness = 0;
        if ('power' in newState) newState.power = 0;
      }

      return {
        success: true,
        newState
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido en Sonoff LAN'
      };
    }
  }

  private async dispatchWithRetry(targetIp: string, deviceId: string, targetState: string, retryCount = 0): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const url = `http://${targetIp}:8081/zeroconf/switch`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceid: deviceId.replace('eWeLink_', ''),
          data: { switch: targetState }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
    } catch (e: unknown) {
      if (retryCount < 1) {
        return this.dispatchWithRetry(targetIp, deviceId, targetState, retryCount + 1);
      }
      throw e;
    }
  }

  private async verifyState(targetIp: string, deviceId: string, optimisticState: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`http://${targetIp}:8081/zeroconf/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceid: deviceId.replace('eWeLink_', ''),
          data: {}
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      if (response.ok) {
        const body = await response.json();
        return body?.data?.switch || optimisticState;
      }
    } catch (e) {
      // Ignorar errores de verificación, caer en estado optimista
    }
    return optimisticState;
  }
}
