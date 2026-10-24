import { Database } from 'better-sqlite3';
import { PreparedStatementCache } from '../../shared/infrastructure/database/PreparedStatementCache';
import { Session } from '../domain/Session';

interface SessionRow {
  token: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

const EXPIRED_SESSION_GRACE_MS = 24 * 60 * 60 * 1000;

export class SqliteSessionRepository {
  constructor(private db: Database) {}

  // Read on every authenticated request; the connection arrives from outside, so the cache is lazy.
  private statementCache?: PreparedStatementCache;
  private get statements(): PreparedStatementCache {
    if (!this.statementCache) this.statementCache = new PreparedStatementCache(this.db);
    return this.statementCache;
  }

  public async createSession(session: Session): Promise<void> {
    const stmt = this.statements.get(`
      INSERT INTO sessions (token, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(
      session.token,
      session.userId,
      session.expiresAt,
      session.createdAt
    );
    // Expired sessions are useless after a day; dropping them keeps the table from growing without limit.
    this.statements.get('DELETE FROM sessions WHERE expires_at < ?')
      .run(new Date(Date.now() - EXPIRED_SESSION_GRACE_MS).toISOString());
  }

  public async getSessionByToken(token: string): Promise<Session | null> {
    const stmt = this.statements.get('SELECT * FROM sessions WHERE token = ?');
    const row = stmt.get(token) as SessionRow | undefined;
    if (!row) return null;
    return {
      id: row.token,
      token: row.token,
      userId: row.user_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    };
  }

  public async deleteSession(token: string): Promise<void> {
    const stmt = this.statements.get('DELETE FROM sessions WHERE token = ?');
    stmt.run(token);
  }

  public async deleteAllUserSessions(userId: string): Promise<number> {
    const stmt = this.statements.get('DELETE FROM sessions WHERE user_id = ?');
    const result = stmt.run(userId);
    return result.changes;
  }

  public async countActiveForUser(userId: string): Promise<number> {
    const stmt = this.statements.get(`
      SELECT count(*) as count 
      FROM sessions 
      WHERE user_id = ? AND expires_at > STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')
    `);
    const row = stmt.get(userId) as { count: number };
    return row.count;
  }
}
