import type { Device } from '../../../devices/domain/types';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import type { AndroidDisplaySource, AndroidDisplaySourceRepository } from '../domain/AndroidDisplaySource';

interface SourceRow {
  device_id: string; home_id: string; adb_host: string; adb_port: number; enabled: number;
  created_at: string; updated_at: string; adb_serial: string | null; android_id: string | null;
  manufacturer: string | null; model: string | null; android_version: string | null;
  resolution: string | null; density_dpi: number | null; screen_state: string;
  connection_state: string; last_seen_at: string | null;
}

const SELECT = `SELECT s.*, o.adb_serial, o.android_id, o.manufacturer, o.model,
  o.android_version, o.resolution, o.density_dpi, o.screen_state, o.connection_state, o.last_seen_at
  FROM android_display_sources s JOIN android_display_observations o ON o.device_id = s.device_id`;

export class SQLiteAndroidDisplaySourceRepository implements AndroidDisplaySourceRepository {
  constructor(private readonly dbPath: string) {}

  private get db() { return SqliteDatabaseManager.getInstance(this.dbPath); }

  private map(row: SourceRow): AndroidDisplaySource {
    return {
      deviceId: row.device_id, homeId: row.home_id, adbHost: row.adb_host, adbPort: 5555,
      enabled: row.enabled === 1, createdAt: row.created_at, updatedAt: row.updated_at,
      connectionState: row.connection_state as AndroidDisplaySource['connectionState'],
      lastSeenAt: row.last_seen_at,
      metadata: {
        adbSerial: row.adb_serial, androidId: row.android_id, manufacturer: row.manufacturer,
        model: row.model, androidVersion: row.android_version, resolution: row.resolution,
        densityDpi: row.density_dpi,
        screenState: row.screen_state as AndroidDisplaySource['metadata']['screenState'],
      },
    };
  }

  findByDeviceId(deviceId: string): AndroidDisplaySource | null {
    const row = this.db.prepare(`${SELECT} WHERE s.device_id = ?`).get(deviceId) as SourceRow | undefined;
    return row ? this.map(row) : null;
  }

  findByEndpoint(host: string, port: number): AndroidDisplaySource | null {
    const row = this.db.prepare(`${SELECT} WHERE s.adb_host = ? AND s.adb_port = ?`).get(host, port) as SourceRow | undefined;
    return row ? this.map(row) : null;
  }

  findByAndroidId(androidId: string): AndroidDisplaySource | null {
    const row = this.db.prepare(`${SELECT} WHERE o.android_id = ?`).get(androidId) as SourceRow | undefined;
    return row ? this.map(row) : null;
  }

  listByHomeId(homeId: string): ReadonlyArray<AndroidDisplaySource> {
    return (this.db.prepare(`${SELECT} WHERE s.home_id = ? ORDER BY s.created_at`).all(homeId) as SourceRow[])
      .map((row) => this.map(row));
  }

  createWithDevice(device: Device, source: AndroidDisplaySource): void {
    if (device.id !== source.deviceId || device.homeId !== source.homeId || device.integrationSource !== 'android-display') {
      throw new Error('INVALID_DISPLAY_DEVICE');
    }
    this.db.transaction(() => {
      this.db.prepare(`INSERT INTO devices
        (id, home_id, room_id, external_id, name, type, vendor, status, integration_source,
         invert_state, last_known_state, entity_version, created_at, updated_at, semantic_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`)
        .run(device.id, device.homeId, device.roomId, device.externalId, device.name,
          device.type, device.vendor, device.status, device.integrationSource,
          JSON.stringify(device.lastKnownState), device.entityVersion, device.createdAt,
          device.updatedAt, device.semanticType ?? null);
      this.db.prepare(`INSERT INTO android_display_sources
        (device_id, home_id, adb_host, adb_port, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(source.deviceId, source.homeId, source.adbHost, source.adbPort,
          source.enabled ? 1 : 0, source.createdAt, source.updatedAt);
      this.writeObservation(source);
    })();
  }

  updateObservation(source: AndroidDisplaySource): void {
    this.db.transaction(() => {
      this.writeObservation(source);
      this.db.prepare(`UPDATE devices SET last_known_state = ?, updated_at = ?
        WHERE id = ? AND integration_source = 'android-display'`)
        .run(JSON.stringify({ connectionState: source.connectionState,
          screenState: source.metadata.screenState }), source.updatedAt, source.deviceId);
    })();
  }

  private writeObservation(source: AndroidDisplaySource): void {
    const m = source.metadata;
    this.db.prepare(`INSERT INTO android_display_observations
      (device_id, adb_serial, android_id, manufacturer, model, android_version, resolution,
       density_dpi, screen_state, connection_state, last_seen_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
       adb_serial = excluded.adb_serial, android_id = excluded.android_id,
       manufacturer = excluded.manufacturer, model = excluded.model,
       android_version = excluded.android_version, resolution = excluded.resolution,
       density_dpi = excluded.density_dpi, screen_state = excluded.screen_state,
       connection_state = excluded.connection_state, last_seen_at = excluded.last_seen_at,
       updated_at = excluded.updated_at`)
      .run(source.deviceId, m.adbSerial, m.androidId, m.manufacturer, m.model,
        m.androidVersion, m.resolution, m.densityDpi, m.screenState,
        source.connectionState, source.lastSeenAt, source.updatedAt);
  }
}
