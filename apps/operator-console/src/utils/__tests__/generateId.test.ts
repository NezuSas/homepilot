import { generateId } from '../generateId';

describe('generateId', () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
    jest.restoreAllMocks();
  });

  it('uses randomUUID and keeps an optional prefix', () => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => 'uuid-1' } });
    expect(generateId('card')).toBe('card_uuid-1');
  });

  it('constructs an RFC4122 v4 UUID with getRandomValues when randomUUID is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { getRandomValues: (bytes: Uint8Array) => { bytes.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]); return bytes; } },
    });

    expect(generateId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
  });

  it('falls back safely when Web Crypto is missing, throws, or returns an empty value', () => {
    jest.spyOn(Date, 'now').mockReturnValue(123456789);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    const missing = generateId();
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => { throw new Error('unavailable'); } } });
    const throwing = generateId();
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => '' } });
    const empty = generateId();

    expect(missing).toMatch(/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/);
    expect(throwing).not.toBe(missing);
    expect(empty).not.toBe(throwing);
  });
});