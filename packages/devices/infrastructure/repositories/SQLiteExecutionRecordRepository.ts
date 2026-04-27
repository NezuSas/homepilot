import { Database as SqliteDatabase } from 'better-sqlite3';
import { ExecutionRecordRepository } from '../../domain/repositories/ExecutionRecordRepository';
import { ExecutionRecord, SceneActionResult } from '../../domain/ExecutionRecord';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';

interface ExecutionRecordRow {
  id: string;
  source_type: string;
  source_id: string;
  status: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  action_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  correlation_id: string | null;
  summary: string | null;
  actions_json: string;
}

function isExecutionSourceType(value: string): value is ExecutionRecord['sourceType'] {
  return value === 'scene' || value === 'automation' || value === 'manual';
}

function isExecutionStatus(value: string): value is ExecutionRecord['status'] {
  return value === 'success' || value === 'partial' || value === 'failed';
}

export class SQLiteExecutionRecordRepository implements ExecutionRecordRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPathOrDb: string | SqliteDatabase) {
    if (typeof dbPathOrDb === 'string') {
      this.db = SqliteDatabaseManager.getInstance(dbPathOrDb);
    } else {
      this.db = dbPathOrDb;
    }
  }

  public async save(record: ExecutionRecord): Promise<void> {
    const t_save = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO execution_records (
        id, source_type, source_id, status, started_at, completed_at, 
        duration_ms, action_count, success_count, failed_count, 
        skipped_count, correlation_id, summary, actions_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.sourceType,
      record.sourceId,
      record.status,
      record.startedAt,
      record.completedAt,
      record.durationMs,
      record.actionCount,
      record.successCount,
      record.failedCount,
      record.skippedCount,
      record.correlationId || null,
      record.summary || null,
      JSON.stringify(record.actions)
    );

    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[SQLiteExecutionRecordRepository] save took ${Date.now() - t_save}ms`);
    }
  }

  public async findRecent(limit: number = 50): Promise<ReadonlyArray<ExecutionRecord>> {
    const stmt = this.db.prepare(`
      SELECT * FROM execution_records 
      ORDER BY started_at DESC 
      LIMIT ?
    `);

    const rows = stmt.all(limit) as ExecutionRecordRow[];
    return rows.map(row => this.mapToEntity(row));
  }

  public async findBySource(
    sourceType: 'scene' | 'automation' | 'manual',
    sourceId: string,
    limit: number = 50
  ): Promise<ReadonlyArray<ExecutionRecord>> {
    const stmt = this.db.prepare(`
      SELECT * FROM execution_records 
      WHERE source_type = ? AND source_id = ?
      ORDER BY started_at DESC 
      LIMIT ?
    `);

    const rows = stmt.all(sourceType, sourceId, limit) as ExecutionRecordRow[];
    return rows.map(row => this.mapToEntity(row));
  }

  public async findById(id: string): Promise<ExecutionRecord | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM execution_records 
      WHERE id = ?
    `);

    const row = stmt.get(id) as ExecutionRecordRow | undefined;
    if (!row) return null;

    return this.mapToEntity(row);
  }

  private mapToEntity(row: ExecutionRecordRow): ExecutionRecord {
    if (!isExecutionSourceType(row.source_type)) {
      throw new Error(`Invalid execution source_type: ${row.source_type}`);
    }
    if (!isExecutionStatus(row.status)) {
      throw new Error(`Invalid execution status: ${row.status}`);
    }

    let actions: SceneActionResult[];
    try {
      const parsed = JSON.parse(row.actions_json);
      if (!Array.isArray(parsed)) {
        throw new Error('actions_json is not an array');
      }
      actions = parsed as SceneActionResult[];
    } catch (err: unknown) {
      throw new Error(
        `Invalid execution actions_json for record ${row.id}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    return {
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationMs: row.duration_ms,
      actionCount: row.action_count,
      successCount: row.success_count,
      failedCount: row.failed_count,
      skippedCount: row.skipped_count,
      correlationId: row.correlation_id || undefined,
      summary: row.summary || undefined,
      actions
    };
  }
}
