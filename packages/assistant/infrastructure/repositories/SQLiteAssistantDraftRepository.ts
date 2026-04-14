import { Database as SqliteDatabase } from 'better-sqlite3';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import { AssistantDraft, AssistantDraftStatus, AssistantDraftType } from '../../domain/AssistantDraft';
import { AssistantDraftRepository } from '../../domain/repositories/AssistantDraftRepository';

interface DraftRow {
  id: string;
  fingerprint: string;
  type: string;
  status: string;
  payload: string;
  created_at: string;
}

export class SQLiteAssistantDraftRepository implements AssistantDraftRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  public async save(draft: AssistantDraft): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO assistant_drafts (id, fingerprint, type, status, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        payload = excluded.payload
    `);

    stmt.run(
      draft.id,
      draft.fingerprint,
      draft.type,
      draft.status,
      JSON.stringify(draft.payload),
      draft.createdAt
    );
  }

  public async findById(id: string): Promise<AssistantDraft | null> {
    const row = this.db.prepare('SELECT * FROM assistant_drafts WHERE id = ?').get(id) as DraftRow | undefined;
    return row ? this.mapToEntity(row) : null;
  }

  public async findByFingerprint(fingerprint: string): Promise<AssistantDraft | null> {
    const row = this.db.prepare('SELECT * FROM assistant_drafts WHERE fingerprint = ?').get(fingerprint) as DraftRow | undefined;
    return row ? this.mapToEntity(row) : null;
  }

  public async updateStatus(id: string, status: 'draft' | 'active'): Promise<void> {
    this.db.prepare('UPDATE assistant_drafts SET status = ? WHERE id = ?').run(status, id);
  }

  public async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM assistant_drafts WHERE id = ?').run(id);
  }

  private mapToEntity(row: DraftRow): AssistantDraft {
    return {
      id: row.id,
      fingerprint: row.fingerprint,
      type: row.type as AssistantDraftType,
      status: row.status as AssistantDraftStatus,
      payload: JSON.parse(row.payload),
      createdAt: row.created_at
    };
  }
}
