import { DeviceCommandV1 } from './commands';

/**
 * Diccionario estático e inmutable de capacidades por tipo de dispositivo (Iteración V1).
 * Define qué comandos operativos son permitidos según la naturaleza del hardware.
 * 
 * Si un tipo no existe en este mapa, se asume que tiene CERO capacidades operativas.
 */
const DEVICE_TYPE_CAPABILITIES: Readonly<Record<string, ReadonlyArray<DeviceCommandV1>>> = {
  'switch': ['turn_on', 'turn_off', 'toggle'],
  'light': ['turn_on', 'turn_off', 'toggle'],
  'cover': ['open', 'close', 'stop', 'set_position'],
  'sensor': [],
  'gateway': []
};

/**
 * Helper puro de dominio para validar si un tipo de dispositivo soporta un comando específico.
 * Esta validación es determinista y no requiere persistencia ni estado externo.
 * 
 * @param deviceType El tipo del dispositivo (proveniente de la entidad Device)
 * @param command El comando V1 que se desea ejecutar
 * @returns true si el dispositivo soporta el comando, false en caso contrario
 */
export function canDeviceExecuteCommand(deviceType: string, command: DeviceCommandV1): boolean {
  const capabilities = DEVICE_TYPE_CAPABILITIES[deviceType];
  
  if (!capabilities) {
    return false;
  }

  return capabilities.includes(command);
}

// --- Foundation for Future Device Abstraction ---

export type CapabilityType = 
  | 'switch' 
  | 'light' 
  | 'dimmer' 
  | 'sensor' 
  | 'binary_sensor' 
  | 'cover' 
  | 'climate' 
  | 'media_player';

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
  readonly state: DeviceState;
  readonly lastCommand?: DeviceCommand;
}
