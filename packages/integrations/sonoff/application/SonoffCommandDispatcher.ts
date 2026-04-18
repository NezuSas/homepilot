import { DeviceCommandDispatcherPort } from '../../../devices/application/ports/DeviceCommandDispatcherPort';
import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import { syncDeviceStateUseCase, SyncDeviceStateDependencies } from '../../../devices/application/syncDeviceStateUseCase';
import { SonoffConnectionRegistry } from './SonoffLanDiscoveryService';

export class SonoffCommandDispatcher implements DeviceCommandDispatcherPort {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly syncDeps: SyncDeviceStateDependencies,
    private readonly correlationId: string = 'sonoff-lan-sync'
  ) {}

  private logInfo(message: string): void {
    if (process.env.NODE_ENV !== 'test') {
      console.log(message);
    }
  }

  public async dispatch(deviceId: string, command: DeviceCommandV1): Promise<void> {
    const device = await this.deviceRepository.findDeviceById(deviceId);
    if (!device) throw new Error(`Dispositivo ${deviceId} no encontrado para despacho Sonoff LAN`);

    if (!device.externalId.startsWith('sonoff:')) {
      throw new Error(`El dispositivo ${deviceId} no tiene un externalId válido de Sonoff (sonoff:...)`);
    }

    const externalIdMatch = device.externalId.split(':')[1];
    
    // Default fallback switch values
    let targetState = 'on';

    if (command === 'turn_on') {
      targetState = 'on';
    } else if (command === 'turn_off') {
      targetState = 'off';
    } else if (command === 'toggle') {
      const isCurrentlyOn = device.lastKnownState?.on === true || device.lastKnownState?.state === 'on';
      targetState = isCurrentlyOn ? 'off' : 'on';
    } else {
      throw new Error(`Comando ${command} no soportado temporalmente para dispositivos Sonoff por LAN`);
    }

    let targetIp = SonoffConnectionRegistry.getIp(externalIdMatch);
    if (!targetIp) {
      targetIp = typeof device.lastKnownState?.ip === 'string' ? device.lastKnownState.ip : null;
    }
    
    if (!targetIp) {
      throw new Error(`Falta dirección IP (no descubierta) para el dispositivo Sonoff LAN ${externalIdMatch}`);
    }

    this.logInfo(`[Sonoff-LAN] Despachando comando LAN local: ${targetState} hacia IP ${targetIp} (${externalIdMatch})`);

    const dispatchWithRetry = async (retryCount = 0): Promise<void> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 sec protection
        
        // Basic Node standard fetch to zeroconf endpoint
        const url = `http://${targetIp}:8081/zeroconf/switch`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceid: externalIdMatch.replace('eWeLink_', ''), // naive extraction for v1
            data: {
              switch: targetState
            }
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Error de red HTTP ${response.status} en la comunicación Sonoff LAN`);
        }
      } catch (e: any) {
        if (retryCount < 1) {
          this.logInfo(`[Sonoff-LAN] Fallo de red detectado, reintentando (1/1)...`);
          return dispatchWithRetry(retryCount + 1);
        }
        throw e;
      }
    };

    try {
      await dispatchWithRetry();
    } catch (e) {
      // Throw cleanly to ensure failures are routed back to the invoker properly instead of failing silently 
      throw new Error(`Error accediendo físicamente a ${targetIp}: ${(e as Error).message}`);
    }

    // Optimistic sync if successful 
    const newState: Record<string, unknown> = { ...device.lastKnownState };
    
    newState.on = (targetState === 'on');
    newState.state = targetState;

    if (targetState === 'off') {
       if ('brightness' in newState) newState.brightness = 0;
       if ('power' in newState) newState.power = 0;
    }

    await syncDeviceStateUseCase(deviceId, newState, this.correlationId, this.syncDeps);
  }
}
