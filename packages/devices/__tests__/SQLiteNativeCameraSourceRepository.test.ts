import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SQLiteNativeCameraSourceRepository } from '../infrastructure/repositories/SQLiteNativeCameraSourceRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';

describe('SQLiteNativeCameraSourceRepository', () => {
  const dbPath = path.join(os.tmpdir(), `homepilot-native-camera-source-${process.pid}.db`);

  beforeEach(() => {
    SqliteDatabaseManager.closeAll();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.exec(`
      CREATE TABLE native_camera_sources (
        device_id TEXT PRIMARY KEY,
        host TEXT NOT NULL,
        rtsp_port INTEGER NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        rtsp_path TEXT NOT NULL,
        enabled INTEGER NOT NULL
      );
    `);
  });

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('returns the RTSP source in domain form for an enabled native camera', () => {
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.prepare(`
      INSERT INTO native_camera_sources (device_id, host, rtsp_port, username, password, rtsp_path, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('camera-1', '192.168.1.20', 554, 'admin', 'secret', '/stream', 1);

    const source = new SQLiteNativeCameraSourceRepository(dbPath).findByDeviceId('camera-1');

    expect(source).toEqual({
      deviceId: 'camera-1', host: '192.168.1.20', rtspPort: 554,
      username: 'admin', password: 'secret', rtspPath: '/stream', enabled: true,
    });
  });

  it('returns null when no native camera source exists', () => {
    expect(new SQLiteNativeCameraSourceRepository(dbPath).findByDeviceId('missing')).toBeNull();
  });
});