import { Dashboard, DashboardRepository } from '../../domain/Dashboard';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';

interface LocalDashboardRow {
  id: string;
  owner_id: string;
  title: string;
  visibility: string;
  tabs: string;
  created_at: string;
  updated_at: string;
}

export class SQLiteDashboardRepository implements DashboardRepository {
  constructor(private readonly dbPath: string) {}

  private getDb() {
    return SqliteDatabaseManager.getInstance(this.dbPath);
  }

  private mapRow(row: LocalDashboardRow): Dashboard {
    return {
      id: row.id,
      ownerId: row.owner_id,
      title: row.title,
      visibility: JSON.parse(row.visibility),
      tabs: JSON.parse(row.tabs),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async saveDashboard(dashboard: Dashboard): Promise<void> {
    const db = this.getDb();
    db.prepare(`
      INSERT INTO dashboards (id, owner_id, title, visibility, tabs, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        visibility=excluded.visibility,
        tabs=excluded.tabs,
        updated_at=excluded.updated_at
    `).run(
      dashboard.id,
      dashboard.ownerId,
      dashboard.title,
      JSON.stringify(dashboard.visibility),
      JSON.stringify(dashboard.tabs),
      dashboard.createdAt,
      dashboard.updatedAt
    );
  }

  public async findDashboardById(id: string): Promise<Dashboard | null> {
    const db = this.getDb();
    const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(id) as LocalDashboardRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  public async findAllVisibleTo(userId: string, userRole: string, homeIds: string[]): Promise<Dashboard[]> {
    const db = this.getDb();
    const rows = db.prepare('SELECT * FROM dashboards').all() as LocalDashboardRow[];
    const dashboards = rows.map(r => this.mapRow(r));
    
    return dashboards.filter(d => {
      if (d.ownerId === userId) return true;
      if (userRole === 'admin') return true;
      
      const v = d.visibility;
      if (v.roles?.includes(userRole)) return true;
      if (v.users?.includes(userId)) return true;
      if (v.homes?.some(h => homeIds.includes(h))) return true;
      
      return false;
    });
  }

  public async deleteDashboard(id: string): Promise<void> {
    const db = this.getDb();
    db.prepare('DELETE FROM dashboards WHERE id = ?').run(id);
  }
}
