import { Database as SqliteDatabase } from 'better-sqlite3';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import { AssistantFeedbackEvent, FeedbackType } from '../../domain/AssistantFeedbackEvent';
import { AssistantFeedbackRepository } from '../../domain/repositories/AssistantFeedbackRepository';

interface FeedbackRow {
  id: string;
  finding_type: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  room_id: string | null;
  domain: string | null;
  action_type: string | null;
  feedback_type: string;
  created_at: string;
  metadata: string | null;
}

export class SQLiteAssistantFeedbackRepository implements AssistantFeedbackRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  public async save(event: AssistantFeedbackEvent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO assistant_feedback_events (
        id, finding_type, related_entity_type, related_entity_id, 
        room_id, domain, action_type, feedback_type, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id,
      event.findingType,
      event.relatedEntityType,
      event.relatedEntityId,
      event.roomId,
      event.domain,
      event.actionType,
      event.feedbackType,
      event.createdAt,
      JSON.stringify(event.metadata)
    );
  }

  public async findAll(): Promise<AssistantFeedbackEvent[]> {
    const rows = this.db.prepare('SELECT * FROM assistant_feedback_events ORDER BY created_at DESC').all() as FeedbackRow[];
    return rows.map(r => this.mapToEntity(r));
  }

  public async findByType(type: string): Promise<AssistantFeedbackEvent[]> {
    const rows = this.db.prepare('SELECT * FROM assistant_feedback_events WHERE finding_type = ? ORDER BY created_at DESC').all(type) as FeedbackRow[];
    return rows.map(r => this.mapToEntity(r));
  }

  public async findByRoom(roomId: string): Promise<AssistantFeedbackEvent[]> {
    const rows = this.db.prepare('SELECT * FROM assistant_feedback_events WHERE room_id = ? ORDER BY created_at DESC').all(roomId) as FeedbackRow[];
    return rows.map(r => this.mapToEntity(r));
  }

  public async getAggregateStats(): Promise<Record<string, number>> {
    // Simple count by finding_type and feedback_type
    const rows = this.db.prepare(`
      SELECT finding_type || ':' || feedback_type as key, COUNT(*) as count 
      FROM assistant_feedback_events 
      GROUP BY finding_type, feedback_type
    `).all() as { key: string; count: number }[];

    return Object.fromEntries(rows.map(r => [r.key, r.count]));
  }

  private mapToEntity(row: FeedbackRow): AssistantFeedbackEvent {
    return {
      id: row.id,
      findingType: row.finding_type as any,
      relatedEntityType: row.related_entity_type,
      relatedEntityId: row.related_entity_id,
      roomId: row.room_id,
      domain: row.domain,
      actionType: row.action_type,
      feedbackType: row.feedback_type as FeedbackType,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }
}
