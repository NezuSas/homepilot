import { Database as SqliteDatabase } from 'better-sqlite3';
import { ActivityLogRepository, ActivityRecord, ActivityType } from '../../domain/repositories/ActivityLogRepository';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';

/**
 * Interfaz interna para tipar las filas de la tabla 'activity_logs'.
 */
interface ActivityLogRow {
  id: number;
  device_id: string;
  type: string;
  description: string;
  data: string | null;
  timestamp: string;
  correlation_id: string | null;
}

/**
 * SQLiteActivityLogRepository
 *
 * Implementación de persistencia local puramente append-only para registros de actividad.
 * Diseñado para casos de uso de Observabilidad V1.
 */
export class SQLiteActivityLogRepository implements ActivityLogRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  /**
   * Agrega un nuevo registro de actividad de forma inmutable.
   * La columna correlation_id se inserta como null temporalmente hasta
   * que se introduzca Observabilidad V2 (trazabilidad distribuida) en el Dominio.
   */
  public async saveActivity(record: ActivityRecord): Promise<void> {
    const serializedData = this.serializeData(record.data);
    const correlationId = record.correlationId || null;

    const stmt = this.db.prepare(`
      INSERT INTO activity_logs (device_id, type, description, data, timestamp, correlation_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.deviceId,
      record.type,
      record.description,
      serializedData,
      record.timestamp,
      correlationId
    );
  }

  /**
   * Recupera las entradas más recientes especificadas para un dispositivo.
   * Ordena según el timestamp de forma descendente (LIFO).
   */
  public async findRecentByDeviceId(deviceId: string, limit: number): Promise<ReadonlyArray<ActivityRecord>> {
    const stmt = this.db.prepare(`
      SELECT * FROM activity_logs 
      WHERE device_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    const rows = stmt.all(deviceId, limit) as ActivityLogRow[];
    
    return rows.map(row => this.mapToEntity(row));
  }

  public async findAllRecent(limit: number): Promise<ReadonlyArray<ActivityRecord>> {
    const stmt = this.db.prepare(`
      SELECT * FROM activity_logs 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    const rows = stmt.all(limit) as ActivityLogRow[];
    
    return rows.map(row => this.mapToEntity(row));
  }

  /**
   * Mapea de fila de base de datos a registro atómico del modelo de lectura.
   */
  private mapToEntity(row: ActivityLogRow): ActivityRecord {
    return {
      timestamp: row.timestamp,
      deviceId: row.device_id,
      type: row.type as ActivityType,
      description: row.description,
      data: this.deserializeData(row.data),
      ...(row.correlation_id ? { correlationId: row.correlation_id } : {})
    };
  }

  /**
   * Helper privado y tipado para serialización segura de payloads de auditoría.
   */
  private serializeData(data: Record<string, unknown> | undefined): string | null {
    if (!data || Object.keys(data).length === 0) return null;
    try {
      return JSON.stringify(data);
    } catch {
      return null;
    }
  }

  /**
   * Helper privado y tipado para deserialización controlada, previniendo fuga de nulos
   * y respetando el contrato estricto Record<string, unknown> del objeto de actividad.
   */
  private deserializeData(raw: string | null): Record<string, unknown> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
}
