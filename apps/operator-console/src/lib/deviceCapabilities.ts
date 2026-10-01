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

export function isCameraDevice(device: Pick<SnapshotDevice, 'type' | 'semanticType'>): boolean {
  return device.type === 'camera' || device.semanticType === 'camera';
}

/**
 * canExecuteCommand
 * Determina si el dispositivo soporta un comando basándose en las capacidades 
 * y comandos permitidos que vienen desde el backend.
 * Implementa un fallback conservador para dispositivos legacy.
 */
export function canExecuteCommand(device: Pick<SnapshotDevice, 'capabilities'>, command: string): boolean {
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

export type RoutineDeviceCommand = 'turn_on' | 'turn_off' | 'toggle' | 'open' | 'close' | 'stop' | 'press' | 'activate';

/** Commands usable as a scene step or an automation consequence, based on real capabilities. */
export function getRoutineDeviceCommands(device: Pick<SnapshotDevice, 'type' | 'semanticType' | 'capabilities'>): RoutineDeviceCommand[] {
  if (isCameraDevice(device)) return [];

  // A button or imported HA scene remains momentary even if the user labels it as a light.
  const momentary: RoutineDeviceCommand[] = ['press', 'activate'];
  const availableMomentary = momentary.filter(command => canExecuteCommand(device, command));
  if (availableMomentary.length > 0) return availableMomentary;

  const stateful: RoutineDeviceCommand[] = ['turn_on', 'turn_off', 'toggle', 'open', 'close', 'stop'];
  if (device.capabilities?.length) return stateful.filter(command => canExecuteCommand(device, command));

  // The legacy fallback has no published commands; keep it limited to known physical roles.
  const candidates = device.type === 'cover' ? ['open', 'close', 'stop']
    : ['light', 'switch', 'outlet'].includes(device.type) ? ['turn_on', 'turn_off', 'toggle'] : [];
  return candidates.filter((command): command is RoutineDeviceCommand => canExecuteCommand(device, command));
}
