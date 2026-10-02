import type { Database } from 'better-sqlite3';
import { Scene, SceneAction } from '../../domain/Scene';
import { SceneRepository } from '../../domain/repositories/SceneRepository';

interface LocalSceneRow {
  id: string;
  home_id: string;
  room_id: string | null;
  name: string;
  actions: string; // JSON string — includes executionMode as top-level key
  shared_user_ids: string;
  created_at: string;
  updated_at: string;
}

/**
 * Payload JSON persistido en la columna `actions`.
 * Incluye executionMode para evitar cambiar el schema de la tabla.
 */
interface SceneJsonPayload {
  actions: SceneAction[];
  userId?: string;
  executionMode?: 'sequential' | 'parallel';
  icon?: string;
  description?: string;
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
      userId: payload.userId,
      sharedUserIds: JSON.parse(row.shared_user_ids ?? '[]') as string[],
      description: payload.description,
      roomId: row.room_id,
      name: row.name,
      actions: payload.actions,
      executionMode: payload.executionMode,
      icon: payload.icon,
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
      INSERT INTO scenes (id, home_id, room_id, name, actions, created_at, updated_at, shared_user_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        home_id = excluded.home_id,
        room_id = excluded.room_id,
        name = excluded.name,
        actions = excluded.actions,
        shared_user_ids = excluded.shared_user_ids,
        updated_at = excluded.updated_at
    `);

    const payload: SceneJsonPayload = {
      actions: scene.actions,
      ...(scene.userId !== undefined ? { userId: scene.userId } : {}),
      ...(scene.executionMode !== undefined ? { executionMode: scene.executionMode } : {}),
      ...(scene.icon !== undefined ? { icon: scene.icon } : {}),
      ...(scene.description !== undefined ? { description: scene.description } : {}),
    };

    stmt.run(
      scene.id,
      scene.homeId,
      scene.roomId,
      scene.name,
      JSON.stringify(payload),
      scene.createdAt,
      scene.updatedAt,
      JSON.stringify(scene.sharedUserIds ?? [])
    );
  }

  public async deleteScene(id: string): Promise<void> {
    this.db.prepare('DELETE FROM scenes WHERE id = ?').run(id);
  }
}
