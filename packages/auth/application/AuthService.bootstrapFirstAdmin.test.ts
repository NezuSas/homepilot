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
});
