import { Database as SqliteDatabase } from 'better-sqlite3';
import { SettingsRepository } from '../domain/SettingsRepository';
import { HomeAssistantSettings } from '../domain/HomeAssistantSettings';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';

interface SettingsRow {
  id: string;
  base_url: string;
  access_token: string;
  updated_at: string;
}

/**
 * SQLiteSettingsRepository
 * 
 * Implementación duradera en SQLite para la configuración de Home Assistant.
 */
export class SQLiteSettingsRepository implements SettingsRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  public async getSettings(): Promise<HomeAssistantSettings | null> {
    const stmt = this.db.prepare('SELECT * FROM ha_settings WHERE id = ?');
    const row = stmt.get('default') as SettingsRow | undefined;

    if (!row) return null;

    return {
      baseUrl: row.base_url,
      accessToken: row.access_token,
      updatedAt: row.updated_at
    };
  }

  public async saveSettings(settings: HomeAssistantSettings): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO ha_settings (id, base_url, access_token, updated_at)
      VALUES (?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW'))
      ON CONFLICT(id) DO UPDATE SET
        base_url = excluded.base_url,
        access_token = excluded.access_token,
        updated_at = STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')
    `);

    stmt.run('default', settings.baseUrl, settings.accessToken);
  }
}
