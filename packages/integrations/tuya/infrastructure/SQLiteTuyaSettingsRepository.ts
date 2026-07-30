import { Database as SqliteDatabase } from 'better-sqlite3';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import { TuyaAuthorization } from '../domain/TuyaSettings';
import { TuyaSettingsRepository } from '../domain/TuyaSettingsRepository';

interface TuyaAuthorizationRow {
  user_code: string; endpoint: string; uid: string; terminal_id: string;
  access_token: string; refresh_token: string; expires_at: number; updated_at: string;
}

export class SQLiteTuyaSettingsRepository implements TuyaSettingsRepository {
  private readonly db: SqliteDatabase;
  public constructor(dbPath: string) { this.db = SqliteDatabaseManager.getInstance(dbPath); }
  public async getAuthorization(): Promise<TuyaAuthorization | null> {
    const row = this.db.prepare('SELECT user_code, endpoint, uid, terminal_id, access_token, refresh_token, expires_at, updated_at FROM tuya_authorization WHERE id = ?').get('default') as TuyaAuthorizationRow | undefined;
    return row ? { userCode: row.user_code, endpoint: row.endpoint, uid: row.uid, terminalId: row.terminal_id, accessToken: row.access_token, refreshToken: row.refresh_token, expiresAt: row.expires_at, updatedAt: row.updated_at } : null;
  }
  public async saveAuthorization(value: TuyaAuthorization): Promise<void> {
    this.db.prepare(`INSERT INTO tuya_authorization (id, user_code, endpoint, uid, terminal_id, access_token, refresh_token, expires_at, updated_at)
      VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET user_code=excluded.user_code, endpoint=excluded.endpoint, uid=excluded.uid, terminal_id=excluded.terminal_id, access_token=excluded.access_token, refresh_token=excluded.refresh_token, expires_at=excluded.expires_at, updated_at=excluded.updated_at`)
      .run(value.userCode, value.endpoint, value.uid, value.terminalId, value.accessToken, value.refreshToken, value.expiresAt, value.updatedAt);
  }
  public async clearAuthorization(): Promise<void> { this.db.prepare('DELETE FROM tuya_authorization WHERE id = ?').run('default'); }
}