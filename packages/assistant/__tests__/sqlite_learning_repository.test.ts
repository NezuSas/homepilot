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
  it('aggregates scoped device and room usage and preserves chronological query contracts', async () => {
    const events: AssistantLearningEvent[] = [
      {
        id: 'e1', userId: 'u1', eventType: 'device_used', entityType: 'device', entityId: 'd1', entityName: 'Light 1',
        roomId: 'r1', prompt: 'on', correction: null, metadata: {}, createdAt: '2026-01-01T10:00:00.000Z'
      },
      {
        id: 'e2', userId: 'u1', eventType: 'command_succeeded', entityType: 'device', entityId: 'd1', entityName: 'Light 1',
        roomId: 'r1', prompt: null, correction: null, metadata: {}, createdAt: '2026-01-02T10:00:00.000Z'
      },
      {
        id: 'e3', userId: 'u1', eventType: 'scene_used', entityType: 'scene', entityId: 'scene-1', entityName: 'Movie',
        roomId: 'r2', prompt: 'movie', correction: null, metadata: {}, createdAt: '2026-01-03T10:00:00.000Z'
      },
      {
        id: 'e4', userId: 'u1', eventType: 'correction_received', entityType: null, entityId: null, entityName: null,
        roomId: null, prompt: null, correction: 'not that light', metadata: {}, createdAt: '2026-01-04T10:00:00.000Z'
      },
      {
        id: 'e5', userId: 'u2', eventType: 'device_used', entityType: 'device', entityId: 'other-user-device', entityName: 'Private',
        roomId: 'r3', prompt: null, correction: null, metadata: {}, createdAt: '2026-01-05T10:00:00.000Z'
      },
    ];
    for (const event of events) await repository.save(event);

    await expect(repository.getMostUsedEntities('u1', 'device', 1)).resolves.toEqual([{ entityId: 'd1', count: 2 }]);
    await expect(repository.getMostUsedRooms('u1', 1)).resolves.toEqual([{ roomId: 'r1', count: 2 }]);
    await expect(repository.getRecentCorrections('u1', 1)).resolves.toEqual([expect.objectContaining({ id: 'e4', correction: 'not that light' })]);
    await expect(repository.getEventsInTimeRange('u1', '2026-01-02T00:00:00.000Z', '2026-01-03T23:59:59.999Z')).resolves.toEqual([
      expect.objectContaining({ id: 'e2' }),
      expect.objectContaining({ id: 'e3' }),
    ]);
    await expect(repository.findByUserId('u1', 2)).resolves.toEqual([
      expect.objectContaining({ id: 'e4' }),
      expect.objectContaining({ id: 'e3' }),
    ]);
  });

  it('maps absent metadata to an empty object', async () => {
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.prepare(`INSERT INTO assistant_learning_events (id, user_id, event_type, metadata_json, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run('no-metadata', 'u1', 'alias_created', null, '2026-01-01T00:00:00.000Z');

    await expect(repository.findByUserId('u1')).resolves.toEqual([
      expect.objectContaining({ id: 'no-metadata', metadata: {} })
    ]);
  });
});
