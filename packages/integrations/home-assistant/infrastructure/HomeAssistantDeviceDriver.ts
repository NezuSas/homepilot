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
    let dispatchedCommand = cmdName;
    let dispatchedParams = command.params;

    if (haDomain === 'cover' && device.invertState) {
      if (cmdName === 'open') dispatchedCommand = 'close';
      else if (cmdName === 'close') dispatchedCommand = 'open';
      else if (cmdName === 'set_position' && typeof command.params?.position === 'number') {
        dispatchedParams = { ...command.params, position: 100 - command.params.position };
      }
    }

    if (dispatchedCommand === 'turn_on') service = 'turn_on';
    else if (dispatchedCommand === 'turn_off') service = 'turn_off';
    else if (dispatchedCommand === 'toggle') service = 'toggle';
    else if (dispatchedCommand === 'media_play' && haDomain === 'media_player') {
      domain = 'media_player';
      service = 'media_play';
    } else if (dispatchedCommand === 'media_pause' && haDomain === 'media_player') {
      domain = 'media_player';
      service = 'media_pause';
    } else if (dispatchedCommand === 'media_previous_track' && haDomain === 'media_player') {
      domain = 'media_player';
      service = 'media_previous_track';
    } else if (dispatchedCommand === 'media_next_track' && haDomain === 'media_player') {
      domain = 'media_player';
      service = 'media_next_track';
    } else if (dispatchedCommand === 'volume_set' && haDomain === 'media_player') {
      const requestedVolume = command.params?.volume;

      // Validación estricta de parámetros
      if (requestedVolume === undefined || requestedVolume === null) {
        return { success: false, error: 'Parámetro volume es requerido para volume_set' };
      }
      if (typeof requestedVolume !== 'number' || requestedVolume < 0 || requestedVolume > 100) {
        return { success: false, error: 'Parámetro volume debe ser un número entre 0 y 100' };
      }

      domain = 'media_player';
      service = 'volume_set';
      data = { volume_level: requestedVolume / 100 };
    }
    else if (dispatchedCommand === 'open' && haDomain === 'cover') {
      domain = 'cover';
      service = 'open_cover';
    } else if (dispatchedCommand === 'close' && haDomain === 'cover') {
      domain = 'cover';
      service = 'close_cover';
    } else if (dispatchedCommand === 'stop' && haDomain === 'cover') {
      domain = 'cover';
      service = 'stop_cover';
    } else if (dispatchedCommand === 'set_position' && haDomain === 'cover') {
      const requestedPosition = command.params?.position;
      
      // Validación estricta de parámetros
      if (requestedPosition === undefined || requestedPosition === null) {
        return { success: false, error: 'Parámetro position es requerido para set_position' };
      }
      if (typeof requestedPosition !== 'number' || requestedPosition < 0 || requestedPosition > 100) {
        return { success: false, error: 'Parámetro position debe ser un número entre 0 y 100' };
      }

      domain = 'cover';
      service = 'set_cover_position';
      data = { position: dispatchedParams?.position };
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
      const newState = this.calculateOptimisticState(device, dispatchedCommand, dispatchedParams);

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
    } else if (command === 'open') {
      newState.state = 'open';
      newState.current_position = 100;
      newState.position = 100;
    } else if (command === 'close') {
      newState.state = 'closed';
      newState.current_position = 0;
      newState.position = 0;
    } else if (command === 'media_play') {
      newState.state = 'playing';
      newState.on = true;
    } else if (command === 'media_pause') {
      newState.state = 'paused';
      newState.on = true;
    } else if (command === 'volume_set') {
      const volume = params?.volume as number;
      newState.volume_level = volume / 100;
    }

    return newState;
  }
}
