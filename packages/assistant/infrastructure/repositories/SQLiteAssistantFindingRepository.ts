import { Database as SqliteDatabase } from 'better-sqlite3';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import { AssistantFinding, FindingStatus, FindingType } from '../../domain/AssistantFinding';
import { AssistantFindingRepository } from '../../domain/repositories/AssistantFindingRepository';

interface FindingRow {
  id: string;
  fingerprint: string;
  source: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  status: string;
  actions: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  dismissed_at: string | null;
  resolved_at: string | null;
}

export class SQLiteAssistantFindingRepository implements AssistantFindingRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  public async save(finding: AssistantFinding): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO assistant_findings (
        id, fingerprint, source, type, severity, title, description, 
        related_entity_type, related_entity_id, status, actions, metadata, 
        created_at, updated_at, dismissed_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(fingerprint) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        actions = excluded.actions,
        metadata = excluded.metadata,
        updated_at = STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')
      WHERE status = 'open'
    `);

    stmt.run(
      finding.id,
      finding.fingerprint,
      finding.source,
      finding.type,
      finding.severity,
      finding.title,
      finding.description,
      finding.relatedEntityType,
      finding.relatedEntityId,
      finding.status,
      JSON.stringify(finding.actions || []),
      JSON.stringify(finding.metadata),
      finding.createdAt,
      finding.updatedAt,
      finding.dismissedAt,
      finding.resolvedAt
    );
  }

  public async findById(id: string): Promise<AssistantFinding | null> {
    const row = this.db.prepare('SELECT * FROM assistant_findings WHERE id = ?').get(id) as FindingRow | undefined;
    return row ? this.mapToEntity(row) : null;
  }

  public async findByFingerprint(fingerprint: string): Promise<AssistantFinding | null> {
    const row = this.db.prepare('SELECT * FROM assistant_findings WHERE fingerprint = ?').get(fingerprint) as FindingRow | undefined;
    return row ? this.mapToEntity(row) : null;
  }

  public async findAllOpen(): Promise<AssistantFinding[]> {
    const rows = this.db.prepare("SELECT * FROM assistant_findings WHERE status = 'open' ORDER BY created_at DESC").all() as FindingRow[];
    return rows.map(r => this.mapToEntity(r));
  }

  public async findAllByStatus(status: FindingStatus): Promise<AssistantFinding[]> {
    const rows = this.db.prepare('SELECT * FROM assistant_findings WHERE status = ? ORDER BY created_at DESC').all(status) as FindingRow[];
    return rows.map(r => this.mapToEntity(r));
  }

  public async updateStatus(id: string, status: FindingStatus): Promise<void> {
    const now = new Date().toISOString();
    let query = "UPDATE assistant_findings SET status = ?, updated_at = ?";
    const params: any[] = [status, now];

    if (status === 'dismissed') {
      query += ", dismissed_at = ?";
      params.push(now);
    } else if (status === 'resolved') {
      query += ", resolved_at = ?";
      params.push(now);
    }

    query += " WHERE id = ?";
    params.push(id);

    this.db.prepare(query).run(...params);
  }

  public async resolveMissing(currentFingerprints: string[]): Promise<number> {
    if (currentFingerprints.length === 0) {
      const result = this.db.prepare(`
        UPDATE assistant_findings 
        SET status = 'resolved', resolved_at = STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')
        WHERE status = 'open'
      `).run();
      return result.changes;
    }

    const placeholders = currentFingerprints.map(() => '?').join(',');
    const result = this.db.prepare(`
      UPDATE assistant_findings 
      SET status = 'resolved', resolved_at = STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')
      WHERE status = 'open' AND fingerprint NOT IN (${placeholders})
    `).run(...currentFingerprints);

    return result.changes;
  }

  public async getSummary(): Promise<{ totalOpen: number; bySeverity: Record<string, number>; byType: Record<string, number> }> {
    const total = this.db.prepare("SELECT COUNT(*) as count FROM assistant_findings WHERE status = 'open'").get() as { count: number };
    
    const severities = this.db.prepare("SELECT severity, COUNT(*) as count FROM assistant_findings WHERE status = 'open' GROUP BY severity").all() as { severity: string; count: number }[];
    const types = this.db.prepare("SELECT type, COUNT(*) as count FROM assistant_findings WHERE status = 'open' GROUP BY type").all() as { type: string; count: number }[];

    return {
      totalOpen: total.count,
      bySeverity: Object.fromEntries(severities.map(s => [s.severity, s.count])),
      byType: Object.fromEntries(types.map(t => [t.type, t.count]))
    };
  }

  private mapToEntity(row: FindingRow): AssistantFinding {
    return {
      id: row.id,
      fingerprint: row.fingerprint,
      source: row.source,
      type: row.type as FindingType,
      severity: row.severity as any,
      title: row.title,
      description: row.description,
      relatedEntityType: row.related_entity_type,
      relatedEntityId: row.related_entity_id,
      status: row.status as FindingStatus,
      actions: row.actions ? JSON.parse(row.actions) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      dismissedAt: row.dismissed_at,
      resolvedAt: row.resolved_at
    };
  }
}
