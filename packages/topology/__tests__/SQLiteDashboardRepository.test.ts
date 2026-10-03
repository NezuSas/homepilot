import Database from 'better-sqlite3';
import { SQLiteDashboardRepository } from '../infrastructure/repositories/SQLiteDashboardRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { legacyDashboard } from './fixtures/legacyDashboard';

describe('Feature: Atomic dashboard history (AC49)', () => {
  it('Scenario: A rejected update also rolls back its revision, without touching a real database', async () => {
    const db = new Database(':memory:');
    const connection = jest.spyOn(SqliteDatabaseManager, 'getInstance').mockReturnValue(db);
    try {
      db.exec(`CREATE TABLE dashboards (id TEXT PRIMARY KEY, owner_id TEXT, title TEXT CHECK(title <> 'reject'), visibility TEXT, tabs TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE dashboard_revisions (id TEXT PRIMARY KEY, dashboard_id TEXT, snapshot TEXT, created_at TEXT);`);
      const repository = new SQLiteDashboardRepository('test-only-mocked-connection');
      const original = legacyDashboard();
      await repository.saveDashboard(original);
      expect(connection).toHaveBeenCalled();
      expect(db.pragma('ignore_check_constraints', { simple: true })).toBe(0);
      expect(() => db.prepare('UPDATE dashboards SET title = ? WHERE id = ?').run('reject', original.id)).toThrow();
      const revision = { id: 'revision', dashboardId: original.id, createdAt: original.updatedAt, snapshot: { title: original.title, visibility: original.visibility, tabs: original.tabs } };
      // Native SQLite errors can originate in a previous Jest VM when suites
      // share a worker. Assert their stable contract, not Error instanceof.
      await expect(repository.saveDashboard({ ...original, title: 'reject' }, revision)).rejects.toMatchObject({
        code: 'SQLITE_CONSTRAINT_CHECK', message: expect.stringContaining('CHECK constraint failed'),
      });
      expect(await repository.findDashboardById(original.id)).toEqual(original);
      expect(await repository.findRevisionsByDashboardId(original.id)).toEqual([]);
      await repository.saveDashboard({ ...original, title: 'Updated' }, revision);
      expect((await repository.findDashboardById(original.id))?.title).toBe('Updated');
      expect(await repository.findRevisionsByDashboardId(original.id)).toEqual([revision]);
    } finally { connection.mockRestore(); db.close(); }
  });
});
