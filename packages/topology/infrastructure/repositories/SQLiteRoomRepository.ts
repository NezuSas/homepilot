import { Database as SqliteDatabase } from 'better-sqlite3';
import { Room } from '../../domain/types';
import { RoomRepository } from '../../domain/repositories/RoomRepository';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';

/**
 * Interfaz interna para tipar las filas de la tabla 'rooms'.
 */
interface RoomRow {
  id: string;
  home_id: string;
  name: string;
  entity_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * SQLiteRoomRepository
 * 
 * Implementación sólida del repositorio de Habitaciones utilizando SQLite.
 * Sin uso de 'any' y alineado estrictamente con el esquema y dominio.
 */
export class SQLiteRoomRepository implements RoomRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  /**
   * Persiste una habitación utilizando semántica de UPSERT explícito.
   */
  public async saveRoom(room: Room): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO rooms (id, home_id, name, entity_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW'))
      ON CONFLICT(id) DO UPDATE SET
        home_id = excluded.home_id,
        name = excluded.name,
        entity_version = excluded.entity_version,
        updated_at = STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')
    `);

    stmt.run(room.id, room.homeId, room.name, room.entityVersion, room.createdAt);
  }

  /**
   * Retorna una lista inmutable de todas las habitaciones adscritas a un hogar específico.
   */
  public async findRoomsByHomeId(homeId: string): Promise<ReadonlyArray<Room>> {
    const stmt = this.db.prepare('SELECT * FROM rooms WHERE home_id = ?');
    const rows = stmt.all(homeId) as RoomRow[];

    return rows.map(row => this.mapToEntity(row));
  }

  /**
   * Busca una habitación específica por su identificador único.
   */
  public async findRoomById(roomId: string): Promise<Room | null> {
    const stmt = this.db.prepare('SELECT * FROM rooms WHERE id = ?');
    const row = stmt.get(roomId) as RoomRow | undefined;

    if (!row) return null;

    return this.mapToEntity(row);
  }

  /**
   * Realiza la transformación de fila de base de datos a entidad de dominio.
   */
  private mapToEntity(row: RoomRow): Room {
    return {
      id: row.id,
      homeId: row.home_id,
      name: row.name,
      entityVersion: row.entity_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
