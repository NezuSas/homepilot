import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { SqliteSystemSetupRepository } from '../infrastructure/SqliteSystemSetupRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../../shared/infrastructure/database/SqliteMigrationsRunner';

describe('Feature: persistent setup state', () => {
  let databasePath: string;

  beforeEach(() => {
    databasePath = path.join(__dirname, `system-setup-${randomUUID()}.db`);
    const database = SqliteDatabaseManager.getInstance(databasePath, false);
    new SqliteMigrationsRunner(database).run(path.join(__dirname, '../../../migrations'));
  });

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    for (const candidate of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
      if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
    }
  });

  it('Scenario: Given a migrated appliance When setup is read and completed Then durable state is mapped correctly', async () => {
    const database = SqliteDatabaseManager.getInstance(databasePath, false);
    database.prepare('INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'admin-1', 'admin-1', 'hash', 'admin', 1, '2026-08-17T00:00:00.000Z', '2026-08-17T00:00:00.000Z'
    );
    const repository = new SqliteSystemSetupRepository(databasePath);

    await expect(repository.getSetupState()).resolves.toMatchObject({
      id: 'local-edge',
      isInitialized: false,
      initializedAt: null,
      setupVersion: 1,
      onboardingCompletedByUserId: null,
    });

    const initialized = await repository.markAsInitialized('admin-1');
    SqliteDatabaseManager.closeAll();
    const restartedRepository = new SqliteSystemSetupRepository(databasePath);

    expect(initialized).toMatchObject({
      isInitialized: true,
      onboardingCompletedByUserId: 'admin-1',
    });
    await expect(restartedRepository.getSetupState()).resolves.toMatchObject({
      isInitialized: true,
      onboardingCompletedByUserId: 'admin-1',
    });
  });

  it('Scenario: Given a database missing its setup row When read Then a safe uninitialized fallback is returned', async () => {
    const database = SqliteDatabaseManager.getInstance(databasePath, false);
    database.prepare("DELETE FROM system_setup WHERE id = 'local-edge'").run();
    const repository = new SqliteSystemSetupRepository(databasePath);

    await expect(repository.getSetupState()).resolves.toMatchObject({
      id: 'local-edge',
      isInitialized: false,
      initializedAt: null,
      setupVersion: 1,
      onboardingCompletedByUserId: null,
    });
  });
});
