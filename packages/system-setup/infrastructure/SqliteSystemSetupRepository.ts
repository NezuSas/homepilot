import { Database as SqliteDatabase } from 'better-sqlite3';
import { SystemSetupRepository, SystemSetupState } from '../domain/SystemSetupState';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';

interface SystemSetupRow {
  id: string;
  is_initialized: number;
  initialized_at: string | null;
  setup_version: number;
  onboarding_completed_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteSystemSetupRepository implements SystemSetupRepository {
  private db: SqliteDatabase;

  constructor(dbPath: string = 'homepilot.db') {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  public async getSetupState(): Promise<SystemSetupState> {
    const row = this.db.prepare('SELECT * FROM system_setup WHERE id = ?').get('local-edge') as SystemSetupRow | undefined;
    
    if (!row) {
      // Falback failsafe if migration insert ignored
      return {
        id: 'local-edge',
        isInitialized: false,
        initializedAt: null,
        setupVersion: 1,
        onboardingCompletedByUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    return {
      id: row.id,
      isInitialized: row.is_initialized === 1,
      initializedAt: row.initialized_at,
      setupVersion: row.setup_version,
      onboardingCompletedByUserId: row.onboarding_completed_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async markAsInitialized(userId: string): Promise<SystemSetupState> {
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      UPDATE system_setup 
      SET is_initialized = 1,
          initialized_at = ?,
          onboarding_completed_by_user_id = ?,
          updated_at = ?
      WHERE id = 'local-edge'
    `);

    stmt.run(now, userId, now);
    
    return this.getSetupState();
  }
}
