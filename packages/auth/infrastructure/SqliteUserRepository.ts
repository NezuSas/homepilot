import { Database } from 'better-sqlite3';
import { PreparedStatementCache } from '../../shared/infrastructure/database/PreparedStatementCache';
import { User, UserRole } from '../domain/User';
import type { AccessScope } from '../domain/roomAccess';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  is_active: number;
  display_name: string | null;
  avatar_data_uri: string | null;
  access_scope: AccessScope | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteUserRepository {
  constructor(private db: Database) {}

  // Verifying a token reads the session, the user and its room access on every authenticated request, and
  // compiling the SQL costs more than running it. Created on first use because the connection is injected.
  private statementCache?: PreparedStatementCache;
  private get statements(): PreparedStatementCache {
    if (!this.statementCache) this.statementCache = new PreparedStatementCache(this.db);
    return this.statementCache;
  }

  public async count(): Promise<number> {
    const stmt = this.statements.get('SELECT count(*) as count FROM users');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  public async countActiveAdmins(): Promise<number> {
    const stmt = this.statements.get("SELECT count(*) as count FROM users WHERE role = 'admin' AND is_active = 1");
    const row = stmt.get() as { count: number };
    return row.count;
  }

  public async findAll(): Promise<User[]> {
    const stmt = this.statements.get('SELECT * FROM users ORDER BY created_at ASC');
    const rows = stmt.all() as UserRow[];
    const roomIdsByUser = this.roomIdsByUser();
    return rows.map(r => this.mapToDomain(r, roomIdsByUser.get(r.id) ?? []));
  }

  public async seedInitialAdmin(admin: User): Promise<void> {
    const stmt = this.statements.get(`
      INSERT INTO users (id, username, password_hash, role, is_active, display_name, avatar_data_uri, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      admin.id,
      admin.username,
      admin.passwordHash,
      admin.role,
      admin.isActive ? 1 : 0,
      admin.displayName ?? null,
      admin.avatarDataUri ?? null,
      admin.createdAt,
      admin.updatedAt
    );
  }

  public async findByUsername(username: string): Promise<User | null> {
    const stmt = this.statements.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE');
    const row = stmt.get(username) as UserRow | undefined;
    if (!row) return null;
    return this.mapToDomain(row, this.roomIdsFor(row.id));
  }

  public async findById(id: string): Promise<User | null> {
    const stmt = this.statements.get('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as UserRow | undefined;
    if (!row) return null;
    return this.mapToDomain(row, this.roomIdsFor(row.id));
  }

  public async updatePassword(id: string, passwordHash: string): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.statements.get('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?');
    stmt.run(passwordHash, now, id);
  }

  public async updateRole(id: string, role: UserRole): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.statements.get('UPDATE users SET role = ?, updated_at = ? WHERE id = ?');
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
    // 2. Otherwise we only update if (target is not an active admin) OR (count of active admins > 1).
    const stmt = this.statements.get(`
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
    const stmt = this.statements.get('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?');
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
    const stmt = this.statements.get(`
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

  /** Replaces the user's room scope and expiry in one transaction. */
  public async updateAccess(id: string, scope: AccessScope, roomIds: readonly string[], expiresAt: string | null): Promise<void> {
    const now = new Date().toISOString();
    const apply = this.db.transaction(() => {
      this.statements.get('UPDATE users SET access_scope = ?, expires_at = ?, updated_at = ? WHERE id = ?').run(scope, expiresAt, now, id);
      this.statements.get('DELETE FROM user_room_access WHERE user_id = ?').run(id);
      const insert = this.statements.get('INSERT OR IGNORE INTO user_room_access (user_id, room_id) VALUES (?, ?)');
      for (const roomId of roomIds) insert.run(id, roomId);
    });
    apply();
  }

  public async updateProfile(id: string, displayName: string | null, avatarDataUri: string | null): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.statements.get('UPDATE users SET display_name = ?, avatar_data_uri = ?, updated_at = ? WHERE id = ?');
    stmt.run(displayName, avatarDataUri, now, id);
  }

  private roomIdsFor(userId: string): string[] {
    const rows = this.statements.get('SELECT room_id FROM user_room_access WHERE user_id = ? ORDER BY room_id').all(userId) as { room_id: string }[];
    return rows.map((row) => row.room_id);
  }

  private roomIdsByUser(): Map<string, string[]> {
    const rows = this.statements.get('SELECT user_id, room_id FROM user_room_access ORDER BY room_id').all() as { user_id: string; room_id: string }[];
    const byUser = new Map<string, string[]>();
    for (const row of rows) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row.room_id]);
    return byUser;
  }

  private mapToDomain(row: UserRow, roomIds: string[] = []): User {
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      isActive: row.is_active === 1,
      displayName: row.display_name ?? null,
      avatarDataUri: row.avatar_data_uri ?? null,
      accessScope: row.access_scope === 'rooms' ? 'rooms' : 'all',
      roomIds,
      expiresAt: row.expires_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
