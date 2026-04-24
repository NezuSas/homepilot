import { DeviceDriver, DeviceDriverCommand, DeviceDriverContext, DeviceDriverResult } from '../../../devices/domain/drivers/DeviceDriver';
import { Device } from '../../../devices/domain/types';
import { HomeAssistantConnectionProvider } from '../application/HomeAssistantConnectionProvider';

/**
 * HomeAssistantDeviceDriver
 * 
 * Adaptador que permite a HomePilot controlar dispositivos gestionados por Home Assistant.
 */
export class HomeAssistantDeviceDriver implements DeviceDriver {
  constructor(
    private readonly connectionProvider: HomeAssistantConnectionProvider
  ) {}

  public supports(device: Device): boolean {
    return device.integrationSource === 'ha' || device.integrationSource === 'home_assistant';
  }

  public async executeCommand(
    device: Device,
    command: DeviceDriverCommand,
    context: DeviceDriverContext
  ): Promise<DeviceDriverResult> {
    // Parsing seguro del externalId
    const parts = device.externalId.split(':');
    if (parts.length < 2 || parts[0] !== 'ha') {
      return { success: false, error: `ExternalId inválido. Se esperaba prefijo 'ha:', se recibió: '${device.externalId}'` };
    }

    const fullEntityId = parts[1];
    const entityParts = fullEntityId.split('.');
    if (entityParts.length < 2) {
      return { success: false, error: `Formato de entityId inválido en Home Assistant: '${fullEntityId}'` };
    }

    const haDomain = entityParts[0];
    const entityId = fullEntityId;
    
    let domain = 'homeassistant';
    let service = '';

    const cmdName = command.name;

    if (cmdName === 'turn_on') service = 'turn_on';
    else if (cmdName === 'turn_off') service = 'turn_off';
    else if (cmdName === 'toggle') service = 'toggle';
    else if (cmdName === 'open' && haDomain === 'cover') {
      domain = 'cover';
      service = 'open_cover';
    } else if (cmdName === 'close' && haDomain === 'cover') {
      domain = 'cover';
      service = 'close_cover';
    } else if (cmdName === 'stop' && haDomain === 'cover') {
      domain = 'cover';
      service = 'stop_cover';
    } else if (cmdName === 'set_position' && haDomain === 'cover') {
      // TODO: Implementar soporte de parámetros (position) cuando la capa superior lo permita
      return { success: false, error: 'Comando set_position no soportado todavía por falta de parámetros en el flujo' };
    }

    if (!service) {
      return { success: false, error: `Comando ${cmdName} no soportado para el dominio ${haDomain}` };
    }

    try {
      if (!this.connectionProvider.hasClient()) {
        throw new Error('Integración de Home Assistant no configurada');
      }

      await this.connectionProvider.getClient().callService(domain, service, entityId);

      // Cálculo de estado optimista (Preservando lógica de HomeAssistantCommandDispatcher)
      const newState = this.calculateOptimisticState(device, cmdName);

      return {
        success: true,
        newState
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido en Home Assistant'
      };
    }
  }

  private calculateOptimisticState(device: Device, command: string): Record<string, unknown> {
    const newState: Record<string, unknown> = { ...device.lastKnownState as Record<string, unknown> };
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

    return newState;
  }
}
