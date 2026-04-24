import type { SnapshotDevice, SnapshotDeviceCapability } from '../stores/useDeviceSnapshotStore';

/**
 * getCapability
 * Recupera una capacidad específica del dispositivo si existe.
 */
export function getCapability(device: SnapshotDevice, type: string): SnapshotDeviceCapability | undefined {
  return device.capabilities?.find(c => c.type === type);
}

/**
 * hasCapability
 * Indica si el dispositivo posee una capacidad determinada.
 */
export function hasCapability(device: SnapshotDevice, type: string): boolean {
  return !!getCapability(device, type);
}

/**
 * canExecuteCommand
 * Determina si el dispositivo soporta un comando basándose en las capacidades 
 * y comandos permitidos que vienen desde el backend.
 * Implementa un fallback conservador para dispositivos legacy.
 */
export function canExecuteCommand(device: SnapshotDevice, command: string): boolean {
  // 1. Fallback total si no hay ninguna capacidad declarada (Dispositivos legacy/desconocidos)
  if (!device.capabilities || device.capabilities.length === 0) {
    const legacyAllowed = ['turn_on', 'turn_off', 'toggle', 'open', 'close', 'stop'];
    return legacyAllowed.includes(command);
  }

  // 2. Validación basada estrictamente en los comandos permitidos enviados por el backend
  // Si existen capacidades, confiamos plenamente en lo que el backend declare para ellas.
  return device.capabilities.some(cap => {
    if (!cap.commands || cap.commands.length === 0) {
      return false;
    }
    
    return cap.commands.some(cmd => cmd.name === command);
  });
}
