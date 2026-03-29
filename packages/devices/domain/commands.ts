/**
 * Diccionario centralizado de sentencias permitidas para dispositivos inteligentes en la iteración V1.
 * Representan literales inmutables restringidos puramente al control de estado binario unificado,
 * aislando protocolos complejos físicos de la semántica de la capa de aplicación.
 */
export type DeviceCommandV1 = 'turn_on' | 'turn_off' | 'toggle';

/**
 * Type Guard funcional garantizando que cadenas genéricas inseguras coincidan 
 * estrictamente con el diccionario soportado, previniendo vulnerabilidades de payloads (Zero-Trust).
 */
export function isValidCommand(cmd: string): cmd is DeviceCommandV1 {
  return cmd === 'turn_on' || cmd === 'turn_off' || cmd === 'toggle';
}
