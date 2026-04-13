import { DeviceCommandDispatcherPort } from '../../packages/devices/application/ports/DeviceCommandDispatcherPort';
import { DeviceCommandV1 } from '../../packages/devices/domain/commands';
import { HomeAssistantClient } from '../../packages/devices/infrastructure/adapters/HomeAssistantClient';
import { DeviceRepository } from '../../packages/devices/domain/repositories/DeviceRepository';
import { syncDeviceStateUseCase, SyncDeviceStateDependencies } from '../../packages/devices/application/syncDeviceStateUseCase';
import { HomeAssistantConnectionProvider } from '../../packages/integrations/home-assistant/application/HomeAssistantConnectionProvider';

/**
 * HomeAssistantCommandDispatcher
 * 
 * Implementación de DeviceCommandDispatcherPort que traduce comandos de HomePilot
 * a llamadas de servicio de Home Assistant.
 */
export class HomeAssistantCommandDispatcher implements DeviceCommandDispatcherPort {
  constructor(
    private readonly connectionProvider: HomeAssistantConnectionProvider,
    private readonly deviceRepository: DeviceRepository,
    private readonly syncDeps: SyncDeviceStateDependencies,
    private readonly correlationId: string = 'ha-bridge-sync'
  ) {}

  public async dispatch(deviceId: string, command: DeviceCommandV1): Promise<void> {
    const device = await this.deviceRepository.findDeviceById(deviceId);
    if (!device) throw new Error(`Dispositivo ${deviceId} no encontrado para despacho HA`);

    // El externalId debe tener el formato "ha:domain.entity_id"
    if (!device.externalId.startsWith('ha:')) {
      throw new Error(`El dispositivo ${deviceId} no tiene un externalId válido de Home Assistant (ha:...)`);
    }

    const fullEntityId = device.externalId.split(':')[1];
    const [domain] = fullEntityId.split('.');

    // Mapeo de comandos V1 a servicios de HA
    // Asumimos dominios estándar como light, switch, input_boolean, etc.
    let service = '';
    switch (command) {
      case 'turn_on': service = 'turn_on'; break;
      case 'turn_off': service = 'turn_off'; break;
      case 'toggle': service = 'toggle'; break;
      default: throw new Error(`Comando ${command} no soportado por el Bridge HA V1`);
    }

    console.log(`[HA-Bridge] Despachando servicio: ${domain}.${service} para ${fullEntityId}`);
    
    // Llamada física a HA (Solo si el cliente existe)
    if (!this.connectionProvider.hasClient()) {
      throw new Error(`Integración de Home Assistant no configurada. No se pudo ejecutar el comando en ${fullEntityId}`);
    }
    
    await this.connectionProvider.getClient().callService(domain, service, fullEntityId);

    // Sincronización optimista
    let newState: Record<string, unknown> = { ...device.lastKnownState };
    
    // Determine the current truth
    const isCurrentlyOn = newState.on === true || newState.state === 'on';

    if (command === 'turn_on') {
       newState.on = true;
       newState.state = 'on';
    } else if (command === 'turn_off') {
       newState.on = false;
       newState.state = 'off';
       if ('brightness' in newState) newState.brightness = 0;
       if ('power' in newState) newState.power = 0;
    } else if (command === 'toggle') {
       const turnedOn = !isCurrentlyOn;
       newState.on = turnedOn;
       newState.state = turnedOn ? 'on' : 'off';
       if (!turnedOn) {
         if ('brightness' in newState) newState.brightness = 0;
         if ('power' in newState) newState.power = 0;
       }
    }

    await syncDeviceStateUseCase(deviceId, newState, this.correlationId, this.syncDeps);
  }
}
