import { Database } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { SQLiteAssistantFindingRepository } from '../infrastructure/repositories/SQLiteAssistantFindingRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../../shared/infrastructure/database/SqliteMigrationsRunner';
import { AssistantFinding } from '../domain/AssistantFinding';

function finding(overrides: Partial<AssistantFinding> = {}): AssistantFinding {
  return { id: 'finding-1', fingerprint: 'fingerprint-1', source: 'scanner', type: 'device_name_duplicate', severity: 'medium', title: 'Duplicate name', description: 'Rename devices', relatedEntityType: 'device', relatedEntityId: 'device-1', status: 'open', actions: [{ type: 'rename_device', label: 'Rename' }], metadata: { homeId: 'home-1' }, score: 50, createdAt: '2026-08-17T10:00:00.000Z', updatedAt: '2026-08-17T10:00:00.000Z', ...overrides };
}

describe('SQLiteAssistantFindingRepository', () => {
  let dbPath: string;
  let db: Database;
  let repository: SQLiteAssistantFindingRepository;

  beforeAll(() => {
    dbPath = path.join(__dirname, `test-finding-repository-${Date.now()}.db`);
    db = SqliteDatabaseManager.getInstance(dbPath);
    new SqliteMigrationsRunner(db).run(path.resolve(__dirname, '../../../migrations'));
    repository = new SQLiteAssistantFindingRepository(dbPath);
  });
  afterEach(() => db.exec('DELETE FROM assistant_findings'));
  afterAll(() => { db.close(); if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); });

  it('saves, retrieves, updates open findings, and preserves resolved findings', async () => {
    await repository.save(finding());
    await repository.save(finding({ id: 'ignored-id', title: 'Updated title', score: 70, metadata: { homeId: 'home-1', refreshed: true } }));
    await expect(repository.findById('finding-1')).resolves.toEqual(expect.objectContaining({ title: 'Updated title', score: 70, metadata: { homeId: 'home-1', refreshed: true } }));
    await expect(repository.findByFingerprint('fingerprint-1')).resolves.toEqual(expect.objectContaining({ id: 'finding-1' }));

    await repository.updateStatus('finding-1', 'resolved');
    await repository.save(finding({ title: 'Must not overwrite resolved' }));
    await expect(repository.findById('finding-1')).resolves.toEqual(expect.objectContaining({ status: 'resolved', title: 'Updated title', resolvedAt: expect.any(String) }));
    await expect(repository.findById('missing')).resolves.toBeNull();
  });

  it('lists open/status findings, respects dismissals, resolves stale fingerprints, and aggregates', async () => {
    await repository.save(finding({ id: 'open-high', fingerprint: 'open-high', severity: 'high', score: 90 }));
    await repository.save(finding({ id: 'open-low', fingerprint: 'open-low', severity: 'low', score: 20 }));
    await repository.save(finding({ id: 'other-home', fingerprint: 'other-home', metadata: { homeId: 'home-2' } }));
    await repository.updateStatus('open-low', 'dismissed', '2999-01-01T00:00:00.000Z');

    await expect(repository.findAllOpen()).resolves.toEqual([expect.objectContaining({ id: 'open-high' }), expect.objectContaining({ id: 'other-home' })]);
    await expect(repository.findAllByStatus('dismissed')).resolves.toEqual([expect.objectContaining({ id: 'open-low', status: 'dismissed' })]);
    await expect(repository.resolveMissing(['open-high'], 'home-1')).resolves.toBe(0);
    await expect(repository.resolveMissing([], 'home-2')).resolves.toBe(1);
    await expect(repository.getSummary()).resolves.toEqual({ totalOpen: 1, bySeverity: { high: 1 }, byType: { device_name_duplicate: 1 } });
  });
});