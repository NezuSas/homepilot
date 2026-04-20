import { Database as SqliteDatabase } from 'better-sqlite3';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { SystemVariable, VariableScope } from '../domain/SystemVariable';
import { SystemVariableRepository, SetVariablePayload } from '../domain/SystemVariableRepository';

interface SystemVariableRow {
  id: string;
  scope: string;
  home_id: string | null;
  name: string;
  value: string;
  value_type: string;
  description: string | null;
  ttl_seconds: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * SQLite implementation of SystemVariableRepository.
 *
 * TTL enforcement is lazy: expired rows are filtered out on every read and
 * can be purged in bulk via deleteExpired().
 */
export class SqliteSystemVariableRepository implements SystemVariableRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  async upsert(payload: SetVariablePayload, idGenerator: () => string): Promise<SystemVariable> {
    const now = new Date().toISOString();
    const expiresAt =
      payload.ttlSeconds != null
        ? new Date(Date.now() + payload.ttlSeconds * 1000).toISOString()
        : null;

    // Try to find an existing row to preserve its id and created_at
    // We use 'IS ?' to properly handle NULL matches for home_id
    const existing = this.db
      .prepare(
        'SELECT id, created_at FROM system_variables WHERE scope = ? AND home_id IS ? AND name = ?'
      )
      .get(payload.scope, payload.homeId ?? null, payload.name) as
      | { id: string; created_at: string }
      | undefined;

    if (existing) {
      // UPDATE by Primary Key (always safe)
      this.db
        .prepare(
          `UPDATE system_variables SET
            value       = ?,
            value_type  = ?,
            description = ?,
            ttl_seconds = ?,
            expires_at  = ?,
            updated_at  = ?
          WHERE id = ?`
        )
        .run(
          payload.value,
          payload.valueType,
          payload.description ?? null,
          payload.ttlSeconds ?? null,
          expiresAt,
          now,
          existing.id
        );

      return this.mapRow({
        id: existing.id,
        scope: payload.scope,
        home_id: payload.homeId ?? null,
        name: payload.name,
        value: payload.value,
        value_type: payload.valueType,
        description: payload.description ?? null,
        ttl_seconds: payload.ttlSeconds ?? null,
        expires_at: expiresAt,
        created_at: existing.created_at,
        updated_at: now,
      });
    } else {
      // INSERT new row
      const id = idGenerator();
      this.db
        .prepare(
          `INSERT INTO system_variables
            (id, scope, home_id, name, value, value_type, description, ttl_seconds, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          payload.scope,
          payload.homeId ?? null,
          payload.name,
          payload.value,
          payload.valueType,
          payload.description ?? null,
          payload.ttlSeconds ?? null,
          expiresAt,
          now,
          now
        );

      return this.mapRow({
        id,
        scope: payload.scope,
        home_id: payload.homeId ?? null,
        name: payload.name,
        value: payload.value,
        value_type: payload.valueType,
        description: payload.description ?? null,
        ttl_seconds: payload.ttlSeconds ?? null,
        expires_at: expiresAt,
        created_at: now,
        updated_at: now,
      });
    }
  }

  async findByKey(
    scope: VariableScope,
    homeId: string | null,
    name: string
  ): Promise<SystemVariable | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM system_variables
         WHERE scope = ? AND home_id IS ? AND name = ?
           AND (expires_at IS NULL OR expires_at > STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))`
      )
      .get(scope, homeId ?? null, name) as SystemVariableRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  async findById(id: string): Promise<SystemVariable | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM system_variables
         WHERE id = ?
           AND (expires_at IS NULL OR expires_at > STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))`
      )
      .get(id) as SystemVariableRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  async listAll(filter?: { scope?: VariableScope; homeId?: string }): Promise<SystemVariable[]> {
    let sql =
      `SELECT * FROM system_variables
       WHERE (expires_at IS NULL OR expires_at > STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))`;
    const params: unknown[] = [];

    if (filter?.scope) {
      sql += ' AND scope = ?';
      params.push(filter.scope);
    }
    if (filter?.homeId !== undefined) {
      sql += ' AND home_id = ?';
      params.push(filter.homeId);
    }

    sql += ' ORDER BY scope, name ASC';

    const rows = this.db.prepare(sql).all(...params) as SystemVariableRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db
      .prepare('DELETE FROM system_variables WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  async deleteExpired(): Promise<number> {
    const result = this.db
      .prepare(
        `DELETE FROM system_variables
         WHERE expires_at IS NOT NULL AND expires_at <= STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')`
      )
      .run();
    return result.changes;
  }

  private mapRow(row: SystemVariableRow): SystemVariable {
    return {
      id: row.id,
      scope: row.scope as VariableScope,
      homeId: row.home_id,
      name: row.name,
      value: row.value,
      valueType: row.value_type as SystemVariable['valueType'],
      description: row.description,
      ttlSeconds: row.ttl_seconds,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
