import { Device } from './types';
import { DeviceCapability, CapabilityType } from './capabilities';
import { getDeviceProfileCapabilities, getDeviceProfileForDevice } from './deviceProfiles';

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

  // 2. Perfil modular por integración/tipo. Home Assistant se resuelve por dominio HA.
  const profileCapabilities = getDeviceProfileCapabilities(getDeviceProfileForDevice(device));
  if (profileCapabilities.length > 0) {
    return profileCapabilities;
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
 * isValidCapabilityType
 * Valida si un string corresponde a un CapabilityType conocido.
 */
function isValidCapabilityType(type: string): type is CapabilityType {
  const validTypes: string[] = [
    'switch', 'light', 'dimmer', 'sensor', 'binary_sensor', 'cover', 'climate', 'media_player', 'camera'
  ];
  return validTypes.includes(type);
}
