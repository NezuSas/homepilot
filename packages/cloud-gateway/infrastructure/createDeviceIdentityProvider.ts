import { join, dirname } from 'node:path';
import type { DeviceIdentityProvider } from '../application/DeviceIdentityProvider';
import { DeviceIdentityError } from '../application/DeviceIdentityProvider';
import { SoftwareDeviceIdentityProvider } from './SoftwareDeviceIdentityProvider';
import { Tpm2DeviceIdentityProvider } from './Tpm2DeviceIdentityProvider';

export function createDeviceIdentityProvider(dbPath: string): DeviceIdentityProvider {
  if (process.env.HOMEPILOT_DEVICE_IDENTITY_PROVIDER === 'software') {
    if (process.env.NODE_ENV === 'production') throw new DeviceIdentityError();
    return new SoftwareDeviceIdentityProvider(join(dirname(dbPath), 'device-identity-software.pem'));
  }
  return new Tpm2DeviceIdentityProvider();
}
