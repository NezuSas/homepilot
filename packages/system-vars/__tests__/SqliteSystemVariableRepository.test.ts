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

  it('Scenario: Given existing, scoped, and expired variables When updated, filtered, and deleted Then their persistence contract is preserved', async () => {
    const repository = new SqliteSystemVariableRepository(databasePath);
    const initial = await repository.upsert({ scope: 'global', homeId: null, name: 'theme', value: 'dark', valueType: 'string', description: 'Theme' }, () => 'global-theme');
    const updated = await repository.upsert({ scope: 'global', homeId: null, name: 'theme', value: 'light', valueType: 'string' }, () => 'unused-id');
    await repository.upsert({ scope: 'home', homeId: 'home-a', name: 'night_mode', value: 'true', valueType: 'boolean' }, () => 'home-a-night');
    await repository.upsert({ scope: 'home', homeId: 'home-b', name: 'night_mode', value: 'false', valueType: 'boolean' }, () => 'home-b-night');

    expect(updated).toEqual(expect.objectContaining({ id: initial.id, value: 'light', description: null }));
    await expect(repository.findById(initial.id)).resolves.toEqual(expect.objectContaining({ value: 'light' }));
    await expect(repository.listAll({ scope: 'home', homeId: 'home-a' })).resolves.toEqual([expect.objectContaining({ id: 'home-a-night' })]);
    await expect(repository.listAll({ scope: 'global' })).resolves.toEqual([expect.objectContaining({ id: 'global-theme' })]);
    await expect(repository.delete(initial.id)).resolves.toBe(true);
    await expect(repository.delete(initial.id)).resolves.toBe(false);
    await expect(repository.findById(initial.id)).resolves.toBeNull();
  });

  it('Scenario: Given an expired variable When read or purged Then it is unavailable and removed', async () => {
    const repository = new SqliteSystemVariableRepository(databasePath);
    const database = SqliteDatabaseManager.getInstance(databasePath, false);
    database.prepare(
      "INSERT INTO system_variables (id, scope, home_id, name, value, value_type, description, ttl_seconds, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run('expired', 'home', 'home-a', 'expired_key', 'old', 'string', null, 1, '2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z');

    await expect(repository.findByKey('home', 'home-a', 'expired_key')).resolves.toBeNull();
    await expect(repository.deleteExpired()).resolves.toBe(1);
  });});