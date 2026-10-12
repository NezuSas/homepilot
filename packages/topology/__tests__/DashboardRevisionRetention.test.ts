import Database from 'better-sqlite3';
import { SQLiteDashboardRepository } from '../infrastructure/repositories/SQLiteDashboardRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';

describe('Feature: dashboard history keeps a bounded number of revisions', () => {
  let db: Database.Database;
  let repository: SQLiteDashboardRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec('CREATE TABLE dashboard_revisions (id TEXT PRIMARY KEY, dashboard_id TEXT, snapshot TEXT, created_at TEXT)');
    jest.spyOn(SqliteDatabaseManager, 'getInstance').mockReturnValue(db);
    repository = new SQLiteDashboardRepository('test-only-mocked-connection');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    db.close();
  });

  const save = (dashboardId: string, index: number) => repository.saveRevision({
    id: `${dashboardId}-${index}`,
    dashboardId,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    snapshot: { index } as never,
  });

  it('Scenario: Given a dashboard with more than 100 revisions When another is saved Then only the newest 100 remain', async () => {
    for (let index = 0; index < 105; index += 1) await save('dash-a', index);

    const kept = await repository.findRevisionsByDashboardId('dash-a');

    expect(kept).toHaveLength(100);
    expect(kept[0]?.id).toBe('dash-a-104');
    expect(kept[99]?.id).toBe('dash-a-5');
  });

  it('Scenario: Given revisions of two dashboards When one exceeds the limit Then the other keeps all of its own', async () => {
    for (let index = 0; index < 3; index += 1) await save('dash-b', index);
    for (let index = 0; index < 102; index += 1) await save('dash-a', index);

    expect(await repository.findRevisionsByDashboardId('dash-b')).toHaveLength(3);
    expect(await repository.findRevisionsByDashboardId('dash-a')).toHaveLength(100);
  });

  it('Scenario: Given fewer than 100 revisions When more are saved Then none is removed', async () => {
    for (let index = 0; index < 40; index += 1) await save('dash-a', index);

    expect(await repository.findRevisionsByDashboardId('dash-a')).toHaveLength(40);
  });
});
