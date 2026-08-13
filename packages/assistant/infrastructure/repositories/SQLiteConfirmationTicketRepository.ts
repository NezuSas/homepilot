import { Database as SqliteDatabase } from 'better-sqlite3';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import { ConfirmationTicketRepository } from '../../domain/repositories/ConfirmationTicketRepository';
import { ConfirmationTicket, ConfirmationTicketCommand } from '../../domain/ConfirmationTicket';

interface TicketRow {
  id: string;
  user_id: string;
  home_id: string;
  command: string;
  bulk_type: string | null;
  device_ids_json: string;
  original_prompt: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
}

// Both sides of every expiry comparison use the same STRFTIME-based ISO-8601
// UTC expression as SQLiteAssistantMemoryRepository, so lexical string
// comparison against `expires_at`/`created_at` (also stored as ISO strings) is valid.
const NOW_SQL = "(STRFTIME('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')";

export class SQLiteConfirmationTicketRepository implements ConfirmationTicketRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  public async create(ticket: ConfirmationTicket): Promise<void> {
    this.db.prepare(`
      INSERT INTO assistant_confirmation_tickets
        (id, user_id, home_id, command, bulk_type, device_ids_json, original_prompt, created_at, expires_at, consumed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      ticket.id,
      ticket.userId,
      ticket.homeId,
      ticket.command,
      ticket.bulkType ?? null,
      JSON.stringify(ticket.deviceIds),
      ticket.originalPrompt,
      ticket.createdAt,
      ticket.expiresAt
    );
  }

  public async findActiveByUserId(userId: string): Promise<ConfirmationTicket | null> {
    const row = this.db.prepare(`
      SELECT * FROM assistant_confirmation_tickets
      WHERE user_id = ? AND consumed_at IS NULL AND expires_at > ${NOW_SQL}
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId) as TicketRow | undefined;

    return row ? this.mapToTicket(row) : null;
  }

  public async consume(id: string): Promise<boolean> {
    const result = this.db.prepare(`
      UPDATE assistant_confirmation_tickets
      SET consumed_at = ${NOW_SQL}
      WHERE id = ? AND consumed_at IS NULL AND expires_at > ${NOW_SQL}
    `).run(id);

    return result.changes > 0;
  }

  public async deleteExpired(): Promise<void> {
    this.db.prepare(`DELETE FROM assistant_confirmation_tickets WHERE expires_at <= ${NOW_SQL}`).run();
  }

  private mapToTicket(row: TicketRow): ConfirmationTicket {
    return {
      id: row.id,
      userId: row.user_id,
      homeId: row.home_id,
      command: row.command as ConfirmationTicketCommand,
      bulkType: (row.bulk_type as 'all' | 'lights' | null) ?? undefined,
      deviceIds: JSON.parse(row.device_ids_json),
      originalPrompt: row.original_prompt,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at
    };
  }
}
