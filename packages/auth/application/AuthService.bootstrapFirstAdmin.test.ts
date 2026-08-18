import Database from 'better-sqlite3';
import { AuthService } from './AuthService';
import { CryptoService } from '../infrastructure/CryptoService';
import { SqliteSessionRepository } from '../infrastructure/SqliteSessionRepository';
import { SqliteUserRepository } from '../infrastructure/SqliteUserRepository';

function createAuthService(): AuthService {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      display_name TEXT,
      avatar_data_uri TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return new AuthService(
    new SqliteUserRepository(db),
    new SqliteSessionRepository(db),
    new CryptoService()
  );
}

describe('AuthService.bootstrapFirstAdmin', () => {
  it('creates the first admin and returns an authenticated session', async () => {
    const service = createAuthService();

    const result = await service.bootstrapFirstAdmin({
      username: 'owner',
      password: 'secure-password-1',
      displayName: 'Owner'
    });

    expect(result).not.toBeNull();
    expect(result?.token).toEqual(expect.any(String));
    expect(result?.user.username).toBe('owner');
    expect(result?.user.role).toBe('admin');
    expect(result?.user.displayName).toBe('Owner');

    const login = await service.login('owner', 'secure-password-1');
    expect(login?.user.username).toBe('owner');
  });

  it('refuses to create another first admin once a user exists', async () => {
    const service = createAuthService();

    await service.bootstrapFirstAdmin({
      username: 'owner',
      password: 'secure-password-1'
    });

    const secondAttempt = await service.bootstrapFirstAdmin({
      username: 'another',
      password: 'secure-password-2'
    });

    expect(secondAttempt).toBeNull();
  });

  it('rejects weak passwords before creating the first admin', async () => {
    const service = createAuthService();

    await expect(service.bootstrapFirstAdmin({
      username: 'owner',
      password: 'short'
    })).rejects.toThrow('WEAK_PASSWORD');
  });

  it('does not write authentication details to the console', async () => {
    const service = createAuthService();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    try {
      await service.bootstrapFirstAdmin({
        username: 'owner',
        password: 'secure-password-1'
      });

      await service.login('owner', 'secure-password-1');
      await service.login('owner', 'invalid-password');

      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });
  it('verifies sessions, revokes them on logout, and invalidates prior credentials after a password change', async () => {
    const service = createAuthService();
    const bootstrap = await service.bootstrapFirstAdmin({ username: 'owner', password: 'secure-password-1' });
    expect(bootstrap).not.toBeNull();
    if (!bootstrap) return;

    await expect(service.verifyToken(bootstrap.token)).resolves.toEqual(expect.objectContaining({ isValid: true, user: expect.objectContaining({ id: bootstrap.user.id }) }));
    await service.logout(bootstrap.token);
    await expect(service.verifyToken(bootstrap.token)).resolves.toEqual({ isValid: false, user: null, reason: 'not_found' });

    const beforeChange = await service.login('owner', 'secure-password-1');
    expect(beforeChange).not.toBeNull();
    const changed = await service.changePassword(bootstrap.user.id, 'secure-password-1', 'new-secure-password-2');
    expect(changed).toEqual({ success: true });
    await expect(service.verifyToken(beforeChange!.token)).resolves.toEqual({ isValid: false, user: null, reason: 'not_found' });
    await expect(service.login('owner', 'secure-password-1')).resolves.toBeNull();
    await expect(service.login('owner', 'new-secure-password-2')).resolves.toEqual(expect.objectContaining({ user: expect.objectContaining({ username: 'owner' }) }));
  });

  it('rejects invalid initial usernames and does not create a user', async () => {
    const service = createAuthService();

    await expect(service.bootstrapFirstAdmin({ username: 'a!', password: 'secure-password-1' })).rejects.toThrow('INVALID_USERNAME');
    await expect(service.bootstrapFirstAdmin({ username: 'ab', password: 'secure-password-1' })).rejects.toThrow('INVALID_USERNAME');
    await expect(service.login('ab', 'secure-password-1')).resolves.toBeNull();
  });
});

describe('AuthService core credential contracts', () => {
  it('runs the post-credential callback before issuing a session and rejects invalid credentials without invoking it', async () => {
    const service = createAuthService();
    await service.bootstrapFirstAdmin({ username: 'owner', password: 'secure-password-1' });
    const verified = jest.fn().mockResolvedValue(undefined);

    const successful = await service.login('owner', 'secure-password-1', verified);
    const rejected = await service.login('owner', 'incorrect-password', verified);

    expect(successful).toEqual(expect.objectContaining({ user: expect.objectContaining({ username: 'owner' }) }));
    expect(verified).toHaveBeenCalledTimes(1);
    expect(rejected).toBeNull();
  });

  it('does not change a password for weak, unknown, or incorrectly authenticated requests', async () => {
    const service = createAuthService();
    const bootstrap = await service.bootstrapFirstAdmin({ username: 'owner', password: 'secure-password-1' });
    expect(bootstrap).not.toBeNull();
    if (!bootstrap) return;

    await expect(service.changePassword(bootstrap.user.id, 'secure-password-1', 'short')).resolves.toEqual({ success: false });
    await expect(service.changePassword('unknown-user', 'secure-password-1', 'another-secure-password')).resolves.toEqual({ success: false });
    await expect(service.changePassword(bootstrap.user.id, 'incorrect-password', 'another-secure-password')).resolves.toEqual({ success: false });
    await expect(service.login('owner', 'secure-password-1')).resolves.toEqual(expect.objectContaining({ user: expect.objectContaining({ id: bootstrap.user.id }) }));
  });

  it('returns deterministic bootstrap credentials only for an empty installation', async () => {
    const service = createAuthService();

    const developmentBootstrap = await service.getBootstrapAdmin(true);
    expect(developmentBootstrap).toEqual(expect.objectContaining({ admin: expect.objectContaining({ username: 'admin' }), generatedPlaintext: null }));
    await expect(service.getBootstrapAdmin(false)).resolves.toBeNull();
  });
});
describe('AuthService session validity contracts', () => {
  const user = {
    id: 'owner-1', username: 'owner', passwordHash: 'hash', role: 'admin', isActive: true,
    displayName: 'Owner', avatarDataUri: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('Scenario: Given an unknown or inactive local user When Directory SSO requests a local session Then no session is issued', async () => {
    const findById = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...user, isActive: false });
    const createSession = jest.fn();
    const service = new AuthService(
      { findById } as never,
      { createSession } as never,
      { generateSessionToken: jest.fn().mockReturnValue('should-not-be-issued') } as never,
    );

    await expect(service.createSessionForUserId('missing')).resolves.toBeNull();
    await expect(service.createSessionForUserId('inactive')).resolves.toBeNull();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('Scenario: Given an active linked local user When Directory SSO requests a local session Then a normal expiring session is issued', async () => {
    const createSession = jest.fn().mockResolvedValue(undefined);
    const service = new AuthService(
      { findById: jest.fn().mockResolvedValue(user) } as never,
      { createSession } as never,
      { generateSessionToken: jest.fn().mockReturnValue('directory-session') } as never,
    );

    const result = await service.createSessionForUserId(user.id);

    expect(result).toEqual({ token: 'directory-session', user });
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      id: 'directory-session', token: 'directory-session', userId: user.id, expiresAt: expect.any(String), createdAt: expect.any(String),
    }));
  });
  it('Scenario: Given expired, deleted, or inactive session owners When a token is verified Then the reason is deterministic and authorization stays denied', async () => {
    const findById = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...user, isActive: false });
    const getSessionByToken = jest.fn()
      .mockResolvedValueOnce({ token: 'expired', userId: user.id, expiresAt: '2020-01-01T00:00:00.000Z' })
      .mockResolvedValueOnce({ token: 'deleted-owner', userId: user.id, expiresAt: '2099-01-01T00:00:00.000Z' })
      .mockResolvedValueOnce({ token: 'inactive-owner', userId: user.id, expiresAt: '2099-01-01T00:00:00.000Z' });
    const service = new AuthService(
      { findById } as never,
      { getSessionByToken } as never,
      {} as never,
    );

    await expect(service.verifyToken('expired')).resolves.toEqual({ isValid: false, user: null, reason: 'expired' });
    await expect(service.verifyToken('deleted-owner')).resolves.toEqual({ isValid: false, user: null, reason: 'not_found' });
    await expect(service.verifyToken('inactive-owner')).resolves.toEqual({ isValid: false, user: null, reason: 'inactive' });
  });
});