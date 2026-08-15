import { Database } from 'better-sqlite3';
import type { DirectoryAccountLink, DirectoryLinkRepository, UsedSsoTokenRepository } from '../application/ports/DirectorySsoPorts';

export class SqliteDirectorySsoRepository implements DirectoryLinkRepository, UsedSsoTokenRepository {
  constructor(private readonly db: Database) {}
  async findByDirectoryAccountId(directoryAccountId: string): Promise<DirectoryAccountLink | null> { const row = this.db.prepare('SELECT * FROM directory_account_links WHERE directory_account_id = ?').get(directoryAccountId) as Row | undefined; return row ? map(row) : null; }
  async create(directoryAccountId: string, localUserId: string): Promise<void> { const now = new Date().toISOString(); this.db.prepare('INSERT INTO directory_account_links (directory_account_id,local_user_id,created_at,last_used_at) VALUES (?,?,?,?) ON CONFLICT(directory_account_id) DO UPDATE SET local_user_id=excluded.local_user_id,last_used_at=excluded.last_used_at').run(directoryAccountId, localUserId, now, now); }
  async delete(directoryAccountId: string, localUserId: string): Promise<boolean> { return this.db.prepare('DELETE FROM directory_account_links WHERE directory_account_id = ? AND local_user_id = ?').run(directoryAccountId, localUserId).changes === 1; }
  async listByLocalUserId(localUserId: string): Promise<DirectoryAccountLink[]> { return (this.db.prepare('SELECT * FROM directory_account_links WHERE local_user_id = ? ORDER BY created_at DESC').all(localUserId) as Row[]).map(map); }
  async linkAndConsume(directoryAccountId: string, localUserId: string, jti: string, expiresAt: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.prepare('INSERT INTO directory_account_links (directory_account_id,local_user_id,created_at,last_used_at) VALUES (?,?,?,?) ON CONFLICT(directory_account_id) DO UPDATE SET local_user_id=excluded.local_user_id,last_used_at=excluded.last_used_at').run(directoryAccountId, localUserId, now, now);
      this.db.prepare('INSERT INTO directory_sso_used_tokens (jti,used_at,expires_at) VALUES (?,?,?)').run(jti, now, expiresAt);
    })();
  }
  async isUsed(jti: string): Promise<boolean> { return Boolean(this.db.prepare('SELECT 1 FROM directory_sso_used_tokens WHERE jti = ?').get(jti)); }
  async markUsed(jti: string, expiresAt: string): Promise<void> { this.db.prepare('INSERT INTO directory_sso_used_tokens (jti,used_at,expires_at) VALUES (?,?,?)').run(jti, new Date().toISOString(), expiresAt); }
  async purgeExpired(): Promise<void> { this.db.prepare('DELETE FROM directory_sso_used_tokens WHERE expires_at <= ?').run(new Date().toISOString()); }
}
type Row={directory_account_id:string;local_user_id:string;created_at:string;last_used_at:string|null};
const map=(row:Row):DirectoryAccountLink=>({directoryAccountId:row.directory_account_id,localUserId:row.local_user_id,createdAt:row.created_at,lastUsedAt:row.last_used_at});