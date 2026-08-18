import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildDatabase } from '../infrastructure/assemblers/buildDatabase';
import { SqliteDatabaseManager } from '../packages/shared/infrastructure/database/SqliteDatabaseManager';

describe('buildDatabase', () => {
  let tempDirectory: string;

  beforeEach(() => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'homepilot-build-database-'));
  });

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  it('resolves a relative database path and applies an explicit migration directory', () => {
    const migrationsDir = path.join(tempDirectory, 'migrations');
    fs.mkdirSync(migrationsDir);
    fs.writeFileSync(path.join(migrationsDir, '001_create_probe.sql'), 'CREATE TABLE assembly_probe (id TEXT PRIMARY KEY);');
    const absoluteDbPath = path.join(tempDirectory, 'assembly.db');
    const relativeDbPath = path.relative(process.cwd(), absoluteDbPath);

    const assembly = buildDatabase({ rawDbPath: relativeDbPath, migrationsDir, verbose: false });

    expect(assembly.dbPath).toBe(path.resolve(process.cwd(), relativeDbPath));
    expect(assembly.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'assembly_probe'").get()).toEqual({ name: 'assembly_probe' });
    expect(assembly.db.prepare('SELECT name FROM _migrations').all()).toEqual([{ name: '001_create_probe.sql' }]);
  });

  it('preserves an absolute database path and enables explicit verbose migration diagnostics', () => {
    const migrationsDir = path.join(tempDirectory, 'verbose-migrations');
    const dbPath = path.join(tempDirectory, 'absolute.db');
    fs.mkdirSync(migrationsDir);
    fs.writeFileSync(path.join(migrationsDir, '001_create_verbose_probe.sql'), 'CREATE TABLE verbose_probe (id TEXT PRIMARY KEY);');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const assembly = buildDatabase({ rawDbPath: dbPath, migrationsDir, verbose: true });

      expect(assembly.dbPath).toBe(dbPath);
      expect(assembly.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'verbose_probe'").get())
        .toEqual({ name: 'verbose_probe' });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Inicializando persistencia SQLite'));
    } finally {
      logSpy.mockRestore();
    }
  });
  it('propagates migration errors so bootstrap cannot continue with a partial schema', () => {
    const migrationsDir = path.join(tempDirectory, 'invalid-migrations');
    fs.mkdirSync(migrationsDir);
    fs.writeFileSync(path.join(migrationsDir, '001_invalid.sql'), 'CREATE TABLE broken (');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      expect(() => buildDatabase({ rawDbPath: path.join(tempDirectory, 'invalid.db'), migrationsDir })).toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        '[Bootstrap] Error fatal al aplicar migraciones. Abortando arranque de repositorios.',
        expect.objectContaining({ code: 'SQLITE_ERROR' }),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});