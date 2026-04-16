import { Database as SqliteDatabase } from 'better-sqlite3';
import { Home } from '../../domain/types';
import { HomeRepository } from '../../domain/repositories/HomeRepository';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';

/**
 * Interfaz interna para tipar las filas de la tabla 'homes'.
 */
interface HomeRow {
  id: string;
  owner_id: string;
  name: string;
  entity_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * SQLiteHomeRepository
 * 
 * Implementación sólida del repositorio de Hogares utilizando SQLite.
 * Sin uso de 'any' y alineado estrictamente con el esquema y dominio.
 */
export class SQLiteHomeRepository implements HomeRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  /**
   * Persiste un hogar utilizando semántica de UPSERT explícito.
   * Se actualizan todos los campos, incluyendo owner_id, asumiendo que la 
   * entidad de dominio es la fuente de verdad del estado actual.
   */
  public async saveHome(home: Home): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO homes (id, owner_id, name, entity_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW'))
      ON CONFLICT(id) DO UPDATE SET
        owner_id = excluded.owner_id,
        name = excluded.name,
        entity_version = excluded.entity_version,
        updated_at = STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')
    `);

    stmt.run(home.id, home.ownerId, home.name, home.entityVersion, home.createdAt);
  }

  /**
   * Recupera todos los hogares que pertenezcan a un usuario específico.
   */
  public async findHomesByUserId(userId: string): Promise<ReadonlyArray<Home>> {
    const stmt = this.db.prepare('SELECT * FROM homes WHERE owner_id = ?');
    const rows = stmt.all(userId) as HomeRow[];
    const result = rows.map(row => this.mapToEntity(row));
    if (process.env.NODE_ENV === 'test') {
      console.log(`[DB-DEBUG] findHomesByUserId(${userId}) -> found ${result.length} homes`);
    }
    return result;
  }

  /**
   * Intenta localizar un hogar por su identificador único.
   */
  public async findHomeById(homeId: string): Promise<Home | null> {
    const stmt = this.db.prepare('SELECT * FROM homes WHERE id = ?');
    const row = stmt.get(homeId) as HomeRow | undefined;

    if (!row) return null;

    return this.mapToEntity(row);
  }

  /**
   * Realiza la transformación de fila de base de datos a entidad de dominio.
   */
  private mapToEntity(row: HomeRow): Home {
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      entityVersion: row.entity_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
