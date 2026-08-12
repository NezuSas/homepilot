import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import type { NativeCameraSourceRepository, NativeCameraSource, NativeCameraSourceType } from '../../domain/repositories/NativeCameraSourceRepository';

interface NativeCameraSourceRow {
  readonly device_id: string;
  readonly home_id: string;
  readonly source_type: NativeCameraSourceType;
  readonly name: string;
  readonly host: string;
  readonly onvif_port: number;
  readonly rtsp_port: number;
  readonly username: string;
  readonly password: string;
  readonly rtsp_path: string;
  readonly enabled: number;
  readonly created_at: string;
  readonly updated_at: string;
}

/**
 * Adaptador SQLite para fuentes de cámara local usadas por el proxy de medios.
 */
export class SQLiteNativeCameraSourceRepository implements NativeCameraSourceRepository {
  constructor(private readonly dbPath: string) {}

  findByDeviceId(deviceId: string): NativeCameraSource | null {
    const db = SqliteDatabaseManager.getInstance(this.dbPath);
    const row = db.prepare('SELECT * FROM native_camera_sources WHERE device_id = ?')
      .get(deviceId) as NativeCameraSourceRow | undefined;
    return row ? this.toSource(row) : null;
  }

  findByHomeId(homeId: string): ReadonlyArray<NativeCameraSource> {
    const db = SqliteDatabaseManager.getInstance(this.dbPath);
    const rows = db.prepare('SELECT * FROM native_camera_sources WHERE home_id = ? ORDER BY created_at ASC')
      .all(homeId) as NativeCameraSourceRow[];
    return rows.map((row) => this.toSource(row));
  }

  findDuplicate(homeId: string, host: string, rtspPort: number, rtspPath: string, excludedDeviceId?: string): NativeCameraSource | null {
    const db = SqliteDatabaseManager.getInstance(this.dbPath);
    const row = excludedDeviceId
      ? db.prepare('SELECT * FROM native_camera_sources WHERE home_id = ? AND host = ? AND rtsp_port = ? AND rtsp_path = ? AND device_id <> ? LIMIT 1')
        .get(homeId, host, rtspPort, rtspPath, excludedDeviceId) as NativeCameraSourceRow | undefined
      : db.prepare('SELECT * FROM native_camera_sources WHERE home_id = ? AND host = ? AND rtsp_port = ? AND rtsp_path = ? LIMIT 1')
        .get(homeId, host, rtspPort, rtspPath) as NativeCameraSourceRow | undefined;
    return row ? this.toSource(row) : null;
  }

  save(source: NativeCameraSource): void {
    const db = SqliteDatabaseManager.getInstance(this.dbPath);
    db.prepare(`INSERT INTO native_camera_sources (device_id, home_id, source_type, name, host, onvif_port, rtsp_port, username, password, rtsp_path, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET source_type = excluded.source_type, name = excluded.name, host = excluded.host, onvif_port = excluded.onvif_port, rtsp_port = excluded.rtsp_port, username = excluded.username, password = excluded.password, rtsp_path = excluded.rtsp_path, enabled = excluded.enabled, updated_at = excluded.updated_at`)
      .run(source.deviceId, source.homeId, source.sourceType, source.name, source.host, source.onvifPort, source.rtspPort, source.username, source.password, source.rtspPath, source.enabled ? 1 : 0, source.createdAt, source.updatedAt);
  }

  private toSource(row: NativeCameraSourceRow): NativeCameraSource {
    return {
      deviceId: row.device_id,
      homeId: row.home_id,
      sourceType: row.source_type || 'onvif-ptz',
      name: row.name,
      host: row.host,
      onvifPort: row.onvif_port,
      rtspPort: row.rtsp_port,
      username: row.username,
      password: row.password,
      rtspPath: row.rtsp_path,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}