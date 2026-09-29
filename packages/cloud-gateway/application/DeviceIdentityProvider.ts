import { createPublicKey, randomBytes, verify } from 'node:crypto';

export const DEVICE_IDENTITY_INVALID = 'DEVICE_IDENTITY_INVALID';

export class DeviceIdentityError extends Error {
  readonly code = DEVICE_IDENTITY_INVALID;
  constructor() { super(DEVICE_IDENTITY_INVALID); this.name = 'DeviceIdentityError'; }
}

/** Signature bytes are IEEE P1363 (r || s), exactly 64 bytes for P-256. */
export interface DeviceIdentityProvider {
  readonly cloneResistant: boolean;
  ensureIdentity(): Promise<void>;
  getPublicKey(): Promise<string>;
  getKeyId(): Promise<string>;
  getAlgorithm(): 'ES256';
  sign(payload: Buffer): Promise<Buffer>;
  verifyLocalIdentity(expectedPublicKey: string): Promise<boolean>;
}

export async function verifyDeviceIdentity(provider: DeviceIdentityProvider, expectedPublicKey: string): Promise<boolean> {
  try {
    const actual = createPublicKey(await provider.getPublicKey()).export({ type: 'spki', format: 'der' });
    const expected = createPublicKey(expectedPublicKey).export({ type: 'spki', format: 'der' });
    if (!actual.equals(expected)) return false;
    const challenge = randomBytes(32);
    const signature = await provider.sign(challenge);
    return signature.length === 64 && verify('sha256', challenge,
      { key: expectedPublicKey, dsaEncoding: 'ieee-p1363' }, signature);
  } catch { return false; }
}
