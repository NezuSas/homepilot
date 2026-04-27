import { Database as SqliteDatabase } from 'better-sqlite3';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import { AssistantMemoryRecord, AssistantMemoryRepository } from '../../domain/repositories/AssistantMemoryRepository';

interface MemoryRow {
  user_id: string;
  key: string;
  value: string;
  value_type: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export class SQLiteAssistantMemoryRepository implements AssistantMemoryRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  public async upsert(record: Omit<AssistantMemoryRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO assistant_memory (user_id, key, value, value_type, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        value_type = excluded.value_type,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      record.userId,
      record.key,
      record.value,
      record.valueType,
      record.expiresAt,
      now,
      now
    );
  }

  public async findByKey(userId: string, key: string): Promise<AssistantMemoryRecord | null> {
    const row = this.db.prepare(`
      SELECT * FROM assistant_memory 
      WHERE user_id = ? AND key = ? 
      AND (expires_at IS NULL OR expires_at > STRFTIME('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
    `).get(userId, key) as MemoryRow | undefined;

    return row ? this.mapToRecord(row) : null;
  }

  public async listByPrefix(userId: string, prefix: string): Promise<AssistantMemoryRecord[]> {
    const rows = this.db.prepare(`
      SELECT * FROM assistant_memory 
      WHERE user_id = ? AND key LIKE ?
      AND (expires_at IS NULL OR expires_at > STRFTIME('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
    `).all(userId, `${prefix}%`) as MemoryRow[];

    return rows.map(row => this.mapToRecord(row));
  }

  public async delete(userId: string, key: string): Promise<void> {
    this.db.prepare('DELETE FROM assistant_memory WHERE user_id = ? AND key = ?').run(userId, key);
  }

  public async deleteExpired(): Promise<void> {
    this.db.prepare("DELETE FROM assistant_memory WHERE expires_at IS NOT NULL AND expires_at <= STRFTIME('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'").run();
  }

  private mapToRecord(row: MemoryRow): AssistantMemoryRecord {
    return {
      userId: row.user_id,
      key: row.key,
      value: row.value,
      valueType: row.value_type as 'string' | 'json' | 'number',
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
