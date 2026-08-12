import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { SqliteSystemVariableRepository } from '../infrastructure/SqliteSystemVariableRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../../shared/infrastructure/database/SqliteMigrationsRunner';

describe('Feature: persistent system variables', () => {
  let databasePath: string;

  beforeEach(() => {
    databasePath = path.join(__dirname, `system-variables-${randomUUID()}.db`);
    const database = SqliteDatabaseManager.getInstance(databasePath, false);
    new SqliteMigrationsRunner(database).run(path.join(__dirname, '../../../migrations'));
  });

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    for (const candidate of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
      if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
    }
  });

  it('Scenario: Given two homes with the same key When SQLite is reopened Then values remain isolated and durable', async () => {
    const repository = new SqliteSystemVariableRepository(databasePath);
    await repository.upsert({ scope: 'home', homeId: 'home-a', name: 'night_mode', value: 'true', valueType: 'boolean' }, () => 'variable-a');
    await repository.upsert({ scope: 'home', homeId: 'home-b', name: 'night_mode', value: 'false', valueType: 'boolean' }, () => 'variable-b');

    SqliteDatabaseManager.closeAll();
    const restartedRepository = new SqliteSystemVariableRepository(databasePath);

    await expect(restartedRepository.findByKey('home', 'home-a', 'night_mode')).resolves.toMatchObject({ id: 'variable-a', value: 'true' });
    await expect(restartedRepository.findByKey('home', 'home-b', 'night_mode')).resolves.toMatchObject({ id: 'variable-b', value: 'false' });
  });
});