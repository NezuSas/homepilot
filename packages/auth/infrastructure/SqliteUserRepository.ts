import { Database } from 'better-sqlite3';
import { User, UserRole } from '../domain/User';

export class SqliteUserRepository {
  constructor(private db: Database) {}

  public async count(): Promise<number> {
    const stmt = this.db.prepare('SELECT count(*) as count FROM users');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  public async seedInitialAdmin(admin: User): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      admin.id,
      admin.username,
      admin.passwordHash,
      admin.role,
      admin.isActive ? 1 : 0,
      admin.createdAt,
      admin.updatedAt
    );
  }

  public async findByUsername(username: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE');
    const row = stmt.get(username) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async findById(id: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  public async updatePassword(id: string, passwordHash: string): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?');
    stmt.run(passwordHash, now, id);
  }

  private mapToDomain(row: any): User {
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
