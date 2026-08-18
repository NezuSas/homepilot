import { Database } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { SQLiteAssistantMemoryRepository } from '../infrastructure/repositories/SQLiteAssistantMemoryRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../../shared/infrastructure/database/SqliteMigrationsRunner';

describe('SQLiteAssistantMemoryRepository', () => {
  let dbPath: string;
  let db: Database;
  let repository: SQLiteAssistantMemoryRepository;

  beforeAll(() => {
    dbPath = path.join(__dirname, `test-memory-repository-${Date.now()}.db`);
    db = SqliteDatabaseManager.getInstance(dbPath);
    new SqliteMigrationsRunner(db).run(path.resolve(__dirname, '../../../migrations'));
    repository = new SQLiteAssistantMemoryRepository(dbPath);
  });

  afterEach(() => db.exec('DELETE FROM assistant_memory'));

  afterAll(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('upserts and retrieves non-expired values without changing their creation time', async () => {
    await repository.upsert({ userId: 'user-1', key: 'preference:theme', value: 'dark', valueType: 'string', expiresAt: null });
    const created = await repository.findByKey('user-1', 'preference:theme');

    await repository.upsert({ userId: 'user-1', key: 'preference:theme', value: 'light', valueType: 'string', expiresAt: null });
    const updated = await repository.findByKey('user-1', 'preference:theme');

    expect(created).toEqual(expect.objectContaining({ value: 'dark', createdAt: expect.any(String), updatedAt: expect.any(String) }));
    expect(updated).toEqual(expect.objectContaining({ value: 'light', createdAt: created?.createdAt, updatedAt: expect.any(String) }));
    await expect(repository.findByKey('user-1', 'missing')).resolves.toBeNull();
  });

  it('lists only the caller prefix, excludes expiration, and deletes records', async () => {
    await repository.upsert({ userId: 'user-1', key: 'alias:kitchen', value: 'Kitchen', valueType: 'string', expiresAt: null });
    await repository.upsert({ userId: 'user-1', key: 'alias:office', value: 'Office', valueType: 'string', expiresAt: null });
    await repository.upsert({ userId: 'user-1', key: 'context:room', value: 'Kitchen', valueType: 'string', expiresAt: null });
    await repository.upsert({ userId: 'user-2', key: 'alias:kitchen', value: 'Other', valueType: 'string', expiresAt: null });
    await repository.upsert({ userId: 'user-1', key: 'alias:expired', value: 'Expired', valueType: 'string', expiresAt: '2000-01-01T00:00:00.000Z' });

    await expect(repository.listByPrefix('user-1', 'alias:')).resolves.toEqual([
      expect.objectContaining({ key: 'alias:kitchen', value: 'Kitchen' }),
      expect.objectContaining({ key: 'alias:office', value: 'Office' })
    ]);

    await repository.delete('user-1', 'alias:kitchen');
    await repository.deleteExpired();

    await expect(repository.findByKey('user-1', 'alias:kitchen')).resolves.toBeNull();
    expect(db.prepare('SELECT COUNT(*) AS count FROM assistant_memory WHERE key = ?').get('alias:expired')).toEqual({ count: 0 });
  });
});
