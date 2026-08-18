import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { SQLiteSettingsRepository } from '../infrastructure/SQLiteSettingsRepository';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';

describe('SQLiteSettingsRepository', () => {
  let databasePath: string;

  beforeEach(() => {
    databasePath = path.join(__dirname, `ha-settings-${randomUUID()}.db`);
    SqliteDatabaseManager.getInstance(databasePath, false).exec("CREATE TABLE ha_settings (id TEXT PRIMARY KEY, base_url TEXT NOT NULL, access_token TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')))");
  });

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    for (const candidate of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
  });

  it('returns null before setup and persists the singleton configuration', async () => {
    const repository = new SQLiteSettingsRepository(databasePath);
    await expect(repository.getSettings()).resolves.toBeNull();

    await repository.saveSettings({ baseUrl: 'http://homeassistant.local:8123', accessToken: 'token-a', updatedAt: 'ignored' });
    await expect(repository.getSettings()).resolves.toEqual(expect.objectContaining({ baseUrl: 'http://homeassistant.local:8123', accessToken: 'token-a', updatedAt: expect.any(String) }));
  });

  it('updates the singleton instead of creating a second configuration', async () => {
    const repository = new SQLiteSettingsRepository(databasePath);
    await repository.saveSettings({ baseUrl: 'http://first.local', accessToken: 'one', updatedAt: '' });
    await repository.saveSettings({ baseUrl: 'https://second.local', accessToken: 'two', updatedAt: '' });

    await expect(repository.getSettings()).resolves.toEqual(expect.objectContaining({ baseUrl: 'https://second.local', accessToken: 'two' }));
    expect(SqliteDatabaseManager.getInstance(databasePath, false).prepare('SELECT COUNT(*) AS count FROM ha_settings').get()).toEqual({ count: 1 });
  });
});