import { Database as SqliteDatabase, Statement } from 'better-sqlite3';

/**
 * Reuses prepared statements instead of compiling the same SQL on every call.
 *
 * `db.prepare()` costs more than the simple indexed read it compiles, and the repositories call it once
 * per method invocation. That is most of the cost of the device lookup every Home Assistant state event
 * performs, of the three reads behind every authenticated request, and of the per-device writes a
 * reconciliation pass makes. better-sqlite3 statements are reusable and bound to the connection, which
 * `SqliteDatabaseManager` already keeps as one instance per path, so caching them by their SQL text is
 * safe and needs no invalidation.
 */
export class PreparedStatementCache {
  private readonly statements = new Map<string, Statement>();

  constructor(private readonly db: SqliteDatabase) {}

  public get(sql: string): Statement {
    let statement = this.statements.get(sql);
    if (!statement) {
      statement = this.db.prepare(sql);
      this.statements.set(sql, statement);
    }
    return statement;
  }
}
