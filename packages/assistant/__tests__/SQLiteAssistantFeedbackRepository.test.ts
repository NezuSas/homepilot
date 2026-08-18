import { Database } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { SQLiteAssistantFeedbackRepository } from '../infrastructure/repositories/SQLiteAssistantFeedbackRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../../shared/infrastructure/database/SqliteMigrationsRunner';

function event(id: string, overrides: Record<string, unknown> = {}) {
  return { id, findingType: 'device_name_duplicate' as const, relatedEntityType: 'device', relatedEntityId: 'device-1', roomId: 'room-1', domain: 'light', actionType: 'rename_device', feedbackType: 'accepted' as const, createdAt: `2026-08-17T10:00:0${id}.000Z`, metadata: { source: 'test' }, ...overrides };
}

describe('SQLiteAssistantFeedbackRepository', () => {
  let dbPath: string; let db: Database; let repository: SQLiteAssistantFeedbackRepository;
  beforeAll(() => { dbPath = path.join(__dirname, `test-feedback-repository-${Date.now()}.db`); db = SqliteDatabaseManager.getInstance(dbPath); new SqliteMigrationsRunner(db).run(path.resolve(__dirname, '../../../migrations')); repository = new SQLiteAssistantFeedbackRepository(dbPath); });
  afterEach(() => db.exec('DELETE FROM assistant_feedback_events'));
  afterAll(() => { db.close(); if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); });

  it('round-trips feedback events and filters them by type and room', async () => {
    await repository.save(event('1'));
    await repository.save(event('2', { findingType: 'optimization_opportunity', roomId: 'room-2', feedbackType: 'dismissed', metadata: {} }));

    await expect(repository.findAll()).resolves.toEqual([expect.objectContaining({ id: '2', metadata: {} }), expect.objectContaining({ id: '1', metadata: { source: 'test' } })]);
    await expect(repository.findByType('device_name_duplicate')).resolves.toEqual([expect.objectContaining({ id: '1' })]);
    await expect(repository.findByRoom('room-2')).resolves.toEqual([expect.objectContaining({ id: '2', feedbackType: 'dismissed' })]);
  });

  it('aggregates findings by type and feedback action', async () => {
    await repository.save(event('1'));
    await repository.save(event('2', { feedbackType: 'accepted' }));
    await repository.save(event('3', { feedbackType: 'dismissed' }));

    await expect(repository.getAggregateStats()).resolves.toEqual({ 'device_name_duplicate:accepted': 2, 'device_name_duplicate:dismissed': 1 });
  });
});