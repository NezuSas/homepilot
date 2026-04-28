import { SQLiteAssistantLearningRepository } from '../infrastructure/repositories/SQLiteAssistantLearningRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { AssistantLearningEvent } from '../domain/AssistantLearningEvent';
import type { Database } from 'better-sqlite3';

// Mocking SqliteDatabaseManager to provide a memory database
let mockDb: Database | null = null;

jest.mock('../../shared/infrastructure/database/SqliteDatabaseManager', () => ({
  SqliteDatabaseManager: {
    getInstance: jest.fn(() => {
      if (mockDb) return mockDb;
      const Database = require('better-sqlite3');
      mockDb = new Database(':memory:');
      mockDb!.exec(`
        CREATE TABLE assistant_learning_events (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          event_type TEXT,
          entity_type TEXT,
          entity_id TEXT,
          entity_name TEXT,
          room_id TEXT,
          prompt TEXT,
          correction TEXT,
          metadata_json TEXT,
          created_at TEXT
        )
      `);
      return mockDb;
    })
  }
}));

describe('SQLiteAssistantLearningRepository', () => {
  let repository: SQLiteAssistantLearningRepository;
  const dbPath = ':memory:';

  beforeEach(() => {
    repository = new SQLiteAssistantLearningRepository(dbPath);
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.exec('DELETE FROM assistant_learning_events');
  });

  it('should throw error when mapping an event with invalid event_type', async () => {
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.prepare(`
      INSERT INTO assistant_learning_events (id, user_id, event_type, created_at)
      VALUES (?, ?, ?, ?)
    `).run('e1', 'u1', 'invalid_type', new Date().toISOString());

    await expect(repository.findByUserId('u1')).rejects.toThrow('Invalid learning event type: invalid_type');
  });

  it('should successfully save and find events', async () => {
    const event: AssistantLearningEvent = {
      id: 'e1',
      userId: 'u1',
      eventType: 'device_used',
      entityType: 'device',
      entityId: 'd1',
      entityName: 'Light',
      roomId: 'r1',
      prompt: 'turn on light',
      correction: null,
      metadata: { some: 'data' },
      createdAt: new Date().toISOString()
    };

    await repository.save(event);
    const found = await repository.findByUserId('u1');

    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('e1');
    expect(found[0].eventType).toBe('device_used');
    expect(found[0].metadata).toEqual({ some: 'data' });
  });
});
