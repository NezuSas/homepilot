import { DeviceCommandDispatcherPort } from '../../packages/devices/application/ports/DeviceCommandDispatcherPort';
import { DeviceCommandV1 } from '../../packages/devices/domain/commands';
import { HomeAssistantClient } from '../../packages/devices/infrastructure/adapters/HomeAssistantClient';
import { DeviceRepository } from '../../packages/devices/domain/repositories/DeviceRepository';
import { syncDeviceStateUseCase, SyncDeviceStateDependencies } from '../../packages/devices/application/syncDeviceStateUseCase';

/**
 * HomeAssistantCommandDispatcher
 * 
 * Implementación de DeviceCommandDispatcherPort que traduce comandos de HomePilot
 * a llamadas de servicio de Home Assistant.
 */
export class HomeAssistantCommandDispatcher implements DeviceCommandDispatcherPort {
  constructor(
    private readonly haClient: HomeAssistantClient,
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
    
    // Llamada física a HA
    await this.haClient.callService(domain, service, fullEntityId);

    // Sincronización optimista (u opcionalmente recargar estado real)
    // Para V1, simulamos el cambio localmente para respuesta inmediata de UI
    let newState: Record<string, unknown> = { ...device.lastKnownState };
    if (command === 'turn_on') newState.on = true;
    if (command === 'turn_off') newState.on = false;
    if (command === 'toggle') newState.on = !(device.lastKnownState?.on === true);

    await syncDeviceStateUseCase(deviceId, newState, this.correlationId, this.syncDeps);
  }
}
