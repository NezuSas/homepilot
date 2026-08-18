import { CryptoService } from './CryptoService';

describe('CryptoService', () => {
  const cryptoService = new CryptoService();

  it('hashes a password with a unique salt and verifies only the original password', async () => {
    const firstHash = await cryptoService.hashPassword('correct horse battery staple');
    const secondHash = await cryptoService.hashPassword('correct horse battery staple');

    expect(firstHash).toMatch(/^[a-f0-9]{32}:[a-f0-9]{64}$/);
    expect(secondHash).toMatch(/^[a-f0-9]{32}:[a-f0-9]{64}$/);
    expect(firstHash).not.toBe(secondHash);
    await expect(cryptoService.verifyPassword('correct horse battery staple', firstHash)).resolves.toBe(true);
    await expect(cryptoService.verifyPassword('incorrect password', firstHash)).resolves.toBe(false);
  });

  it('rejects malformed or incompatible stored password hashes safely', async () => {
    await expect(cryptoService.verifyPassword('password', 'missing-separator')).resolves.toBe(false);
    await expect(cryptoService.verifyPassword('password', 'salt:too-short')).resolves.toBe(false);
    await expect(cryptoService.verifyPassword('password', 'too:many:segments')).resolves.toBe(false);
  });

  it('propagates scrypt failures instead of accepting a password hash after cryptographic failure', async () => {
    const mutableCrypto = require('crypto') as {
      scrypt: (password: string, salt: string, keyLength: number, callback: (error: Error | null, key: Buffer) => void) => void;
    };
    const originalScrypt = mutableCrypto.scrypt;
    mutableCrypto.scrypt = (_password, _salt, _keyLength, callback) => callback(new Error('scrypt unavailable'), Buffer.alloc(0));

    try {
      await expect(cryptoService.hashPassword('secret')).rejects.toThrow('scrypt unavailable');
      await expect(cryptoService.verifyPassword('secret', '0123456789abcdef0123456789abcdef:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')).rejects.toThrow('scrypt unavailable');
    } finally {
      mutableCrypto.scrypt = originalScrypt;
    }
  });
  it('generates opaque session tokens, UUIDs, and strong passwords in the requested sizes', () => {
    const token = cryptoService.generateSessionToken(24);
    const password = cryptoService.generateStrongRandomPassword(40);

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(24);
    expect(cryptoService.generateId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(password).toHaveLength(40);
    expect(password).toMatch(/^[a-zA-Z0-9!@#$%^&*()_+]+$/);
  });

  it('uses the secure default sizes for session tokens and bootstrap passwords', () => {
    const token = cryptoService.generateSessionToken();
    const password = cryptoService.generateStrongRandomPassword();

    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(password).toHaveLength(16);
  });
});