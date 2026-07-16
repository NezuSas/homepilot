/**
 * Diccionario centralizado de sentencias permitidas para dispositivos inteligentes en la iteración V1.
 * Representan literales inmutables restringidos puramente al control de estado binario unificado,
 * aislando protocolos complejos físicos de la semántica de la capa de aplicación.
 */
export type DeviceCommandV1 =
  | 'turn_on'
  | 'turn_off'
  | 'toggle'
  | 'open'
  | 'close'
  | 'stop'
  | 'set_position'
  | 'media_play'
  | 'media_pause'
  | 'media_previous_track'
  | 'media_next_track';

/**
 * DeviceCommandRequest
 * 
 * Estructura de comando normalizada que soporta parámetros y metadatos de ejecución.
 * Permite comandos complejos como set_position con parámetros específicos.
 */
export interface DeviceCommandRequest {
  name: DeviceCommandV1;
  params?: Record<string, unknown>;
  metadata?: {
    userId?: string;
    correlationId?: string;
    source?: string;
  };
}

/**
 * Type Guard funcional garantizando que cadenas genéricas inseguras coincidan 
 * estrictamente con el diccionario soportado, previniendo vulnerabilidades de payloads (Zero-Trust).
 */
export function isValidCommand(cmd: string): cmd is DeviceCommandV1 {
  const validCommands: DeviceCommandV1[] = [
    'turn_on',
    'turn_off',
    'toggle',
    'open',
    'close',
    'stop',
    'set_position',
    'media_play',
    'media_pause',
    'media_previous_track',
    'media_next_track',
  ];
  return validCommands.includes(cmd as DeviceCommandV1);
}
