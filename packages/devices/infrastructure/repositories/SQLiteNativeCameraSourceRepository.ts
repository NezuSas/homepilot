import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import type { NativeCameraSourceRepository, NativeCameraSource } from '../../domain/repositories/NativeCameraSourceRepository';

interface NativeCameraSourceRow {
  readonly device_id: string;
  readonly host: string;
  readonly rtsp_port: number;
  readonly username: string;
  readonly password: string;
  readonly rtsp_path: string;
  readonly enabled: number;
}

/**
 * Adaptador SQLite para fuentes de cámara local usadas por el proxy de medios.
 */
export class SQLiteNativeCameraSourceRepository implements NativeCameraSourceRepository {
  constructor(private readonly dbPath: string) {}

  findByDeviceId(deviceId: string): NativeCameraSource | null {
    const db = SqliteDatabaseManager.getInstance(this.dbPath);
    const row = db.prepare('SELECT device_id, host, rtsp_port, username, password, rtsp_path, enabled FROM native_camera_sources WHERE device_id = ?')
      .get(deviceId) as NativeCameraSourceRow | undefined;
    if (!row) return null;
    return {
      deviceId: row.device_id,
      host: row.host,
      rtspPort: row.rtsp_port,
      username: row.username,
      password: row.password,
      rtspPath: row.rtsp_path,
      enabled: row.enabled === 1,
    };
  }
}