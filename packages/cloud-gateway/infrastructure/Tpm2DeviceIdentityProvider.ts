import { createHash, createPublicKey } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { DeviceIdentityError, verifyDeviceIdentity, type DeviceIdentityProvider } from '../application/DeviceIdentityProvider';

const execFile = promisify(execFileCallback);
const PERSISTENT_HANDLE = '0x81010090';

/** Linux TPM 2.0 provider. A persistent TPM primary never exports its private key. */
export class Tpm2DeviceIdentityProvider implements DeviceIdentityProvider {
  readonly cloneResistant = true;

  constructor(private readonly devicePath = '/dev/tpmrm0') {}

  private async command(tool: string, args: string[]): Promise<void> {
    if (process.platform !== 'linux' || !existsSync(this.devicePath)) throw new DeviceIdentityError();
    try {
      await execFile(tool, args, { timeout: 10_000, windowsHide: true,
        env: { ...process.env, TPM2TOOLS_TCTI: `device:${this.devicePath}` } });
    } catch { throw new DeviceIdentityError(); }
  }

  private async withTemporaryFiles<T>(work: (directory: string) => Promise<T>): Promise<T> {
    const directory = mkdtempSync(join(tmpdir(), 'homepilot-tpm-'));
    try { return await work(directory); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  }

  async ensureIdentity(): Promise<void> {
    try { await this.getPublicKey(); return; } catch { /* Provision a new persistent key only during explicit enrollment. */ }
    await this.withTemporaryFiles(async (directory) => {
      const context = join(directory, 'primary.ctx');
      await this.command('tpm2_createprimary', ['-C', 'o', '-g', 'sha256', '-G', 'ecc256:ecdsa',
        '-a', 'sign|fixedtpm|fixedparent|sensitivedataorigin|userwithauth', '-c', context]);
      await this.command('tpm2_evictcontrol', ['-C', 'o', '-c', context, PERSISTENT_HANDLE]);
    });
    await this.getPublicKey();
  }

  async getPublicKey(): Promise<string> {
    return this.withTemporaryFiles(async (directory) => {
      const output = join(directory, 'public.pem');
      await this.command('tpm2_readpublic', ['-c', PERSISTENT_HANDLE, '-f', 'pem', '-o', output]);
      const pem = readFileSync(output, 'utf8');
      const key = createPublicKey(pem);
      if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new DeviceIdentityError();
      return key.export({ type: 'spki', format: 'pem' }).toString();
    });
  }

  async getKeyId(): Promise<string> {
    const der = createPublicKey(await this.getPublicKey()).export({ type: 'spki', format: 'der' });
    return `hp-${createHash('sha256').update(der).digest('hex').slice(0, 32)}`;
  }

  getAlgorithm(): 'ES256' { return 'ES256'; }

  async sign(payload: Buffer): Promise<Buffer> {
    return this.withTemporaryFiles(async (directory) => {
      const message = join(directory, 'message.bin');
      const signature = join(directory, 'signature.der');
      writeFileSync(message, payload, { mode: 0o600 });
      await this.command('tpm2_sign', ['-c', PERSISTENT_HANDLE, '-g', 'sha256', '-f', 'plain', '-o', signature, message]);
      return ecdsaDerToP1363(readFileSync(signature));
    });
  }

  verifyLocalIdentity(expectedPublicKey: string): Promise<boolean> {
    return verifyDeviceIdentity(this, expectedPublicKey);
  }
}

/** tpm2_sign -f plain emits DER ECDSA; Directory expects fixed-width IEEE P1363. */
export function ecdsaDerToP1363(der: Buffer): Buffer {
  if (der.length === 64 && der[0] !== 0x30) return Buffer.from(der);
  if (der.length < 8 || der[0] !== 0x30 || der[1] !== der.length - 2) throw new DeviceIdentityError();
  let offset = 2;
  const components: Buffer[] = [];
  for (let i = 0; i < 2; i += 1) {
    if (der[offset++] !== 0x02) throw new DeviceIdentityError();
    const length = der[offset++];
    if (!length || length > 33 || offset + length > der.length) throw new DeviceIdentityError();
    const bytes = der.subarray(offset, offset + length);
    offset += length;
    if (bytes[0] & 0x80 || (length > 1 && bytes[0] === 0 && !(bytes[1] & 0x80))) throw new DeviceIdentityError();
    const unsigned = bytes[0] === 0 ? bytes.subarray(1) : bytes;
    if (unsigned.length > 32) throw new DeviceIdentityError();
    components.push(Buffer.concat([Buffer.alloc(32 - unsigned.length), unsigned]));
  }
  if (offset !== der.length) throw new DeviceIdentityError();
  return Buffer.concat(components);
}
