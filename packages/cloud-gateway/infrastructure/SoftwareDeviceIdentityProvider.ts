import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { KeyObject } from 'node:crypto';
import { verifyDeviceIdentity, type DeviceIdentityProvider } from '../application/DeviceIdentityProvider';

/** Development/CI only. A copied key file can be cloned: NOT CLONE RESISTANT. */
export class SoftwareDeviceIdentityProvider implements DeviceIdentityProvider {
  readonly cloneResistant = false;
  private privateKey: KeyObject | null = null;

  constructor(private readonly developmentKeyPath?: string) {}

  private loadExistingIdentity(): boolean {
    if (this.privateKey) return true;
    if (this.developmentKeyPath) {
      try {
        this.privateKey = createPrivateKey(readFileSync(this.developmentKeyPath));
        return true;
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
      }
    }
    return false;
  }

  async ensureIdentity(): Promise<void> {
    if (this.loadExistingIdentity()) return;
    const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    if (this.developmentKeyPath) {
      writeFileSync(this.developmentKeyPath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx', mode: 0o600 });
    }
    this.privateKey = pair.privateKey;
  }

  async getPublicKey(): Promise<string> {
    const privateKey = this.existingSigningKey();
    return createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
  }

  async getKeyId(): Promise<string> {
    const publicKey = createPublicKey(await this.getPublicKey()).export({ type: 'spki', format: 'der' });
    return `hp-${createHash('sha256').update(publicKey).digest('hex').slice(0, 32)}`;
  }

  getAlgorithm(): 'ES256' { return 'ES256'; }

  async sign(payload: Buffer): Promise<Buffer> {
    return sign('sha256', payload, { key: this.existingSigningKey(), dsaEncoding: 'ieee-p1363' });
  }

  private existingSigningKey(): KeyObject {
    this.loadExistingIdentity();
    if (!this.privateKey) throw new Error('DEVICE_IDENTITY_INVALID');
    return this.privateKey;
  }

  verifyLocalIdentity(expectedPublicKey: string): Promise<boolean> {
    return verifyDeviceIdentity(this, expectedPublicKey);
  }
}
