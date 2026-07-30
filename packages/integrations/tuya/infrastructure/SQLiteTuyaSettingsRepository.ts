import { Database as SqliteDatabase } from 'better-sqlite3';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import { TuyaSettings } from '../domain/TuyaSettings';
import { TuyaSettingsRepository } from '../domain/TuyaSettingsRepository';

interface TuyaSettingsRow {
  endpoint: string;
  client_id: string;
  client_secret: string;
  user_uid: string;
  updated_at: string;
}

export class SQLiteTuyaSettingsRepository implements TuyaSettingsRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  public async getSettings(): Promise<TuyaSettings | null> {
    const row = this.db.prepare('SELECT endpoint, client_id, client_secret, user_uid, updated_at FROM tuya_settings WHERE id = ?').get('default') as TuyaSettingsRow | undefined;
    return row ? {
      endpoint: row.endpoint,
      clientId: row.client_id,
      clientSecret: row.client_secret,
      userUid: row.user_uid,
      updatedAt: row.updated_at,
    } : null;
  }

  public async saveSettings(settings: TuyaSettings): Promise<void> {
    this.db.prepare(`
      INSERT INTO tuya_settings (id, endpoint, client_id, client_secret, user_uid, updated_at)
      VALUES ('default', ?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW'))
      ON CONFLICT(id) DO UPDATE SET
        endpoint = excluded.endpoint,
        client_id = excluded.client_id,
        client_secret = excluded.client_secret,
        user_uid = excluded.user_uid,
        updated_at = STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')
    `).run(settings.endpoint, settings.clientId, settings.clientSecret, settings.userUid);
  }
}