import { DeviceCommandV1 } from './commands';

/**
 * CapabilityType
 * Tipos de capacidades soportadas por dispositivos en HomePilot.
 */
export type CapabilityType = 
  | 'switch' 
  | 'light' 
  | 'dimmer' 
  | 'sensor' 
  | 'binary_sensor' 
  | 'cover' 
  | 'climate' 
  | 'media_player';

/**
 * CapabilityCommandParamSchema
 * Define la estructura y validación de un parámetro de comando.
 */
export interface CapabilityCommandParamSchema {
  readonly name: string;
  readonly type: 'number' | 'string' | 'boolean';
  readonly min?: number;
  readonly max?: number;
  readonly required?: boolean;
}

/**
 * CapabilityCommand
 * Representa un comando que una capacidad puede ejecutar.
 */
export interface CapabilityCommand {
  readonly name: DeviceCommandV1;
  readonly params?: CapabilityCommandParamSchema[];
}

/**
 * CAPABILITY_DEFINITIONS
 * Diccionario central que define qué comandos y parámetros soporta cada capacidad.
 */
export const CAPABILITY_DEFINITIONS: Record<CapabilityType, CapabilityCommand[]> = {
  'switch': [
    { name: 'turn_on' },
    { name: 'turn_off' },
    { name: 'toggle' }
  ],
  'light': [
    { name: 'turn_on' },
    { name: 'turn_off' },
    { name: 'toggle' }
  ],
  'cover': [
    { name: 'open' },
    { name: 'close' },
    { name: 'stop' },
    { 
      name: 'set_position', 
      params: [{ name: 'position', type: 'number', min: 0, max: 100, required: true }] 
    }
  ],
  'sensor': [],
  'binary_sensor': [],
  'dimmer': [],
  'climate': [],
  'media_player': []
};

/**
 * Foundation for Device Abstraction
 */

export interface DeviceCommand {
  readonly command: string;
  readonly params?: Record<string, unknown>;
}

export interface DeviceState {
  readonly value: unknown;
  readonly attributes?: Record<string, unknown>;
  readonly updatedAt: string;
}

export interface DeviceCapability {
  readonly type: CapabilityType;
  readonly name: string;
  readonly state?: DeviceState;
  readonly lastCommand?: DeviceCommand;
}

/**
 * Legacy helper maintained for backward compatibility.
 * @deprecated Use CommandCapabilityValidator for operational validation.
 */
export function canDeviceExecuteCommand(deviceType: string, command: DeviceCommandV1): boolean {
  const type = deviceType.toLowerCase() as CapabilityType;
  const definition = CAPABILITY_DEFINITIONS[type];
  if (!definition) return false;
  return definition.some(cmd => cmd.name === command);
}
