import type { Database } from 'better-sqlite3';
import { Scene, SceneAction } from '../../domain/Scene';
import { SceneRepository } from '../../domain/repositories/SceneRepository';

interface LocalSceneRow {
  id: string;
  home_id: string;
  room_id: string | null;
  name: string;
  actions: string; // JSON string
  created_at: string;
  updated_at: string;
}

export class SqliteSceneRepository implements SceneRepository {
  constructor(private readonly db: Database) {}

  private mapRowToScene(row: LocalSceneRow): Scene {
    return {
      id: row.id,
      homeId: row.home_id,
      roomId: row.room_id,
      name: row.name,
      actions: JSON.parse(row.actions) as SceneAction[],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async findSceneById(id: string): Promise<Scene | null> {
    const row = this.db.prepare('SELECT * FROM scenes WHERE id = ?').get(id) as LocalSceneRow | undefined;
    return row ? this.mapRowToScene(row) : null;
  }

  public async findScenesByHomeId(homeId: string): Promise<Scene[]> {
    const rows = this.db.prepare('SELECT * FROM scenes WHERE home_id = ? ORDER BY created_at DESC').all(homeId) as LocalSceneRow[];
    return rows.map(r => this.mapRowToScene(r));
  }

  public async saveScene(scene: Scene): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO scenes (id, home_id, room_id, name, actions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        home_id = excluded.home_id,
        room_id = excluded.room_id,
        name = excluded.name,
        actions = excluded.actions,
        updated_at = excluded.updated_at
    `);
    
    stmt.run(
      scene.id,
      scene.homeId,
      scene.roomId,
      scene.name,
      JSON.stringify(scene.actions),
      scene.createdAt,
      scene.updatedAt
    );
  }

  public async deleteScene(id: string): Promise<void> {
    this.db.prepare('DELETE FROM scenes WHERE id = ?').run(id);
  }
}
