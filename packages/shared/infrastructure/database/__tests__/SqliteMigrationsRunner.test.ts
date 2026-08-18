import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SqliteDatabaseManager } from '../SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../SqliteMigrationsRunner';

describe('SqliteMigrationsRunner', () => {
  let tempDirectory: string;
  let databasePath: string;

  beforeEach(() => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'homepilot-migrations-'));
    databasePath = path.join(tempDirectory, 'test.db');
  });

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  it('applies SQL files in lexical order once and records each applied migration', () => {
    const migrationsDir = path.join(tempDirectory, 'migrations');
    fs.mkdirSync(migrationsDir);
    fs.writeFileSync(path.join(migrationsDir, '002_insert.sql'), "INSERT INTO migration_probe (value) VALUES ('second');");
    fs.writeFileSync(path.join(migrationsDir, '001_create.sql'), 'CREATE TABLE migration_probe (value TEXT NOT NULL);');
    fs.writeFileSync(path.join(migrationsDir, 'README.txt'), 'not a migration');
    const db = SqliteDatabaseManager.getInstance(databasePath);
    const runner = new SqliteMigrationsRunner(db);

    runner.run(migrationsDir);
    runner.run(migrationsDir);

    expect(db.prepare('SELECT value FROM migration_probe').all()).toEqual([{ value: 'second' }]);
    expect(db.prepare('SELECT name FROM _migrations ORDER BY name').all()).toEqual([
      { name: '001_create.sql' },
      { name: '002_insert.sql' },
    ]);
  });

  it('initializes migration bookkeeping when the directory has no SQL migrations', () => {
    const migrationsDir = path.join(tempDirectory, 'empty-migrations');
    fs.mkdirSync(migrationsDir);
    fs.writeFileSync(path.join(migrationsDir, 'notes.txt'), 'not a migration');
    const db = SqliteDatabaseManager.getInstance(databasePath);

    new SqliteMigrationsRunner(db).run(migrationsDir);

    expect(db.prepare('SELECT name FROM _migrations').all()).toEqual([]);
  });
  it('rolls back a failing migration and does not mark it as applied', () => {
    const migrationsDir = path.join(tempDirectory, 'migrations');
    fs.mkdirSync(migrationsDir);
    fs.writeFileSync(path.join(migrationsDir, '001_valid.sql'), 'CREATE TABLE valid_probe (value TEXT NOT NULL);');
    fs.writeFileSync(path.join(migrationsDir, '002_invalid.sql'), "INSERT INTO valid_probe (value) VALUES ('before-error'); THIS IS INVALID SQL;");
    const db = SqliteDatabaseManager.getInstance(databasePath);
    const runner = new SqliteMigrationsRunner(db);

    expect(() => runner.run(migrationsDir)).toThrow();

    expect(db.prepare('SELECT value FROM valid_probe').all()).toEqual([]);
    expect(db.prepare('SELECT name FROM _migrations ORDER BY name').all()).toEqual([{ name: '001_valid.sql' }]);
  });
});