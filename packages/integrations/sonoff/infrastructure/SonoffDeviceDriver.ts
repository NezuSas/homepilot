import { DeviceDriver, DeviceDriverCommand, DeviceDriverContext, DeviceDriverResult } from '../../../devices/domain/drivers/DeviceDriver';
import { Device } from '../../../devices/domain/types';
import { SonoffConnectionRegistry } from '../application/SonoffLanDiscoveryService';
import { logRuntimeDiagnostic } from '../../../shared/config/runtimeEnvironment';

/**
 * SonoffDeviceDriver
 * 
 * Driver para controlar dispositivos Sonoff a través de la red local (LAN mode).
 */
/**
 * The error code a Sonoff reports in its LAN response body, or null when it reported none — including
 * when there is no readable body at all, which is not evidence that the command was refused.
 */
async function readReportedError(response: { json?: unknown }): Promise<string | null> {
  if (typeof response.json !== 'function') return null;
  try {
    const body = await (response.json as () => Promise<unknown>)() as { error?: unknown } | null;
    const reported = body?.error;
    if (reported === undefined || reported === null) return null;
    return Number(reported) === 0 ? null : String(reported);
  } catch {
    return null;
  }
}

export class SonoffDeviceDriver implements DeviceDriver {
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

    logRuntimeDiagnostic('log', `[Sonoff-LAN] Ejecutando comando LAN: ${targetState} en ${targetIp}`);

    try {
      await this.dispatchWithRetry(targetIp, externalIdMatch, targetState);

      // Verificación de estado post-comando
      const verified = await this.verifyState(targetIp, externalIdMatch);
      const finalState = verified.confirmed ? verified.state : targetState;

      const newState: Record<string, unknown> = { ...device.lastKnownState as Record<string, unknown> };
      newState.on = (finalState === 'on');
      newState.state = finalState;
      // The command was accepted but the device did not confirm it, so the state shown is what was asked
      // for, not what was read back. Same marker the Modbus driver uses for an unconfirmed write.
      newState.confirmation = verified.confirmed ? 'confirmed' : 'unconfirmed';

      if (finalState === 'off') {
        if ('brightness' in newState) newState.brightness = 0;
        if ('power' in newState) newState.power = 0;
      }

      if (!verified.confirmed) {
        logRuntimeDiagnostic('warn', `[Sonoff-LAN] ${externalIdMatch} aceptó ${targetState} pero no confirmó su estado.`);
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

      try {
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

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        // The eWeLink LAN endpoint answers 200 and reports the outcome in the body. A device that refused
        // the command — a wrong deviceid, an IP that DHCP reassigned to another Sonoff, a device in
        // encrypted LAN mode — returns 200 and does not switch, so the envelope alone proves nothing.
        // Only an explicitly reported error fails the dispatch: a body that is absent or unreadable is
        // not evidence of refusal, and the verification step below is honest about not having confirmed.
        const reported = await readReportedError(response);
        if (reported !== null) {
          throw new Error(`El dispositivo rechazó el comando (error ${reported})`);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e: unknown) {
      if (retryCount < 1) {
        return this.dispatchWithRetry(targetIp, deviceId, targetState, retryCount + 1);
      }
      throw e;
    }
  }

  /**
   * Asks the device what state it is actually in.
   *
   * Returning the optimistic value when the read fails is what made a refused command look like a
   * success: the user saw the light on while standing in the dark. The caller is told whether the state
   * was confirmed by the device or merely accepted, so it can say so instead of asserting it.
   */
  private async verifyState(targetIp: string, deviceId: string): Promise<{ confirmed: true; state: string } | { confirmed: false }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(`http://${targetIp}:8081/zeroconf/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceid: deviceId.replace('eWeLink_', ''),
            data: {}
          }),
          signal: controller.signal
        });

        if (response.ok) {
          const body = await response.json().catch(() => null) as { data?: { switch?: unknown } } | null;
          const reported = body?.data?.switch;
          if (reported === 'on' || reported === 'off') return { confirmed: true, state: reported };
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Falls through to the unconfirmed answer below.
    }
    return { confirmed: false };
  }
}
