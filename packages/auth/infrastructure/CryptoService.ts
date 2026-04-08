import * as crypto from 'crypto';

export class CryptoService {
  private static SALT_LENGTH = 16;
  private static KEY_LENGTH = 32;

  /**
   * Hashes a plain password securely using scrypt with random salt.
   * Format returned: salt:hashBase64
   */
  public async hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(CryptoService.SALT_LENGTH).toString('hex');
      crypto.scrypt(password, salt, CryptoService.KEY_LENGTH, (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  /**
   * Verifies a plain password against a stored hash (salt:hashBase64) in a constant-time manner.
   */
  public async verifyPassword(password: string, storedHashFull: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const parts = storedHashFull.split(':');
      if (parts.length !== 2) return resolve(false);

      const [salt, storedHash] = parts;
      const storedKey = Buffer.from(storedHash, 'hex');

      crypto.scrypt(password, salt, CryptoService.KEY_LENGTH, (err, derivedKey) => {
        if (err) reject(err);
        
        try {
          const match = crypto.timingSafeEqual(storedKey, derivedKey);
          resolve(match);
        } catch (e) {
          resolve(false);
        }
      });
    });
  }

  /**
   * Generates a cryptographically strong opaque token (Bearer string suitable for session ID).
   */
  public generateSessionToken(byteLength: number = 32): string {
    return crypto.randomBytes(byteLength).toString('base64url');
  }

  /**
   * Random strong password generator specifically for bootstrapping.
   */
  public generateStrongRandomPassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    const rand = crypto.randomBytes(length);
    let pass = '';
    for (let i = 0; i < rand.length; i++) {
        pass += charset[rand[i] % charset.length];
    }
    return pass;
  }
}
