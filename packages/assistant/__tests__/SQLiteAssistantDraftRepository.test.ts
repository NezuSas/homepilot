import { Database } from 'better-sqlite3';
import { SQLiteAssistantDraftRepository } from '../infrastructure/repositories/SQLiteAssistantDraftRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../../shared/infrastructure/database/SqliteMigrationsRunner';
import * as fs from 'fs';
import * as path from 'path';

describe('SQLiteAssistantDraftRepository', () => {
  let dbPath: string;
  let repo: SQLiteAssistantDraftRepository;
  let db: Database;

  beforeAll(() => {
    dbPath = path.join(__dirname, `test-draft-repo-${Date.now()}.db`);
    db = SqliteDatabaseManager.getInstance(dbPath);
    
    // Run migrations to ensure schema is up to date (including our new 020 migration)
    const migrationsDir = path.resolve(__dirname, '../../../migrations');
    const runner = new SqliteMigrationsRunner(db);
    runner.run(migrationsDir);

    repo = new SQLiteAssistantDraftRepository(dbPath);
  });

  afterAll(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  afterEach(() => {
    db.exec('DELETE FROM assistant_drafts');
  });

  it('should save a draft and find it by id', async () => {
    const draft = {
      id: 'draft-1',
      fingerprint: 'user1:draft-1',
      type: 'scene' as const,
      status: 'draft' as const,
      payload: { actions: [] },
      createdAt: new Date().toISOString()
    };

    await repo.save(draft);
    
    const found = await repo.findById('draft-1');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('draft-1');
    expect(found?.fingerprint).toBe('user1:draft-1');
  });

  it('should find a draft by fingerprint', async () => {
    const draft = {
      id: 'draft-2',
      fingerprint: 'unique-fingerprint-123',
      type: 'automation' as const,
      status: 'draft' as const,
      payload: { command: 'turn_on' },
      createdAt: new Date().toISOString()
    };

    await repo.save(draft);

    const found = await repo.findByFingerprint('unique-fingerprint-123');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('draft-2');
    expect(found?.fingerprint).toBe('unique-fingerprint-123');
  });

  it('should return null for non-existent fingerprint', async () => {
    const found = await repo.findByFingerprint('non-existent');
    expect(found).toBeNull();
  });

  it('should update draft status', async () => {
    const draft = {
      id: 'draft-3',
      fingerprint: 'user1:draft-3',
      type: 'scene' as const,
      status: 'draft' as const,
      payload: {},
      createdAt: new Date().toISOString()
    };

    await repo.save(draft);
    await repo.updateStatus('draft-3', 'active');

    const found = await repo.findById('draft-3');
    expect(found?.status).toBe('active');
  });
});
