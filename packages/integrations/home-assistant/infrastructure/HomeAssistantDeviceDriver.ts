import { DeviceDriver, DeviceDriverCommand, DeviceDriverContext, DeviceDriverResult } from '../../../devices/domain/drivers/DeviceDriver';
import { Device } from '../../../devices/domain/types';
import { HomeAssistantConnectionProvider } from '../application/HomeAssistantConnectionProvider';

/**
 * HomeAssistantDeviceDriver
 * 
 * Adaptador que permite a HomePilot controlar dispositivos gestionados por Home Assistant.
 * Implementa Command Params V1 para soportar comandos parametrizados como set_position.
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
    let data: Record<string, unknown> | undefined = undefined;

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
      const position = command.params?.position;
      
      // Validación estricta de parámetros
      if (position === undefined || position === null) {
        return { success: false, error: 'Parámetro position es requerido para set_position' };
      }
      if (typeof position !== 'number' || position < 0 || position > 100) {
        return { success: false, error: 'Parámetro position debe ser un número entre 0 y 100' };
      }

      domain = 'cover';
      service = 'set_cover_position';
      data = { position };
    }

    if (!service) {
      return { success: false, error: `Comando ${cmdName} no soportado para el dominio ${haDomain}` };
    }

    try {
      if (!this.connectionProvider.hasClient()) {
        throw new Error('Integración de Home Assistant no configurada');
      }

      const t_ha = Date.now();
      await this.connectionProvider.getClient().callService(domain, service, entityId, data);
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[HomeAssistantDeviceDriver] callService ${domain}.${service} took ${Date.now() - t_ha}ms`);
      }

      // Cálculo de estado optimista
      const newState = this.calculateOptimisticState(device, cmdName, command.params);

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

  private calculateOptimisticState(device: Device, command: string, params?: Record<string, unknown>): Record<string, unknown> {
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
    } else if (command === 'set_position') {
      const position = params?.position as number;
      newState.current_position = position;
      newState.position = position;
      
      // Convención aprobada: 0 => closed, resto => open
      if (position === 0) {
        newState.state = 'closed';
      } else {
        newState.state = 'open';
      }
    }

    return newState;
  }
}
