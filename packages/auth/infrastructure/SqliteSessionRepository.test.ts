import Database from 'better-sqlite3';
import { SqliteSessionRepository } from './SqliteSessionRepository';

describe('SqliteSessionRepository', () => {
  let database: Database.Database;
  let repository: SqliteSessionRepository;

  beforeEach(() => {
    database = new Database(':memory:');
    database.exec(`
      CREATE TABLE sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    repository = new SqliteSessionRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  it('Scenario: Given sessions for multiple users When one user is revoked Then only that user sessions are removed and the affected count is returned', async () => {
    await repository.createSession({ id: 'owner-a', token: 'owner-a', userId: 'owner', expiresAt: '2099-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' });
    await repository.createSession({ id: 'owner-b', token: 'owner-b', userId: 'owner', expiresAt: '2099-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' });
    await repository.createSession({ id: 'member-a', token: 'member-a', userId: 'member', expiresAt: '2099-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' });

    await expect(repository.countActiveForUser('owner')).resolves.toBe(2);
    await expect(repository.deleteAllUserSessions('owner')).resolves.toBe(2);
    await expect(repository.getSessionByToken('owner-a')).resolves.toBeNull();
    await expect(repository.getSessionByToken('member-a')).resolves.toEqual(expect.objectContaining({ userId: 'member' }));
  });

  it('Scenario: Given expired and active sessions When active sessions are counted Then expired entries are excluded', async () => {
    await repository.createSession({ id: 'expired', token: 'expired', userId: 'owner', expiresAt: '2020-01-01T00:00:00.000Z', createdAt: '2020-01-01T00:00:00.000Z' });
    await repository.createSession({ id: 'active', token: 'active', userId: 'owner', expiresAt: '2099-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' });

    await expect(repository.countActiveForUser('owner')).resolves.toBe(1);
    await repository.deleteSession('active');
    await expect(repository.countActiveForUser('owner')).resolves.toBe(0);
  });
});