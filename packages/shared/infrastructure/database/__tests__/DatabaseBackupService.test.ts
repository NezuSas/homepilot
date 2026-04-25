import fs from 'fs';
import path from 'path';
import { DatabaseBackupService } from '../DatabaseBackupService';
import * as getDbPathModule from '../../../config/getDatabasePath';

jest.mock('../../../config/getDatabasePath');

describe('DatabaseBackupService', () => {
  const testBackupDir = path.resolve(__dirname, 'tmp-backups');
  const testDbPath = path.resolve(__dirname, 'tmp-test.db');
  let service: DatabaseBackupService;

  beforeAll(() => {
    process.env.HOMEPILOT_BACKUP_DIR = testBackupDir;
    if (!fs.existsSync(testBackupDir)) fs.mkdirSync(testBackupDir, { recursive: true });
    fs.writeFileSync(testDbPath, 'dummy sqlite data');
    (getDbPathModule.getDatabasePath as jest.Mock).mockReturnValue(testDbPath);
  });

  afterAll(() => {
    if (fs.existsSync(testBackupDir)) {
      fs.readdirSync(testBackupDir).forEach(f => fs.unlinkSync(path.join(testBackupDir, f)));
      fs.rmdirSync(testBackupDir);
    }
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  beforeEach(() => {
    service = new DatabaseBackupService();
    // Clear backups dir before each test
    fs.readdirSync(testBackupDir).forEach(f => fs.unlinkSync(path.join(testBackupDir, f)));
  });

  it('should create a backup file', async () => {
    const result = await service.createBackup();
    expect(result.success).toBe(true);
    expect(result.backup).toBeDefined();
    expect(fs.existsSync(result.backup!.path)).toBe(true);
    expect(result.backup!.filename).toMatch(/^homepilot-backup-.*\.db$/);
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
});
