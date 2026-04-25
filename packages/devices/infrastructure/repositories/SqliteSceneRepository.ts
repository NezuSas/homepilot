import type { Database } from 'better-sqlite3';
import { Scene, SceneAction } from '../../domain/Scene';
import { SceneRepository } from '../../domain/repositories/SceneRepository';

interface LocalSceneRow {
  id: string;
  home_id: string;
  room_id: string | null;
  name: string;
  actions: string; // JSON string — includes executionMode as top-level key
  created_at: string;
  updated_at: string;
}

/**
 * Payload JSON persistido en la columna `actions`.
 * Incluye executionMode para evitar cambiar el schema de la tabla.
 */
interface SceneJsonPayload {
  actions: SceneAction[];
  executionMode?: 'sequential' | 'parallel';
}

export class SqliteSceneRepository implements SceneRepository {
  constructor(private readonly db: Database) {}

  private mapRowToScene(row: LocalSceneRow): Scene {
    const raw = JSON.parse(row.actions) as unknown;

    // Backward-compatibility: formato antiguo era SceneAction[] directo
    if (Array.isArray(raw)) {
      return {
        id: row.id,
        homeId: row.home_id,
        roomId: row.room_id,
        name: row.name,
        actions: raw as SceneAction[],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }

    // Nuevo formato: { actions: SceneAction[], executionMode?: '...' }
    const payload = raw as SceneJsonPayload;
    return {
      id: row.id,
      homeId: row.home_id,
      roomId: row.room_id,
      name: row.name,
      actions: payload.actions,
      executionMode: payload.executionMode,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public async findSceneById(id: string): Promise<Scene | null> {
    const row = this.db.prepare('SELECT * FROM scenes WHERE id = ?').get(id) as LocalSceneRow | undefined;
    return row ? this.mapRowToScene(row) : null;
  }

  public async findScenesByHomeId(homeId: string): Promise<Scene[]> {
    const rows = this.db
      .prepare('SELECT * FROM scenes WHERE home_id = ? ORDER BY created_at DESC')
      .all(homeId) as LocalSceneRow[];
    return rows.map(r => this.mapRowToScene(r));
  }

  public async findAll(): Promise<Scene[]> {
    const rows = this.db.prepare('SELECT * FROM scenes ORDER BY created_at DESC').all() as LocalSceneRow[];
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

    const payload: SceneJsonPayload = {
      actions: scene.actions,
      ...(scene.executionMode !== undefined ? { executionMode: scene.executionMode } : {}),
    };

    stmt.run(
      scene.id,
      scene.homeId,
      scene.roomId,
      scene.name,
      JSON.stringify(payload),
      scene.createdAt,
      scene.updatedAt
    );
  }

  public async deleteScene(id: string): Promise<void> {
    this.db.prepare('DELETE FROM scenes WHERE id = ?').run(id);
  }
}
