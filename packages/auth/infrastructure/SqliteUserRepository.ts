import { Database } from 'better-sqlite3';
import { User, UserRole } from '../domain/User';

export class SqliteUserRepository {
  constructor(private db: Database) {}

  public async count(): Promise<number> {
    const stmt = this.db.prepare('SELECT count(*) as count FROM users');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  public async countActiveAdmins(): Promise<number> {
    const stmt = this.db.prepare("SELECT count(*) as count FROM users WHERE role = 'admin' AND is_active = 1");
    const row = stmt.get() as { count: number };
    return row.count;
  }

  public async findAll(): Promise<User[]> {
    const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at ASC');
    const rows = stmt.all() as any[];
    return rows.map(r => this.mapToDomain(r));
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

  public async updateRole(id: string, role: UserRole): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?');
    stmt.run(role, now, id);
  }

  /**
   * Updates user role ONLY if it doesn't violate the Minimum Admin rule.
   * Atomic operation using a subquery to count active admins.
   */
  public async updateRoleAtomic(id: string, newRole: UserRole): Promise<boolean> {
    const now = new Date().toISOString();
    // Logic: 
    // 1. If newRole is 'admin', it's always safe (adding an admin).
    // 2. If newRole is 'operator', we only update if (target is not an active admin) OR (count of active admins > 1).
    const stmt = this.db.prepare(`
      UPDATE users 
      SET role = ?, updated_at = ? 
      WHERE id = ? 
      AND (
        ? = 'admin' OR 
        role != 'admin' OR 
        is_active = 0 OR
        (SELECT count(*) FROM users WHERE role = 'admin' AND is_active = 1) > 1
      )
    `);
    const result = stmt.run(newRole, now, id, newRole);
    return result.changes > 0;
  }

  public async updateActiveState(id: string, isActive: boolean): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?');
    stmt.run(isActive ? 1 : 0, now, id);
  }

  /**
   * Updates active status ONLY if it doesn't violate the Minimum Admin rule.
   */
  public async updateActiveStateAtomic(id: string, isActive: boolean): Promise<boolean> {
    const now = new Date().toISOString();
    const is_active_val = isActive ? 1 : 0;
    // Logic:
    // 1. If isActive is true, it's always safe (activating a user).
    // 2. If isActive is false, we only update if (target is not an admin) OR (count of active admins > 1).
    const stmt = this.db.prepare(`
      UPDATE users 
      SET is_active = ?, updated_at = ? 
      WHERE id = ? 
      AND (
        ? = 1 OR 
        role != 'admin' OR 
        (SELECT count(*) FROM users WHERE role = 'admin' AND is_active = 1) > 1
      )
    `);
    const result = stmt.run(is_active_val, now, id, is_active_val);
    return result.changes > 0;
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
