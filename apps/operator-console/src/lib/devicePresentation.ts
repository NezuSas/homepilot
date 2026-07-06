import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { hasCapability } from './deviceCapabilities';

export type ManagedDeviceKind = 'camera' | 'cover' | 'light' | 'switch' | 'sensor' | 'other';

export const resolveManagedDeviceKind = (device: SnapshotDevice): ManagedDeviceKind => {
  if (
    hasCapability(device, 'camera')
    || device.type === 'camera'
    || device.profile?.domain === 'camera'
    || device.externalId?.startsWith('ha:camera.') === true
    || device.integrationSource === 'native-camera'
  ) return 'camera';

  if (
    hasCapability(device, 'cover')
    || device.semanticType === 'cover'
    || device.type === 'cover'
    || device.profile?.domain === 'cover'
  ) return 'cover';

  if (hasCapability(device, 'light') || device.semanticType === 'light' || device.type === 'light') return 'light';
  if (
    hasCapability(device, 'switch')
    || device.semanticType === 'switch'
    || device.semanticType === 'outlet'
    || device.type === 'switch'
    || device.type === 'outlet'
  ) return 'switch';
  if (
    hasCapability(device, 'sensor')
    || hasCapability(device, 'binary_sensor')
    || device.semanticType === 'sensor'
    || device.type === 'sensor'
    || device.type === 'binary_sensor'
  ) return 'sensor';
  return 'other';
};
