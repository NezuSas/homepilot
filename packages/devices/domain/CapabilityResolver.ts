import { Device } from './types';
import { DeviceCapability, CapabilityType } from './capabilities';

/**
 * resolveCapabilitiesForDevice
 * 
 * Resuelve las capacidades operativas de un dispositivo basándose en su configuración,
 * tipo o identificador externo. Implementa una lógica de fallback para asegurar
 * compatibilidad con dispositivos existentes.
 */
export function resolveCapabilitiesForDevice(device: Device): DeviceCapability[] {
  // 1. Prioridad: Capacidades explícitamente declaradas en la entidad
  if (device.capabilities && device.capabilities.length > 0) {
    return [...device.capabilities];
  }

  // 2. Inferencia por ExternalId de Home Assistant (ha:domain.entity_id)
  const haCapability = inferFromHomeAssistantId(device.externalId);
  if (haCapability) {
    return [haCapability];
  }

  // 3. Fallback por device.type (Normalización obligatoria a lowercase)
  const typeNormalized = device.type.toLowerCase();
  if (isValidCapabilityType(typeNormalized)) {
    return [{
      type: typeNormalized,
      name: device.type
    }];
  }

  // Si no se puede inferir nada, se retorna array vacío (el validador decidirá si bloquea o permite)
  return [];
}

/**
 * inferFromHomeAssistantId
 * Extrae la capacidad basándose en el dominio de la entidad de Home Assistant.
 */
function inferFromHomeAssistantId(externalId: string): DeviceCapability | null {
  if (!externalId.startsWith('ha:')) return null;
  
  // Extraer el dominio antes del punto (ej: ha:light.office_lamp -> light)
  const match = externalId.match(/^ha:([^.]+)\./);
  if (!match) return null;

  const haDomain = match[1];
  const typeMap: Record<string, CapabilityType> = {
    'light': 'light',
    'switch': 'switch',
    'cover': 'cover',
    'sensor': 'sensor',
    'binary_sensor': 'binary_sensor',
    'climate': 'climate',
    'media_player': 'media_player'
  };

  const type = typeMap[haDomain];
  if (type) {
    return { type, name: haDomain };
  }

  return null;
}

/**
 * isValidCapabilityType
 * Valida si un string corresponde a un CapabilityType conocido.
 */
function isValidCapabilityType(type: string): type is CapabilityType {
  const validTypes: string[] = [
    'switch', 'light', 'dimmer', 'sensor', 'binary_sensor', 'cover', 'climate', 'media_player'
  ];
  return validTypes.includes(type);
}
