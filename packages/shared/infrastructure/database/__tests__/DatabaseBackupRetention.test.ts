import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { DatabaseBackupService } from '../DatabaseBackupService';
import * as getDbPathModule from '../../../config/getDatabasePath';

jest.mock('../../../config/getDatabasePath');

describe('Feature: manual backups no longer accumulate without limit', () => {
  let directory: string;
  let databasePath: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hp-backup-keep-'));
    databasePath = path.join(directory, 'source.db');
    const source = new Database(databasePath);
    source.exec('CREATE TABLE sample (value TEXT)');
    source.prepare('INSERT INTO sample (value) VALUES (?)').run('kept');
    source.close();
    (getDbPathModule.getDatabasePath as jest.Mock).mockReturnValue(databasePath);
    process.env.HOMEPILOT_BACKUP_DIR = path.join(directory, 'backups');
  });

  afterEach(() => {
    delete process.env.HOMEPILOT_BACKUP_DIR;
    delete process.env.HOMEPILOT_BACKUP_KEEP;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const backupFiles = () => fs.readdirSync(path.join(directory, 'backups')).filter((file) => file.startsWith('homepilot-backup-'));

  it('Scenario: Given the default setting When more than five backups are created Then only the latest five remain', async () => {
    const service = new DatabaseBackupService();
    let last: string | undefined;

    for (let index = 0; index < 7; index += 1) {
      const result = await service.createBackup();
      expect(result.success).toBe(true);
      last = result.backup?.filename;
    }

    expect(backupFiles()).toHaveLength(5);
    expect(backupFiles()).toContain(last);
  });

  it('Scenario: Given HOMEPILOT_BACKUP_KEEP=2 When backups are created Then two remain, including the newest', async () => {
    process.env.HOMEPILOT_BACKUP_KEEP = '2';
    const service = new DatabaseBackupService();
    let last: string | undefined;

    for (let index = 0; index < 4; index += 1) last = (await service.createBackup()).backup?.filename;

    expect(backupFiles()).toHaveLength(2);
    expect(backupFiles()).toContain(last);
  });

  it('Scenario: Given an invalid setting When a backup is created Then the default of five applies and the new backup is never removed', async () => {
    process.env.HOMEPILOT_BACKUP_KEEP = '0';
    const service = new DatabaseBackupService();
    let last: string | undefined;

    for (let index = 0; index < 6; index += 1) last = (await service.createBackup()).backup?.filename;

    expect(backupFiles()).toHaveLength(5);
    expect(backupFiles()).toContain(last);
  });

  it('Scenario: Given files that are not this service backups When old backups are pruned Then those files are never touched', async () => {
    process.env.HOMEPILOT_BACKUP_KEEP = '1';
    const folder = path.join(directory, 'backups');
    fs.mkdirSync(folder, { recursive: true });
    for (const other of ['manual-before-upgrade.db', 'notes.txt', 'homepilot-backup-note.txt']) fs.writeFileSync(path.join(folder, other), 'x');
    const service = new DatabaseBackupService();

    await service.createBackup();
    await service.createBackup();

    expect(backupFiles().filter((file) => file.endsWith('.db'))).toHaveLength(1);
    expect(fs.readdirSync(folder)).toEqual(expect.arrayContaining(['manual-before-upgrade.db', 'notes.txt', 'homepilot-backup-note.txt']));
  });
});
