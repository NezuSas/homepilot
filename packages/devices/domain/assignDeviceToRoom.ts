import { Device } from './types';
import { InvalidTopologyReferenceError, DeviceAlreadyAssignedError } from './errors';
import { Clock } from '../../shared/domain/types';

/**
 * Mutador funcional puro que transiciona el estado inmutable de un dispositivo hacia una habitación específica.
 */
export function assignDeviceToRoom(
  device: Device,
  roomId: string,
  clock: Clock
): Device {
  if (device.status === 'ASSIGNED') {
    throw new DeviceAlreadyAssignedError(device.id);
  }

  if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
    throw new InvalidTopologyReferenceError('roomId');
  }

  const updatedDevice: Device = {
    ...device,
    roomId: roomId.trim(),
    status: 'ASSIGNED',
    entityVersion: device.entityVersion + 1,
    updatedAt: clock.now()
  };

  return Object.freeze(updatedDevice);
}
