import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { DatabaseBackupService } from '../DatabaseBackupService';
import * as getDbPathModule from '../../../config/getDatabasePath';

jest.mock('../../../config/getDatabasePath');

describe('DatabaseBackupService', () => {
  const testBackupDir = path.resolve(__dirname, 'tmp-backups');
  const testDbPath = path.resolve(__dirname, 'tmp-test.db');
  const invalidDbPath = path.resolve(__dirname, 'tmp-invalid.db');
  let service: DatabaseBackupService;
  let source: Database.Database;

  beforeAll(() => {
    process.env.HOMEPILOT_BACKUP_DIR = testBackupDir;
    if (!fs.existsSync(testBackupDir)) fs.mkdirSync(testBackupDir, { recursive: true });
    source = new Database(testDbPath);
    source.pragma('journal_mode = WAL');
    source.exec('CREATE TABLE backup_check (value TEXT NOT NULL)');
    source.prepare('INSERT INTO backup_check (value) VALUES (?)').run('before-backup');
    (getDbPathModule.getDatabasePath as jest.Mock).mockReturnValue(testDbPath);
  });

  afterAll(() => {
    source.close();
    if (fs.existsSync(testBackupDir)) {
      fs.readdirSync(testBackupDir).forEach(f => fs.unlinkSync(path.join(testBackupDir, f)));
      fs.rmdirSync(testBackupDir);
    }
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    for (const file of [`${testDbPath}-wal`, `${testDbPath}-shm`, invalidDbPath]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    delete process.env.HOMEPILOT_BACKUP_DIR;
  });

  beforeEach(() => {
    service = new DatabaseBackupService();
    // Clear backups dir before each test
    fs.readdirSync(testBackupDir).forEach(f => fs.unlinkSync(path.join(testBackupDir, f)));
  });

  function expectOnlyFinalBackup(filename: string): void {
    // Assert before opening the WAL-mode backup: the test itself may create sidecars.
    expect(fs.readdirSync(testBackupDir)).toEqual([filename]);
    const partialPath = path.join(testBackupDir, `${filename}.partial`);
    expect(fs.existsSync(partialPath)).toBe(false);
    expect(fs.existsSync(`${partialPath}-wal`)).toBe(false);
    expect(fs.existsSync(`${partialPath}-shm`)).toBe(false);
  }

  it('should create a backup file', async () => {
    const result = await service.createBackup();
    expect(result.success).toBe(true);
    expect(result.backup).toBeDefined();
    expect(fs.existsSync(result.backup!.path)).toBe(true);
    expect(result.backup!.filename).toMatch(/^homepilot-backup-.*\.db$/);
    expectOnlyFinalBackup(result.backup!.filename);
    const restored = new Database(result.backup!.path, { readonly: true });
    try {
      expect(restored.pragma('integrity_check', { simple: true })).toBe('ok');
      expect(restored.prepare('SELECT value FROM backup_check').get()).toEqual({ value: 'before-backup' });
    } finally {
      restored.close();
    }
  });

  it('includes committed rows still in the live WAL', async () => {
    source.prepare('INSERT INTO backup_check (value) VALUES (?)').run('in-wal');
    expect(fs.existsSync(`${testDbPath}-wal`)).toBe(true);
    expect(fs.statSync(`${testDbPath}-wal`).size).toBeGreaterThan(0);
    const result = await service.createBackup();
    expect(result.success).toBe(true);
    expectOnlyFinalBackup(result.backup!.filename);
    const restored = new Database(result.backup!.path, { readonly: true });
    try {
      expect(restored.prepare('SELECT value FROM backup_check WHERE value = ?').get('in-wal'))
        .toEqual({ value: 'in-wal' });
    } finally {
      restored.close();
    }
  });

  it('should list backups ordered by date desc', async () => {
    // Create 2 backups with a small delay
    await service.createBackup();
    await new Promise(resolve => setTimeout(resolve, 1100));
    await service.createBackup();

    const list = await service.listBackups();
    expect(list.length).toBe(2);
    const date1 = new Date(list[0].createdAt).getTime();
    const date2 = new Date(list[1].createdAt).getTime();
    expect(date1).toBeGreaterThanOrEqual(date2);
  });

  it('should return error if source database does not exist', async () => {
    (getDbPathModule.getDatabasePath as jest.Mock).mockReturnValue('non-existent.db');
    const result = await service.createBackup();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Source database not found');
    (getDbPathModule.getDatabasePath as jest.Mock).mockReturnValue(testDbPath);
  });
  it('does not expose a partial backup when the source is invalid', async () => {
    fs.writeFileSync(invalidDbPath, 'not a SQLite database');
    (getDbPathModule.getDatabasePath as jest.Mock).mockReturnValue(invalidDbPath);
    const result = await service.createBackup();
    expect(result.success).toBe(false);
    expect(fs.readdirSync(testBackupDir)).toEqual([]);
    (getDbPathModule.getDatabasePath as jest.Mock).mockReturnValue(testDbPath);
  });

  it('fails visibly instead of publishing a backup if sidecar cleanup fails', async () => {
    const remove = fs.rmSync.bind(fs);
    let failedOnce = false;
    const removeSpy = jest.spyOn(fs, 'rmSync').mockImplementation((file, options) => {
      if (!failedOnce && String(file).endsWith('.partial-wal')) {
        failedOnce = true;
        throw new Error('simulated sidecar cleanup failure');
      }
      return remove(file, options);
    });

    let result;
    try {
      result = await service.createBackup();
    } finally {
      removeSpy.mockRestore();
    }

    expect(failedOnce).toBe(true);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to remove temporary SQLite backup artifacts');
    expect(fs.readdirSync(testBackupDir)).toEqual([]);
  });

  it('ignores non-backup files and returns an empty list when listing fails', async () => {
    fs.writeFileSync(path.join(testBackupDir, 'notes.txt'), 'not a backup');
    expect(await service.listBackups()).toEqual([]);

    const readdirSync = jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw new Error('directory unavailable');
    });
    await expect(service.listBackups()).resolves.toEqual([]);
    readdirSync.mockRestore();
  });
});
