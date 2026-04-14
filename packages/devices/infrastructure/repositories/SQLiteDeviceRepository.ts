import { Database as SqliteDatabase } from 'better-sqlite3';
import { Device } from '../../domain/types';
import { DeviceRepository } from '../../domain/repositories/DeviceRepository';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';

/**
 * Interfaz interna para tipar las filas de la tabla 'devices'.
 */
interface DeviceRow {
  id: string;
  home_id: string;
  room_id: string | null;
  external_id: string;
  name: string;
  type: string;
  vendor: string;
  status: string;
  last_known_state: string | null;
  entity_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * SQLiteDeviceRepository
 *
 * Implementación de persistencia local y durable para dispositivos.
 * Sigue estrictamente el modelo de Zero-Trust y las restricciones del esquema.
 */
export class SQLiteDeviceRepository implements DeviceRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = SqliteDatabaseManager.getInstance(dbPath);
  }

  /**
   * Persiste un dispositivo utilizando semántica de UPSERT explícito (por id).
   */
  public async saveDevice(device: Device): Promise<void> {
    const serializedState = this.serializeState(device.lastKnownState);

    const stmt = this.db.prepare(`
      INSERT INTO devices (
        id, home_id, room_id, external_id, name, type, vendor, status, last_known_state, entity_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW'))
      ON CONFLICT(id) DO UPDATE SET
        home_id = excluded.home_id,
        room_id = excluded.room_id,
        external_id = excluded.external_id,
        name = excluded.name,
        type = excluded.type,
        vendor = excluded.vendor,
        status = excluded.status,
        last_known_state = excluded.last_known_state,
        entity_version = excluded.entity_version,
        updated_at = STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')
    `);

    stmt.run(
      device.id,
      device.homeId,
      device.roomId,
      device.externalId,
      device.name,
      device.type,
      device.vendor,
      device.status,
      serializedState,
      device.entityVersion,
      device.createdAt
    );
  }

  /**
   * Recupera un dispositivo por su identificador interno único.
   */
  public async findDeviceById(deviceId: string): Promise<Device | null> {
    const stmt = this.db.prepare('SELECT * FROM devices WHERE id = ?');
    const row = stmt.get(deviceId) as DeviceRow | undefined;

    if (!row) return null;
    return this.mapToEntity(row);
  }

  /**
   * Recupera la bandeja de entrada de dispositivos pendientes de un hogar.
   * Filtra estrictamente por roomId IS NULL y status = 'PENDING'.
   */
  public async findInboxByHomeId(homeId: string): Promise<ReadonlyArray<Device>> {
    const stmt = this.db.prepare(`
      SELECT * FROM devices 
      WHERE home_id = ? AND room_id IS NULL AND status = 'PENDING'
    `);
    
    const rows = stmt.all(homeId) as DeviceRow[];
    return rows.map(row => this.mapToEntity(row));
  }

  /**
   * Recupera todos los dispositivos de todos los hogares.
   */
  public async findAll(): Promise<ReadonlyArray<Device>> {
    const stmt = this.db.prepare('SELECT * FROM devices');
    const rows = stmt.all() as DeviceRow[];
    return rows.map(row => this.mapToEntity(row));
  }

  /**
   * Recupera todos los dispositivos de un hogar sin filtros.
   */
  public async findAllByHomeId(homeId: string): Promise<ReadonlyArray<Device>> {
    const stmt = this.db.prepare('SELECT * FROM devices WHERE home_id = ?');
    const rows = stmt.all(homeId) as DeviceRow[];
    return rows.map(row => this.mapToEntity(row));
  }

  /**
   * Localiza un dispositivo basándose en su external_id y home_id.
   */
  public async findByExternalIdAndHomeId(externalId: string, homeId: string): Promise<Device | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM devices 
      WHERE external_id = ? AND home_id = ?
    `);
    
    const row = stmt.get(externalId, homeId) as DeviceRow | undefined;
    
    if (!row) return null;
    return this.mapToEntity(row);
  }

  /**
   * Localiza un dispositivo globalmente usando sólo el external_id.
   */
  public async findByExternalId(externalId: string): Promise<Device | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM devices 
      WHERE external_id = ?
    `);
    
    // Asumidos unívocos localmente o tomamos el primero
    const row = stmt.get(externalId) as DeviceRow | undefined;
    
    if (!row) return null;
    return this.mapToEntity(row);
  }

  /**
   * Mapea de fila de base de datos a entidad de Dominio.

   */
  private mapToEntity(row: DeviceRow): Device {
    return {
      id: row.id,
      homeId: row.home_id,
      roomId: row.room_id,
      externalId: row.external_id,
      name: row.name,
      type: row.type as Device['type'],
      vendor: row.vendor,
      status: row.status as Device['status'],
      lastKnownState: this.deserializeState(row.last_known_state),
      entityVersion: row.entity_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Helper privado y tipado para serializar estados JSON de dispositivos.
   */
  private serializeState(state: Record<string, unknown> | null | undefined): string | null {
    if (!state) return null;
    try {
      return JSON.stringify(state);
    } catch {
      return null;
    }
  }

  /**
   * Helper privado y tipado para deserializar estados JSON de dispositivos.
   */
  private deserializeState(raw: string | null): Record<string, unknown> | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
}
