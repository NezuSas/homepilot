import { Database } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { SqliteDirectorySsoRepository } from '../infrastructure/SqliteDirectorySsoRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../../shared/infrastructure/database/SqliteMigrationsRunner';

describe('SqliteDirectorySsoRepository', () => {
  let dbPath: string;
  let db: Database;
  let repository: SqliteDirectorySsoRepository;

  beforeAll(() => {
    dbPath = path.join(__dirname, `test-directory-sso-${randomUUID()}.db`);
    db = SqliteDatabaseManager.getInstance(dbPath);
    new SqliteMigrationsRunner(db).run(path.resolve(__dirname, '../../../migrations'));
    repository = new SqliteDirectorySsoRepository(db);
  });

  beforeEach(() => {
    const insert = db.prepare('INSERT INTO users (id, username, password_hash, role, is_active, display_name, avatar_data_uri, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const id of ['user-1', 'user-2', 'user-3', 'user-4']) {
      insert.run(id, id, 'hash', 'admin', 1, id, null, '2026-08-17T10:00:00.000Z', '2026-08-17T10:00:00.000Z');
    }
  });

  afterEach(() => db.exec('DELETE FROM directory_account_links; DELETE FROM directory_sso_used_tokens; DELETE FROM users;'));
  afterAll(() => { SqliteDatabaseManager.close(dbPath); if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); });

  it('creates, updates, lists, and deletes links only for their matching local user', async () => {
    await repository.create('directory-1', 'user-1');
    await repository.create('directory-2', 'user-1');
    await repository.create('directory-1', 'user-2');

    await expect(repository.findByDirectoryAccountId('directory-1')).resolves.toEqual(expect.objectContaining({ localUserId: 'user-2' }));
    await expect(repository.listByLocalUserId('user-1')).resolves.toEqual([expect.objectContaining({ directoryAccountId: 'directory-2' })]);
    await expect(repository.delete('directory-2', 'user-2')).resolves.toBe(false);
    await expect(repository.delete('directory-2', 'user-1')).resolves.toBe(true);
    await expect(repository.findByDirectoryAccountId('missing')).resolves.toBeNull();
  });

  it('tracks consumed tokens, purges expiration, and atomically links with a consumed token', async () => {
    await repository.markUsed('used', '2999-01-01T00:00:00.000Z');
    await repository.markUsed('expired', '2000-01-01T00:00:00.000Z');
    await expect(repository.isUsed('used')).resolves.toBe(true);
    await repository.purgeExpired();
    await expect(repository.isUsed('expired')).resolves.toBe(false);

    const atomicJti = randomUUID();
    await repository.linkAndConsume('directory-3', 'user-3', atomicJti, '2999-01-01T00:00:00.000Z');
    await expect(repository.findByDirectoryAccountId('directory-3')).resolves.toEqual(expect.objectContaining({ localUserId: 'user-3' }));
    await expect(repository.isUsed(atomicJti)).resolves.toBe(true);
    await expect(repository.listByLocalUserId('user-3')).resolves.toEqual([expect.objectContaining({ directoryAccountId: 'directory-3' })]);
  });
});