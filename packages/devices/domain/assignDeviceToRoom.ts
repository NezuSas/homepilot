import { Device } from './types';
import { InvalidTopologyReferenceError, DeviceAlreadyAssignedError } from './errors';
import { Clock } from '../../shared/domain/types';

/**
 * Mutador funcional puro que transiciona el estado inmutable de un dispositivo hacia una habitación específica.
 * El roomId puede ser null para desasignar el dispositivo y devolverlo al estado PENDING.
 */
export function assignDeviceToRoom(
  device: Device,
  roomId: string | null,
  clock: Clock
): Device {
  // Soporte para desasignación: roomId null devuelve a PENDING
  if (roomId === null) {
    const unassignedDevice: Device = {
      ...device,
      roomId: null,
      status: 'PENDING',
      entityVersion: device.entityVersion + 1,
      updatedAt: clock.now()
    };
    return Object.freeze(unassignedDevice);
  }

  if (typeof roomId !== 'string' || roomId.trim() === '') {
    throw new InvalidTopologyReferenceError('roomId');
  }

  // Soporte para "Mover a otro cuarto": permitimos reasignación si roomId es distinto
  const updatedDevice: Device = {
    ...device,
    roomId: roomId.trim(),
    status: 'ASSIGNED',
    entityVersion: device.entityVersion + 1,
    updatedAt: clock.now()
  };

  return Object.freeze(updatedDevice);
}
