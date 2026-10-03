import { Device } from './types';
import { DeviceCommandRequest } from './commands';
import { CapabilityCommand } from './capabilities';
import { resolveCapabilitiesForDevice, capabilityCommandsForDevice } from './CapabilityResolver';

/**
 * ValidationResult
 * Resultado de la validación de un comando.
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

/**
 * validateDeviceCommand
 * 
 * Valida si un comando y sus parámetros son compatibles con las capacidades del dispositivo.
 * Implementa un enfoque conservador para no romper dispositivos existentes no identificados.
 */
export function validateDeviceCommand(device: Device, command: DeviceCommandRequest): ValidationResult {
  if (device.integrationSource === 'modbus-tcp') {
    const state = device.lastKnownState;
    if (command.name === 'set_value') return state?.plcRole === 'setpoint' && state.writable === true && typeof command.params?.value === 'number' && Number.isFinite(command.params.value) && Object.keys(command.params).length === 1 ? { valid: true } : { valid: false, error: 'Invalid PLC setpoint command.' };
    if (command.name === 'pulse' || command.name === 'press') return state?.plcMode === 'pulse' && state.writable === true && !Object.keys(command.params ?? {}).length ? { valid: true } : { valid: false, error: 'PLC pulse is not configured.' };
  } else if (command.name === 'pulse' || command.name === 'set_value') return { valid: false, error: 'PLC command not supported by this integration.' };
  const capabilities = resolveCapabilitiesForDevice(device);

  if (device.integrationSource === 'android-display') {
    if (capabilities.length !== 1 || capabilities[0].type !== 'smart_display') {
      return { valid: false, error: 'Smart Display sin capacidad explícita válida.' };
    }
    if (command.name === 'navigate_home' || command.name === 'navigate_back') {
      return command.params && Object.keys(command.params).length > 0
        ? { valid: false, error: 'Esta acción no acepta parámetros.' }
        : { valid: true };
    }
    if (command.name === 'volume_set') {
      const params = command.params;
      const value = params?.volume;
      return params && Object.keys(params).length === 1 && typeof value === 'number'
        && Number.isInteger(value) && value >= 0 && value <= 100
        ? { valid: true }
        : { valid: false, error: 'volume_set requiere volume entero entre 0 y 100.' };
    }
    return { valid: false, error: 'Acción no soportada para Smart Display.' };
  }

  if (command.name === 'navigate_home' || command.name === 'navigate_back') {
    return { valid: false, error: 'Navegación Android no soportada por esta integración.' };
  }

  // Fallback conservador: Si no hay capacidades inferidas, permitir comandos legacy para no romper dispositivos raros.
  // Esto asegura que la transición a capacidades sea incremental.
  if (capabilities.length === 0) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[CapabilityValidator] Device ${device.id} (${device.externalId}) has no resolvable capabilities. Allowing legacy execution.`);
    }
    return { valid: true };
  }

  // Buscar si alguna capacidad del dispositivo soporta el comando solicitado
  let supportedCommand: CapabilityCommand | undefined;
  let anyCapabilityHasCommands = false;

  for (const cap of capabilities) {
    const definition = capabilityCommandsForDevice(device, cap.type);
    if (definition && definition.length > 0) {
      anyCapabilityHasCommands = true;
      const found = definition.find(cmd => cmd.name === command.name);
      if (found) {
        supportedCommand = found;
        break;
      }
    }
  }

  // Si el comando no es soportado por ninguna de las capacidades identificadas
  if (!supportedCommand) {
    // Caso especial: Si el dispositivo es un sensor explícito (sin comandos), rechazar siempre.
    const isExplicitSensor = capabilities.some(c => c.type === 'sensor' || c.type === 'binary_sensor');
    if (isExplicitSensor && !anyCapabilityHasCommands) {
      return { 
        valid: false, 
        error: `El dispositivo "${device.name}" es de tipo sensor y no soporta comandos operativos.` 
      };
    }

    return { 
      valid: false, 
      error: `Comando "${command.name}" no soportado por las capacidades del dispositivo "${device.name}".` 
    };
  }

  // Validación de parámetros contra el esquema definido en la capacidad
  if (supportedCommand.params) {
    const params = command.params || {};
    
    for (const schema of supportedCommand.params) {
      const value = params[schema.name];

      // 1. Validar presencia si es requerido
      if (schema.required && (value === undefined || value === null)) {
        return { 
          valid: false, 
          error: `El parámetro "${schema.name}" es requerido para el comando "${command.name}".` 
        };
      }

      // 2. Validar tipo y rango si el parámetro está presente
      if (value !== undefined && value !== null) {
        if (typeof value !== schema.type) {
          return { 
            valid: false, 
            error: `El parámetro "${schema.name}" debe ser de tipo ${schema.type}.` 
          };
        }

        if (schema.type === 'string' && typeof value === 'string' && value.trim() === '') {
          return {
            valid: false,
            error: `El parámetro "${schema.name}" no puede estar vacío.`
          };
        }
        if (schema.type === 'number') {
          const num = value as number;
          if (schema.min !== undefined && num < schema.min) {
            return { 
              valid: false, 
              error: `El parámetro "${schema.name}" (${num}) está por debajo del mínimo permitido (${schema.min}).` 
            };
          }
          if (schema.max !== undefined && num > schema.max) {
            return { 
              valid: false, 
              error: `El parámetro "${schema.name}" (${num}) excede el máximo permitido (${schema.max}).` 
            };
          }
        }
      }
    }
  }

  return { valid: true };
}
