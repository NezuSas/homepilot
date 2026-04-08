import { Database } from 'better-sqlite3';
import { Session } from '../domain/Session';

export class SqliteSessionRepository {
  constructor(private db: Database) {}

  public async createSession(session: Session): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(
      session.token,
      session.userId,
      session.expiresAt,
      session.createdAt
    );
  }

  public async getSessionByToken(token: string): Promise<Session | null> {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE token = ?');
    const row = stmt.get(token) as any;
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
    const stmt = this.db.prepare('DELETE FROM sessions WHERE token = ?');
    stmt.run(token);
  }

  public async deleteAllUserSessions(userId: string): Promise<number> {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE user_id = ?');
    const result = stmt.run(userId);
    return result.changes;
  }

  public async countActiveForUser(userId: string): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT count(*) as count 
      FROM sessions 
      WHERE user_id = ? AND expires_at > STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')
    `);
    const row = stmt.get(userId) as { count: number };
    return row.count;
  }
}
