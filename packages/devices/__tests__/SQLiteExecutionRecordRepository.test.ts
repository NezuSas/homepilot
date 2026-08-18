import Database from 'better-sqlite3';
import { ExecutionRecord } from '../domain/ExecutionRecord';
import { SQLiteExecutionRecordRepository } from '../infrastructure/repositories/SQLiteExecutionRecordRepository';

function record(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    id: 'execution-1', sourceType: 'scene', sourceId: 'scene-1', status: 'success', startedAt: '2026-08-17T10:00:00.000Z', completedAt: '2026-08-17T10:00:01.000Z', durationMs: 1000, actionCount: 1, successCount: 1, failedCount: 0, skippedCount: 0, correlationId: 'corr-1', summary: 'Completed', actions: [{ deviceId: 'light-1', command: 'turn_on', commandName: 'Turn on', status: 'success' }], ...overrides,
  };
}

describe('SQLiteExecutionRecordRepository', () => {
  let db: Database.Database;
  let repository: SQLiteExecutionRecordRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE execution_records (
      id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_id TEXT NOT NULL, status TEXT NOT NULL,
      started_at TEXT NOT NULL, completed_at TEXT NOT NULL, duration_ms INTEGER NOT NULL,
      action_count INTEGER NOT NULL, success_count INTEGER NOT NULL, failed_count INTEGER NOT NULL,
      skipped_count INTEGER NOT NULL, correlation_id TEXT, summary TEXT, actions_json TEXT NOT NULL
    )`);
    repository = new SQLiteExecutionRecordRepository(db);
  });

  afterEach(() => db.close());

  it('round-trips optional values and structured action results', async () => {
    await repository.save(record());

    await expect(repository.findById('execution-1')).resolves.toEqual(record());
    await expect(repository.findById('missing')).resolves.toBeNull();
  });

  it('orders recent records and filters source history with limits', async () => {
    await repository.save(record({ id: 'older', startedAt: '2026-08-17T08:00:00.000Z', correlationId: undefined, summary: undefined }));
    await repository.save(record({ id: 'newer', sourceId: 'scene-2', startedAt: '2026-08-17T11:00:00.000Z' }));

    await expect(repository.findRecent(1)).resolves.toEqual([expect.objectContaining({ id: 'newer' })]);
    await expect(repository.findBySource('scene', 'scene-1')).resolves.toEqual([expect.objectContaining({ id: 'older', correlationId: undefined, summary: undefined })]);
  });

  it.each([
    ['source_type', 'other', 'Invalid execution source_type: other'],
    ['status', 'running', 'Invalid execution status: running'],
  ])('rejects invalid persisted %s values', async (column, value, message) => {
    db.prepare(`INSERT INTO execution_records (id, source_type, source_id, status, started_at, completed_at, duration_ms, action_count, success_count, failed_count, skipped_count, correlation_id, summary, actions_json) VALUES ('invalid', 'scene', 'scene-1', 'success', '2026-01-01', '2026-01-01', 0, 0, 0, 0, 0, NULL, NULL, '[]')`).run();
    db.prepare(`UPDATE execution_records SET ${column} = ? WHERE id = 'invalid'`).run(value);

    await expect(repository.findById('invalid')).rejects.toThrow(message);
  });

  it.each(['not-json', '{}'])('rejects invalid action JSON safely', async (actionsJson) => {
    db.prepare(`INSERT INTO execution_records (id, source_type, source_id, status, started_at, completed_at, duration_ms, action_count, success_count, failed_count, skipped_count, correlation_id, summary, actions_json) VALUES ('invalid-actions', 'manual', 'manual-1', 'failed', '2026-01-01', '2026-01-01', 0, 0, 0, 0, 0, NULL, NULL, ? )`).run(actionsJson);

    await expect(repository.findById('invalid-actions')).rejects.toThrow('Invalid execution actions_json for record invalid-actions');
  });
});