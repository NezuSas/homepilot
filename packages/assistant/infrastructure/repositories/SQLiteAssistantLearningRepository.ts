import { Database as SqliteDatabase } from 'better-sqlite3';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import { AssistantLearningEvent, LearningEventType } from '../../domain/AssistantLearningEvent';
import { AssistantLearningRepository } from '../../domain/repositories/AssistantLearningRepository';

interface LearningRow {
  id: string;
  user_id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  room_id: string | null;
  prompt: string | null;
  correction: string | null;
  metadata_json: string | null;
  created_at: string;
}

function isLearningEventType(value: string): value is LearningEventType {
  return [
    'device_used',
    'scene_used',
    'automation_used',
    'alias_created',
    'clarification_selected',
    'correction_received',
    'command_failed',
    'command_succeeded'
  ].includes(value);
}

export class SQLiteAssistantLearningRepository implements AssistantLearningRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  public async save(event: AssistantLearningEvent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO assistant_learning_events (
        id, user_id, event_type, entity_type, entity_id, entity_name, room_id, prompt, correction, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id,
      event.userId,
      event.eventType,
      event.entityType,
      event.entityId,
      event.entityName,
      event.roomId,
      event.prompt,
      event.correction,
      JSON.stringify(event.metadata),
      event.createdAt
    );
  }

  public async findByUserId(userId: string, limit: number = 100): Promise<AssistantLearningEvent[]> {
    const rows = this.db.prepare(`
      SELECT * FROM assistant_learning_events 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit) as LearningRow[];

    return rows.map(row => this.mapToEvent(row));
  }

  public async getMostUsedEntities(userId: string, entityType: string, limit: number = 5): Promise<Array<{ entityId: string; count: number }>> {
    const rows = this.db.prepare(`
      SELECT entity_id, COUNT(*) as count 
      FROM assistant_learning_events 
      WHERE user_id = ? AND entity_type = ? AND event_type IN ('device_used', 'scene_used', 'automation_used', 'command_succeeded')
      GROUP BY entity_id 
      ORDER BY count DESC 
      LIMIT ?
    `).all(userId, entityType, limit) as Array<{ entity_id: string; count: number }>;

    return rows.map(row => ({
      entityId: row.entity_id,
      count: row.count
    }));
  }

  public async getMostUsedRooms(userId: string, limit: number = 5): Promise<Array<{ roomId: string; count: number }>> {
    const rows = this.db.prepare(`
      SELECT room_id, COUNT(*) as count 
      FROM assistant_learning_events 
      WHERE user_id = ? AND room_id IS NOT NULL
      GROUP BY room_id 
      ORDER BY count DESC 
      LIMIT ?
    `).all(userId, limit) as Array<{ room_id: string; count: number }>;

    return rows.map(row => ({
      roomId: row.room_id,
      count: row.count
    }));
  }

  public async getRecentCorrections(userId: string, limit: number = 10): Promise<AssistantLearningEvent[]> {
    const rows = this.db.prepare(`
      SELECT * FROM assistant_learning_events 
      WHERE user_id = ? AND event_type = 'correction_received'
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit) as LearningRow[];

    return rows.map(row => this.mapToEvent(row));
  }

  private mapToEvent(row: LearningRow): AssistantLearningEvent {
    const eventType = row.event_type;
    if (!isLearningEventType(eventType)) {
      throw new Error(`Invalid learning event type: ${eventType}`);
    }

    return {
      id: row.id,
      userId: row.user_id,
      eventType,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityName: row.entity_name,
      roomId: row.room_id,
      prompt: row.prompt,
      correction: row.correction,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
      createdAt: row.created_at
    };
  }
}
